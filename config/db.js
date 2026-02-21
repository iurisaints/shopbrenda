const mysql = require('mysql2');

// Cria um Pool de conexões (Melhor para produção que createConnection)
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'brenda_shop',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Promisify para usar async/await
const promisePool = pool.promise();

console.log("--> Banco de Dados Configurado.");

module.exports = promisePool;