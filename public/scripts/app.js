// ==================================================
// 1. environment e state global em memoria
// ==================================================

// resolvo a url da api dinamicamente via hostname para bypassar o localhost vs origin em prod
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : '/api';

// ponteiros globais de memoria (estado de ui)
let currentCategory = '';
let currentSearch = '';

// exponho as matrizes no escopo global (window) para consumo do cart.js sem overhead de requests
window.allProducts = [];
let allOrdersCache = [];

// controle de state do carrossel nativo
let currentModalImages = [];
let currentImageIndex = 0;

// ==================================================
// 2. core de auth e interceptors
// ==================================================

// wrapper assincrono que muta a requisicao padrao do fetch. injeto o token jwt no header e aplico interceptor de erro 401/403 para force-logout.
window.authFetch = async function (url, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { ...options.headers };

    // defino content-type padrao, ignorando caso o payload seja multpart (arquivos)
    if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(url, { ...options, headers });

    // trigger de sessao invalida. derrubo o token e redireciono.
    if (response.status === 401 || response.status === 403) {
        if (response.status === 403 && url.includes('admin')) showAlertModal("Sessão Expirada", "Sua chave de acesso venceu. Faça login novamente.", "warning");
        logout();
    }
    return response;
};

// validacao hibrida de ui. leio o storage e altero os nós do dom (menu de navegacao) condicionalmente.
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

// flush de memoria e redirect
function logout() { localStorage.clear(); window.location.href = 'index.html'; }

// router customizado pro motor de busca. avalio o path atual: se em rota / muto o dom direto, senao do pushstate com parametros.
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

// handler de mutacao da badge do filtro e update condicional de query string
function selectCategory(cat, event) {
    if (event) event.preventDefault();
    if (cat === 'Todas') {
        currentCategory = '';
        currentSearch = '';
        const input = document.getElementById('search-input');
        if (input) input.value = '';
    } else {
        currentCategory = cat;
    }
    const badge = document.getElementById('active-filter-badge');
    if (badge) {
        if (currentCategory) { badge.innerText = `Filtro: ${currentCategory}`; badge.classList.remove('d-none'); }
        else badge.classList.add('d-none');
    }
    performGlobalSearch();
}

// parsing de urlparams via web api. hidrato os inputs no lifecycle hook.
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
        if (badge) { badge.innerText = `Filtro: ${catParam}`; badge.classList.remove('d-none'); }
    }
    if ((searchParam || catParam) && document.getElementById('products-container')) loadProducts();
}

// ==================================================
// 3. render engine principal (catalogo)
// ==================================================

// fetch no endpoint de produtos interpolando os ponteiros de memoria para fitragem via qs. 
async function loadProducts() {
    const container = document.getElementById('products-container');
    if (!container) return; 

    // cache-busting timestamp force
    let url = `${API_URL}/products?t=${Date.now()}`;
    if (currentCategory && currentCategory !== 'Todas') url += `&category=${encodeURIComponent(currentCategory)}`;
    if (currentSearch) url += `&search=${encodeURIComponent(currentSearch)}`;

    try {
        container.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2 text-muted">Buscando materiais...</p></div>';
        const res = await fetch(url);
        
        // atualizo o cache global
        window.allProducts = await res.json();
        
        // delego manipulacao do innerhtml pro render, MAS PASSANDO PELO SORT ANTES
        renderProducts(getSortedProducts(window.allProducts), container);
    } catch (error) {
        console.error("erro ao dar o fetch no catalogo:", error);
        container.innerHTML = '<div class="col-12 text-center py-5 text-danger">Erro ao carregar produtos.</div>';
    }
}

// motor de ordenacao de matriz in-memory (acionado pelo dropdown do index)
function getSortedProducts(products) {
    const sortSelect = document.getElementById('sort-select');
    const sortVal = sortSelect ? sortSelect.value : 'recent';
    
    // clone raso para nao mutar a resposta original da api
    let sorted = [...products]; 
    
    if (sortVal === 'price-asc') {
        sorted.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    } else if (sortVal === 'price-desc') {
        sorted.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    } else {
        // default: desc (maior id = mais recente)
        sorted.sort((a, b) => b.id - a.id); 
    }
    return sorted;
}

