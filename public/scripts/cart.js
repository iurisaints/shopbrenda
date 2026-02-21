// ==========================================
// CONFIGURAÇÃO DO CARRINHO
// ==========================================
const CART_KEY = 'brenda_shop_cart_v1';

// inicializa o contador ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    updateCartCount();
});

// ==========================================
// FUNÇÕES DE AÇÃO (ABRIR, ADICIONAR, REMOVER)
// ==========================================

// função chamada pelo botão do cabeçalho
function toggleCart() {
    const modal = document.getElementById('cart-modal');
    if (!modal) return;

    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        renderCartModal(); // atualiza a lista antes de mostrar
        modal.style.display = 'flex';
    }
}

// adiciona produto (chamado pelo botão "Comprar")
function addToCart(product) {
    let cart = getCart();

    // verifica se já está no carrinho
    if (cart.find(item => item.id === product.id)) {
        if(typeof showToast === 'function') showToast("Este item já está no carrinho!", "info");
        else alert("Este item já está no carrinho!");
        return;
    }

    cart.push(product);
    saveCart(cart);
    updateCartCount();

    // Tenta mostrar sugestões, se não tiver, abre o carrinho
    if (typeof showSuggestionModal === 'function') {
        showSuggestionModal(product);
    } else {
        if(typeof showToast === 'function') showToast("Adicionado ao carrinho!", "success");
        toggleCart();
    }
}

function removeFromCart(productId) {
    let cart = getCart();
    cart = cart.filter(item => item.id !== productId);
    saveCart(cart);
    
    updateCartCount();
    renderCartModal(); // re-renderiza para atualizar visualmente
}

// ==========================================
// LÓGICA DE DADOS (LOCALSTORAGE)
// ==========================================

function getCart() {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
}

function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function updateCartCount() {
    const cart = getCart();
    const count = cart.length;

    // Atualiza badge do Desktop
    const badge = document.getElementById('cart-count');
    if (badge) badge.innerText = count;

    // Atualiza badge do Mobile (se existir)
    const mobileBadge = document.getElementById('mobile-cart-count');
    if (mobileBadge) {
        mobileBadge.innerText = count;
        mobileBadge.style.display = count > 0 ? 'block' : 'none';
    }
}

// ==========================================
// RENDERIZAÇÃO VISUAL (HTML DO MODAL)
// ==========================================

function renderCartModal() {
    const container = document.getElementById('cart-items-container');
    const totalEl = document.getElementById('cart-total-value');
    const cart = getCart();

    if (!container || !totalEl) return;

    container.innerHTML = '';

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-shopping-basket text-muted fs-1 mb-3"></i>
                <p class="text-muted">Seu carrinho está vazio.</p>
                <button onclick="toggleCart()" class="btn btn-outline-primary btn-sm">Continuar Comprando</button>
            </div>
        `;
        totalEl.innerText = "R$ 0,00";
        return;
    }

    let total = 0;

    cart.forEach(item => {
        const price = parseFloat(item.price);
        total += price;

        const div = document.createElement('div');
        div.className = 'd-flex justify-content-between align-items-center mb-3 border-bottom pb-3';
        
        div.innerHTML = `
            <div class="d-flex align-items-center gap-3">
                <img src="${item.image_url || 'https://via.placeholder.com/50'}" class="rounded" style="width:50px; height:50px; object-fit:cover;">
                <div>
                    <h6 class="m-0 text-dark fw-bold" style="font-size:0.9rem;">${item.title}</h6>
                    <small class="text-muted">R$ ${price.toFixed(2).replace('.', ',')}</small>
                </div>
            </div>
            <button onclick="removeFromCart(${item.id})" class="btn btn-link text-danger p-0">
                <i class="fas fa-trash"></i>
            </button>
        `;
        container.appendChild(div);
    });

    totalEl.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

// ==========================================
// CHECKOUT E SUGESTÕES
// ==========================================

async function checkoutCart() {
    const cart = getCart();
    if (cart.length === 0) {
        alert("Seu carrinho está vazio.");
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        alert("Para finalizar, você precisa fazer login.");
        window.location.href = 'login.html';
        return;
    }

    const btn = document.getElementById('btn-checkout-final');
    const originalText = btn.innerText;
    btn.innerText = "PROCESSANDO...";
    btn.disabled = true;

    try {
        // Envia para o backend criar a preferência do Mercado Pago
        const res = await fetch(`${API_URL}/orders/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ cartItems: cart })
        });

        const data = await res.json();

        if (res.ok && data.url) {
            // Limpa o carrinho e redireciona para o pagamento
            localStorage.removeItem(CART_KEY);
            window.location.href = data.url; 
        } else {
            alert(data.error || "Erro ao processar pagamento.");
            btn.innerText = originalText;
            btn.disabled = false;
        }
    } catch (error) {
        console.error(error);
        alert("Erro de conexão.");
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function showSuggestionModal(currentProduct) {
    // AQUI ESTÁ A CORREÇÃO:
    // Usa window.allProducts que foi preenchido pelo app.js
    const productsList = window.allProducts || [];

    if (productsList.length === 0) {
        toggleCart(); // Se não tiver lista, abre o carrinho direto
        return;
    }

    const currentCats = currentProduct.category ? currentProduct.category.split(',') : [];
    const cart = getCart();
    
    // Filtra sugestões da lista global
    const suggestions = productsList.filter(p => {
        if (p.id === currentProduct.id) return false;
        if (cart.find(c => c.id === p.id)) return false; 
        
        const pCats = p.category ? p.category.split(',') : [];
        return pCats.some(c => currentCats.includes(c));
    }).slice(0, 2);

    if (suggestions.length > 0) {
        const modal = document.getElementById('suggestion-modal');
        const container = document.getElementById('suggestion-items');
        
        if (modal && container) {
            container.innerHTML = suggestions.map(p => `
                <div class="card h-100 border p-2">
                    <img src="${p.image_url}" class="card-img-top rounded" style="height:100px; object-fit:cover;">
                    <div class="card-body p-2 text-center">
                        <h6 style="font-size:0.8rem; height:30px; overflow:hidden;">${p.title}</h6>
                        <button class="btn btn-sm btn-outline-primary w-100 mt-1" 
                            onclick="addToCartWrapper(${p.id}); document.getElementById('suggestion-modal').style.display='none'">
                            + R$ ${parseFloat(p.price).toFixed(2)}
                        </button>
                    </div>
                </div>
            `).join('');
            
            modal.style.display = 'flex';
        } else {
            toggleCart();
        }
    } else {
        toggleCart();
    }
}