const nodemailer = require('nodemailer');

// Configuração Cloud-Friendly (Porta 587 com STARTTLS e forçando IPv4 no socket)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Falso para a porta 587
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false // Evita bloqueio de certificados no Railway
    }
});

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
        // Log simplificado para limpar o seu ecrã no Railway
        console.error(`❌ Erro ao enviar para ${to}: ${error.message}`);
        return false;
    }
};

module.exports = sendEmail;