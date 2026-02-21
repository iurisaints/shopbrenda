const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// Railway404
app.use(express.static(__dirname));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rotas Importadas
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');

// Middlewares Globais
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve o Frontend (HTML/CSS/JS da raiz)
app.use(express.static(path.join(__dirname, '/')));

// Definição das Rotas da API
app.use('/api', authRoutes);      // /api/login, /api/register
app.use('/api/products', productRoutes); // /api/products

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/orders', require('./routes/orders'));

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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor voando na porta ${PORT}`);
    console.log(`📂 Lendo arquivos da pasta: ${__dirname}`);
});
