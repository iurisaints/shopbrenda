// usamos o "origin" para forçar uma URL absoluta e evitar os chiliques do Safari com rotas relativas
const ADMIN_API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : window.location.origin + '/api';

// guardo os produtos aqui pra poder usar depois (tipo na hora de editar)
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
        alert("erro de sistema: authFetch não encontrado. recarregue a página.");
        return;
    }
    
    loadProductsList();
}

// --- puxar a lista de produtos do banco ---
async function loadProductsList() {
    const list = document.getElementById('admin-product-list');
    if (!list) return;

    list.innerHTML = '<p style="text-align:center;">atualizando...</p>';

    try {
        const res = await fetch(`${ADMIN_API_URL}/products?t=${Date.now()}`);
        currentProducts = await res.json(); 

        list.innerHTML = '';

        if (!currentProducts || currentProducts.length === 0) {
            list.innerHTML = '<p style="text-align:center; color:#666;">nenhum produto cadastrado.</p>';
            return;
        }

        currentProducts.forEach(p => {
            const img = p.image_url || 'https://via.placeholder.com/50';
            const price = parseFloat(p.price).toFixed(2).replace('.', ',');
            const titleDisplay = p.is_offer ? `🔥 ${p.title}` : p.title; 

            const item = document.createElement('div');
            item.className = 'product-list-item';
            item.innerHTML = `
                <div class="product-info">
                    <img src="${img}" class="product-img">
                    <div>
                        <strong style="color:#0f172a; display:block;">${titleDisplay}</strong>
                        <span style="font-size:0.85rem; color:#64748b;">${p.category || 'Sem Categoria'} • R$ ${price}</span>
                    </div>
                </div>
                <div class="actions">
                    <button onclick="startEditMode(${p.id})" class="btn-icon edit-btn" title="Editar">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    <button onclick="deleteProductItem(${p.id})" class="btn-icon delete-btn" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            list.appendChild(item);
        });

    } catch (error) {
        console.error(error);
        list.innerHTML = `<p style="color:red; text-align:center;">erro ao carregar a lista.</p>`;
    }
}

// --- hora de salvar (ou editar) mandando arquivo junto ---
async function handleProductSubmit(event) {
    event.preventDefault();

    const idField = document.getElementById('p-id');
    const titleField = document.getElementById('p-title');
    const priceField = document.getElementById('p-price');
    const descField = document.getElementById('p-desc');
    const imagesField = document.getElementById('p-images'); 
    const fileField = document.getElementById('p-file');     
    const offerField = document.getElementById('p-offer');   

    const checkedCategories = Array.from(document.querySelectorAll('input[name="cat"]:checked'))
                                   .map(cb => cb.value)
                                   .join(', ');

    if (!titleField || !priceField) {
        alert("erro: campos principais não encontrados no html.");
        return;
    }

    const btn = document.getElementById('btn-save');
    const originalText = btn.innerText;
    btn.innerText = "ENVIANDO...";
    btn.disabled = true;

    const formData = new FormData();
    formData.append('title', titleField.value);
    formData.append('price', priceField.value);
    formData.append('category', checkedCategories); 
    formData.append('description', descField.value);
    
    if (offerField) {
        formData.append('is_offer', offerField.checked ? 1 : 0);
    }

    if (imagesField && imagesField.files.length > 0) {
        formData.append('image', imagesField.files[0]); 
    }
    
    if (fileField && fileField.files.length > 0) {
        formData.append('file', fileField.files[0]);
    }

    try {
        let res;
        const id = idField.value;
        const token = localStorage.getItem('token'); 

        const url = id ? `${ADMIN_API_URL}/products/${id}` : `${ADMIN_API_URL}/products`;
        const method = id ? 'PUT' : 'POST';

        // ATENÇÃO AQUI: Usando o fetch nativo diretamente para enviar os arquivos com segurança
        res = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`
                // ZERO Content-Type aqui! Deixamos o navegador fazer a mágica do multipart/form-data
            },
            body: formData
        });

        if (res.ok) {
            alert(id ? "produto atualizado!" : "produto criado com sucesso!");
            cancelEditMode(); 
            loadProductsList(); 
        } else {
            const errData = await res.json();
            alert("erro: " + (errData.error || "problema ao salvar no servidor"));
        }

    } catch (error) {
        console.error(error);
        alert("falha de conexão.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// --- joga os dados pro form quando clico no lapis ---
function startEditMode(id) {
    const product = currentProducts.find(p => p.id === id);
    if (!product) return;

    document.getElementById('p-id').value = product.id;
    document.getElementById('p-title').value = product.title;
    document.getElementById('p-price').value = product.price;
    document.getElementById('p-desc').value = product.description || '';
    
    const offerField = document.getElementById('p-offer');
    if (offerField) offerField.checked = !!product.is_offer;

    document.querySelectorAll('input[name="cat"]').forEach(cb => {
        cb.checked = false; 
        if (product.category && product.category.includes(cb.value)) {
            cb.checked = true; 
        }
    });
    
    document.getElementById('form-title').innerText = "editando: " + product.title;
    document.getElementById('btn-save').innerHTML = '<i class="fas fa-save"></i> ATUALIZAR';
    document.getElementById('btn-save').classList.replace('btn-primary', 'btn-warning'); 
    document.getElementById('btn-cancel').style.display = "block";
    
    document.querySelector('.admin-wrapper').scrollIntoView({ behavior: 'smooth' });
}

// --- desiste da edicao e limpa tudo ---
function cancelEditMode() {
    document.getElementById('product-form').reset();
    document.getElementById('p-id').value = "";
    
    document.querySelectorAll('input[name="cat"]').forEach(cb => cb.checked = false);
    
    document.getElementById('form-title').innerText = "+ Novo Produto";
    document.getElementById('btn-save').innerHTML = '<i class="fas fa-save"></i> SALVAR PRODUTO';
    document.getElementById('btn-save').classList.replace('btn-warning', 'btn-primary');
    document.getElementById('btn-cancel').style.display = "none";
}

// --- matar um produto ---
async function deleteProductItem(id) {
    if (!confirm("certeza absoluta q quer apagar?")) return;
    try {
        const res = await window.authFetch(`${ADMIN_API_URL}/products/${id}`, { method: 'DELETE' });
        if (res.ok) loadProductsList();
    } catch (e) { alert("deu ruim ao excluir."); }
}

window.handleProductSubmit = handleProductSubmit;
window.startEditMode = startEditMode;
window.cancelEditMode = cancelEditMode;
window.deleteProductItem = deleteProductItem;