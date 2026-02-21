const mysql = require('mysql2/promise');

const dbHost = process.env.MYSQLHOST || process.env.DB_HOST || 'localhost';
const dbPort = process.env.MYSQLPORT || process.env.DB_PORT || 3306;
const dbUser = process.env.MYSQLUSER || process.env.DB_USER || 'root';
const dbPassword = process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '';
const dbName = process.env.MYSQLDATABASE || process.env.DB_NAME || 'railway';

const db = mysql.createPool({
    host: dbHost,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    port: dbPort,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection()
    .then(conn => {
        console.log("🟢 BINGO! Conexão com o banco de dados MySQL estabelecida com sucesso!");
        conn.release();
    })
    .catch(err => {
        console.log("🔴 ALERTA VERMELHO! O servidor não conseguiu conectar ao banco de dados.");
        console.error("👉 MOTIVO EXATO:", err.code, err.message);
    });

module.exports = db;

