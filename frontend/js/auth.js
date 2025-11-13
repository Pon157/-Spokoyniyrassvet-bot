class AuthManager {
    constructor() {
        console.log('🚀 AuthManager запущен');
        this.currentForm = 'login';
        this.API_BASE = '/api/auth'; // Базовый путь API
        this.init();
    }

    init() {
        console.log('🎯 Инициализация AuthManager');
        this.waitForDOM()
            .then(() => {
                this.setupEventListeners();
                this.checkExistingAuth();
                this.setupServiceWorker(); // Для оффлайн работы
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
            this.setupAutoSave(); // Автосохранение данных форм

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

    setupAutoSave() {
        // Автосохранение данных форм
        const forms = ['login', 'register'];
        forms.forEach(formName => {
            const form = document.getElementById(`${formName}Form`);
            if (form) {
                const inputs = form.querySelectorAll('input');
                inputs.forEach(input => {
                    // Восстанавливаем сохраненные значения
                    const savedValue = localStorage.getItem(`auth_${formName}_${input.name || input.id}`);
                    if (savedValue && !input.type.includes('password')) {
                        input.value = savedValue;
                    }

                    // Сохраняем при вводе
                    input.addEventListener('input', (e) => {
                        if (!e.target.type.includes('password')) {
                            localStorage.setItem(`auth_${formName}_${e.target.name || e.target.id}`, e.target.value);
                        }
                    });
                });
            }
        });
    }

    clearAutoSave() {
        // Очистка автосохраненных данных
        const keys = Object.keys(localStorage).filter(key => key.startsWith('auth_'));
        keys.forEach(key => localStorage.removeItem(key));
    }

    async handleLogin() {
        console.log('🔐 Обработка входа...');
        
        const username = document.getElementById('loginUsername');
        const password = document.getElementById('loginPassword');
        const loginBtn = document.getElementById('loginBtn');

        if (!username || !password) {
            this.showNotification('Ошибка: поля ввода не найдены', 'error');
            return;
        }

        const usernameValue = username.value.trim();
        const passwordValue = password.value;

        // Валидация
        if (!usernameValue || !passwordValue) {
            this.showNotification('Заполните все поля', 'error');
            return;
        }

        if (!this.validateField(username) || !this.validateField(password)) {
            return;
        }

        try {
            this.setLoading(loginBtn, true);

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

            const data = await response.json();

            if (response.ok && data.success) {
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

            const data = await response.json();

            if (response.ok && data.success) {
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
        
        // Очищаем автосохраненные данные
        this.clearAutoSave();
        
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
            this.clearAutoSave();
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
            this.showNotification('Ошибка соединения с сервером. Проверьте подключение к интернету.', 'error');
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
                    document.getElementById('forgotTelegram').value = '';
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

    setupServiceWorker() {
        // Регистрация Service Worker для оффлайн работы
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('✅ ServiceWorker зарегистрирован');
                })
                .catch(error => {
                    console.log('❌ Ошибка регистрации ServiceWorker:', error);
                });
        }
    }

    // Остальные методы остаются без изменений...
    // switchForm(), showForm(), setupPasswordToggles(), setupTermsModal(), 
    // getRedirectPageForRole(), setLoading(), showNotification() и т.д.
}

// Глобальный обработчик ошибок
window.addEventListener('error', function(e) {
    console.error('🚨 Глобальная ошибка:', e.error);
});

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 DOM загружен, инициализация AuthManager');
    window.authManager = new AuthManager();
});
