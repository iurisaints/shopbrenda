async function handleLogin(e) {
    // evita que a página recarregue ao enviar o formulário
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        // chama a api para verificar as credenciais
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (res.ok) {
            // guarda as informações importantes para usar nas outras páginas
            localStorage.setItem('token', data.token);
            localStorage.setItem('userName', data.name);
            localStorage.setItem('userRole', data.role);
            localStorage.setItem('userId', data.id);

            // verifica se tinha coisas no carrinho antes de logar e junta com a conta
            const guestCart = JSON.parse(localStorage.getItem('cart_guest')) || [];
            
            if (guestCart.length > 0) {
                const userKey = `cart_${data.id}`;
                const userCart = JSON.parse(localStorage.getItem(userKey)) || [];
                
                // mescla os itens do visitante com os do usuário
                const mergedCart = [...userCart, ...guestCart];
                
                // atualiza o carrinho oficial e limpa o temporário
                localStorage.setItem(userKey, JSON.stringify(mergedCart));
                localStorage.removeItem('cart_guest');
            }

            showAlertModal("Bem-vindo!", "Seu login foi feito com sucesso.", "success");
            
            // redireciona para o painel se for admin ou para a loja se for cliente
            if (data.role === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'index.html';
            }
        } else {
            // avisa caso a senha ou email estejam errados
            showAlertModal("Erro no Login", data.error || "Credenciais inválidas.", "error");
        }
    } catch (error) {
        // trata erros de rede ou servidor desligado
        console.error(error);
        alert("Erro de conexão com o servidor.");
    }
}