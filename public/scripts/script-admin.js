// essa url descobre sozinha se eu to testando no pc ou se ja ta no ar
const ADMIN_API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : '/api';

// guardo os produtos aqui pra poder usar depois (tipo na hora de editar)
let currentProducts = []; 

document.addEventListener('DOMContentLoaded', () => {
    initAdminPage();
});

async function initAdminPage() {
    // vejo se a pessoa logou e tem um token guardado
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html'; // nao tem token? rua
        return;
    }
    
    // as vezes o app.js demora a carregar, entao confirmo se a funcao existe
    if (typeof window.authFetch !== 'function') {
        alert("erro de sistema: authFetch não encontrado. recarregue a página.");
        return;
    }
    
    // se passou de tudo, carrega a vitrine do admin
    loadProductsList();
}

// --- puxar a lista de produtos do banco ---
async function loadProductsList() {
    const list = document.getElementById('admin-product-list');
    if (!list) return;

    list.innerHTML = '<p style="text-align:center;">atualizando...</p>';

    try {
        // o Date.now() no final é um truquezinho pro navegador nao usar cache e sempre buscar do banco
        const res = await fetch(`${ADMIN_API_URL}/products?t=${Date.now()}`);
        currentProducts = await res.json(); 

        list.innerHTML = '';

        // se voltar vazio
        if (!currentProducts || currentProducts.length === 0) {
            list.innerHTML = '<p style="text-align:center; color:#666;">nenhum produto cadastrado.</p>';
            return;
        }

        // monta a lista no html item por item
        currentProducts.forEach(p => {
            const img = p.image_url || 'https://via.placeholder.com/50';
            const price = parseFloat(p.price).toFixed(2).replace('.', ',');

            const item = document.createElement('div');
            item.className = 'product-list-item';
            item.innerHTML = `
                <div class="product-info">
                    <img src="${img}" class="product-img">
                    <div>
                        <strong style="color:#0f172a; display:block;">${p.title}</strong>
                        <span style="font-size:0.85rem; color:#64748b;">${p.category} • R$ ${price}</span>
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
    event.preventDefault(); // segura o reload da pagina

    // 1. catando todos os campos do form
    const idField = document.getElementById('p-id');
    const titleField = document.getElementById('p-title');
    const priceField = document.getElementById('p-price');
    const categoryField = document.getElementById('p-category');
    const descField = document.getElementById('p-desc');
    const imageField = document.getElementById('p-image');

    // prevencao basica caso eu mude o html e esqueca o id
    if (!titleField || !priceField) {
        alert("erro: campos nao encontrados no html.");
        return;
    }

    const btn = document.getElementById('btn-save');
    const originalText = btn.innerText;
    btn.innerText = "ENVIANDO...";
    btn.disabled = true;

    // 2. como tem arquivo (imagem), tenho q usar o FormData em vez de json
    const formData = new FormData();
    formData.append('title', titleField.value);
    formData.append('price', priceField.value);
    formData.append('category', categoryField.value);
    formData.append('description', descField.value);

    // se o cara subiu uma foto, adiciona ela na mochila
    if (imageField.files.length > 0) {
        formData.append('image', imageField.files[0]);
    }

    try {
        let res;
        const id = idField.value;

        // se tem id, é edicao. se nao, é produto novo
        if (id) {
            res = await window.authFetch(`${ADMIN_API_URL}/products/${id}`, {
                method: 'PUT',
                body: formData 
            });
        } else {
            res = await window.authFetch(`${ADMIN_API_URL}/products`, {
                method: 'POST',
                body: formData
            });
        }

        if (res.ok) {
            alert(id ? "produto atualizado!" : "produto criado com sucesso!");
            cancelEditMode(); // limpa o form
            loadProductsList(); // atualiza a vitrine
            imageField.value = ''; // zera o file input
        } else {
            const errData = await res.json();
            alert("erro: " + (errData.error || "nao sei oq rolou"));
        }

    } catch (error) {
        console.error(error);
        alert("falha de conexão.");
    } finally {
        // volta o botao ao normal
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// --- joga os dados pro form quando clico no lapis ---
function startEditMode(id) {
    // acha o produto no array que eu guardei lá em cima
    const product = currentProducts.find(p => p.id === id);
    if (!product) return;

    document.getElementById('p-id').value = product.id;
    document.getElementById('p-title').value = product.title;
    document.getElementById('p-price').value = product.price;
    document.getElementById('p-category').value = product.category;
    document.getElementById('p-desc').value = product.description;
    
    // obs: navegador nao deixa eu preencher o input type file por motivo de hack, entao deixo quieto
    
    // muda a cara da ui pra modo de edicao
    document.getElementById('form-title').innerText = "editando: " + product.title;
    document.getElementById('btn-save').innerText = "ATUALIZAR";
    document.getElementById('btn-save').style.background = "#f59e0b"; // laranjinha
    document.getElementById('btn-cancel').style.display = "block";
    
    // rola a pagina suave ate o form
    document.querySelector('.admin-wrapper').scrollIntoView({ behavior: 'smooth' });
}

// --- desiste da edicao e limpa tudo ---
function cancelEditMode() {
    document.getElementById('product-form').reset();
    document.getElementById('p-id').value = "";
    document.getElementById('p-image').value = "";
    
    document.getElementById('form-title').innerText = "+ novo produto";
    document.getElementById('btn-save').innerText = "CADASTRAR PRODUTO";
    document.getElementById('btn-save').style.background = "var(--red-bordo)";
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

// deixando as funcoes publicas pro html poder chamar pelo onclick
window.handleProductSubmit = handleProductSubmit;
window.startEditMode = startEditMode;
window.cancelEditMode = cancelEditMode;
window.deleteProductItem = deleteProductItem;
