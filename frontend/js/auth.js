// Auth functionality - FIXED TOKEN VERSION
class AuthManager {
    constructor() {
        this.currentForm = 'login';
        this.apiBase = '/auth';
        this.init();
    }

    init() {
        console.log('🔧 AuthManager - Fixed Token Version');
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
            console.log('🔄 Отправка запроса на вход...');
            
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

            // ПРОВЕРЯЕМ ОТВЕТ ПЕРЕД ПАРСИНГОМ
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('📨 Ответ сервера:', data);

            if (data.success && data.token) {
                console.log('✅ Успешный вход! Токен получен');
                
                // УСИЛЕННОЕ СОХРАНЕНИЕ ДАННЫХ
                this.saveAuthData(data.token, data.user, username, rememberMe);
                
                this.showNotification('Успешный вход! Перенаправляем...', 'success');

                // ПЕРЕНАПРАВЛЕНИЕ С ПРОВЕРКОЙ
                setTimeout(() => {
                    console.log('🚀 Перенаправление на chat.html');
                    console.log('🔍 Проверка сохраненного токена:', localStorage.getItem('auth_token') ? '✅ есть' : '❌ нет');
                    window.location.href = data.redirectTo || 'chat.html';
                }, 1000);

            } else {
                console.error('❌ Ошибка входа:', data.error);
                this.showNotification(data.error || 'Ошибка при входе', 'error');
            }
        } catch (error) {
            console.error('❌ Ошибка входа:', error);
            this.showNotification('Ошибка соединения с сервером: ' + error.message, 'error');
        } finally {
            this.setLoadingState('loginBtn', false);
        }
    }

    // УСИЛЕННЫЙ МЕТОД СОХРАНЕНИЯ
    saveAuthData(token, user, username, rememberMe) {
        try {
            console.log('💾 Начало сохранения данных...');
            
            // Очищаем ВСЕ старые данные
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            localStorage.removeItem('remember_me');
            localStorage.removeItem('username');
            
            sessionStorage.removeItem('auth_token');
            sessionStorage.removeItem('user_data');

            // Сохраняем в localStorage
            localStorage.setItem('auth_token', token);
            localStorage.setItem('user_data', JSON.stringify(user));
            
            if (rememberMe) {
                localStorage.setItem('remember_me', 'true');
                localStorage.setItem('username', username);
            }

            // Дублируем в sessionStorage для надежности
            sessionStorage.setItem('auth_token', token);
            sessionStorage.setItem('user_data', JSON.stringify(user));

            // ПРОВЕРЯЕМ СОХРАНЕНИЕ
            const savedToken = localStorage.getItem('auth_token');
            const savedUser = localStorage.getItem('user_data');

            console.log('💾 Данные сохранены:', {
                token: savedToken ? `✅ (${savedToken.substring(0, 20)}...)` : '❌ не сохранен',
                user: savedUser ? '✅ сохранен' : '❌ не сохранен',
                rememberMe: rememberMe ? '✅ включено' : '❌ выключено'
            });

            if (!savedToken) {
                throw new Error('Токен не сохранился в localStorage');
            }

        } catch (error) {
            console.error('❌ Критическая ошибка сохранения:', error);
            this.showNotification('Ошибка сохранения данных', 'error');
        }
    }

    async handleRegister() {
        const username = document.getElementById('registerUsername').value.trim();
        const telegram = document.getElementById('registerTelegram').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const acceptTerms = document.getElementById('acceptTerms').checked;

        // ВАЛИДАЦИЯ
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
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 4000);
    }

    checkExistingAuth() {
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        const user = localStorage.getItem('user_data') || sessionStorage.getItem('user_data');
        
        console.log('🔍 Проверка существующей авторизации:', { 
            token: token ? '✅ найден' : '❌ не найден',
            user: user ? '✅ найден' : '❌ не найден'
        });

        if (token && user) {
            console.log('✅ Обнаружена авторизация, перенаправляем...');
            this.showNotification('Обнаружена активная сессия, перенаправляем...', 'info');
            
            setTimeout(() => {
                window.location.href = 'chat.html';
            }, 1000);
        }

        const savedUsername = localStorage.getItem('username');
        if (savedUsername && document.getElementById('loginUsername')) {
            document.getElementById('loginUsername').value = savedUsername;
        }
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 AuthManager запущен');
    window.authManager = new AuthManager();
});

// ДЕБАГ ФУНКЦИИ ДЛЯ ПРОВЕРКИ
window.debugAuth = {
    checkStorage: function() {
        console.log('🔍 Проверка localStorage:', {
            auth_token: localStorage.getItem('auth_token'),
            user_data: localStorage.getItem('user_data'),
            remember_me: localStorage.getItem('remember_me'),
            username: localStorage.getItem('username')
        });
    },
    
    clearStorage: function() {
        localStorage.clear();
        sessionStorage.clear();
        console.log('🧹 Все данные очищены');
    },
    
    testToken: function() {
        const token = localStorage.getItem('auth_token');
        if (token) {
            console.log('✅ Токен есть:', token.substring(0, 20) + '...');
            return true;
        } else {
            console.log('❌ Токена нет');
            return false;
        }
    }
};
