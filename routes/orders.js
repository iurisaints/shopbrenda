const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');
const sendEmail = require('../utils/mailer'); // Importamos o nosso carteiro central
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
            payer: { name: user.name, email: 'test_user_exemplo@test.com' },
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
        // Nota: Assumindo que req.user tem o email. Se não tiver, terá de fazer um SELECT na base de dados pelo user.id
        const [userDb] = await db.query("SELECT email FROM users WHERE id = ?", [user.id]);
        if (userDb.length > 0) {
            await sendEmail(userDb[0].email, `Aguardando Pagamento - Pedido #${orderId}`, mailHtml);
        }

        res.json({ url: paymentUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao criar pagamento" });
    }
});

// ==========================================
// 3. WEBHOOK (O MERCADO PAGO CHAMA AQUI)
// ==========================================
router.post('/webhook', async (req, res) => {
    const paymentId = req.query.id || req.body?.data?.id;
    const type = req.query.topic || req.body?.type;

    res.sendStatus(200);

    if (type === 'payment' && paymentId) {
        try {
            const payment = new Payment(client);
            const paymentInfo = await payment.get({ id: paymentId });

            const status = paymentInfo.status;
            const orderId = paymentInfo.external_reference;

            if (status === 'approved' && orderId) {
                const [checkOrder] = await db.query("SELECT status FROM orders WHERE id = ?", [orderId]);
                if (checkOrder.length > 0 && checkOrder[0].status === 'paid') return; 

                await db.query("UPDATE orders SET status = 'paid' WHERE id = ?", [orderId]);
                
                const [users] = await db.query(`SELECT u.name, u.email FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = ?`, [orderId]);
                const [items] = await db.query(`SELECT oi.title, p.file_url FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?`, [orderId]);

                if (users.length > 0) {
                    enviarEmailComProduto(users[0].email, users[0].name, orderId, items);
                }
            }
        } catch (error) {
            console.error("❌ Erro ao processar pagamento do Webhook:", error);
        }
    }
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
    await sendEmail(userEmail, `O seu material chegou! Pedido #${orderId} 🚀`, mensagemHtml);
}

module.exports = router;