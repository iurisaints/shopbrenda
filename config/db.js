const mysql = require('mysql2/promise');

// Cria um "Pool" de conexões (gerencia várias requisições ao mesmo tempo sem travar)
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT, // A PORTA É CRUCIAL NO RAILWAY!
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// ==========================================
// TESTE DE VIDA DO BANCO (O "Dedo Duro")
// ==========================================
db.getConnection()
    .then(conn => {
        console.log("🟢 BINGO! Conexão com o banco de dados MySQL estabelecida com sucesso!");
        conn.release(); // Libera a conexão de volta pro pool
    })
    .catch(err => {
        console.log("🔴 ALERTA VERMELHO! O servidor não conseguiu conectar ao banco de dados.");
        console.error("👉 MOTIVO EXATO:", err.message);
        console.log("👉 DICA: Verifique as variáveis DB_HOST, DB_USER, DB_PASSWORD, DB_NAME e DB_PORT no Railway.");
    });

module.exports = db;
