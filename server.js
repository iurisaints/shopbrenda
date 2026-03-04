require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// Railway404
app.use(express.static(__dirname));

// Serve o Frontend (HTML/CSS/JS da raiz)
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rotas Importadas
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');

// Middlewares Globais — CORS restrito em produção (Railway)
const isProd = process.env.NODE_ENV === 'production';
let allowedOrigin = process.env.SITE_URL || null;
if (allowedOrigin) {
    try { allowedOrigin = new URL(allowedOrigin).origin; } catch (_) { allowedOrigin = process.env.SITE_URL; }
}
app.use(cors(isProd && allowedOrigin ? { origin: allowedOrigin, credentials: true } : {}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Definição das Rotas da API
app.use('/api', authRoutes);      // /api/login, /api/register
app.use('/api/products', productRoutes); // /api/products

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/user', require('./routes/userData'));

// TESTE DE VIDA DO SERVIDOR
app.get('/teste', (req, res) => {
    res.send("<h1>O servidor Node.js está vivo e respondendo!</h1>");
});

// ROTA DE DOWNLOAD — seguro contra path traversal (ex.: ../../../etc/passwd)
const fs = require('fs');
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');

app.get('/api/download/:filename', (req, res) => {
    // Usar apenas o nome do ficheiro, sem barras (evita path traversal)
    const safeFilename = path.basename(req.params.filename.trim());
    if (!safeFilename) {
        res.status(400).send('Nome de ficheiro inválido.');
        return;
    }

    const filePath = path.join(UPLOADS_DIR, safeFilename);
    const realPath = path.resolve(filePath);

    // Garantir que o ficheiro está dentro de uploads/
    if (!realPath.startsWith(UPLOADS_DIR)) {
        res.status(400).send('Pedido inválido.');
        return;
    }

    if (!fs.existsSync(realPath) || !fs.statSync(realPath).isFile()) {
        if (process.env.NODE_ENV !== 'production') {
            console.warn('Download não encontrado:', safeFilename);
        }
        res.status(404).send('Ficheiro não encontrado.');
        return;
    }

    res.download(realPath, safeFilename, (err) => {
        if (err && !res.headersSent) res.status(500).send('Erro ao transferir ficheiro.');
    });
});

// Inicialização
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor voando na porta ${PORT}`);
    console.log(`Lendo arquivos da pasta: ${__dirname}`);
});


