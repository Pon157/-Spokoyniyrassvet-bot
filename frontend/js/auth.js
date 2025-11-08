// Auth functionality with Telegram username - VERSION 3.0 FIXED Token Storage
class AuthManager {
    constructor() {
        this.currentForm = 'login';
        this.apiBase = '/auth';
        this.init();
    }

    init() {
        console.log('AuthManager v3.0 - Fixed Token Storage');
        console.log('API Base URL:', this.apiBase);
        this.bindEvents();
        this.checkExistingAuth();
        this.setupTermsModal();
        this.fixCheckboxValidation();
    }

    fixCheckboxValidation() {
        const termsCheckbox = document.getElementById('acceptTerms');
        if (termsCheckbox) {
            termsCheckbox.required = false;
            termsCheckbox.style.opacity = '1';
            termsCheckbox.style.position = 'relative';
            console.log('Checkbox validation fixed');
        }
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
            registerForm.setAttribute('novalidate', 'true');
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
            termsCheckbox.classList.add('accepted');
        }
        this.hideTermsModal();
        this.showNotification('Условия приняты!', 'success');
    }

    async handleLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('rememberMe')?.checked || false;

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
            console.log('🔄 Отправка запроса на вход:', { username });
            
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

            console.log('📊 Статус ответа:', response.status);

            const data = await response.json();
            console.log('📨 Полный ответ сервера:', data);

            if (data.success && data.token) {
                console.log('✅ Успешный вход, токен получен');
                
                // УСИЛЕННОЕ СОХРАНЕНИЕ ДАННЫХ
                this.saveAuthData(data.token, data.user, username, rememberMe);
                
                this.showNotification('Успешный вход! Перенаправляем...', 'success');

                // ПРОВЕРКА СОХРАНЕНИЯ ПЕРЕД ПЕРЕНАПРАВЛЕНИЕМ
                setTimeout(() => {
                    const savedToken = localStorage.getItem('token');
                    const savedUser = localStorage.getItem('user');
                    console.log('🔍 Проверка сохраненных данных:', {
                        token: savedToken ? '✅ сохранен' : '❌ отсутствует',
                        user: savedUser ? '✅ сохранен' : '❌ отсутствует'
                    });

                    if (!savedToken) {
                        this.showNotification('Ошибка: токен не сохранился', 'error');
                        return;
                    }

                    // ПЕРЕНАПРАВЛЕНИЕ С ПАРАМЕТРАМИ
                    const redirectTo = data.redirectTo || 'chat.html';
                    console.log('🚀 Перенаправление на:', redirectTo);
                    
                    // Принудительное перенаправление
                    window.location.href = redirectTo + '?auth=success&t=' + Date.now();
                    
                }, 1500);

            } else {
                console.error('❌ Ошибка входа:', data.error);
                this.showNotification(data.error || 'Ошибка при входе', 'error');
            }
        } catch (error) {
            console.error('❌ Ошибка входа:', error);
            this.showNotification('Ошибка соединения с сервером', 'error');
        } finally {
            this.setLoadingState('loginBtn', false);
        }
    }

    // УСИЛЕННЫЙ МЕТОД СОХРАНЕНИЯ ДАННЫХ
    saveAuthData(token, user, username, rememberMe) {
        try {
            // Очищаем предыдущие данные
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('rememberMe');
            localStorage.removeItem('savedUsername');

            // Сохраняем новые данные
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            
            if (rememberMe) {
                localStorage.setItem('rememberMe', 'true');
                localStorage.setItem('savedUsername', username);
            }

            // Дублируем в sessionStorage для надежности
            sessionStorage.setItem('token', token);
            sessionStorage.setItem('user', JSON.stringify(user));

            console.log('💾 Данные сохранены:', {
                token: token ? '✅' : '❌',
                user: user ? '✅' : '❌',
                rememberMe: rememberMe ? '✅' : '❌'
            });

        } catch (error) {
            console.error('❌ Ошибка сохранения данных:', error);
        }
    }

    async handleRegister() {
        const username = document.getElementById('registerUsername').value.trim();
        const telegram = document.getElementById('registerTelegram').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const acceptTerms = document.getElementById('acceptTerms').checked;

        // КАСТОМНАЯ ВАЛИДАЦИЯ
        if (!username || username.length < 2) {
            this.showNotification('Имя пользователя должно содержать минимум 2 символа', 'error');
            this.highlightField('registerUsername', true);
            return;
        } else {
            this.highlightField('registerUsername', false);
        }

        if (!telegram || !telegram.startsWith('@')) {
            this.showNotification('Telegram должен начинаться с @', 'error');
            this.highlightField('registerTelegram', true);
            return;
        } else {
            this.highlightField('registerTelegram', false);
        }

        if (password.length < 6) {
            this.showNotification('Пароль должен содержать минимум 6 символов', 'error');
            this.highlightField('registerPassword', true);
            return;
        } else {
            this.highlightField('registerPassword', false);
        }

        if (password !== confirmPassword) {
            this.showNotification('Пароли не совпадают', 'error');
            this.highlightField('confirmPassword', true);
            return;
        } else {
            this.highlightField('confirmPassword', false);
        }

        if (!acceptTerms) {
            this.showNotification('Необходимо принять условия использования', 'error');
            const termsLabel = document.querySelector('label[for="acceptTerms"]');
            if (termsLabel) {
                termsLabel.style.color = '#f44336';
                termsLabel.style.fontWeight = 'bold';
            }
            return;
        } else {
            const termsLabel = document.querySelector('label[for="acceptTerms"]');
            if (termsLabel) {
                termsLabel.style.color = '';
                termsLabel.style.fontWeight = '';
            }
        }

        this.setLoadingState('registerBtn', true);

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

            if (data.success) {
                this.showNotification('Регистрация успешна! Теперь вы можете войти.', 'success');
                
                setTimeout(() => {
                    document.getElementById('registerForm').reset();
                    this.showForm('login');
                }, 2000);

            } else {
                this.showNotification(data.error || 'Ошибка регистрации', 'error');
            }
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            this.showNotification('Ошибка соединения с сервером', 'error');
        } finally {
            this.setLoadingState('registerBtn', false);
        }
    }

    highlightField(fieldId, isError) {
        const field = document.getElementById(fieldId);
        if (field) {
            if (isError) {
                field.style.borderColor = '#f44336';
                field.style.boxShadow = '0 0 0 2px rgba(244, 67, 54, 0.1)';
            } else {
                field.style.borderColor = '';
                field.style.boxShadow = '';
            }
        }
    }

    showForgotPassword() {
        this.showNotification('Для восстановления пароля обратитесь к администратору в Telegram', 'info');
    }

    showForm(formType) {
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });

        const targetForm = document.getElementById(`${formType}Form`);
        if (targetForm) {
            targetForm.classList.add('active');
            this.currentForm = formType;
        }

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
        `;

        const icon = document.createElement('i');
        icon.className = type === 'success' ? 'fas fa-check-circle' : 
                         type === 'error' ? 'fas fa-exclamation-circle' : 'fas fa-info-circle';
        notification.appendChild(icon);

        const text = document.createElement('span');
        text.textContent = message;
        notification.appendChild(text);

        container.appendChild(notification);

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

        if (!document.getElementById('notificationStyles')) {
            const style = document.createElement('style');
            style.id = 'notificationStyles';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
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

        // ЕСЛИ УЖЕ АВТОРИЗОВАНЫ - ПЕРЕНАПРАВЛЯЕМ СРАЗУ
        if (token && user.id) {
            console.log('✅ Обнаружена существующая авторизация, перенаправляем на chat.html');
            this.showNotification('Обнаружена активная сессия, перенаправляем...', 'info');
            
            setTimeout(() => {
                window.location.href = 'chat.html?auth=existing';
            }, 1000);
            return;
        }

        // Восстанавливаем имя пользователя для формы
        const savedUsername = localStorage.getItem('savedUsername');
        if (savedUsername && document.getElementById('loginUsername')) {
            document.getElementById('loginUsername').value = savedUsername;
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM загружен, инициализация системы авторизации v3.0');
    window.authManager = new AuthManager();
});

// Функции для отладки
window.authDebug = {
    forceRedirect: function() {
        console.log('🔄 Принудительное перенаправление на chat.html');
        window.location.href = 'chat.html?debug=forced';
    },
    
    checkAuth: function() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        console.log('🔍 Текущая авторизация:', {
            token: token ? '✅ присутствует' : '❌ отсутствует',
            user: user ? '✅ присутствует' : '❌ отсутствует',
            fullToken: token,
            fullUser: user
        });
        return { token, user: JSON.parse(user || '{}') };
    },
    
    clearAuth: function() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('savedUsername');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        console.log('🧹 Auth data cleared');
    }
};

console.log('🐛 Debug functions: authDebug.forceRedirect(), authDebug.checkAuth(), authDebug.clearAuth()');
