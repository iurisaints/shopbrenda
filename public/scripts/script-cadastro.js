async function handleRegister(e) {
    // previne o recarregamento da página
    e.preventDefault();
    
    const btn = document.getElementById('btn-register');
    const originalText = btn.innerText;
    
    // coleta os valores dos inputs
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;

    if (password.length < 6) {
        showAlertModal("Senha Fraca", "A senha deve ter no mínimo 6 caracteres.", "warning");
        return; // Interrompe tudo aqui, nem tenta mandar pro servidor
    }

    if (password !== confirmPassword) {
        showAlertModal("Erro no Cadastro", "As senhas não coincidem!", "error");
        return;
    }

    // muda o botão para indicar carregamento
    btn.innerText = "CRIANDO CONTA...";
    btn.disabled = true;
    btn.style.opacity = "0.7";

    try {
        // envia os dados para a api de cadastro
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const data = await res.json();

        // se der certo, avisa e manda pro login
        if (res.ok) {
            showAlertModal("Bem-vinda!", "Sua conta foi criada com sucesso.", "success");
            window.location.href = 'login.html';
        } else {
            // se der erro, mostra a mensagem do servidor
            alert(data.error || "Erro ao criar conta.");
        }

    } catch (error) {
        // erro de conexão ou rede
        console.error(error);
        alert("Erro de conexão com o servidor.");
    } finally {
        // restaura o botão ao estado original
        btn.innerText = originalText;
        btn.disabled = false;
        btn.style.opacity = "1";
    }
}