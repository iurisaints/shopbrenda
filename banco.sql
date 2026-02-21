-- ==================================================
-- SCRIPT DE RESET TOTAL (V3.0 - FINAL)
-- ==================================================

-- 1. Limpeza (CUIDADO: APAGA DADOS)
DROP DATABASE IF EXISTS brenda_shop;
CREATE DATABASE brenda_shop;
USE brenda_shop;

-- 2. Tabela de Usuários
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela de Reset de Senha
CREATE TABLE password_resets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabela de Produtos (Completa)
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    category TEXT, -- Agora suporta "BNCC,Inglês,Fundamental"
    description TEXT,
    image_url VARCHAR(255), -- Capa Principal
    file_url VARCHAR(255),  -- Arquivo PDF/ZIP para Download
    is_offer TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Galeria de Imagens (Fotos Extras)
CREATE TABLE product_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 6. Tabela de Pedidos
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, paid, cancelled
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. Itens do Pedido (Relaciona Pedido x Produto)
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT, -- Pode ser null se o produto for deletado, mas mantemos o histórico
    title VARCHAR(255), -- Salva o título na época da compra
    price DECIMAL(10, 2), -- Salva o preço na época da compra
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- (Opcional) Criar um Admin Padrão
-- Senha: "admin" (hash gerado para teste)
INSERT INTO users (name, email, password, role) VALUES 
('Admin Brenda', 'admin@loja.com', '$2a$10$X.x.x.x.x.x.x', 'admin');

