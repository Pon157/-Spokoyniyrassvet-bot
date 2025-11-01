// Auth functionality
class AuthManager {
    constructor() {
        this.currentForm = 'login';
        this.termsLink = 'https://your-domain.com/terms-of-service'; // ЗАМЕНИТЕ НА ВАШУ ССЫЛКУ
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuthState();
        this.applySavedTheme();
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

        // Форма восстановления пароля через Telegram
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

        // Ссылка на условия использования
        document.getElementById('termsLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.showTermsModal();
        });

        // Модальное окно условий
        document.getElementById('closeTermsModal').addEventListener('click', () => {
            this.hideTermsModal();
        });

        document.getElementById('cancelTermsBtn').addEventListener('click', () => {
            this.hideTermsModal();
        });

        document.getElementById('modalAcceptTerms').addEventListener('change', (e) => {
            document.getElementById('acceptTermsBtn').disabled = !e.target.checked;
        });

        document.getElementById('acceptTermsBtn').addEventListener('click', () => {
            this.acceptTerms();
        });

        // Закрытие модального окна при клике вне его
        document.getElementById('termsModal').addEventListener('click', (e) => {
            if (e.target.id === 'termsModal') {
                this.hideTermsModal();
            }
        });

        // Настройки темы
        document.getElementById('themeToggle').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleThemeOptions();
        });

        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', () => {
                const theme = option.getAttribute('data-theme');
                this.setTheme(theme);
            });
        });

        // Закрытие настроек темы при клике вне области
        document.addEventListener('click', () => {
            this.hideThemeOptions();
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

        // Escape key для закрытия модальных окон
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideTermsModal();
                this.hideThemeOptions();
            }
        });
    }

    showTermsModal() {
        const modal = document.getElementById('termsModal');
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    hideTermsModal() {
        const modal = document.getElementById('termsModal');
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }

    acceptTerms() {
        document.getElementById('acceptTerms').checked = true;
        this.hideTermsModal();
        this.showNotification('Условия использования приняты', 'success');
    }

    switchForms() {
        if (this.currentForm === 'login') {
            this.showForm('register');
            document.getElementById('switchText').textContent = 'Уже есть аккаунт?';
            document.getElementById('switchBtn').textContent = 'Войти';
        } else {
            this.showForm('login');
            document.getElementById('switchText').textContent = 'Нет аккаунта?';
            document.getElementById('switchBtn').textContent = 'Создать аккаунт';
        }
    }

    showForm(formType) {
        // Скрыть все формы
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });

        // Показать нужную форму
        const targetForm = document.getElementById(formType + 'Form');
        if (targetForm) {
            targetForm.classList.add('active');
            this.currentForm = formType;
        }

        // Обновить текст переключателя
        if (formType === 'login') {
            document.getElementById('switchText').textContent = 'Нет аккаунта?';
            document.getElementById('switchBtn').textContent = 'Создать аккаунт';
        } else if (formType === 'register') {
            document.getElementById('switchText').textContent = 'Уже есть аккаунт?';
            document.getElementById('switchBtn').textContent = 'Войти';
        }

        // Прокрутить к верху
        window.scrollTo(0, 0);
    }

    async handleLogin() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('rememberMe').checked;

        if (!username) {
            this.showNotification('Пожалуйста, введите имя пользователя или Telegram', 'error');
            return;
        }

        if (password.length < 6) {
            this.showNotification('Пароль должен содержать минимум 6 символов', 'error');
            return;
        }

        this.setLoading('loginBtn', true);

        try {
            // Имитация API запроса
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // В реальном приложении здесь будет fetch запрос
            const data = {
                success: true,
                token: 'demo_token_' + Date.now(),
                user: {
                    username: username,
                    role: 'user' // По умолчанию роль "пользователь"
                }
            };

            if (data.success) {
                this.showNotification('Успешный вход! Перенаправление...', 'success');
                
                if (data.token) {
                    localStorage.setItem('auth_token', data.token);
                    if (rememberMe) {
                        localStorage.setItem('remember_me', 'true');
                    }
                }

                setTimeout(() => {
                    this.redirectUser(data.user);
                }, 1500);

            } else {
                this.showNotification('Неверное имя пользователя или пароль', 'error');
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

        if (!this.validateTelegram(telegram)) {
            this.showNotification('Пожалуйста, введите корректный Telegram username (например: @username)', 'error');
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
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const data = {
                success: true
            };

            if (data.success) {
                this.showNotification('Регистрация успешна! Вы можете войти.', 'success');
                
                setTimeout(() => {
                    this.showForm('login');
                    document.getElementById('registerForm').reset();
                }, 2000);

            } else {
                this.showNotification('Ошибка регистрации. Возможно, пользователь уже существует', 'error');
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

        if (!this.validateTelegram(telegram)) {
            this.showNotification('Пожалуйста, введите корректный Telegram username (например: @username)', 'error');
            return;
        }

        this.setLoading('forgotBtn', true);

        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const data = {
                success: true
            };

            if (data.success) {
                this.showNotification('Ожидайте, в течение дня вам напишут в личные сообщения Telegram с вашим паролем', 'success');
                
                setTimeout(() => {
                    this.showForm('login');
                    document.getElementById('forgotPasswordForm').reset();
                }, 3000);

            } else {
                this.showNotification('Пользователь с таким Telegram не найден', 'error');
            }
        } catch (error) {
            console.error('Forgot password error:', error);
            this.showNotification('Ошибка соединения с сервером', 'error');
        } finally {
            this.setLoading('forgotBtn', false);
        }
    }

    validateTelegram(username) {
        // Проверяем формат Telegram username
        const telegramRegex = /^@?[a-zA-Z0-9_]{5,32}$/;
        return telegramRegex.test(username.replace('@', ''));
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

    toggleThemeOptions() {
        const themeOptions = document.getElementById('themeOptions');
        themeOptions.classList.toggle('show');
    }

    hideThemeOptions() {
        const themeOptions = document.getElementById('themeOptions');
        themeOptions.classList.remove('show');
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('selectedTheme', theme);
        this.hideThemeOptions();
    }

    applySavedTheme() {
        const savedTheme = localStorage.getItem('selectedTheme') || 'light';
        this.setTheme(savedTheme);
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
        
        // Иерархия ролей: пользователь → слушатель → совладелец → администратор → владелец
        const roleNames = {
            'user': 'Пользователь',
            'listener': 'Слушатель', 
            'coowner': 'Совладелец',
            'admin': 'Администратор',
            'owner': 'Владелец'
        };
        
        this.showNotification(`Добро пожаловать! Ваша роль: ${roleNames[role]}. В реальном приложении будет перенаправление`, 'success');
    }

    checkAuthState() {
        const token = localStorage.getItem('auth_token');
        if (token) {
            this.validateToken(token);
        }
    }

    async validateToken(token) {
        // В демо-версии пропускаем проверку токена
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.authManager = new AuthManager();
});
