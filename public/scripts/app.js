// ==================================================
// 1. configurações globais
// ==================================================
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : '/api';

let currentCategory = ''; 
let currentSearch = '';   

// torno a lista de produtos global para o cart.js conseguir ler
window.allProducts = []; 
let allOrdersCache = [];

let currentModalImages = []; 
let currentImageIndex = 0;

// ==================================================
// 2. sistema central de busca e filtros
// ==================================================

// fetch personalizado com token
window.authFetch = async function (url, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { ...options.headers };
    if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401 || response.status === 403) {
        if (response.status === 403 && url.includes('admin')) alert("Sessão expirada.");
        logout();
    }
    return response;
};

function checkAuth() {
    const token = localStorage.getItem('token');
    const userNav = document.getElementById('user-nav');
    if (!userNav) return;

    if (token) {
        const name = localStorage.getItem('userName') || 'Profa.';
        const role = localStorage.getItem('userRole');
        const adminLink = role === 'admin' ? `<a href="admin.html" class="text-warning fw-bold text-decoration-none d-flex align-items-center gap-1"></i> Admin</a>` : '';

        userNav.className = "d-none d-md-flex align-items-center gap-4"; 
        userNav.innerHTML = `
            ${adminLink}
            <a href="meus-pedidos.html" class="text-dark text-decoration-none fw-bold">Pedidos</a>
            <a href="favoritos.html" class="text-danger text-decoration-none fw-bold d-flex align-items-center gap-1"></i> Favoritos</a>
            <div class="vr mx-2 bg-secondary" style="height: 20px;"></div>
            <div class="d-flex flex-column align-items-end" style="line-height:1.2;">
                <span class="text-primary fw-bold" style="font-size:0.9rem;">Olá, ${name}</span>
                <button onclick="logout()" class="btn btn-link text-muted p-0 text-decoration-none" style="font-size:0.75rem;">(Sair)</button>
            </div>
        `;
    } else {
        userNav.className = "d-none d-md-flex align-items-center gap-3";
        userNav.innerHTML = `<a href="login.html" class="text-dark fw-bold text-decoration-none">Entrar</a><a href="cadastro.html" class="btn btn-primary btn-sm fw-bold px-4 rounded-pill">Cadastrar</a>`;
    }
}

function logout() { localStorage.clear(); window.location.href = 'index.html'; }

function performGlobalSearch() {
    const searchInput = document.getElementById('search-input');
    const term = searchInput ? searchInput.value.trim() : '';
    const isHome = !!document.getElementById('products-container');

    if (isHome) {
        currentSearch = term;
        loadProducts();
    } else {
        let targetUrl = `index.html?search=${encodeURIComponent(term)}`;
        if (currentCategory && currentCategory !== 'Todas') targetUrl += `&category=${encodeURIComponent(currentCategory)}`;
        window.location.href = targetUrl;
    }
}

function selectCategory(cat, event) {
    if (event) event.preventDefault();
    if (cat === 'Todas') {
        currentCategory = '';
        currentSearch = '';
        const input = document.getElementById('search-input');
        if(input) input.value = '';
    } else {
        currentCategory = cat;
    }
    const badge = document.getElementById('active-filter-badge');
    if(badge) {
        if(currentCategory) { badge.innerText = `Filtro: ${currentCategory}`; badge.classList.remove('d-none'); }
        else badge.classList.add('d-none');
    }
    performGlobalSearch();
}

function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const searchParam = params.get('search');
    const catParam = params.get('category');

    if (searchParam) {
        currentSearch = searchParam;
        const input = document.getElementById('search-input');
        if (input) input.value = searchParam;
    }
    if (catParam) {
        currentCategory = catParam;
        const badge = document.getElementById('active-filter-badge');
        if(badge) { badge.innerText = `Filtro: ${catParam}`; badge.classList.remove('d-none'); }
    }
    if ((searchParam || catParam) && document.getElementById('products-container')) loadProducts();
}

