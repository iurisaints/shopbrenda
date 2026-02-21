const multer = require('multer');
const path = require('path');

// Configuração de onde salvar
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Filtro de Segurança
const fileFilter = (req, file, cb) => {
    // ADICIONEI 'webp' AQUI NA LISTA
    const allowedExts = /jpeg|jpg|png|gif|webp|pdf|zip|rar|doc|docx/;
    
    // Verifica a extensão
    const extname = allowedExts.test(path.extname(file.originalname).toLowerCase());
    
    // Verifica o tipo do arquivo (Mimetype)
    const isMimeTypeValid = allowedExts.test(file.mimetype) || 
                            file.mimetype === 'application/octet-stream' || 
                            file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                            file.mimetype === 'application/msword';

    if (extname && isMimeTypeValid) {
        return cb(null, true);
    } else {
        console.log("❌ ARQUIVO BLOQUEADO:");
        console.log("--> Nome:", file.originalname);
        console.log("--> Mimetype:", file.mimetype);
        cb(new Error('Erro: Tipo de arquivo não suportado!'));
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
    fileFilter: fileFilter
});

module.exports = upload;