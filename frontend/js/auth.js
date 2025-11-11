class AuthManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkExistingAuth();
    }

    setupEventListeners() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister();
            });
        }
    }

    async handleLogin() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        const errorDiv = document.getElementById('loginError');
        const submitBtn = document.getElementById('loginSubmitBtn');

        if (!username || !password) {
            this.showError(errorDiv, 'Заполните все поля');
            return;
        }

        try {
            this.setLoading(submitBtn, true);

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success) {
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('user_data', JSON.stringify(data.user));
                
                this.showError(errorDiv, '', true);
                this.showSuccess('Вход выполнен успешно!');
                
                setTimeout(() => {
                    window.location.href = data.redirectTo;
                }, 1000);
                
            } else {
                this.showError(errorDiv, data.error || 'Ошибка входа');
            }
        } catch (error) {
            this.showError(errorDiv, 'Ошибка соединения с сервером');
        } finally {
            this.setLoading(submitBtn, false);
        }
    }

    async handleRegister() {
        const username = document.getElementById('registerUsername').value;
        const telegram = document.getElementById('registerTelegram').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;
        const errorDiv = document.getElementById('registerError');
        const submitBtn = document.getElementById('registerSubmitBtn');

        if (!username || !telegram || !password || !confirmPassword) {
            this.showError(errorDiv, 'Заполните все поля');
            return;
        }

        if (username.length < 2) {
            this.showError(errorDiv, 'Имя пользователя должно содержать минимум 2 символа');
            return;
        }

        if (!telegram.startsWith('@')) {
            this.showError(errorDiv, 'Telegram должен начинаться с @');
            return;
        }

        if (password.length < 6) {
            this.showError(errorDiv, 'Пароль должен содержать минимум 6 символов');
            return;
        }

        if (password !== confirmPassword) {
            this.showError(errorDiv, 'Пароли не совпадают');
            return;
        }

        try {
            this.setLoading(submitBtn, true);

            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    telegram_username: telegram,
                    password,
                    confirmPassword
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showError(errorDiv, '', true);
                this.showSuccess('Регистрация успешна! Теперь вы можете войти.');
                
                document.getElementById('loginForm').style.display = 'block';
                document.getElementById('registerForm').style.display = 'none';
                
            } else {
                this.showError(errorDiv, data.error || 'Ошибка регистрации');
            }
        } catch (error) {
            this.showError(errorDiv, 'Ошибка соединения с сервером');
        } finally {
            this.setLoading(submitBtn, false);
        }
    }

    checkExistingAuth() {
        const token = localStorage.getItem('auth_token');
        const userData = localStorage.getItem('user_data');
        
        if (token && userData) {
            try {
                const user = JSON.parse(userData);
                const redirectTo = this.getRedirectPageForRole(user.role);
                window.location.href = redirectTo;
            } catch (error) {
                this.clearAuth();
            }
        }
    }

    getRedirectPageForRole(role) {
        const routes = {
            'owner': '/owner.html',
            'admin': '/admin.html',
            'coowner': '/coowner.html',
            'listener': '/listener.html',
            'user': '/chat.html'
        };
        return routes[role] || '/chat.html';
    }

    showError(errorElement, message, isSuccess = false) {
        if (!errorElement) return;
        
        errorElement.textContent = message;
        if (message) {
            errorElement.style.display = 'block';
            errorElement.style.color = isSuccess ? 'green' : 'red';
        } else {
            errorElement.style.display = 'none';
        }
    }

    showSuccess(message) {
        alert(message); // Простое уведомление
    }

    setLoading(button, isLoading) {
        if (!button) return;
        
        if (isLoading) {
            button.disabled = true;
            button.innerHTML = 'Загрузка...';
        } else {
            button.disabled = false;
            button.innerHTML = button.id === 'loginSubmitBtn' ? 'Войти' : 'Зарегистрироваться';
        }
    }

    clearAuth() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    window.authManager = new AuthManager();
});
