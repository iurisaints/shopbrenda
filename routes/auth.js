const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_super_segura';

// Configuração de Email
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'seuemail@gmail.com',
        pass: process.env.EMAIL_PASS || 'sua_senha_app'
    }
});

// --- CADASTRO ---
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        // Verifica se email já existe
        const [existing] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) return res.status(400).json({ error: "Email já cadastrado" });

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hashedPassword]);

        // Envia Email
        transporter.sendMail({
            from: `"Loja Brenda" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Bem-vindo(a)!",
            html: `<h3>Olá ${name}!</h3><p>Sua conta foi criada com sucesso.</p>`
        }).catch(err => console.error("Erro email:", err));

        res.json({ message: "Usuário criado com sucesso!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- LOGIN ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(400).json({ error: "Usuário não encontrado" });

        const user = users[0];
        if (await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
            res.json({ message: "Logado", token, id: user.id, name: user.name, role: user.role });
        } else {
            res.status(400).json({ error: "Senha incorreta" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ESQUECI MINHA SENHA ---
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(404).json({ error: "Email não encontrado" });

        const token = crypto.randomBytes(20).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hora

        await db.query('INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)', [email, token, expires]);

        const link = `${process.env.SITE_URL || 'http://localhost:3000'}/reset-password.html?token=${token}`;
        
        transporter.sendMail({
            from: `"Loja Brenda" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Redefinir Senha",
            html: `<p>Clique aqui para redefinir sua senha: <a href="${link}">Redefinir</a></p>`
        });

        res.json({ message: "Email de recuperação enviado!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;