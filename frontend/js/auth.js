class AuthManager {
    constructor() {
        console.log('🚀 AuthManager запущен');
        this.currentForm = 'login';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkExistingAuth();
        this.initializeAnimations();
    }

    setupEventListeners() {
        console.log('🎯 Настройка обработчиков событий...');

        // Основное переключение между входом и регистрацией
        const switchBtn = document.getElementById('switchBtn');
        const switchText = document.getElementById('switchText');

        if (switchBtn && switchText) {
            switchBtn.addEventListener('click', () => {
                this.switchForm();
            });
        }

        // Кнопка "Назад к входу" из формы восстановления
        const backToLogin = document.getElementById('backToLogin');
        if (backToLogin) {
            backToLogin.addEventListener('click', () => {
                this.showForm('login');
            });
        }

        // Ссылка "Забыли пароль?"
        const forgotPasswordLink = document.getElementById('forgotPasswordLink');
        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showForm('forgot');
            });
        }

        // Обработчики отправки форм
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const forgotPasswordForm = document.getElementById('forgotPasswordForm');

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

        if (forgotPasswordForm) {
            forgotPasswordForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleForgotPassword();
            });
        }

        // Переключение видимости пароля
        this.setupPasswordToggles();

        // Модальное окно условий использования
        this.setupTermsModal();

        console.log('✅ Все обработчики событий настроены');
    }

    switchForm() {
        if (this.currentForm === 'login') {
            this.showForm('register');
        } else {
            this.showForm('login');
        }
    }

    showForm(formName) {
        console.log('🔄 Переключение на форму:', formName);
        
        // Скрываем все формы
        const forms = document.querySelectorAll('.auth-form');
        forms.forEach(form => form.classList.remove('active'));

        // Показываем нужную форму
        const targetForm = document.getElementById(formName + 'Form');
        if (targetForm) {
            targetForm.classList.add('active');
        }

        // Обновляем текст переключателя
        const switchBtn = document.getElementById('switchBtn');
        const switchText = document.getElementById('switchText');

        if (formName === 'login') {
            if (switchText) switchText.textContent = 'Нет аккаунта?';
            if (switchBtn) switchBtn.textContent = 'Создать аккаунт';
            this.currentForm = 'login';
        } else if (formName === 'register') {
            if (switchText) switchText.textContent = 'Уже есть аккаунт?';
            if (switchBtn) switchBtn.textContent = 'Войти';
            this.currentForm = 'register';
        } else if (formName === 'forgot') {
            // Скрываем переключатель для формы восстановления
            const authSwitch = document.querySelector('.auth-switch');
            if (authSwitch) authSwitch.style.display = 'none';
        } else {
            // Показываем переключатель для других форм
            const authSwitch = document.querySelector('.auth-switch');
            if (authSwitch) authSwitch.style.display = 'block';
        }

        this.clearErrors();
    }

    setupPasswordToggles() {
        const toggleLogin = document.getElementById('toggleLoginPassword');
        const toggleRegister = document.getElementById('toggleRegisterPassword');

        if (toggleLogin) {
            toggleLogin.addEventListener('click', () => {
                this.togglePasswordVisibility('loginPassword', toggleLogin);
            });
        }

        if (toggleRegister) {
            toggleRegister.addEventListener('click', () => {
                this.togglePasswordVisibility('registerPassword', toggleRegister);
            });
        }
    }

    togglePasswordVisibility(passwordFieldId, toggleButton) {
        const passwordField = document.getElementById(passwordFieldId);
        const icon = toggleButton.querySelector('i');
        
        if (passwordField.type === 'password') {
            passwordField.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            passwordField.type = 'password';
            icon.className = 'fas fa-eye';
        }
    }

    setupTermsModal() {
        const termsLink = document.getElementById('termsLink');
        const closeTermsModal = document.getElementById('closeTermsModal');
        const acceptTermsBtn = document.getElementById('acceptTermsBtn');
        const cancelTermsBtn = document.getElementById('cancelTermsBtn');
        const modalAcceptTerms = document.getElementById('modalAcceptTerms');
        const termsModal = document.getElementById('termsModal');

        if (termsLink) {
            termsLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showTermsModal();
            });
        }

        if (closeTermsModal) {
            closeTermsModal.addEventListener('click', () => {
                this.hideTermsModal();
            });
        }

        if (cancelTermsBtn) {
            cancelTermsBtn.addEventListener('click', () => {
                this.hideTermsModal();
            });
        }

        if (modalAcceptTerms) {
            modalAcceptTerms.addEventListener('change', () => {
                const acceptTermsBtn = document.getElementById('acceptTermsBtn');
                if (acceptTermsBtn) {
                    acceptTermsBtn.disabled = !modalAcceptTerms.checked;
                }
            });
        }

        if (acceptTermsBtn) {
            acceptTermsBtn.addEventListener('click', () => {
                this.acceptTerms();
            });
        }

        // Закрытие модального окна при клике вне его
        if (termsModal) {
            termsModal.addEventListener('click', (e) => {
                if (e.target === termsModal) {
                    this.hideTermsModal();
                }
            });
        }
    }

    showTermsModal() {
        const termsModal = document.getElementById('termsModal');
        if (termsModal) {
            termsModal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    hideTermsModal() {
        const termsModal = document.getElementById('termsModal');
        if (termsModal) {
            termsModal.classList.remove('show');
            document.body.style.overflow = '';
        }
    }

    acceptTerms() {
        const acceptTermsCheckbox = document.getElementById('acceptTerms');
        if (acceptTermsCheckbox) {
            acceptTermsCheckbox.checked = true;
        }
        this.hideTermsModal();
        this.showNotification('Условия приняты', 'success');
    }

    initializeAnimations() {
        // Инициализация анимированных полей ввода
        const inputs = document.querySelectorAll('.animated-input input');
        inputs.forEach(input => {
            // Помечаем поле как заполненное если есть значение
            if (input.value) {
                input.classList.add('filled');
            }

            input.addEventListener('blur', () => {
                if (input.value) {
                    input.classList.add('filled');
                } else {
                    input.classList.remove('filled');
                }
            });
        });
    }

    clearErrors() {
        // Очищаем все сообщения об ошибках
        const errorMessages = document.querySelectorAll('.error-message');
        errorMessages.forEach(error => {
            error.textContent = '';
            error.classList.remove('show', 'success');
        });
    }

    checkExistingAuth() {
        const token = localStorage.getItem('auth_token');
        const userData = localStorage.getItem('user_data');
        
        console.log('🔍 Проверка существующей авторизации:', {
            token: token ? '✅ найден' : '❌ не найден',
            user: userData ? '✅ найден' : '❌ не найден'
        });

        if (token && userData) {
            try {
                const user = JSON.parse(userData);
                console.log('🔐 Пользователь уже аутентифицирован:', user.username);
                
                // Перенаправляем на правильную страницу
                const redirectTo = this.getRedirectPageForRole(user.role);
                console.log('🎯 Автоматическое перенаправление на:', redirectTo);
                
                setTimeout(() => {
                    window.location.href = redirectTo;
                }, 500);
                
            } catch (error) {
                console.error('❌ Ошибка проверки аутентификации:', error);
                this.clearAuth();
            }
        }
    }

    async handleLogin() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        const loginBtn = document.getElementById('loginBtn');

        console.log('🔐 Попытка входа:', username);

        if (!username || !password) {
            this.showNotification('Заполните все поля', 'error');
            return;
        }

        try {
            this.setLoading(loginBtn, true);

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            console.log('📨 Ответ сервера:', data);

            if (response.ok && data.success) {
                console.log('✅ Вход успешен:', data.user.username);
                
                // Сохраняем токен и данные пользователя
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('user_data', JSON.stringify(data.user));
                
                this.showNotification('Вход выполнен успешно!', 'success');
                
                // Перенаправляем на указанную страницу
                setTimeout(() => {
                    window.location.href = data.redirectTo || this.getRedirectPageForRole(data.user.role);
                }, 1000);
                
            } else {
                console.log('❌ Ошибка входа:', data.error);
                this.showNotification(data.error || 'Ошибка входа', 'error');
            }
        } catch (error) {
            console.error('❌ Ошибка входа:', error);
            this.showNotification('Ошибка соединения с сервером', 'error');
        } finally {
            this.setLoading(loginBtn, false);
        }
    }

    async handleRegister() {
        const username = document.getElementById('registerUsername').value;
        const telegram = document.getElementById('registerTelegram').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const acceptTerms = document.getElementById('acceptTerms').checked;
        const registerBtn = document.getElementById('registerBtn');

        console.log('👤 Попытка регистрации:', username);

        // Валидация
        if (!username || !telegram || !password || !confirmPassword) {
            this.showNotification('Заполните все поля', 'error');
            return;
        }

        if (username.length < 2) {
            this.showNotification('Имя пользователя должно содержать минимум 2 символа', 'error');
            return;
        }

        if (!telegram.startsWith('@')) {
            this.showNotification('Telegram должен начинаться с @', 'error');
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
            this.showNotification('Необходимо принять условия использования', 'error');
            return;
        }

        try {
            this.setLoading(registerBtn, true);

            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    telegram_username: telegram,
                    password
                })
            });

            const data = await response.json();
            console.log('📨 Ответ сервера:', data);

            if (response.ok && data.success) {
                console.log('✅ Регистрация успешна:', data.user.username);
                this.showNotification('Регистрация успешна! Теперь вы можете войти.', 'success');
                
                // Переключаем на форму логина
                setTimeout(() => {
                    this.showForm('login');
                    
                    // Очищаем форму регистрации
                    document.getElementById('registerUsername').value = '';
                    document.getElementById('registerTelegram').value = '';
                    document.getElementById('registerPassword').value = '';
                    document.getElementById('confirmPassword').value = '';
                    document.getElementById('acceptTerms').checked = false;
                }, 2000);
                
            } else {
                console.log('❌ Ошибка регистрации от сервера:', data.error);
                this.showNotification(data.error || 'Ошибка регистрации', 'error');
            }
        } catch (error) {
            console.error('❌ Ошибка регистрации:', error);
            this.showNotification('Ошибка соединения с сервером', 'error');
        } finally {
            this.setLoading(registerBtn, false);
        }
    }

    async handleForgotPassword() {
        const telegram = document.getElementById('forgotTelegram').value;
        const forgotBtn = document.getElementById('forgotBtn');

        console.log('🔑 Восстановление пароля для:', telegram);

        if (!telegram || !telegram.startsWith('@')) {
            this.showNotification('Введите корректный Telegram username', 'error');
            return;
        }

        try {
            this.setLoading(forgotBtn, true);

            // Временная реализация - имитация запроса
            await new Promise(resolve => setTimeout(resolve, 2000));

            this.showNotification(
                'Запрос отправлен! Ожидайте сообщение в Telegram в течение дня.',
                'success'
            );

            // Очищаем поле и возвращаем к форме входа
            setTimeout(() => {
                document.getElementById('forgotTelegram').value = '';
                this.showForm('login');
            }, 3000);

        } catch (error) {
            console.error('❌ Ошибка восстановления пароля:', error);
            this.showNotification('Ошибка при отправке запроса', 'error');
        } finally {
            this.setLoading(forgotBtn, false);
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

    setLoading(button, isLoading) {
        if (!button) return;
        
        if (isLoading) {
            button.classList.add('loading');
            button.disabled = true;
        } else {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    showNotification(message, type = 'info') {
        console.log(`📢 Уведомление [${type}]:`, message);
        
        const container = document.getElementById('notificationsContainer');
        if (!container) {
            console.warn('⚠️ Контейнер уведомлений не найден');
            return;
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="notification-icon ${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close">&times;</button>
        `;

        // Добавляем базовые стили если их нет
        if (!document.querySelector('#notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: white;
                    padding: 16px 20px;
                    border-radius: 12px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    max-width: 400px;
                    z-index: 10000;
                    animation: slideInRight 0.3s ease;
                    border-left: 4px solid #ff7e5f;
                }
                .notification.success {
                    border-left-color: #10b981;
                }
                .notification.error {
                    border-left-color: #ef4444;
                }
                .notification.warning {
                    border-left-color: #f59e0b;
                }
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex: 1;
                }
                .notification-close {
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    color: #6b7280;
                    padding: 4px;
                }
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }

        container.appendChild(notification);

        // Закрытие при клике
        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                notification.remove();
            });
        }

        // Автоматическое скрытие
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            'success': 'fas fa-check-circle',
            'error': 'fas fa-exclamation-circle',
            'warning': 'fas fa-exclamation-triangle',
            'info': 'fas fa-info-circle'
        };
        return icons[type] || 'fas fa-info-circle';
    }

    clearAuth() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 DOM загружен, инициализация AuthManager');
    window.authManager = new AuthManager();
});

// Глобальный обработчик ошибок
window.addEventListener('error', function(e) {
    console.error('🚨 Глобальная ошибка:', e.error);
});
