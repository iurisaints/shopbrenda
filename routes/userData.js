const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

// ==========================================
// FAVORITOS
// ==========================================

// GET /api/user/favorites — lista os IDs dos produtos favoritos do usuário
router.get('/favorites', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT product_id FROM user_favorites WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(rows.map(r => r.product_id));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/user/favorites — adiciona produto aos favoritos (body: { product_id })
router.post('/favorites', authenticateToken, async (req, res) => {
    const { product_id } = req.body;
    if (!product_id) return res.status(400).json({ error: 'product_id é obrigatório.' });
    try {
        await db.query(
            'INSERT IGNORE INTO user_favorites (user_id, product_id) VALUES (?, ?)',
            [req.user.id, product_id]
        );
        res.json({ added: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/user/favorites/:productId — remove dos favoritos
router.delete('/favorites/:productId', authenticateToken, async (req, res) => {
    const productId = parseInt(req.params.productId, 10);
    if (isNaN(productId)) return res.status(400).json({ error: 'ID de produto inválido.' });
    try {
        const [result] = await db.query(
            'DELETE FROM user_favorites WHERE user_id = ? AND product_id = ?',
            [req.user.id, productId]
        );
        res.json({ removed: result.affectedRows > 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// CARRINHO
// ==========================================

// GET /api/user/cart — lista itens do carrinho com dados do produto (para exibir no modal e no checkout)
router.get('/cart', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT p.id, p.title, p.price, p.image_url, p.category, p.description, p.file_url, p.is_offer
             FROM user_cart_items c
             INNER JOIN products p ON p.id = c.product_id
             WHERE c.user_id = ?
             ORDER BY c.created_at DESC`,
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/user/cart — adiciona produto ao carrinho (body: { product_id })
router.post('/cart', authenticateToken, async (req, res) => {
    const { product_id } = req.body;
    if (!product_id) return res.status(400).json({ error: 'product_id é obrigatório.' });
    try {
        await db.query(
            'INSERT INTO user_cart_items (user_id, product_id, quantity) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE quantity = quantity + 1',
            [req.user.id, product_id]
        );
        res.json({ added: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/user/cart/:productId — remove item do carrinho
router.delete('/cart/:productId', authenticateToken, async (req, res) => {
    const productId = parseInt(req.params.productId, 10);
    if (isNaN(productId)) return res.status(400).json({ error: 'ID de produto inválido.' });
    try {
        const [result] = await db.query(
            'DELETE FROM user_cart_items WHERE user_id = ? AND product_id = ?',
            [req.user.id, productId]
        );
        res.json({ removed: result.affectedRows > 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
