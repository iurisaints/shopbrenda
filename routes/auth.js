const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../utils/mailer');

const JWT_SECRET = process.env.JWT_SECRET;

// ==========================================
// 1. REGISTO (CRIAR CONTA E ENVIAR E-MAIL)
// ==========================================
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) return res.status(400).json({ error: 'O e-mail já está em uso.' });

        const hashedPassword = await bcrypt.hash(password, 10);
        
        await db.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email, hashedPassword, 'user']);
        
        // E-mail de Boas-vindas
        const mailHtml = `
            <h2>Bem-vinda(o) à Loja da Professora Brenda!</h2>
            <p>Olá ${name}! A sua conta foi criada com sucesso.</p>
            <p>Agora já pode favoritar materiais, acompanhar as suas encomendas e descarregar os seus ficheiros digitais diretamente na plataforma.</p>
        `;
        await sendEmail(email, "Bem-vinda(o)! Confirmação de Registo", mailHtml);

        res.json({ message: 'Conta criada com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 2. LOGIN NORMAL
// ==========================================
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(401).json({ error: 'Credenciais inválidas.' });

        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Credenciais inválidas.' });

        const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 3. RECUPERAR PALAVRA-PASSE (GERAR LINK)
// ==========================================
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(404).json({ error: 'E-mail não encontrado.' });

        const user = users[0];
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiration = new Date(Date.now() + 3600000); // 1 hora de validade

        // Guarda o token de recuperação na base de dados (Exige as colunas reset_token e reset_token_expires na tabela users)
        await db.query('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?', [resetToken, tokenExpiration, user.id]);

        const currentUrl = process.env.SITE_URL || 'http://localhost:3000';
        const resetLink = `${currentUrl}/nova-senha.html?token=${resetToken}`;

        const mailHtml = `
            <h2>Recuperação de Palavra-passe</h2>
            <p>Olá ${user.name}, solicitou a redefinição da sua palavra-passe. Clique no botão abaixo para criar uma nova:</p>
            <br>
            <a href="${resetLink}" style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">Redefinir Palavra-passe</a>
            <br><br>
            <p>Se não solicitou esta alteração, apenas ignore este e-mail.</p>
        `;
        
        const success = await sendEmail(email, "Recuperação de Palavra-passe - Professora Brenda", mailHtml);
        
        if (success) {
            res.json({ message: 'E-mail de recuperação enviado.' });
        } else {
            res.status(500).json({ error: 'Falha ao enviar e-mail.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 4. REDEFINIR A PALAVRA-PASSE (GUARDAR NOVA)
// ==========================================
router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        const [users] = await db.query('SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()', [token]);
        
        if (users.length === 0) return res.status(400).json({ error: 'Token inválido ou expirado.' });

        const user = users[0];
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Atualiza a palavra-passe e limpa o token de recuperação
        await db.query('UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?', [hashedPassword, user.id]);

        res.json({ message: 'Palavra-passe atualizada com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;