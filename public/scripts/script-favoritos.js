document.addEventListener('DOMContentLoaded', () => {
    loadFavoritesPage();
});

async function loadFavoritesPage() {
    const container = document.getElementById('favorites-container');
    if (!container) return;

    // pega os ids salvos no localstorage (função do app.js)
    const favIds = getFavorites();

    // se não tiver nada, mostra tela vazia
    if (favIds.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding:60px 20px;">
                <i class="far fa-heart" style="font-size:4rem; color:#cbd5e1; margin-bottom:20px;"></i>
                <h3 style="color:var(--blue-navy);">Sua lista está vazia</h3>
                <p style="color:#64748b; margin-bottom:20px;">Salve seus materiais preferidos clicando no coração.</p>
                <a href="index.html" class="btn btn-primary">
                    Ir para a Loja
                </a>
            </div>
        `;
        // altera o grid para não ficar estranho com um item só
        container.style.display = 'block'; 
        return;
    }

    try {
        // busca todos os produtos para filtrar (em produção ideal seria endpoint especifico)
        const res = await fetch(`${API_URL}/products`);
        const products = await res.json();
        
        // guarda no global do app.js para o modal funcionar
        if (typeof allProducts !== 'undefined') {
            allProducts = products;
        }

        // filtra apenas os que estão nos favoritos do usuário
        const favProducts = products.filter(p => favIds.includes(p.id));

        // renderiza usando a mesma lógica da home, mas injetando no container de favoritos
        // usa a função renderProducts do app.js se disponível, senão faz manual
        if (typeof renderProducts === 'function') {
            renderProducts(favProducts, container);
        } else {
            console.error("Função renderProducts não encontrada no app.js");
        }

    } catch (e) {
        console.error(e);
        container.innerHTML = '<div class="alert alert-danger">Erro ao carregar favoritos. Tente novamente.</div>';
    }
}