// ==================================================
// 3. produtos (carrega na variavel global)
// ==================================================

async function loadProducts() {
    const container = document.getElementById('products-container');
    if (!container) return; 

    let url = `${API_URL}/products?t=${Date.now()}`;
    if (currentCategory && currentCategory !== 'Todas') url += `&category=${encodeURIComponent(currentCategory)}`;
    if (currentSearch) url += `&search=${encodeURIComponent(currentSearch)}`;

    try {
        container.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2 text-muted">Buscando materiais...</p></div>';
        const res = await fetch(url);
        
        // aqui salvo na variavel global window.allProducts
        window.allProducts = await res.json();
        
        renderProducts(window.allProducts, container);
    } catch (error) {
        console.error("Erro:", error);
        container.innerHTML = '<div class="col-12 text-center py-5 text-danger">Erro ao carregar produtos.</div>';
    }
}

function renderProducts(products, containerElement) {
    containerElement.innerHTML = '';
    if (products.length === 0) {
        containerElement.innerHTML = `<div class="col-12 text-center py-5"><i class="fas fa-search fa-3x text-muted mb-3"></i><p class="text-muted fs-5">Nenhum material encontrado.</p><button onclick="window.location.href='index.html'" class="btn btn-outline-primary mt-2">Limpar Filtros</button></div>`;
        return;
    }

    products.forEach(p => {
        const priceNum = parseFloat(p.price);
        const currentPrice = priceNum.toFixed(2).replace('.', ',');
        
        let badgeHtml = p.is_offer ? `<div class="position-absolute top-0 end-0 m-2 badge bg-danger shadow-sm">OFERTA 🔥</div>` : '';
        let priceHtml = p.is_offer 
            ? `<small class="text-decoration-line-through text-muted me-2">R$ ${(priceNum * 1.2).toFixed(2)}</small><span class="fw-bold text-danger fs-5">R$ ${currentPrice}</span>`
            : `<span class="fw-bold text-dark fs-5">R$ ${currentPrice}</span>`;

        const heartIcon = isFavorite(p.id) ? 'fas fa-heart' : 'far fa-heart'; 
        const heartColor = isFavorite(p.id) ? 'text-danger' : 'text-secondary';
        const imgUrl = p.image_url || 'https://via.placeholder.com/300x300?text=Sem+Imagem';

        const col = document.createElement('div');
        col.className = 'col-6 col-md-4 col-lg-3'; 
        col.innerHTML = `
            <div class="card h-100 border-0 shadow-sm product-card position-relative">
                ${badgeHtml}
                <div class="position-relative overflow-hidden" style="cursor: pointer;" onclick="openProductDetail(${p.id})">
                    <img src="${imgUrl}" class="card-img-top" alt="${p.title}" style="height: 200px; object-fit: cover;">
                    <button class="btn btn-light rounded-circle position-absolute top-0 start-0 m-2 shadow-sm d-flex align-items-center justify-content-center" 
                            style="width: 35px; height: 35px;" onclick="toggleFavorite(${p.id}, this)">
                        <i class="${heartIcon} ${heartColor}"></i>
                    </button>
                </div>
                <div class="card-body d-flex flex-column p-3">
                    <span class="badge bg-light text-secondary border align-self-start mb-2">${p.category ? p.category.split(',')[0] : 'Geral'}</span>
                    <h5 class="card-title text-dark fw-bold fs-6 mb-2" style="cursor:pointer; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" onclick="openProductDetail(${p.id})">
                        ${p.title}
                    </h5>
                    <div class="mt-auto pt-2">
                        <div class="mb-3">${priceHtml}</div>
                        <button class="btn btn-primary w-100 fw-bold btn-sm text-uppercase" onclick="addToCartWrapper(${p.id})">Adicionar</button>
                    </div>
                </div>
            </div>`;
        containerElement.appendChild(col);
    });
}

