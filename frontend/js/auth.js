// auth.js
class AuthManager {
    constructor() {
        console.log('🚀 AuthManager запущен');
        this.currentForm = 'login';
        this.init();
    }

    init() {
        console.log('🎯 Инициализация AuthManager');
        this.waitForDOM().then(() => {
            this.setupEventListeners();
            this.checkExistingAuth();
        }).catch(error => {
            console.error('❌ Ошибка инициализации:', error);
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

        // Основное переключение между входом и регистрацией
        const switchBtn = document.getElementById('switchBtn');
        console.log('switchBtn элемент:', switchBtn);
        
        if (switchBtn) {
            switchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🔄 Кнопка переключения нажата');
                this.switchForm();
            });
        } else {
            console.error('❌ switchBtn не найден');
        }

        // Кнопка "Назад к входу" из формы восстановления
        const backToLogin = document.getElementById('backToLogin');
        if (backToLogin) {
            backToLogin.addEventListener('click', (e) => {
                e.preventDefault();
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

        console.log('loginForm элемент:', loginForm);
        console.log('registerForm элемент:', registerForm);

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('📤 Форма входа отправлена');
                this.handleLogin();
            });
        }

        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('📤 Форма регистрации отправлена');
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

        const usernameValue = username.value;
        const passwordValue = password.value;

        console.log('Введенные данные:', { username: usernameValue, password: '***' });

        if (!usernameValue || !passwordValue) {
            this.showNotification('Заполните все поля', 'error');
            return;
        }

        try {
            this.setLoading(loginBtn, true);
            console.log('🔄 Отправка запроса на вход...');

            // Используем относительный путь
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
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
                
                if (response.status === 502) {
                    throw new Error('Сервер временно недоступен. Попробуйте позже.');
                } else {
                    throw new Error('Ошибка сервера: ' + response.status);
                }
            }

            const data = await response.json();
            console.log('📨 Ответ сервера:', data);

            if (data.success) {
                console.log('✅ Вход успешен:', data.user.username);
                
                // Сохраняем токен и данные пользователя
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('user_data', JSON.stringify(data.user));
                
                this.showNotification('Вход выполнен успешно!', 'success');
                
                // Перенаправляем на указанную страницу
                setTimeout(() => {
                    const redirectTo = this.getRedirectPageForRole(data.user.role);
                    console.log('🎯 Перенаправление на:', redirectTo);
                    window.location.href = redirectTo;
                }, 1000);
                
            } else {
                console.log('❌ Ошибка входа:', data.error);
                this.showNotification(data.error || 'Ошибка входа', 'error');
            }
        } catch (error) {
            console.error('❌ Ошибка входа:', error);
            this.showNotification(error.message || 'Ошибка соединения с сервером', 'error');
        } finally {
            this.setLoading(loginBtn, false);
        }
    }

    async handleRegister() {
        console.log('👤 Обработка регистрации...');
        
        const username = document.getElementById('registerUsername');
        const telegram = document.getElementById('registerTelegram');
        const password = document.getElementById('registerPassword');
        const confirmPassword = document.getElementById('confirmPassword');
        const acceptTerms = document.getElementById('acceptTerms');
        const registerBtn = document.getElementById('registerBtn');

        if (!username || !telegram || !password || !confirmPassword || !acceptTerms) {
            console.error('❌ Не все поля регистрации найдены');
            this.showNotification('Ошибка: не все поля найдены', 'error');
            return;
        }

        const usernameValue = username.value;
        const telegramValue = telegram.value;
        const passwordValue = password.value;
        const confirmPasswordValue = confirmPassword.value;
        const acceptTermsValue = acceptTerms.checked;

        console.log('Введенные данные:', { 
            username: usernameValue, 
            telegram: telegramValue,
            password: '***',
            confirmPassword: '***',
            acceptTerms: acceptTermsValue
        });

        // Валидация
        if (!usernameValue || !telegramValue || !passwordValue || !confirmPasswordValue) {
            this.showNotification('Заполните все поля', 'error');
            return;
        }

        if (usernameValue.length < 2) {
            this.showNotification('Имя пользователя должно содержать минимум 2 символа', 'error');
            return;
        }

        if (!telegramValue.startsWith('@')) {
            this.showNotification('Telegram должен начинаться с @', 'error');
            return;
        }

        if (passwordValue.length < 6) {
            this.showNotification('Пароль должен содержать минимум 6 символов', 'error');
            return;
        }

        if (passwordValue !== confirmPasswordValue) {
            this.showNotification('Пароли не совпадают', 'error');
            return;
        }

        if (!acceptTermsValue) {
            this.showNotification('Необходимо принять условия использования', 'error');
            return;
        }

        try {
            this.setLoading(registerBtn, true);
            console.log('🔄 Отправка запроса на регистрацию...');

            // Используем относительный путь
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: usernameValue,
                    telegram_username: telegramValue,
                    password: passwordValue
                })
            });

            console.log('📊 Статус ответа:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Ошибка сервера:', errorText);
                
                if (response.status === 502) {
                    throw new Error('Сервер временно недоступен. Попробуйте позже.');
                } else {
                    throw new Error('Ошибка сервера: ' + response.status);
                }
            }

            const data = await response.json();
            console.log('📨 Ответ сервера:', data);

            if (data.success) {
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
            this.showNotification(error.message || 'Ошибка соединения с сервером', 'error');
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

            // Используем относительный путь
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    telegram_username: telegram
                })
            });

            console.log('📊 Статус ответа:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Ошибка сервера:', errorText);
                
                if (response.status === 502) {
                    throw new Error('Сервер временно недоступен. Попробуйте позже.');
                } else {
                    throw new Error('Ошибка сервера: ' + response.status);
                }
            }

            const data = await response.json();
            console.log('📨 Ответ сервера:', data);

            if (data.success) {
                this.showNotification(
                    'Запрос отправлен! Ожидайте сообщение в Telegram в течение дня.',
                    'success'
                );

                // Очищаем поле и возвращаем к форме входа
                setTimeout(() => {
                    document.getElementById('forgotTelegram').value = '';
                    this.showForm('login');
                }, 3000);
            } else {
                this.showNotification(data.error || 'Ошибка при отправке запроса', 'error');
            }

        } catch (error) {
            console.error('❌ Ошибка восстановления пароля:', error);
            this.showNotification(error.message || 'Ошибка при отправке запроса', 'error');
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
                <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}-circle"></i>
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
