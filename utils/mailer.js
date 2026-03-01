const nodemailer = require('nodemailer');

// Configura o servidor de disparo (Ex: Gmail)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Função global que qualquer parte do sistema pode usar
const sendEmail = async (to, subject, htmlContent) => {
    try {
        await transporter.sendMail({
            from: `"Loja Professora Brenda" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            html: htmlContent
        });
        console.log(`✅ E-mail enviado com sucesso para: ${to}`);
        return true;
    } catch (error) {
        console.error(`❌ Erro ao enviar e-mail para ${to}:`, error);
        return false;
    }
};

module.exports = sendEmail;