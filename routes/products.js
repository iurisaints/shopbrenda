const express = require('express');
const router = express.Router();
const db = require('../config/db');
const upload = require('../middleware/upload');
const authenticateToken = require('../middleware/auth');

// O Multer configurado para receber até 5 imagens na galeria!
const uploadFields = upload.fields([
    { name: 'gallery', maxCount: 5 }, 
    { name: 'file', maxCount: 1 }   
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

// --- CRIAR PRODUTO COM GALERIA (POST) ---
router.post('/', authenticateToken, uploadFields, async (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);

    const { title, price, category, description, is_offer } = req.body;
    const offerValue = (is_offer === 'true' || is_offer === '1') ? 1 : 0;
    
    let coverUrl = 'https://via.placeholder.com/150';
    let fileUrl = null;
    let extraImages = [];

    // Lógica da Galeria: A foto 0 é a Capa, as outras vão pro carrossel
    if (req.files && req.files['gallery']) {
        const files = req.files['gallery'];
        coverUrl = `${req.protocol}://${req.get('host')}/uploads/${files[0].filename}`; 
        
        for (let i = 1; i < files.length; i++) {
            extraImages.push(`${req.protocol}://${req.get('host')}/uploads/${files[i].filename}`);
        }
    }

    if (req.files && req.files['file']) {
        fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.files['file'][0].filename}`;
    }

    try {
        // 1. Salva a Capa na tabela principal
        const [result] = await db.query(
            "INSERT INTO products (title, price, category, description, image_url, file_url, is_offer) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [title, price, category, description, coverUrl, fileUrl, offerValue]
        );
        const productId = result.insertId;

        // 2. Salva as fotos extras na tabela de galeria
        if (extraImages.length > 0) {
            const values = extraImages.map(url => [productId, url]);
            await db.query("INSERT INTO product_images (product_id, image_url) VALUES ?", [values]);
        }

        res.json({ message: "Produto criado com sucesso!", id: productId });
    } catch (err) {
        console.error("Erro ao salvar:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- EDITAR PRODUTO COM GALERIA (PUT) ---
router.put('/:id', authenticateToken, uploadFields, async (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);

    const productId = req.params.id;
    const { title, price, category, description, is_offer } = req.body;
    const offerValue = (is_offer === 'true' || is_offer === '1') ? 1 : 0;

    try {
        const [oldProduct] = await db.query("SELECT image_url, file_url FROM products WHERE id = ?", [productId]);
        if (oldProduct.length === 0) return res.status(404).json({ error: "Produto não encontrado." });

        let coverUrl = oldProduct[0].image_url;
        let fileUrl = oldProduct[0].file_url;
        let extraImages = [];
        let hasNewImages = false;

        // Lógica de Atualização da Galeria
        if (req.files && req.files['gallery']) {
            hasNewImages = true;
            const files = req.files['gallery'];
            coverUrl = `${req.protocol}://${req.get('host')}/uploads/${files[0].filename}`;
            
            for (let i = 1; i < files.length; i++) {
                extraImages.push(`${req.protocol}://${req.get('host')}/uploads/${files[i].filename}`);
            }
        }

        if (req.files && req.files['file']) {
            fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.files['file'][0].filename}`;
        }

        // 1. Atualiza a tabela principal
        await db.query(
            "UPDATE products SET title = ?, price = ?, category = ?, description = ?, image_url = ?, file_url = ?, is_offer = ? WHERE id = ?",
            [title, price, category, description, coverUrl, fileUrl, offerValue, productId]
        );

        // 2. Se mandou fotos novas, zera a galeria velha e insere as novas
        if (hasNewImages) {
            await db.query("DELETE FROM product_images WHERE product_id = ?", [productId]);
            
            if (extraImages.length > 0) {
                const values = extraImages.map(url => [productId, url]);
                await db.query("INSERT INTO product_images (product_id, image_url) VALUES ?", [values]);
            }
        }

        res.json({ message: "Produto atualizado com sucesso!" });
    } catch (err) {
        console.error("Erro ao atualizar:", err);
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