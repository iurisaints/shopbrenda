const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');
const sendEmail = require('../utils/mailer');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

const client = new MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN || 'SEU_TOKEN_AQUI', 
    options: { timeout: 5000 } 
});

// ==========================================
// 1. LISTAR MEUS PEDIDOS
// ==========================================
router.get('/', authenticateToken, async (req, res) => {
    try {
        const [orders] = await db.query('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
        
        if (orders.length === 0) return res.json([]);

        const ordersWithItems = await Promise.all(orders.map(async (order) => {
            const [items] = await db.query(`
                SELECT oi.*, p.file_url 
                FROM order_items oi
                LEFT JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = ?
            `, [order.id]);
            
            return { ...order, items };
        }));

        res.json(ordersWithItems);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 2. CRIAR CHECKOUT E ENVIAR E-MAIL DE COBRANÇA
// ==========================================
router.post('/create-checkout-session', authenticateToken, async (req, res) => {
    const { cartItems } = req.body;
    const user = req.user;

    if (!cartItems || cartItems.length === 0) return res.status(400).json({ error: "Carrinho vazio" });

    try {
        const total = cartItems.reduce((acc, item) => acc + parseFloat(item.price), 0);
        
        const [orderResult] = await db.query(
            "INSERT INTO orders (user_id, total, status, created_at) VALUES (?, ?, 'pending', NOW())", 
            [user.id, total]
        );
        const orderId = orderResult.insertId;

        const itemValues = cartItems.map(item => [orderId, item.id, item.title, item.price]);
        await db.query("INSERT INTO order_items (order_id, product_id, title, price) VALUES ?", [itemValues]);

        const [userRow] = await db.query("SELECT email FROM users WHERE id = ?", [user.id]);
        const payerEmail = (userRow && userRow[0] && userRow[0].email) ? userRow[0].email : null;
        if (!payerEmail) {
            return res.status(400).json({ error: 'E-mail do utilizador não encontrado. Atualize o seu perfil.' });
        }

        let currentUrl = process.env.SITE_URL || 'http://localhost:3000';
        let webhookUrl = `${currentUrl}/api/orders/webhook`;
        
        const preference = new Preference(client);
        const result = await preference.create({ body: {
            items: cartItems.map(item => ({
                id: item.id.toString(),
                title: item.title,
                quantity: 1,
                unit_price: Number(item.price),
                currency_id: 'BRL',
                picture_url: item.image_url
            })),
            payer: { name: user.name, email: payerEmail },
            back_urls: {
                success: `${currentUrl}/meus-pedidos.html`,
                failure: `${currentUrl}/index.html`,
                pending: `${currentUrl}/meus-pedidos.html`
            },
            auto_return: "approved",
            notification_url: webhookUrl,
            external_reference: orderId.toString(),
            statement_descriptor: "LOJA BRENDA"
        }});

        const paymentUrl = result.init_point;

        // Tenta guardar o link do Mercado Pago na base de dados (para o botão amarelo do frontend funcionar)
        try {
            await db.query("UPDATE orders SET payment_url = ? WHERE id = ?", [paymentUrl, orderId]);
        } catch (dbErr) {
            console.warn("Aviso: A coluna 'payment_url' pode não existir na tabela orders. O botão no frontend pode não funcionar.", dbErr.message);
        }

        // DISPARO DO E-MAIL: Aguardando Pagamento com o link
        const mailHtml = `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>O seu pedido #${orderId} está quase concluído!</h2>
                <p>Olá ${user.name}, recebemos o seu pedido. Para libertar o download dos seus materiais, finalize o pagamento clicando no botão abaixo:</p>
                <br>
                <a href="${paymentUrl}" style="padding: 12px 24px; background: #fbbf24; color: #000; font-weight: bold; text-decoration: none; border-radius: 5px;">PAGAR ENCOMENDA AGORA</a>
                <br><br>
                <p>Assim que o pagamento for aprovado, receberá um novo e-mail com os links para descarregar os seus ficheiros.</p>
            </div>
        `;
        sendEmail(payerEmail, `Aguardando Pagamento - Pedido #${orderId}`, mailHtml);

        try {
            await db.query('DELETE FROM user_cart_items WHERE user_id = ?', [user.id]);
        } catch (e) { /* ignora se a tabela não existir ainda */ }

        res.json({ url: paymentUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao criar pagamento" });
    }
});

// ==========================================
// 3. WEBHOOK (O MERCADO PAGO CHAMA AQUI)
// ==========================================

/** Verifica assinatura x-signature do Mercado Pago (HMAC SHA256). Retorna true se válida ou se secret não configurado. */
function verifyWebhookSignature(req) {
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (!secret || !secret.trim()) {
        return { verified: true, reason: 'MP_WEBHOOK_SECRET não configurado (webhook aceito sem verificação)' };
    }
    const xSignature = req.headers['x-signature'];
    const xRequestId = req.headers['x-request-id'] || '';
    const dataId = String(req.query['data.id'] ?? req.body?.data?.id ?? '').trim();
    if (!xSignature || !dataId) {
        return { verified: false, reason: 'x-signature ou data.id ausente' };
    }
    const parts = xSignature.split(',');
    let ts = '', hash = '';
    parts.forEach(part => {
        const [key, value] = part.split('=').map(s => (s || '').trim());
        if (key === 'ts') ts = value || '';
        if (key === 'v1') hash = value || '';
    });
    if (!ts || !hash) {
        return { verified: false, reason: 'x-signature sem ts ou v1' };
    }
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    if (expected !== hash) {
        return { verified: false, reason: 'HMAC não confere' };
    }
    return { verified: true, reason: 'assinatura válida' };
}

router.post('/webhook', async (req, res) => {
    const paymentId = req.query.id || req.body?.data?.id;
    const type = (req.query.topic || req.body?.type || '').toLowerCase();

    const logCtx = `[webhook] topic=${type} paymentId=${paymentId || 'n/a'}`;

    // Resposta 200 imediata para o MP não reenviar por timeout
    res.sendStatus(200);

    const sig = verifyWebhookSignature(req);
    if (!sig.verified) {
        console.warn(`${logCtx} REJEITADO: ${sig.reason}. Configure MP_WEBHOOK_SECRET no painel do MP e em .env para produção.`);
        return;
    }
    if (process.env.MP_WEBHOOK_SECRET) {
        console.log(`${logCtx} assinatura OK`);
    }

    if (type !== 'payment' || !paymentId) {
        console.log(`${logCtx} ignorado (tipo não é payment ou id ausente)`);
        return;
    }

    (async () => {
        try {
            const payment = new Payment(client);
            const paymentInfo = await payment.get({ id: paymentId });
            const status = (paymentInfo.status || '').toLowerCase();
            const orderIdRaw = paymentInfo.external_reference;
            const orderId = orderIdRaw != null ? parseInt(String(orderIdRaw), 10) : NaN;

            console.log(`[webhook] paymentId=${paymentId} status=${status} external_reference=${orderIdRaw}`);

            if (!Number.isInteger(orderId) || orderId < 1) {
                console.warn(`[webhook] paymentId=${paymentId} external_reference inválido ou ausente, ignorado`);
                return;
            }

            const [orderRows] = await db.query('SELECT id, status FROM orders WHERE id = ?', [orderId]);
            if (orderRows.length === 0) {
                console.warn(`[webhook] orderId=${orderId} não existe no banco, ignorado`);
                return;
            }
            const currentStatus = orderRows[0].status;

            switch (status) {
                case 'approved': {
                    if (currentStatus === 'paid') {
                        console.log(`[webhook] orderId=${orderId} já estava pago (idempotente), ignorado`);
                        return;
                    }
                    const [updated] = await db.query(
                        "UPDATE orders SET status = 'paid' WHERE id = ? AND status = 'pending'",
                        [orderId]
                    );
                    if (updated.affectedRows === 0) {
                        console.warn(`[webhook] orderId=${orderId} não atualizado (status atual: ${currentStatus})`);
                        return;
                    }
                    console.log(`[webhook] orderId=${orderId} marcado como pago`);

                    const [users] = await db.query(
                        'SELECT u.name, u.email FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = ?',
                        [orderId]
                    );
                    const [items] = await db.query(
                        'SELECT oi.title, p.file_url FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?',
                        [orderId]
                    );
                    if (users.length > 0) {
                        await enviarEmailComProduto(users[0].email, users[0].name, orderId, items);
                        console.log(`[webhook] orderId=${orderId} e-mail de entrega enviado`);
                    }
                    break;
                }
                case 'rejected':
                case 'cancelled':
                    console.log(`[webhook] orderId=${orderId} status=${status} (não aprovado), nenhuma alteração no pedido`);
                    break;
                case 'refunded':
                case 'charged_back':
                    console.log(`[webhook] orderId=${orderId} status=${status} — considerar reverter entrega manualmente se necessário`);
                    break;
                case 'pending':
                case 'in_process':
                case 'in_mediation':
                    console.log(`[webhook] orderId=${orderId} status=${status} (aguardando), nenhuma ação`);
                    break;
                default:
                    console.log(`[webhook] orderId=${orderId} status desconhecido: ${status}`);
            }
        } catch (err) {
            console.error(`[webhook] ERRO ao processar paymentId=${paymentId}:`, err.message);
            if (err.response) console.error('[webhook] resposta MP:', err.response?.status, err.response?.data);
        }
    })();
});

// ==========================================
// 4. E-MAIL DE SUCESSO E ENTREGA DOS FICHEIROS
// ==========================================
async function enviarEmailComProduto(userEmail, userName, orderId, items) {
    let linksHtml = '';
    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';

    items.forEach(item => {
        if (item.file_url) {
            const filename = item.file_url.split(/[/\\]/).pop();
            const downloadUrl = `${siteUrl}/api/download/${filename}`;
            linksHtml += `<li style="margin-bottom: 10px;"><strong>${item.title}:</strong> <br> <a href="${downloadUrl}" style="color: #2563eb; text-decoration: none; font-weight: bold;">📥 Clique aqui para descarregar</a></li>`;
        } else {
            linksHtml += `<li style="margin-bottom: 10px;"><strong>${item.title}:</strong> <span style="color: #ef4444;">Ficheiro indisponível temporariamente.</span></li>`;
        }
    });

    const mensagemHtml = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #0f172a; padding: 20px; text-align: center; color: white;">
                <h2 style="margin: 0;">Pagamento Aprovado! 🎉</h2>
            </div>
            <div style="padding: 20px;">
                <p>Olá, <strong>${userName}</strong>!</p>
                <p>Obrigado por comprar na <b>Loja Professora Brenda</b>. O seu pedido <strong>#${orderId}</strong> já está processado e os seus materiais estão prontos.</p>
                <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0;">
                    <h3 style="margin-top: 0; font-size: 16px;">Os seus Materiais:</h3>
                    <ul style="padding-left: 20px; margin: 0;">${linksHtml}</ul>
                </div>
            </div>
        </div>
    `;

    // Dispara através do nosso carteiro central
    sendEmail(userEmail, `O seu material chegou! Pedido #${orderId} 🚀`, mensagemHtml);
}

module.exports = router;