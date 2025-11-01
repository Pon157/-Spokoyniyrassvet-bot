class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('chat_token');
        this.isLoginForm = true;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadTheme();
        this.checkExistingAuth();
        this.initializeAnimations();
    }

    // ... остальные методы остаются такими же ...

    async handleLogin() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        if (!this.validateEmail(email)) {
            this.showNotification('Пожалуйста, введите корректный email', 'error');
            return;
        }

        if (!password) {
            this.showNotification('Введите пароль', 'error');
            return;
        }

        this.setLoading(true, 'login');

        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Ошибка входа');
            }

            this.token = data.token;
            this.currentUser = data.user;

            localStorage.setItem('chat_token', this.token);
            localStorage.setItem('user_data', JSON.stringify(data.user));

            this.showNotification(`Успешный вход! Роль: ${this.getRoleDisplayName(data.user.role)}`, 'success');
            
            // Редирект на нужную страницу
            setTimeout(() => {
                window.location.href = data.redirectTo || this.getRedirectPath(data.user.role);
            }, 1500);

        } catch (error) {
            this.showNotification(error.message, 'error');
        } finally {
            this.setLoading(false, 'login');
        }
    }

    async handleRegister() {
        const username = document.getElementById('registerUsername').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const acceptTerms = document.getElementById('acceptTerms').checked;
        const roleSelect = document.getElementById('registerRole');

        // ... валидация ...

        // Определяем роль
        let role = 'user';
        if (roleSelect) {
            role = roleSelect.value;
        }

        this.setLoading(true, 'register');

        try {
            const response = await fetch('/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password, role })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Ошибка регистрации');
            }

            this.token = data.token;
            this.currentUser = data.user;

            localStorage.setItem('chat_token', this.token);
            localStorage.setItem('user_data', JSON.stringify(data.user));

            this.showNotification(`Регистрация успешна! Роль: ${this.getRoleDisplayName(data.user.role)}`, 'success');
            
            setTimeout(() => {
                window.location.href = data.redirectTo || this.getRedirectPath(data.user.role);
            }, 1500);

        } catch (error) {
            this.showNotification(error.message, 'error');
        } finally {
            this.setLoading(false, 'register');
        }
    }

    getRedirectPath(role) {
        const routes = {
            'user': 'chat.html',
            'listener': 'chat.html',
            'admin': 'admin.html',
            'coowner': 'coowner.html',
            'owner': 'owner.html'
        };
        return routes[role] || 'chat.html';
    }

    getRoleDisplayName(role) {
        const roles = {
            'user': 'Пользователь',
            'listener': 'Слушатель',
            'admin': 'Администратор',
            'coowner': 'Совладелец',
            'owner': 'Владелец'
        };
        return roles[role] || role;
    }

    // ... остальные методы ...
}
