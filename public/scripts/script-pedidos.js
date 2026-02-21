document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const container = document.getElementById('orders-list');

    try {
        const res = await window.authFetch(`${API_URL}/orders`);
        const orders = await res.json();

        container.innerHTML = '';

        if (orders.length === 0) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="text-center p-5 bg-white rounded shadow-sm">
                        <i class="fas fa-folder-open text-muted fs-1 mb-3"></i>
                        <h4 class="text-dark">Nenhum pedido encontrado</h4>
                        <p class="text-muted">Você ainda não comprou nenhum material.</p>
                        <a href="index.html" class="btn btn-primary mt-3">Explorar Loja</a>
                    </div>
                </div>
            `;
            return;
        }

        orders.forEach(order => {
            const date = new Date(order.created_at).toLocaleDateString('pt-BR');
            
            let badgeClass = 'bg-warning text-dark';
            let statusLabel = 'Pendente';
            let actionBtnHtml = ''; 
            
            if (order.status === 'paid') {
                badgeClass = 'bg-success';
                statusLabel = 'Pago';

                const fileUrl = order.items && order.items.length > 0 ? order.items[0].file_url : null;
                
                if (fileUrl) {
                    const filename = fileUrl.split(/[/\\]/).pop();
                    const downloadUrl = `${API_URL}/download/${filename}`;
                    
                    actionBtnHtml = `
                        <a href="${downloadUrl}" class="btn btn-dark w-100 fw-bold">
                            <i class="fas fa-download me-2"></i> BAIXAR ARQUIVO
                        </a>`;
                } else {
                    actionBtnHtml = `<button disabled class="btn btn-secondary w-100">Arquivo Indisponível no Servidor</button>`;
                }
            } else {
                actionBtnHtml = `<button disabled class="btn btn-secondary w-100">Aguardando Pagamento</button>`;
            }

            const itemsHtml = order.items 
                ? order.items.map(i => `
                    <li class="list-group-item d-flex justify-content-between align-items-center border-0 px-0">
                        <span><i class="fas fa-check-circle text-primary me-2"></i> ${i.title}</span>
                    </li>
                  `).join('')
                : `<li class="list-group-item border-0 px-0 text-muted">Detalhes indisponíveis</li>`;

            const col = document.createElement('div');
            col.className = 'col-md-6 col-lg-4';
            col.innerHTML = `
                <div class="card h-100 border-0 shadow-sm">
                    <div class="card-header bg-white border-bottom d-flex justify-content-between align-items-center py-3">
                        <span class="fw-bold text-dark">#${order.id}</span>
                        <span class="badge ${badgeClass}">${statusLabel}</span>
                    </div>
                    <div class="card-body">
                        <p class="text-muted small mb-3"><i class="far fa-calendar-alt me-1"></i> ${date}</p>
                        <ul class="list-group list-group-flush mb-3">${itemsHtml}</ul>
                    </div>
                    <div class="card-footer bg-light border-top py-3">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <span class="text-muted">Total</span>
                            <span class="fw-bold text-dark fs-5">R$ ${parseFloat(order.total).toFixed(2).replace('.', ',')}</span>
                        </div>
                        ${actionBtnHtml}
                    </div>
                </div>
            `;
            container.appendChild(col);
        });

    } catch (error) {
        console.error("Erro ao carregar pedidos:", error);
        container.innerHTML = `
            <div class="col-12 text-center">
                <div class="alert alert-danger">Erro ao carregar seus pedidos. Tente novamente mais tarde.</div>
            </div>
        `;
    }
});