// wrapper que chama o carrinho
function addToCartWrapper(id) {
    // busca na variavel global
    let product = window.allProducts.find(p => p.id === id);
    if (!product) return;
    if (typeof addToCart === 'function') addToCart(product);
}

// ==================================================
// 4. carrossel modal
// ==================================================

function openProductDetail(id) {
    const product = window.allProducts.find(p => p.id === id);
    if (!product) return;

    currentModalImages = (product.gallery && product.gallery.length > 0) ? product.gallery : [product.image_url || 'https://via.placeholder.com/400'];
    currentImageIndex = 0; 

    document.getElementById('pm-title').innerText = product.title;
    document.getElementById('pm-category').innerText = (product.category || '').replace(/,/g, ' • ');
    document.getElementById('pm-desc').innerText = product.description || "";
    
    updateCarouselDisplay();
    renderPriceInModal(product);
    setupCarouselControls();

    const btn = document.getElementById('pm-add-btn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.onclick = () => {
        addToCartWrapper(product.id);
        document.getElementById('product-detail-modal').style.display = 'none';
    };
    document.getElementById('product-detail-modal').style.display = 'flex';
}

function updateCarouselDisplay() {
    const img = document.getElementById('pm-img');
    if(img && currentModalImages.length > 0) img.src = currentModalImages[currentImageIndex];
}
function nextSlide() {
    currentImageIndex = (currentImageIndex < currentModalImages.length - 1) ? currentImageIndex + 1 : 0;
    updateCarouselDisplay(); setupCarouselControls();
}
function prevSlide() {
    currentImageIndex = (currentImageIndex > 0) ? currentImageIndex - 1 : currentModalImages.length - 1;
    updateCarouselDisplay(); setupCarouselControls();
}
function setupCarouselControls() {
    const prev = document.getElementById('carousel-prev');
    const next = document.getElementById('carousel-next');
    if(!prev || !next) return;
    const display = currentModalImages.length > 1 ? 'flex' : 'none';
    prev.style.display = display;
    next.style.display = display;
}
function closeProductModal(e) {
    if (e.target.id === 'product-detail-modal' || e.target.closest('.close-modal-btn')) {
        document.getElementById('product-detail-modal').style.display = 'none';
    }
}
function renderPriceInModal(product) {
    const priceBox = document.getElementById('pm-price-container');
    const priceNum = parseFloat(product.price);
    if(product.is_offer) {
        document.getElementById('pm-badge').style.display = 'block';
        priceBox.innerHTML = `<span class="text-decoration-line-through text-muted fs-5 me-2">R$ ${(priceNum*1.2).toFixed(2)}</span><span class="text-danger fw-bold fs-2">R$ ${priceNum.toFixed(2)}</span>`;
    } else {
        document.getElementById('pm-badge').style.display = 'none';
        priceBox.innerHTML = `<span class="text-dark fw-bold fs-2">R$ ${priceNum.toFixed(2)}</span>`;
    }
}

// ==================================================
// 5. favoritos, toast e inicialização
// ==================================================

function getFavorites() { return JSON.parse(localStorage.getItem('favorites')) || []; }
function isFavorite(id) { return getFavorites().includes(id); }

function toggleFavorite(id, btnElement) {
    if (event) event.stopPropagation();
    let favs = getFavorites();
    const index = favs.indexOf(id);
    if (index === -1) {
        favs.push(id);
        if(btnElement) btnElement.innerHTML = '<i class="fas fa-heart text-danger"></i>';
        showToast("Salvo nos favoritos!", "success");
    } else {
        favs.splice(index, 1);
        if(btnElement) btnElement.innerHTML = '<i class="far fa-heart text-secondary"></i>';
        if (window.location.pathname.includes('favoritos.html')) loadFavoritesPage();
        showToast("Removido dos favoritos.");
    }
    localStorage.setItem('favorites', JSON.stringify(favs));
}

