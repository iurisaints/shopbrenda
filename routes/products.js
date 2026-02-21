const express = require('express');
const router = express.Router();
const db = require('../config/db');
const upload = require('../middleware/upload');
const authenticateToken = require('../middleware/auth');

// Configuração dos campos de upload (Imagens + PDF)
const uploadFields = upload.fields([
    { name: 'images', maxCount: 5 }, 
    { name: 'productFile', maxCount: 1 }
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
    if (req.user.role !== 'admin') return res.sendStatus(403);

    const { title, price, category, description, is_offer } = req.body;
    
    // Tratamento de Arquivos
    let coverUrl = 'https://via.placeholder.com/150';
    let galleryPaths = [];
    let fileUrl = null;

    if (req.files['images']) {
        galleryPaths = req.files['images'].map(file => `${req.protocol}://${req.get('host')}/uploads/${file.filename}`);
        coverUrl = galleryPaths[0]; 
    }
    if (req.files['productFile']) {
        fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.files['productFile'][0].filename}`;
    }

    const offerValue = (is_offer === 'true' || is_offer === '1') ? 1 : 0;

    try {
        const [result] = await db.query(
            "INSERT INTO products (title, price, category, description, image_url, file_url, is_offer) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [title, price, category, description, coverUrl, fileUrl, offerValue]
        );

        const productId = result.insertId;

        // Salva Galeria
        if (galleryPaths.length > 0) {
            const values = galleryPaths.map(url => [productId, url]);
            await db.query("INSERT INTO product_images (product_id, image_url) VALUES ?", [values]);
        }

        res.json({ message: "Produto criado!", id: productId });
    } catch (err) {
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