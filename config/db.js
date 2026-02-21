const mysql = require('mysql2');


// Cria um Pool de conexões (Melhor para produção que createConnection)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Promisify para usar async/await
const promisePool = pool.promise();
// TESTE DE CONEXÃO DIRETA PARA O RAILWAY
db.getConnection()
    .then(conn => {
        console.log("🟢 BINGO! Conectado ao banco de dados com sucesso!");
        conn.release();
    })
    .catch(err => {
        console.log("🔴 ALERTA VERMELHO! O banco não conectou. Motivo:");
        console.error(err);
    });


module.exports = promisePool;

