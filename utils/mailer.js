const nodemailer = require('nodemailer');

// Configuração forçada para IPv4 e TLS explícito
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // true para a porta 465
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false // Evita bloqueios de certificados no Railway/Deploy
    }
});

// Função global que qualquer parte do sistema pode usar
const sendEmail = async (to, subject, htmlContent) => {
    try {
        await transporter.sendMail({
            from: `"Loja Profa. Brenda" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            html: htmlContent
        });
        console.log(`✅ E-mail enviado com sucesso para: ${to}`);
        return true;
    } catch (error) {
        console.error(`❌ Erro ao enviar e-mail para ${to}:`, error.message);
        return false;
    }
};

module.exports = sendEmail;