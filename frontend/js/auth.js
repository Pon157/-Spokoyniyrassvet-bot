// Auth functionality with Telegram username
class AuthManager {
    constructor() {
        this.currentForm = 'login';
        this.apiBase = '/auth';
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuthState();
    }

    bindEvents() {
        // Форма входа
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Форма регистрации
        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // Форма восстановления пароля
        document.getElementById('forgotPasswordForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleForgotPassword();
        });

        // Переключение между формами
        document.getElementById('switchBtn').addEventListener('click', () => {
            this.switchForms();
        });

        // Ссылка "Забыли пароль"
        document.getElementById('forgotPasswordLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.showForm('forgotPassword');
        });

        // Кнопка "Назад к входу"
        document.getElementById('backToLogin').addEventListener('click', () => {
            this.showForm('login');
        });

        // Переключение видимости пароля
        document.getElementById('toggleLoginPassword').addEventListener('click', () => {
            this.togglePassword('loginPassword', 'toggleLoginPassword');
        });

        document.getElementById('toggleRegisterPassword').addEventListener('click', () => {
            this.togglePassword('registerPassword', 'toggleRegisterPassword');
        });

        // Enter key support
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const activeForm = document.querySelector('.auth-form.active');
                if (activeForm) {
                    const submitBtn = activeForm.querySelector('button[type="submit"]');
                    if (submitBtn) submitBtn.click();
                }
            }
        });
    }

    async handleLogin() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('rememberMe').checked;

        // Валидация
        if (!username) {
            this.showNotification('Пожалуйста, введите имя пользователя или Telegram', 'error');
            return;
        }

        if (!password) {
            this.showNotification('Пожалуйста, введите пароль', 'error');
            return;
        }

        this.setLoading('loginBtn', true);

        try {
            const response = await fetch(`${this.apiBase}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showNotification('Успешный вход! Перенаправление...', 'success');
                
                // Сохраняем данные
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('user_data', JSON.stringify(data.user));
                
                if (rememberMe) {
                    localStorage.setItem('remember_me', 'true');
                }

                setTimeout(() => {
                    this.redirectUser(data.user);
                }, 1500);

            } else {
                this.showNotification(data.error || 'Ошибка входа', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showNotification('Ошибка соединения с сервером', 'error');
        } finally {
            this.setLoading('loginBtn', false);
        }
    }

    async handleRegister() {
        const username = document.getElementById('registerUsername').value;
        const telegram = document.getElementById('registerTelegram').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const acceptTerms = document.getElementById('acceptTerms').checked;

        // Валидация
        if (!username || username.length < 2) {
            this.showNotification('Имя пользователя должно содержать минимум 2 символа', 'error');
            return;
        }

        if (!telegram || !telegram.startsWith('@')) {
            this.showNotification('Telegram username должен начинаться с @', 'error');
            return;
        }

        if (password.length < 6) {
            this.showNotification('Пароль должен содержать минимум 6 символов', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showNotification('Пароли не совпадают', 'error');
            return;
        }

        if (!acceptTerms) {
            this.showNotification('Необходимо согласие с условиями использования', 'error');
            return;
        }

        this.setLoading('registerBtn', true);

        try {
            const response = await fetch(`${this.apiBase}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    telegram_username: telegram,
                    password: password,
                    confirmPassword: confirmPassword
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showNotification('Регистрация успешна! Вы можете войти.', 'success');
                
                setTimeout(() => {
                    this.showForm('login');
                    document.getElementById('registerForm').reset();
                }, 2000);

            } else {
                this.showNotification(data.error || 'Ошибка регистрации', 'error');
            }
        } catch (error) {
            console.error('Register error:', error);
            this.showNotification('Ошибка соединения с сервером', 'error');
        } finally {
            this.setLoading('registerBtn', false);
        }
    }

    async handleForgotPassword() {
        const telegram = document.getElementById('forgotTelegram').value;

        if (!telegram || !telegram.startsWith('@')) {
            this.showNotification('Введите корректный Telegram username (начинается с @)', 'error');
            return;
        }

        this.setLoading('forgotBtn', true);

        try {
            const response = await fetch(`${this.apiBase}/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    telegram_username: telegram
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showNotification('Ожидайте, в течение дня вам напишут в личные сообщения Telegram с вашим паролем', 'success');
                
                setTimeout(() => {
                    this.showForm('login');
                    document.getElementById('forgotPasswordForm').reset();
                }, 3000);

            } else {
                this.showNotification(data.error || 'Ошибка восстановления пароля', 'error');
            }
        } catch (error) {
            console.error('Forgot password error:', error);
            this.showNotification('Ошибка соединения с сервером', 'error');
        } finally {
            this.setLoading('forgotBtn', false);
        }
    }

    // Остальные методы остаются без изменений...
    showForm(formType) {
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });

        const targetForm = document.getElementById(formType + 'Form');
        if (targetForm) {
            targetForm.classList.add('active');
            this.currentForm = formType;
        }

        if (formType === 'login') {
            document.getElementById('switchText').textContent = 'Нет аккаунта?';
            document.getElementById('switchBtn').textContent = 'Создать аккаунт';
        } else if (formType === 'register') {
            document.getElementById('switchText').textContent = 'Уже есть аккаунт?';
            document.getElementById('switchBtn').textContent = 'Войти';
        }

        window.scrollTo(0, 0);
    }

    switchForms() {
        if (this.currentForm === 'login') {
            this.showForm('register');
        } else {
            this.showForm('login');
        }
    }

    togglePassword(inputId, buttonId) {
        const input = document.getElementById(inputId);
        const toggleBtn = document.getElementById(buttonId);
        const icon = toggleBtn.querySelector('i');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
        }
    }

    setLoading(buttonId, isLoading) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        if (isLoading) {
            button.disabled = true;
            button.classList.add('loading');
        } else {
            button.disabled = false;
            button.classList.remove('loading');
        }
    }

    showNotification(message, type = 'success') {
        let container = document.getElementById('notificationsContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notificationsContainer';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            document.body.appendChild(container);
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            padding: 16px 20px;
            border-radius: 12px;
            color: white;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            animation: slideInRight 0.3s ease;
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 300px;
            max-width: 400px;
        `;

        const icon = document.createElement('i');
        icon.className = type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-triangle';
        notification.appendChild(icon);

        const messageEl = document.createElement('span');
        messageEl.textContent = message;
        notification.appendChild(messageEl);

        container.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);

        if (!document.getElementById('notificationStyles')) {
            const style = document.createElement('style');
            style.id = 'notificationStyles';
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOutRight {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
                .notification.success {
                    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                }
                .notification.error {
                    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                }
            `;
            document.head.appendChild(style);
        }
    }

    redirectUser(user) {
        const role = user?.role || 'user';
        
        const roleNames = {
            'user': 'Пользователь',
            'listener': 'Слушатель', 
            'coowner': 'Совладелец',
            'admin': 'Администратор',
            'owner': 'Владелец'
        };
        
        this.showNotification(`Добро пожаловать, ${user.username}! Ваша роль: ${roleNames[role]}`, 'success');
        
        // Перенаправление по роли
        setTimeout(() => {
            switch(user.role) {
                case 'owner':
                    window.location.href = '/owner.html';
                    break;
                case 'admin':
                    window.location.href = '/admin.html';
                    break;
                case 'coowner':
                    window.location.href = '/coowner.html';
                    break;
                case 'listener':
                    window.location.href = '/listener.html';
                    break;
                default:
                    window.location.href = '/chat.html';
            }
        }, 2000);
    }

    async checkAuthState() {
        const token = localStorage.getItem('auth_token');
        if (token) {
            try {
                const response = await fetch(`${this.apiBase}/verify`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        this.redirectUser(data.user);
                    }
                }
            } catch (error) {
                console.error('Auth check error:', error);
                // Очищаем невалидный токен
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_data');
            }
        }
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.authManager = new AuthManager();
});
