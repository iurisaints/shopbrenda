require('dotenv').config(); // Carrega variáveis do .env (se existir)
const express = require('express');
const cors = require('cors');
const path = require('path');

// Rotas Importadas
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');

const app = express();

// Middlewares Globais
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors());

// Pasta de Uploads Pública
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Serve o Frontend (HTML/CSS/JS da raiz)
app.use(express.static(path.join(__dirname, '/')));

// Definição das Rotas da API
app.use('/api', authRoutes);      // /api/login, /api/register
app.use('/api/products', productRoutes); // /api/products
app.use('/api/orders', orderRoutes);     // /api/orders

// Rota padrão para SPA (opcional, se usar React no futuro) ou 404
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ROTA DE DOWNLOAD (COM LOGS PARA DEBUG)
app.get('/api/download/:filename', (req, res) => {
    const filename = req.params.filename;
    // Garante que não haja espaços extras ou caracteres estranhos
    const cleanFilename = filename.trim(); 
    
    const filePath = path.join(__dirname, 'uploads', cleanFilename);

    console.log("--- TENTATIVA DE DOWNLOAD ---");
    console.log("1. Arquivo solicitado:", cleanFilename);
    console.log("2. Caminho completo buscado:", filePath);

    // Verifica se o arquivo existe antes de tentar baixar
    const fs = require('fs');
    if (fs.existsSync(filePath)) {
        console.log("3. STATUS: Arquivo ENCONTRADO! Enviando...");
        res.download(filePath, cleanFilename, (err) => {
            if (err) {
                console.error("4. ERRO NO ENVIO:", err);
                if (!res.headersSent) res.status(500).send("Erro ao baixar arquivo.");
            } else {
                console.log("5. SUCESSO: Download concluído.");
            }
        });
    } else {
        console.error("3. STATUS: ARQUIVO NÃO EXISTE NA PASTA!");
        // Lista arquivos que REALMENTE estão na pasta para ajudar a achar o erro
        const filesInFolder = fs.readdirSync(path.join(__dirname, 'uploads'));
        console.log("   -> Arquivos disponíveis na pasta uploads:", filesInFolder);
        
        res.status(404).send(`Erro: O arquivo '${cleanFilename}' não foi encontrado no servidor.`);
    }
});

// Inicialização
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando lindão na porta ${PORT}`);
    console.log(`📂 Uploads em: ${path.join(__dirname, 'uploads')}`);
});