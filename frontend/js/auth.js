class AuthManager {
    constructor() {
        console.log('🚀 AuthManager запущен');
        this.currentForm = 'login';
        this.API_BASE = '/api/auth'; // Используем относительные пути
        this.isOnline = true;
        this.init();
    }

    init() {
        console.log('🎯 Инициализация AuthManager');
        this.waitForDOM()
            .then(() => {
                this.setupEventListeners();
                this.checkExistingAuth();
                this.checkServerStatus();
            })
            .catch(error => {
                console.error('❌ Ошибка инициализации:', error);
                this.showNotification('Ошибка инициализации системы', 'error');
            });
    }

    waitForDOM() {
        return new Promise((resolve) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }

    setupEventListeners() {
        console.log('🎯 Настройка обработчиков событий...');

        try {
            // Основные элементы
            const elements = {
                switchBtn: document.getElementById('switchBtn'),
                backToLogin: document.getElementById('backToLogin'),
                forgotPasswordLink: document.getElementById('forgotPasswordLink'),
                loginForm: document.getElementById('loginForm'),
                registerForm: document.getElementById('registerForm'),
                forgotPasswordForm: document.getElementById('forgotPasswordForm')
            };

            // Проверка наличия элементов
            Object.entries(elements).forEach(([name, element]) => {
                if (!element) {
                    console.error(`❌ Элемент ${name} не найден`);
                }
            });

            // Обработчики событий
            if (elements.switchBtn) {
                elements.switchBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.switchForm();
                });
            }

            if (elements.backToLogin) {
                elements.backToLogin.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.showForm('login');
                });
            }

            if (elements.forgotPasswordLink) {
                elements.forgotPasswordLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.showForm('forgot');
                });
            }

            // Обработчики форм
            if (elements.loginForm) {
                elements.loginForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleLogin();
                });
            }

            if (elements.registerForm) {
                elements.registerForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleRegister();
                });
            }

            if (elements.forgotPasswordForm) {
                elements.forgotPasswordForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleForgotPassword();
                });
            }

            // Дополнительные настройки
            this.setupPasswordToggles();
            this.setupTermsModal();
            this.setupInputValidation();

            console.log('✅ Все обработчики событий настроены');

        } catch (error) {
            console.error('❌ Ошибка настройки обработчиков:', error);
            this.showNotification('Ошибка инициализации интерфейса', 'error');
        }
    }

    setupInputValidation() {
        // Валидация в реальном времени
        const inputs = document.querySelectorAll('input[required]');
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => this.clearFieldError(input));
        });

        // Валидация Telegram username
        const telegramInput = document.getElementById('registerTelegram');
        if (telegramInput) {
            telegramInput.addEventListener('input', (e) => {
                const value = e.target.value;
                if (value && !value.startsWith('@')) {
                    e.target.value = '@' + value.replace('@', '');
                }
            });
        }
    }

    validateField(field) {
        const value = field.value.trim();
        let isValid = true;
        let message = '';

        switch (field.type) {
            case 'text':
                if (field.id.includes('username') && value.length < 2) {
                    isValid = false;
                    message = 'Минимум 2 символа';
                }
                break;
            case 'password':
                if (value.length < 6) {
                    isValid = false;
                    message = 'Минимум 6 символов';
                }
                break;
        }

        if (!isValid) {
            this.showFieldError(field, message);
        }

        return isValid;
    }

    showFieldError(field, message) {
        this.clearFieldError(field);
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            color: #ef4444;
            font-size: 12px;
            margin-top: 4px;
        `;
        
        field.parentNode.appendChild(errorDiv);
        field.style.borderColor = '#ef4444';
    }

    clearFieldError(field) {
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
        field.style.borderColor = '';
    }

    async checkServerStatus() {
        try {
            const response = await fetch('/health', {
                method: 'GET',
                timeout: 5000
            });
            
            if (response.ok) {
                this.isOnline = true;
                console.log('✅ Сервер доступен');
            } else {
                this.isOnline = false;
                console.warn('⚠️ Сервер отвечает с ошибкой');
            }
        } catch (error) {
            this.isOnline = false;
            console.error('❌ Сервер недоступен:', error);
        }
    }

    switchForm() {
        console.log('🔄 Переключение формы');
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
        forms.forEach(form => {
            form.classList.remove('active');
            console.log('Скрыта форма:', form.id);
        });

        // Показываем нужную форму
        const targetForm = document.getElementById(formName + 'Form');
        if (targetForm) {
            targetForm.classList.add('active');
            console.log('Показана форма:', targetForm.id);
        }

        // Обновляем текст переключателя
        const switchBtn = document.getElementById('switchBtn');
        const switchText = document.getElementById('switchText');

        if (formName === 'login') {
            if (switchText) {
                switchText.textContent = 'Нет аккаунта?';
                console.log('Текст переключателя обновлен: Нет аккаунта?');
            }
            if (switchBtn) {
                switchBtn.textContent = 'Создать аккаунт';
                console.log('Текст кнопки обновлен: Создать аккаунт');
            }
            this.currentForm = 'login';
            
            // Показываем переключатель
            const authSwitch = document.querySelector('.auth-switch');
            if (authSwitch) authSwitch.style.display = 'block';
        } else if (formName === 'register') {
            if (switchText) {
                switchText.textContent = 'Уже есть аккаунт?';
                console.log('Текст переключателя обновлен: Уже есть аккаунт?');
            }
            if (switchBtn) {
                switchBtn.textContent = 'Войти';
                console.log('Текст кнопки обновлен: Войти');
            }
            this.currentForm = 'register';
            
            // Показываем переключатель
            const authSwitch = document.querySelector('.auth-switch');
            if (authSwitch) authSwitch.style.display = 'block';
        } else if (formName === 'forgot') {
            // Скрываем переключатель для формы восстановления
            const authSwitch = document.querySelector('.auth-switch');
            if (authSwitch) {
                authSwitch.style.display = 'none';
                console.log('Переключатель скрыт для формы восстановления');
            }
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
        console.log('🔐 Обработка входа...');
        
        const username = document.getElementById('loginUsername');
        const password = document.getElementById('loginPassword');
        const loginBtn = document.getElementById('loginBtn');

        if (!username || !password) {
            console.error('❌ Поля ввода не найдены');
            this.showNotification('Ошибка: поля ввода не найдены', 'error');
            return;
        }

        const usernameValue = username.value.trim();
        const passwordValue = password.value;

        console.log('Введенные данные:', { username: usernameValue, password: '***' });

        if (!usernameValue || !passwordValue) {
            this.showNotification('Заполните все поля', 'error');
            return;
        }

        try {
            this.setLoading(loginBtn, true);

            // Проверка доступности сервера
            if (!this.isOnline) {
                await this.checkServerStatus();
                if (!this.isOnline) {
                    this.showNotification('Сервер недоступен. Проверьте подключение и запустите сервер.', 'error');
                    return;
                }
            }

            console.log('🔄 Отправка запроса на вход...');

            const response = await fetch(`${this.API_BASE}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    username: usernameValue, 
                    password: passwordValue 
                })
            });

            console.log('📊 Статус ответа:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Ошибка сервера:', errorText);
                throw new Error('Ошибка сервера: ' + response.status);
            }

            const data = await response.json();
            console.log('📨 Ответ сервера:', data);

            if (data.success) {
                await this.handleSuccessfulAuth(data);
            } else {
                this.handleAuthError(data.error || 'Ошибка входа');
            }
        } catch (error) {
            console.error('❌ Ошибка входа:', error);
            this.handleNetworkError(error);
        } finally {
            this.setLoading(loginBtn, false);
        }
    }

    async handleRegister() {
        console.log('👤 Обработка регистрации...');
        
        const formData = {
            username: document.getElementById('registerUsername')?.value.trim(),
            telegram: document.getElementById('registerTelegram')?.value.trim(),
            password: document.getElementById('registerPassword')?.value,
            confirmPassword: document.getElementById('confirmPassword')?.value,
            acceptTerms: document.getElementById('acceptTerms')?.checked
        };

        const registerBtn = document.getElementById('registerBtn');

        // Валидация
        const validation = this.validateRegistration(formData);
        if (!validation.isValid) {
            this.showNotification(validation.message, 'error');
            return;
        }

        try {
            this.setLoading(registerBtn, true);

            // Проверка доступности сервера
            if (!this.isOnline) {
                await this.checkServerStatus();
                if (!this.isOnline) {
                    this.showNotification('Сервер недоступен. Проверьте подключение и запустите сервер.', 'error');
                    return;
                }
            }

            console.log('🔄 Отправка запроса на регистрацию...');

            const response = await fetch(`${this.API_BASE}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: formData.username,
                    telegram_username: formData.telegram,
                    password: formData.password
                })
            });

            console.log('📊 Статус ответа:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Ошибка сервера:', errorText);
                throw new Error('Ошибка сервера: ' + response.status);
            }

            const data = await response.json();
            console.log('📨 Ответ сервера:', data);

            if (data.success) {
                await this.handleSuccessfulRegistration(data);
            } else {
                this.handleAuthError(data.error || 'Ошибка регистрации');
            }
        } catch (error) {
            console.error('❌ Ошибка регистрации:', error);
            this.handleNetworkError(error);
        } finally {
            this.setLoading(registerBtn, false);
        }
    }

    validateRegistration(formData) {
        const { username, telegram, password, confirmPassword, acceptTerms } = formData;

        if (!username || !telegram || !password || !confirmPassword) {
            return { isValid: false, message: 'Заполните все поля' };
        }

        if (username.length < 2) {
            return { isValid: false, message: 'Имя пользователя должно содержать минимум 2 символа' };
        }

        if (!telegram.startsWith('@')) {
            return { isValid: false, message: 'Telegram должен начинаться с @' };
        }

        if (password.length < 6) {
            return { isValid: false, message: 'Пароль должен содержать минимум 6 символов' };
        }

        if (password !== confirmPassword) {
            return { isValid: false, message: 'Пароли не совпадают' };
        }

        if (!acceptTerms) {
            return { isValid: false, message: 'Необходимо принять условия использования' };
        }

        return { isValid: true };
    }

    async handleSuccessfulAuth(data) {
        console.log('✅ Вход успешен:', data.user.username);
        
        // Сохраняем данные аутентификации
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user_data', JSON.stringify(data.user));
        
        this.showNotification('Вход выполнен успешно!', 'success');
        
        // Задержка для отображения уведомления
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Перенаправление
        const redirectTo = data.redirectTo || this.getRedirectPageForRole(data.user.role);
        console.log('🎯 Перенаправление на:', redirectTo);
        window.location.href = redirectTo;
    }

    async handleSuccessfulRegistration(data) {
        console.log('✅ Регистрация успешна:', data.user.username);
        
        this.showNotification('Регистрация успешна! Теперь вы можете войти.', 'success');
        
        // Очищаем форму и переключаем на вход
        setTimeout(() => {
            this.showForm('login');
            this.clearRegistrationForm();
        }, 2000);
    }

    clearRegistrationForm() {
        const fields = [
            'registerUsername',
            'registerTelegram', 
            'registerPassword',
            'confirmPassword'
        ];
        
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) field.value = '';
        });
        
        const acceptTerms = document.getElementById('acceptTerms');
        if (acceptTerms) acceptTerms.checked = false;
    }

    handleAuthError(error) {
        console.log('❌ Ошибка аутентификации:', error);
        this.showNotification(error, 'error');
    }

    handleNetworkError(error) {
        console.error('🌐 Ошибка сети:', error);
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            this.showNotification('Ошибка соединения с сервером. Проверьте, запущен ли сервер на порту 3006.', 'error');
        } else {
            this.showNotification('Временные технические неполадки. Попробуйте позже.', 'error');
        }
    }

    async handleForgotPassword() {
        const telegram = document.getElementById('forgotTelegram')?.value.trim();
        const forgotBtn = document.getElementById('forgotBtn');

        if (!telegram || !telegram.startsWith('@')) {
            this.showNotification('Введите корректный Telegram username', 'error');
            return;
        }

        try {
            this.setLoading(forgotBtn, true);

            // Здесь будет реальный API вызов
            const response = await fetch(`${this.API_BASE}/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ telegram_username: telegram })
            });

            if (response.ok) {
                this.showNotification(
                    'Запрос отправлен! Ожидайте сообщение в Telegram в течение дня.',
                    'success'
                );

                setTimeout(() => {
                    if (document.getElementById('forgotTelegram')) {
                        document.getElementById('forgotTelegram').value = '';
                    }
                    this.showForm('login');
                }, 3000);
            } else {
                this.showNotification('Ошибка при отправке запроса', 'error');
            }

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
        if (!button) {
            console.error('❌ Кнопка не найдена для установки состояния загрузки');
            return;
        }
        
        if (isLoading) {
            button.classList.add('loading');
            button.disabled = true;
            console.log('🔄 Установлено состояние загрузки для кнопки:', button.id);
        } else {
            button.classList.remove('loading');
            button.disabled = false;
            console.log('✅ Снято состояние загрузки для кнопки:', button.id);
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
