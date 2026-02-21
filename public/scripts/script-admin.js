const ADMIN_API_URL = 'http://localhost:3000/api'; 
let currentProducts = []; 

document.addEventListener('DOMContentLoaded', () => {
    initAdminPage();
});

async function initAdminPage() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    if (typeof window.authFetch !== 'function') {
        alert("Erro de sistema: authFetch não encontrado. Recarregue a página.");
        return;
    }
    loadProductsList();
}

// --- CARREGAR LISTA ---
async function loadProductsList() {
    const list = document.getElementById('admin-product-list');
    if (!list) return;

    try {
        const res = await fetch(`${ADMIN_API_URL}/products?t=${Date.now()}`);
        currentProducts = await res.json(); 

        list.innerHTML = '';

        if (!currentProducts || currentProducts.length === 0) {
            list.innerHTML = `
                <div class="text-center py-4 bg-light rounded">
                    <i class="fas fa-box-open fa-3x text-muted mb-3"></i>
                    <p class="text-muted">Nenhum produto cadastrado ainda.</p>
                </div>`;
            return;
        }

        currentProducts.forEach(p => {
            const img = p.image_url || 'https://via.placeholder.com/50';
            const price = parseFloat(p.price).toFixed(2).replace('.', ',');
            const isOffer = p.is_offer == 1 ? '<span class="badge bg-danger ms-2">OFERTA</span>' : '';
            
            // Verifica se tem arquivo (visual apenas para o admin saber)
            const hasFile = p.file_url ? '<span class="badge bg-success ms-1"><i class="fas fa-file"></i> PDF</span>' : '<span class="badge bg-secondary ms-1">Sem Arq.</span>';
            
            let catsDisplay = p.category ? p.category.replace(/,/g, ', ') : 'Sem categoria';

            const item = document.createElement('div');
            item.className = 'product-list-item';
            item.innerHTML = `
                <div class="d-flex align-items-center gap-3">
                    <img src="${img}" class="product-img">
                    <div>
                        <strong class="text-dark d-block">${p.title} ${isOffer} ${hasFile}</strong>
                        <small class="text-muted">${catsDisplay} • <strong>R$ ${price}</strong></small>
                    </div>
                </div>
                <div class="d-flex gap-2">
                    <button onclick="startEditMode(${p.id})" class="btn btn-outline-primary btn-sm" title="Editar">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    <button onclick="deleteProductItem(${p.id})" class="btn btn-outline-danger btn-sm" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            list.appendChild(item);
        });

    } catch (error) {
        console.error(error);
        list.innerHTML = `<div class="alert alert-danger">Erro ao carregar lista.</div>`;
    }
}


// --- SALVAR (CRIAR OU EDITAR) ---
async function handleProductSubmit(event) {
    event.preventDefault();

    const id = document.getElementById('p-id').value;
    const btn = document.getElementById('btn-save');
    const originalText = btn.innerHTML;
    
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> ENVIANDO...';
    btn.disabled = true;

    const formData = new FormData();
    formData.append('title', document.getElementById('p-title').value);
    formData.append('price', document.getElementById('p-price').value);
    formData.append('description', document.getElementById('p-desc').value);
    
    // Oferta
    formData.append('is_offer', document.getElementById('p-offer').checked);

    // Categorias
    const checkedCats = Array.from(document.querySelectorAll('input[name="cat"]:checked'))
                             .map(cb => cb.value);
    if (checkedCats.length > 3) {
        alert("Por favor, selecione no máximo 3 categorias.");
        btn.innerHTML = originalText;
        btn.disabled = false;
        return;
    }
    formData.append('category', checkedCats.join(','));

    // 1. IMAGENS MÚLTIPLAS
    const imageInput = document.getElementById('p-images');
    if (imageInput.files.length > 0) {
        for (let i = 0; i < imageInput.files.length; i++) {
            formData.append('images', imageInput.files[i]); 
        }
    }

    // 2. ARQUIVO DIGITAL (PDF/ZIP) - O NOVO CAMPO
    const fileInput = document.getElementById('p-file');
    if (fileInput.files.length > 0) {
        formData.append('productFile', fileInput.files[0]);
    }

    const url = id ? `${ADMIN_API_URL}/products/${id}` : `${ADMIN_API_URL}/products`;
    const method = id ? 'PUT' : 'POST';

    try {
        const res = await window.authFetch(url, { method: method, body: formData });
        
        if (res.ok) {
            alert(id ? "Produto atualizado!" : "Produto criado com sucesso!");
            cancelEditMode();
            loadProductsList();
        } else {
            const err = await res.json();
            alert("Erro ao salvar: " + (err.error || "Erro desconhecido"));
        }
    } catch (e) { 
        console.error(e);
        alert("Erro de conexão.");
    } finally { 
        btn.disabled = false; 
        btn.innerHTML = originalText; 
    }
}

// --- MODO DE EDIÇÃO ---
function startEditMode(id) {
    const product = currentProducts.find(p => p.id === id);
    if (!product) return;

    document.getElementById('p-id').value = product.id;
    document.getElementById('p-title').value = product.title;
    document.getElementById('p-price').value = product.price;
    document.getElementById('p-desc').value = product.description;
    document.getElementById('p-offer').checked = (product.is_offer == 1);

    // Limpa e marca categorias
    document.querySelectorAll('input[name="cat"]').forEach(cb => cb.checked = false);
    if (product.category) {
        const cats = product.category.split(',');
        cats.forEach(c => {
            const cb = document.querySelector(`input[name="cat"][value="${c.trim()}"]`);
            if (cb) cb.checked = true;
        });
    }

    // Visual
    document.getElementById('form-title').innerText = "Editando: " + product.title;
    const btnSave = document.getElementById('btn-save');
    btnSave.innerHTML = '<i class="fas fa-sync"></i> ATUALIZAR PRODUTO';
    btnSave.classList.remove('btn-primary');
    btnSave.classList.add('btn-warning');
    
    document.getElementById('btn-cancel').style.display = "block";
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEditMode() {
    document.getElementById('product-form').reset();
    document.getElementById('p-id').value = "";
    
    document.getElementById('form-title').innerText = "+ Novo Produto";
    const btnSave = document.getElementById('btn-save');
    btnSave.innerHTML = '<i class="fas fa-save"></i> SALVAR PRODUTO';
    btnSave.classList.remove('btn-warning');
    btnSave.classList.add('btn-primary');
    
    document.getElementById('btn-cancel').style.display = "none";
    
    const collapseEl = document.getElementById('catCollapse');
    if (collapseEl.classList.contains('show')) {
        const bsCollapse = new bootstrap.Collapse(collapseEl, {toggle: false});
        bsCollapse.hide();
    }
}

// --- DELETAR ---
async function deleteProductItem(id) {
    if (!confirm("Tem certeza?")) return;
    try {
        const res = await window.authFetch(`${ADMIN_API_URL}/products/${id}`, { method: 'DELETE' });
        if (res.ok) loadProductsList();
    } catch (e) { alert("Erro ao excluir."); }
}

window.handleProductSubmit = handleProductSubmit;
window.startEditMode = startEditMode;
window.cancelEditMode = cancelEditMode;
window.deleteProductItem = deleteProductItem;