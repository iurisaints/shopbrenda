const express = require('express');
const router = express.Router();
const db = require('../config/db');
const upload = require('../middleware/upload');
const authenticateToken = require('../middleware/auth');

// 1. A MÁGICA AQUI: Os nomes exatos que o front-end envia ('image' e 'file')
const uploadFields = upload.fields([
    { name: 'image', maxCount: 1 }, // A foto de capa
    { name: 'file', maxCount: 1 }   // O arquivo PDF/Digital
]);

// --- LISTAR PRODUTOS (GET) ---
router.get('/', async (req, res) => {
    const { search, category } = req.query;
    let sql = `
        SELECT p.*, GROUP_CONCAT(pi.image_url) as gallery_images 
        FROM products p
        LEFT JOIN product_images pi ON p.id = pi.product_id
        WHERE 1=1
    `;
    let params = [];

    if (category && category !== 'Todas') { 
        sql += " AND p.category LIKE ?"; params.push(`%${category}%`); 
    }
    if (search) { 
        sql += " AND (p.title LIKE ? OR p.description LIKE ?)"; 
        params.push(`%${search}%`, `%${search}%`); 
    }

    sql += " GROUP BY p.id ORDER BY p.id DESC";

    try {
        const [results] = await db.query(sql, params);
        const products = results.map(p => ({
            ...p,
            gallery: p.gallery_images ? p.gallery_images.split(',') : (p.image_url ? [p.image_url] : [])
        }));
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- CRIAR PRODUTO (POST - ADMIN) ---
router.post('/', authenticateToken, uploadFields, async (req, res) => {
    // Verifica se é admin
    if (req.user.role !== 'admin') return res.sendStatus(403);

    const { title, price, category, description, is_offer } = req.body;
    
    let coverUrl = 'https://via.placeholder.com/150';
    let fileUrl = null;

    // 2. Se o front-end mandou a foto de capa, salva a URL dela
    if (req.files && req.files['image']) {
        coverUrl = `${req.protocol}://${req.get('host')}/uploads/${req.files['image'][0].filename}`;
    }
    
    // 3. Se o front-end mandou o arquivo digital, salva a URL dele
    if (req.files && req.files['file']) {
        fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.files['file'][0].filename}`;
    }

    // Transforma o switch de oferta em número (1 ou 0) para o banco de dados
    const offerValue = (is_offer === 'true' || is_offer === '1') ? 1 : 0;

    try {
        const [result] = await db.query(
            "INSERT INTO products (title, price, category, description, image_url, file_url, is_offer) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [title, price, category, description, coverUrl, fileUrl, offerValue]
        );

        res.json({ message: "Produto criado com sucesso!", id: result.insertId });
    } catch (err) {
        console.error("Erro ao salvar no banco:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- DELETAR PRODUTO (DELETE - ADMIN) ---
router.delete('/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    try {
        await db.query("DELETE FROM products WHERE id = ?", [req.params.id]);
        res.json({ message: "Produto deletado" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;