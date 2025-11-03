// Auth functionality with Telegram username
class AuthManager {
    constructor() {
        this.currentForm = 'login';
        // ИСПРАВЛЕНО: убрал /api перед auth
        this.apiBase = '/auth';  // БЫЛО: '/api/auth'
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkExistingAuth();
        this.setupTermsModal();
        console.log('🔐 AuthManager инициализирован');
    }

    bindEvents() {
        // Форма входа
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Форма регистрации
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister();
            });
        }

        // Переключение между формами
        const switchBtn = document.getElementById('switchBtn');
        if (switchBtn) {
            switchBtn.addEventListener('click', () => {
                this.switchForms();
            });
        }

        // Ссылка "Забыли пароль?"
        const forgotPasswordLink = document.getElementById('forgotPasswordLink');
        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showForgotPassword();
            });
        }

        // Кнопка "Назад" в восстановлении пароля
        const backToLogin = document.getElementById('backToLogin');
        if (backToLogin) {
            backToLogin.addEventListener('click', () => {
                this.showForm('login');
            });
        }

        // Переключение видимости пароля
        this.setupPasswordToggle('loginPassword', 'toggleLoginPassword');
        this.setupPasswordToggle('registerPassword', 'toggleRegisterPassword');
        this.setupPasswordToggle('confirmPassword', 'toggleConfirmPassword');

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

    setupPasswordToggle(passwordFieldId, toggleButtonId) {
        const passwordField = document.getElementById(passwordFieldId);
        const toggleButton = document.getElementById(toggleButtonId);
        
        if (passwordField && toggleButton) {
            toggleButton.addEventListener('click', () => {
                this.togglePasswordVisibility(passwordField, toggleButton);
            });
        }
    }

    togglePasswordVisibility(passwordField, toggleButton) {
        const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordField.setAttribute('type', type);
        
        // Изменяем иконку
        const icon = toggleButton.querySelector('i');
        if (icon) {
            icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
        }
    }

    setupTermsModal() {
        const termsLink = document.getElementById('termsLink');
        const closeTerms = document.getElementById('closeTerms');
        const acceptTermsBtn = document.getElementById('acceptTermsBtn');

        if (termsLink) {
            termsLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showTermsModal();
            });
        }

        if (closeTerms) {
            closeTerms.addEventListener('click', () => {
                this.hideTermsModal();
            });
        }

        if (acceptTermsBtn) {
            acceptTermsBtn.addEventListener('click', () => {
                this.acceptTerms();
            });
        }

        // Клик вне модального окна
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('termsModal');
            if (e.target === modal) {
                this.hideTermsModal();
            }
        });
    }

    showTermsModal() {
        const modal = document.getElementById('termsModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    hideTermsModal() {
        const modal = document.getElementById('termsModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    acceptTerms() {
        const termsCheckbox = document.getElementById('acceptTerms');
        if (termsCheckbox) {
            termsCheckbox.checked = true;
        }
        this.hideTermsModal();
        this.showNotification('Условия приняты!', 'success');
    }

    async handleLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('rememberMe')?.checked || false;

        // Валидация
        if (!username) {
            this.showNotification('Введите имя пользователя или Telegram', 'error');
            return;
        }

        if (!password) {
            this.showNotification('Введите пароль', 'error');
            return;
        }

        this.setLoadingState('loginBtn', true);

        try {
            console.log('🔐 Отправка запроса на вход:', { username });
            console.log('📍 URL:', `${this.apiBase}/login`);
            
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

            console.log('📨 Статус ответа:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('📨 Ответ сервера:', data);

            if (data.success) {
                this.showNotification('Успешный вход! Перенаправляем...', 'success');
                
                // Сохраняем данные
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                if (rememberMe) {
                    localStorage.setItem('rememberMe', 'true');
                    localStorage.setItem('savedUsername', username);
                }

                // ГАРАНТИРОВАННОЕ ПЕРЕНАПРАВЛЕНИЕ
                this.forceRedirect(data.user, data.redirectTo);

            } else {
                this.showNotification(data.error || 'Ошибка при входе', 'error');
            }
        } catch (error) {
            console.error('❌ Ошибка входа:', error);
            this.showNotification('Ошибка соединения с сервером', 'error');
        } finally {
            this.setLoadingState('loginBtn', false);
        }
    }

    // ГАРАНТИРОВАННОЕ ПЕРЕНАПРАВЛЕНИЕ
    forceRedirect(user, redirectTo = null) {
        console.log('🔄 Принудительное перенаправление пользователя:', user);
        
        // Определяем целевой URL
        let targetUrl = redirectTo;
        if (!targetUrl) {
            targetUrl = this.getTargetPage(user);
        }
        
        console.log(`📍 Немедленное перенаправление на: ${targetUrl}`);
        
        // Используем replace чтобы нельзя было вернуться назад
        setTimeout(() => {
            window.location.href = targetUrl;
        }, 500);
    }

    getTargetPage(user) {
        // Определяем страницу назначения по роли
        const role = user?.role || 'user';
        const pages = {
            'user': 'chat.html',
            'listener': 'listener.html', 
            'admin': 'admin.html',
            'coowner': 'coowner.html',
            'owner': 'owner.html'
        };
        
        return pages[role] || 'chat.html';
    }

    async handleRegister() {
        const username = document.getElementById('registerUsername').value.trim();
        const telegram = document.getElementById('registerTelegram').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const acceptTerms = document.getElementById('acceptTerms').checked;

        // Валидация
        if (!username || username.length < 2) {
            this.showNotification('Имя пользователя должно содержать минимум 2 символа', 'error');
            return;
        }

        if (!telegram || !telegram.startsWith('@')) {
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

        this.setLoadingState('registerBtn', true);

        try {
            console.log('📍 URL регистрации:', `${this.apiBase}/register`);
            
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

            console.log('📨 Статус ответа:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                this.showNotification('Регистрация успешна! Теперь вы можете войти.', 'success');
                
                // Очищаем форму и переключаемся на вход
                setTimeout(() => {
                    document.getElementById('registerForm').reset();
                    this.showForm('login');
                }, 2000);

            } else {
                this.showNotification(data.error || 'Ошибка регистрации', 'error');
            }
        } catch (error) {
            console.error('❌ Ошибка регистрации:', error);
            this.showNotification('Ошибка соединения с сервером', 'error');
        } finally {
            this.setLoadingState('registerBtn', false);
        }
    }

    showForgotPassword() {
        this.showNotification('Для восстановления пароля обратитесь к администратору в Telegram', 'info');
    }

    showForm(formType) {
        console.log(`📝 Переключение на форму: ${formType}`);
        
        // Скрываем все формы
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });

        // Показываем нужную форму
        const targetForm = document.getElementById(`${formType}Form`);
        if (targetForm) {
            targetForm.classList.add('active');
            this.currentForm = formType;
        }

        // Обновляем текст переключателя
        this.updateSwitchText();
    }

    updateSwitchText() {
        const switchText = document.getElementById('switchText');
        const switchBtn = document.getElementById('switchBtn');
        
        if (!switchText || !switchBtn) return;

        if (this.currentForm === 'login') {
            switchText.textContent = 'Нет аккаунта?';
            switchBtn.textContent = 'Создать аккаунт';
        } else {
            switchText.textContent = 'Уже есть аккаунт?';
            switchBtn.textContent = 'Войти';
        }
    }

    switchForms() {
        if (this.currentForm === 'login') {
            this.showForm('register');
        } else {
            this.showForm('login');
        }
    }

    setLoadingState(buttonId, isLoading) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        const originalText = button.textContent;

        if (isLoading) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка...';
            button.classList.add('loading');
        } else {
            button.disabled = false;
            button.textContent = originalText;
            button.classList.remove('loading');
        }
    }

    showNotification(message, type = 'info') {
        console.log(`📢 Уведомление [${type}]: ${message}`);
        
        // Создаем контейнер для уведомлений если его нет
        let container = document.getElementById('notifications');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notifications';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
            `;
            document.body.appendChild(container);
        }

        // Создаем уведомление
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            margin-bottom: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideInRight 0.3s ease;
            display: flex;
            align-items: center;
            gap: 10px;
            cursor: pointer;
        `;

        // Добавляем иконку
        const icon = document.createElement('i');
        icon.className = type === 'success' ? 'fas fa-check-circle' : 
                         type === 'error' ? 'fas fa-exclamation-circle' : 'fas fa-info-circle';
        notification.appendChild(icon);

        // Добавляем текст
        const text = document.createElement('span');
        text.textContent = message;
        notification.appendChild(text);

        // Клик для закрытия
        notification.addEventListener('click', () => {
            this.removeNotification(notification);
        });

        // Добавляем в контейнер
        container.appendChild(notification);

        // Удаляем через 5 секунд
        setTimeout(() => {
            this.removeNotification(notification);
        }, 5000);

        // Добавляем стили анимации если их нет
        this.ensureNotificationStyles();
    }

    removeNotification(notification) {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }

    ensureNotificationStyles() {
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
            `;
            document.head.appendChild(style);
        }
    }

    checkExistingAuth() {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        console.log('🔍 Проверка существующей авторизации:', { 
            hasToken: !!token, 
            user: user 
        });

        // Если пользователь уже авторизован и находится на странице входа - перенаправляем
        if (token && user.id) {
            console.log('✅ Пользователь уже авторизован, принудительное перенаправление...');
            
            // Мгновенное перенаправление
            setTimeout(() => {
                this.forceRedirect(user);
            }, 1000);
        }

        // Восстанавливаем сохраненное имя пользователя
        const savedUsername = localStorage.getItem('savedUsername');
        if (savedUsername && document.getElementById('loginUsername')) {
            document.getElementById('loginUsername').value = savedUsername;
        }
    }

    // Вспомогательный метод для выхода
    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('rememberMe');
        window.location.href = 'index.html';
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM загружен, инициализация системы авторизации');
    
    // Проверяем, не на странице ли мы входа
    const isAuthPage = window.location.pathname.includes('index.html') || 
                      window.location.pathname === '/' || 
                      window.location.pathname.includes('login');
    
    if (!isAuthPage) {
        console.log('📍 Не на странице входа, проверяем авторизацию...');
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (!token || !user.id) {
            console.log('❌ Нет авторизации, перенаправление на вход');
            window.location.href = 'index.html';
            return;
        }
    }
    
    window.authManager = new AuthManager();
});

// Глобальная функция для выхода (можно вызывать из других скриптов)
window.logoutUser = function() {
    if (window.authManager) {
        window.authManager.logout();
    } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    }
};