// listener atrelado ao onchange do select no html
window.handleSortChange = function() {
    const container = document.getElementById('products-container');
    if(container && window.allProducts.length > 0) {
        // re-renderiza injetando a matriz reordenada
        renderProducts(getSortedProducts(window.allProducts), container);
    }
};

// factory de nodes html baseada na matriz iterada.
function renderProducts(products, containerElement) {
    containerElement.innerHTML = '';

    // empty state view
    if (products.length === 0) {
        containerElement.innerHTML = `<div class="col-12 text-center py-5"><i class="fas fa-search fa-3x text-muted mb-3"></i><p class="text-muted fs-5">Nenhum material encontrado.</p><button onclick="window.location.href='index.html'" class="btn btn-outline-primary mt-2">Limpar Filtros</button></div>`;
        return;
    }

    products.forEach(p => {
        const priceNum = parseFloat(p.price);
        const currentPrice = priceNum.toFixed(2).replace('.', ',');

        // ternary condicional para tag de oferta e mutacao na str de preco original
        let badgeHtml = p.is_offer ? `<div class="position-absolute top-0 end-0 m-2 badge bg-danger shadow-sm">OFERTA 🔥</div>` : '';
        let priceHtml = p.is_offer
            ? `<small class="text-decoration-line-through text-muted me-2">R$ ${(priceNum * 1.2).toFixed(2)}</small><span class="fw-bold text-danger fs-5">R$ ${currentPrice}</span>`
            : `<span class="fw-bold text-dark fs-5">R$ ${currentPrice}</span>`;

        // sync do dom baseado em storage (likes)
        const heartIcon = isFavorite(p.id) ? 'fas fa-heart' : 'far fa-heart';
        const heartColor = isFavorite(p.id) ? 'text-danger' : 'text-secondary';
        const imgUrl = p.image_url || 'https://via.placeholder.com/300x300?text=Sem+Imagem';

        // faco o split da string categorica separando por virgula e mapeio pra nodes (span) injetando wrap fluid e safe layout via css
        const categoriasHtml = p.category
            ? p.category.split(',').map(cat => `<span class="badge bg-light text-secondary border px-2 py-1" style="font-size: 0.7rem; white-space: normal;">${cat.trim()}</span>`).join('')
            : `<span class="badge bg-light text-secondary border px-2 py-1" style="font-size: 0.7rem;">Geral</span>`;

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
                    <h5 class="card-title text-dark fw-bold fs-6 mb-2" style="cursor:pointer; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" onclick="openProductDetail(${p.id})">
                        ${p.title}
                    </h5>
                    <div class="mt-auto pt-2">
                        <div class="mb-2">${priceHtml}</div>
                        
                        <div class="d-flex flex-wrap gap-1 mb-3">
                            ${categoriasHtml}
                        </div>
                        
                        <button class="btn btn-primary w-100 fw-bold btn-sm text-uppercase" onclick="addToCartWrapper(${p.id})">Adicionar</button>
                    </div>
                </div>
            </div>`;
        containerElement.appendChild(col);
    });
}

// controller intermediario pro cart. varre o in-memory storage e injeta na action do component isolado
function addToCartWrapper(id) {
    let product = window.allProducts.find(p => p.id === id);
    if (!product) return;
    if (typeof addToCart === 'function') addToCart(product);
}

// ==================================================
// 4. carrossel e product modal engine
// ==================================================

// busco o hit na ref global de array via id e monto o modal tree// busco o hit na ref global de array via id e monto o modal tree
function openProductDetail(id) {
    const product = window.allProducts.find(p => p.id === id);
    if (!product) return;

    // defino a imagem principal com fallback garantido
    const mainImage = product.image_url || 'https://via.placeholder.com/400';
    currentModalImages = [mainImage];

    // O SEGREDO AQUI: filtro rigoroso contra "lixo" no banco de dados (null, undefined, vazios)
    if (product.gallery && Array.isArray(product.gallery)) {
        product.gallery.forEach(img => {
            if (img && typeof img === 'string') {
                const cleanUrl = img.trim();
                // só adiciona se for um link válido e diferente da foto principal
                if (cleanUrl.length > 5 && cleanUrl !== 'null' && cleanUrl !== 'undefined' && cleanUrl !== mainImage) {
                    currentModalImages.push(cleanUrl);
                }
            }
        });
    }

    currentImageIndex = 0; 

    document.getElementById('pm-title').innerText = product.title;
    document.getElementById('pm-desc').innerText = product.description || "";
    
    // aplico a mesma engine de parse de tags (split + map + flex wrap) do layout de cards principal
    const catContainer = document.getElementById('pm-category');
    catContainer.innerHTML = ''; 
    catContainer.className = 'd-flex flex-wrap justify-content-center gap-1 mb-3 w-100'; 
    
    if (product.category) {
        const categorias = product.category.split(',');
        categorias.forEach(cat => {
            if (cat.trim()) {
                catContainer.innerHTML += `<span class="badge bg-light text-primary border px-2 py-1" style="white-space: normal; font-size: 0.8rem;">${cat.trim()}</span>`;
            }
        });
    }
    
    // pipeline update ui -> trigger price parse -> sync event listeners 
    updateCarouselDisplay();
    renderPriceInModal(product);
    setupCarouselControls(); // Se o array tiver só 1 foto, as setas somem sozinhas!

    // cloneNode hack para desvincular o listener (onclick) residual
    const btn = document.getElementById('pm-add-btn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.onclick = () => {
        addToCartWrapper(product.id);
        document.getElementById('product-detail-modal').style.display = 'none';
    };
    
    // forco re-render layout trigger 
    document.getElementById('product-detail-modal').style.display = 'flex';
}

// update de node target nativo de midia
function updateCarouselDisplay() {
    const img = document.getElementById('pm-img');
    if (img && currentModalImages.length > 0) img.src = currentModalImages[currentImageIndex];
}

// incremento de node em array circular com update dispatch
function nextSlide() {
    currentImageIndex = (currentImageIndex < currentModalImages.length - 1) ? currentImageIndex + 1 : 0;
    updateCarouselDisplay(); setupCarouselControls();
}

// decremento de node em array circular com update dispatch
function prevSlide() {
    currentImageIndex = (currentImageIndex > 0) ? currentImageIndex - 1 : currentModalImages.length - 1;
    updateCarouselDisplay(); setupCarouselControls();
}

// conditional rendering de chevrons baseada no length da str da galeria
function setupCarouselControls() {
    const prev = document.getElementById('carousel-prev');
    const next = document.getElementById('carousel-next');
    if (!prev || !next) return;
    const display = currentModalImages.length > 1 ? 'flex' : 'none';
    prev.style.display = display;
    next.style.display = display;
}

// event delegation fallback do root ou pointer click
function closeProductModal(e) {
    if (e.target.id === 'product-detail-modal' || e.target.closest('.close-modal-btn')) {
        document.getElementById('product-detail-modal').style.display = 'none';
    }
}

// manipulacao manual condicional do box model e html tree pra switch de label oferta 
function renderPriceInModal(product) {
    const priceBox = document.getElementById('pm-price-container');
    const priceNum = parseFloat(product.price);
    if (product.is_offer) {
        document.getElementById('pm-badge').style.display = 'block';
        priceBox.innerHTML = `<span class="text-decoration-line-through text-muted fs-5 me-2">R$ ${(priceNum * 1.2).toFixed(2)}</span><span class="text-danger fw-bold fs-2">R$ ${priceNum.toFixed(2)}</span>`;
    } else {
        document.getElementById('pm-badge').style.display = 'none';
        priceBox.innerHTML = `<span class="text-dark fw-bold fs-2">R$ ${priceNum.toFixed(2)}</span>`;
    }
}

// ==================================================
// 5. utils e cross-sell module
// ==================================================

// wrapper de deserializacao padrao para getters do webstorage
function getFavorites() { return JSON.parse(localStorage.getItem('favorites')) || []; }
function isFavorite(id) { return getFavorites().includes(id); }

// toggle de index em array local e mutation do pointer persistente
function toggleFavorite(id, btnElement) {
    if (event) event.stopPropagation();
    let favs = getFavorites();
    const index = favs.indexOf(id);
    if (index === -1) {
        favs.push(id);
        if (btnElement) btnElement.innerHTML = '<i class="fas fa-heart text-danger"></i>';
        showToast("Salvo nos favoritos!", "success");
    } else {
        favs.splice(index, 1);
        if (btnElement) btnElement.innerHTML = '<i class="far fa-heart text-secondary"></i>';
        if (window.location.pathname.includes('favoritos.html')) loadFavoritesPage();
        showToast("Removido dos favoritos.");
    }
    localStorage.setItem('favorites', JSON.stringify(favs));
}

// sync do render tree no component principal com a flag salva persistente
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

// factory procedural para dynamic dom mount de alert popups e cleanup on timeout
function showToast(msg, type = 'info') {
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

// bind dos input triggers nativos
function setupGlobalEvents() {
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('search-input');
    if (searchBtn) searchBtn.onclick = performGlobalSearch;
    if (searchInput) searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performGlobalSearch(); });
}

// feature isolada. script lexico rodando regex de comparativo com in-memory pra puxar hit de recomendacao de vendas (cross-sell array match).
window.showSuggestionModal = function (currentProduct) {
    if (!allProductsCache || allProductsCache.length === 0) {
        toggleCart();
        return;
    }

    // array buffer das tags originais lowercased
    const rawCats = currentProduct.category ? currentProduct.category.split(',') : [];
    const currentCats = rawCats.map(c => c.trim().toLowerCase());

    const currentCart = JSON.parse(localStorage.getItem('brenda_shop_cart_v1')) || [];

    // reduco via iteracao logica estrita: sem o id de context base e sem os hit ja existentes no json serializado
    const suggestions = allProductsCache.filter(p => {
        if (p.id === currentProduct.id) return false;
        if (currentCart.find(c => c.id === p.id)) return false;

        const pCatsRaw = p.category ? p.category.split(',') : [];
        const pCats = pCatsRaw.map(c => c.trim().toLowerCase());

        const hasMatch = pCats.some(cat => currentCats.includes(cat));
        return hasMatch;
    }).slice(0, 2);

    // flush pro dom via template literals injetados a seco.
    if (suggestions.length > 0) {
        const modal = document.getElementById('suggestion-modal');
        const container = document.getElementById('suggestion-items');

        if (modal && container) {
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
            toggleCart();
        }
    } else {
        toggleCart();
    }
}

// ==================================================
// 6. core orders module e autenticacao estetica
// ==================================================

// tree rendering das faturas salvas em cache com bypass url dinamica do regex parse
function renderOrders() {
    const container = document.getElementById('orders-list');
    if (!container) return;

    // runtime logic pro pipeline nativo do order array search filter. regex simplificada.
    const filtered = allOrdersCache.filter(order => {
        const searchLower = currentSearch.toLowerCase();
        const matchId = order.id.toString().includes(searchLower);
        const matchItem = order.items && order.items.some(item => item.title.toLowerCase().includes(searchLower));
        
        return !currentSearch || matchId || matchItem;
    });

    container.innerHTML = '';

    if (filtered.length === 0) {
        container.innerHTML = `<div class="col-12 text-center py-5"><p class="text-muted">Nenhum pedido encontrado.</p></div>`;
        return;
    }

    filtered.forEach(order => {
        const date = new Date(order.created_at).toLocaleDateString('pt-BR');
        
        const isPaid = order.status === 'paid';
        const statusClass = isPaid ? 'bg-success' : 'bg-warning text-dark';
        const statusLabel = isPaid ? 'Pago' : 'Pendente';
        
        // bypass do full path do db pegando apenas pop na mascara do os file structure regex format.
        let actionBtn = '';
        if (isPaid) {
            const fullUrl = order.items && order.items[0] ? order.items[0].file_url : null;
            if (fullUrl) {
                const filename = fullUrl.split(/[/\\]/).pop(); 
                const downloadUrl = `${API_URL}/download/${filename}`;

                actionBtn = `<a href="${downloadUrl}" class="btn btn-dark w-100 fw-bold">
                                <i class="fas fa-download me-2"></i> BAIXAR ARQUIVO
                             </a>`;
            } else {
                actionBtn = `<button disabled class="btn btn-secondary w-100">Arquivo Indisponível</button>`;
            }
        } else {
            // A MÁGICA ACONTECE AQUI: 
            // O sistema procura por qualquer chave padrão que o seu backend possa estar enviando com o link do Mercado Pago
            const paymentLink = order.payment_link || order.payment_url || order.init_point || order.checkout_url;
            
            if (paymentLink) {
                actionBtn = `<a href="${paymentLink}" target="_blank" class="btn btn-warning w-100 fw-bold text-dark shadow-sm">
                                <i class="fas fa-credit-card me-2"></i> PAGAR AGORA
                             </a>`;
            } else {
                actionBtn = `<button disabled class="btn btn-secondary w-100">Aguardando Pagamento</button>`;
            }
        }

        const itemsHtml = order.items ? order.items.map(i => 
            `<li class="list-group-item border-0 px-0"><i class="fas fa-check-circle text-primary me-2"></i> ${i.title}</li>`
        ).join('') : '';

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

// motor hibrido de render mobile. intercepta estado do token e faz o split de ui components na arvore do dom.
function renderTopAuthPlaceholder() {
    const token = localStorage.getItem('token');
    const headerPlaceholder = document.getElementById('auth-placeholder');
    const adminPlaceholder = document.getElementById('admin-mobile-placeholder');
    
    if (!token) {
        // injeta sair no root header com flex garantido e sem quebra
        if (headerPlaceholder) {
            headerPlaceholder.innerHTML = `
                <div class="d-flex justify-content-end" style="min-width: 80px;">
                    <button onclick="handleLogout()" class="btn btn-outline-danger btn-sm fw-bold px-3 rounded-pill d-md-none">
                        <i class="fas fa-sign-out-alt"></i> Sair
                    </button>
                </div>
            `;
        }
        if (adminPlaceholder) adminPlaceholder.innerHTML = '';
    } else {
        // view logada: parse do jwt role
        const role = localStorage.getItem('userRole');
        
        // injeta sair no root header (isolado e com width controlada)
        if (headerPlaceholder) {
            headerPlaceholder.innerHTML = `
                <button onclick="handleLogout()" class="btn btn-outline-danger btn-sm fw-bold px-3 rounded-pill d-md-none">
                    <i class="fas fa-sign-out-alt"></i> Sair
                </button>
            `;
        }
        
        // delega o mount do btn admin para o container de ordenacao (strict: role == admin)
        if (adminPlaceholder) {
            if (role === 'admin') {
                adminPlaceholder.innerHTML = `
                    <a href="admin.html" class="btn btn-warning btn-sm fw-bold text-dark d-md-none shadow-sm px-3" style="border-radius: 6px;">
                        <i class="fas fa-cog"></i> Admin
                    </a>
                `;
            } else {
                adminPlaceholder.innerHTML = '';
            }
        }
    }
}

// ==================================================
// 7. MOTOR DE MODAL GLOBAL (ALERTS CUSTOMIZADOS)
// ==================================================

// injeta o html dos modais com css inline para bypass de stylesheets ausentes
function injectGlobalModal() {
    if (document.getElementById('global-alert-modal')) return;
    
    // propriedades de overlay e box model travadas no inline style
    const overlayStyle = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0,0,0,0.6); display: none; z-index: 9999; align-items: center; justify-content: center; backdrop-filter: blur(2px);";
    const contentStyle = "background-color: #fff; max-width: 350px; width: 90%; border-radius: 16px; padding: 24px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);";

    const alertHtml = `
    <div id="global-alert-modal" style="${overlayStyle}">
        <div style="${contentStyle}">
            <div id="global-modal-icon" class="mb-3"></div>
            <h4 id="global-modal-title" class="fw-bold text-dark mb-2"></h4>
            <p id="global-modal-message" class="text-muted mb-4" style="font-size: 0.95rem;"></p>
            <button onclick="document.getElementById('global-alert-modal').style.display='none'" class="btn w-100 fw-bold rounded-pill" id="global-modal-btn">OK</button>
        </div>
    </div>`;

    const confirmHtml = `
    <div id="global-confirm-modal" style="${overlayStyle}">
        <div style="${contentStyle}">
            <div class="mb-3"><i class="fas fa-question-circle text-primary" style="font-size: 3.5rem;"></i></div>
            <h4 id="global-confirm-title" class="fw-bold text-dark mb-2"></h4>
            <p id="global-confirm-message" class="text-muted mb-4" style="font-size: 0.95rem;"></p>
            <div class="d-flex gap-2">
                <button onclick="document.getElementById('global-confirm-modal').style.display='none'" class="btn btn-light w-50 fw-bold rounded-pill text-dark border">Cancelar</button>
                <button id="global-confirm-btn" class="btn btn-danger w-50 fw-bold rounded-pill">Sair</button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', alertHtml + confirmHtml);
}

// controller para invocar alertas simples (sucesso/erro)
window.showAlertModal = function(title, message, type = 'success') {
    const modal = document.getElementById('global-alert-modal');
    const icon = document.getElementById('global-modal-icon');
    const titleEl = document.getElementById('global-modal-title');
    const msgEl = document.getElementById('global-modal-message');
    const btn = document.getElementById('global-modal-btn');

    titleEl.innerText = title;
    msgEl.innerText = message;

    if (type === 'success') {
        icon.innerHTML = '<i class="fas fa-check-circle text-success" style="font-size: 3.5rem;"></i>';
        btn.className = 'btn btn-success w-100 fw-bold rounded-pill';
    } else if (type === 'error') {
        icon.innerHTML = '<i class="fas fa-times-circle text-danger" style="font-size: 3.5rem;"></i>';
        btn.className = 'btn btn-danger w-100 fw-bold rounded-pill';
    } else {
        icon.innerHTML = '<i class="fas fa-exclamation-triangle text-warning" style="font-size: 3.5rem;"></i>';
        btn.className = 'btn btn-warning text-dark w-100 fw-bold rounded-pill';
    }

    modal.style.display = 'flex';
};

// controller para invocar confirmações com callback (ex: logout, exclusões)
window.showConfirmModal = function(title, message, onConfirmCallback, confirmText = "Confirmar") {
    document.getElementById('global-confirm-title').innerText = title;
    document.getElementById('global-confirm-message').innerText = message;
    
    const confirmBtn = document.getElementById('global-confirm-btn');
    confirmBtn.innerText = confirmText; // <- Atualiza o texto do botão dinamicamente!
    
    confirmBtn.onclick = () => {
        document.getElementById('global-confirm-modal').style.display = 'none';
        if (typeof onConfirmCallback === 'function') onConfirmCallback();
    };
    
    document.getElementById('global-confirm-modal').style.display = 'flex';
};

// aciona a injeção assim que a árvore do dom estiver pronta
document.addEventListener('DOMContentLoaded', injectGlobalModal);

// call pra dump em memoria com modal customizado de confirmação
function handleLogout() {
    showConfirmModal("Sair da Conta", "Tem certeza que deseja sair da sua conta e voltar para a vitrine?", () => {
        // esse código só roda se o usuário clicar no botão vermelho "Sair"
        localStorage.removeItem('token');
        window.location.href = 'index.html';
    });
}
window.handleLogout = handleLogout;

// event loop init. chaining do domcontentloaded rodando functions puras na stack.
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupGlobalEvents();
    checkUrlParams();
    renderTopAuthPlaceholder();
    if (document.getElementById('products-container') && !window.location.search) loadProducts();
    if (document.getElementById('favorites-container')) loadFavoritesPage();
});