async function loadFavoritesPage() {
    const container = document.getElementById('favorites-container');
    if (!container) return;
    const favIds = getFavorites();
    if (favIds.length === 0) {
        container.innerHTML = `<div class="col-12 text-center py-5"><i class="far fa-heart fa-3x text-muted mb-3"></i><h3 class="h5 text-dark">Sua lista está vazia</h3><a href="index.html" class="btn btn-primary mt-2">Ir para a Loja</a></div>`;
        return;
    }
    try {
        const res = await fetch(`${API_URL}/products`);
        window.allProducts = await res.json();
        const favProducts = window.allProducts.filter(p => favIds.includes(p.id));
        renderProducts(favProducts, container);
    } catch (e) {
        container.innerHTML = '<div class="alert alert-danger">Erro ao carregar favoritos.</div>';
    }
}

function showToast(msg, type='info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = "position: fixed; top: 20px; right: 20px; z-index: 3000; display: flex; flex-direction: column; gap: 10px;";
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast show align-items-center text-white bg-${type === 'success' ? 'success' : 'primary'} border-0`;
    toast.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3500);
}

function setupGlobalEvents() {
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('search-input');
    if (searchBtn) searchBtn.onclick = performGlobalSearch;
    if (searchInput) searchInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') performGlobalSearch(); });
}

window.showSuggestionModal = function(currentProduct) {
    console.log("🔍 Iniciando busca de sugestões para:", currentProduct.title);

    // 1. Verifica se temos produtos para sugerir
    if (!allProductsCache || allProductsCache.length === 0) {
        console.warn("⚠️ Cache de produtos vazio. Abrindo carrinho direto.");
        toggleCart();
        return;
    }

    // 2. Prepara as categorias do produto atual (limpa espaços e deixa minúsculo)
    // Ex: "BNCC, Inglês" vira ["bncc", "inglês"]
    const rawCats = currentProduct.category ? currentProduct.category.split(',') : [];
    const currentCats = rawCats.map(c => c.trim().toLowerCase());

    console.log("📂 Categorias do produto:", currentCats);

    // 3. Pega o carrinho atual para não sugerir o que já comprou
    const currentCart = JSON.parse(localStorage.getItem('brenda_shop_cart_v1')) || [];

    // 4. Filtragem Inteligente
    const suggestions = allProductsCache.filter(p => {
        // Não sugere o próprio produto
        if (p.id === currentProduct.id) return false;

        // Não sugere o que já está no carrinho
        if (currentCart.find(c => c.id === p.id)) return false; 
        
        // Verifica Categorias
        const pCatsRaw = p.category ? p.category.split(',') : [];
        const pCats = pCatsRaw.map(c => c.trim().toLowerCase());

        // Se tiver pelo menos UMA categoria em comum, serve
        const hasMatch = pCats.some(cat => currentCats.includes(cat));
        
        return hasMatch;
    }).slice(0, 2); // Pega no máximo 2

    console.log(`✅ Sugestões encontradas: ${suggestions.length}`, suggestions);

    // 5. Decisão: Mostra Modal ou Carrinho
    if (suggestions.length > 0) {
        const modal = document.getElementById('suggestion-modal');
        const container = document.getElementById('suggestion-items');
        
        if(modal && container) {
            container.innerHTML = suggestions.map(p => `
                <div class="card h-100 border-0 shadow-sm">
                    <div class="row g-0 align-items-center h-100">
                        <div class="col-4">
                            <img src="${p.image_url}" class="img-fluid rounded-start h-100" style="object-fit:cover; min-height:80px;" alt="${p.title}">
                        </div>
                        <div class="col-8">
                            <div class="card-body p-2">
                                <h6 class="card-title text-dark small mb-1 text-truncate" title="${p.title}">${p.title}</h6>
                                <p class="card-text text-danger fw-bold small mb-2">+ R$ ${parseFloat(p.price).toFixed(2).replace('.', ',')}</p>
                                <button class="btn btn-sm btn-outline-primary w-100 py-0" style="font-size: 0.8rem;" 
                                    onclick="addToCartWrapper(${p.id}); document.getElementById('suggestion-modal').style.display='none'">
                                    Adicionar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
            
            modal.style.display = 'flex';
        } else {
            console.error("❌ Elemento HTML do modal não encontrado.");
            toggleCart();
        }
    } else {
        console.log("ℹ️ Nenhuma sugestão compatível. Abrindo carrinho.");
        toggleCart(); 
    }
}

function renderOrders() {
    const container = document.getElementById('orders-list');
    if (!container) return;

    // 1. Filtra Pedidos (Busca local)
    const filtered = allOrdersCache.filter(order => {
        const searchLower = currentSearch.toLowerCase();
        const matchId = order.id.toString().includes(searchLower);
        // Verifica se algum item do pedido tem o texto da busca
        const matchItem = order.items && order.items.some(item => item.title.toLowerCase().includes(searchLower));
        
        return !currentSearch || matchId || matchItem;
    });

    container.innerHTML = '';

    if (filtered.length === 0) {
        container.innerHTML = emptyState('Nenhum pedido encontrado.');
        return;
    }

    filtered.forEach(order => {
        const date = new Date(order.created_at).toLocaleDateString('pt-BR');
        
        // Define cor e texto do status
        const isPaid = order.status === 'paid';
        const statusClass = isPaid ? 'bg-success' : 'bg-warning text-dark';
        const statusLabel = isPaid ? 'Pago' : 'Pendente';
        
        // === LÓGICA DO BOTÃO DE DOWNLOAD (A PARTE IMPORTANTE) ===
        let actionBtn = '';

        if (isPaid) {
            // Pega o link do primeiro produto do pedido
            const fullUrl = order.items && order.items[0] ? order.items[0].file_url : null;
            
            if (fullUrl) {
                // Truque: Pega só o nome do arquivo (ex: 12345-livro.pdf) da URL completa
                const filename = fullUrl.split(/[/\\]/).pop(); 
                
                // Cria o link usando a nossa rota segura de download
                const downloadUrl = `${API_URL}/download/${filename}`;

                actionBtn = `<a href="${downloadUrl}" class="btn btn-dark w-100 fw-bold">
                                <i class="fas fa-download me-2"></i> BAIXAR ARQUIVO
                             </a>`;
            } else {
                actionBtn = `<button disabled class="btn btn-secondary w-100">Arquivo Indisponível</button>`;
            }
        } else {
            actionBtn = `<button disabled class="btn btn-secondary w-100">Aguardando Pagamento</button>`;
        }

        // Monta a lista de itens (texto)
        const itemsHtml = order.items ? order.items.map(i => 
            `<li class="list-group-item border-0 px-0"><i class="fas fa-check-circle text-primary me-2"></i> ${i.title}</li>`
        ).join('') : '';

        // Cria o Card HTML
        const card = document.createElement('div');
        card.className = 'col-md-6 col-lg-4';
        card.innerHTML = `
            <div class="card h-100 border-0 shadow-sm">
                <div class="card-header bg-white border-bottom d-flex justify-content-between align-items-center py-3">
                    <span class="fw-bold text-dark">Pedido #${order.id}</span>
                    <span class="badge ${statusClass}">${statusLabel}</span>
                </div>
                <div class="card-body">
                    <p class="text-muted small mb-3"><i class="far fa-calendar-alt me-1"></i> ${date}</p>
                    <ul class="list-group list-group-flush mb-3 small">${itemsHtml}</ul>
                </div>
                <div class="card-footer bg-light border-top py-3">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <span class="text-muted">Total</span>
                        <span class="fw-bold text-dark fs-5">R$ ${parseFloat(order.total).toFixed(2).replace('.', ',')}</span>
                    </div>
                    ${actionBtn}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupGlobalEvents();
    checkUrlParams();
    if (document.getElementById('products-container') && !window.location.search) loadProducts();
    if (document.getElementById('favorites-container')) loadFavoritesPage();
});