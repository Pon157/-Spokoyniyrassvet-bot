class AuthManager {
    constructor() {
        console.log('🚀 AuthManager запущен');
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkExistingAuth();
    }

    setupEventListeners() {
        console.log('🎯 Настройка обработчиков событий...');

        // Переключение между логином и регистрацией
        const showRegisterBtn = document.getElementById('showRegisterBtn');
        const showLoginBtn = document.getElementById('showLoginBtn');
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        if (showRegisterBtn && showLoginBtn) {
            showRegisterBtn.addEventListener('click', () => {
                console.log('📝 Переключение на регистрацию');
                loginForm.classList.remove('active');
                registerForm.classList.add('active');
                showRegisterBtn.classList.add('active');
                showLoginBtn.classList.remove('active');
                this.clearErrors();
            });

            showLoginBtn.addEventListener('click', () => {
                console.log('🔐 Переключение на вход');
                registerForm.classList.remove('active');
                loginForm.classList.add('active');
                showLoginBtn.classList.add('active');
                showRegisterBtn.classList.remove('active');
                this.clearErrors();
            });
        } else {
            console.error('❌ Кнопки переключения не найдены');
        }

        // Форма логина
        const loginFormElement = document.getElementById('loginForm');
        if (loginFormElement) {
            loginFormElement.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('📤 Отправка формы входа');
                this.handleLogin();
            });
        } else {
            console.error('❌ Форма входа не найдена');
        }

        // Форма регистрации
        const registerFormElement = document.getElementById('registerForm');
        if (registerFormElement) {
            registerFormElement.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('📤 Отправка формы регистрации');
                this.handleRegister();
            });
        } else {
            console.error('❌ Форма регистрации не найдена');
        }

        console.log('✅ Все обработчики событий настроены');
    }

    clearErrors() {
        const loginError = document.getElementById('loginError');
        const registerError = document.getElementById('registerError');
        
        if (loginError) {
            loginError.textContent = '';
            loginError.classList.remove('show', 'success');
        }
        
        if (registerError) {
            registerError.textContent = '';
            registerError.classList.remove('show', 'success');
        }
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
                
                // Добавляем небольшую задержку для стабильности
                setTimeout(() => {
                    window.location.href = redirectTo;
                }, 500);
                
            } catch (error) {
                console.error('❌ Ошибка проверки аутентификации:', error);
                this.clearAuth();
            }
        } else {
            console.log('🔐 Пользователь не аутентифицирован');
        }
    }

    async handleLogin() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        const errorDiv = document.getElementById('loginError');
        const submitBtn = document.getElementById('loginSubmitBtn');

        console.log('🔐 Попытка входа:', username);

        if (!username || !password) {
            this.showError(errorDiv, 'Заполните все поля');
            return;
        }

        try {
            this.setLoading(submitBtn, true);
            console.log('🔄 Отправка запроса на вход...');

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            console.log('📊 Статус ответа:', response.status);

            const data = await response.json();
            console.log('📨 Ответ сервера:', data);

            if (response.ok && data.success) {
                console.log('✅ Вход успешен:', data.user.username);
                
                // Сохраняем токен и данные пользователя
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('user_data', JSON.stringify(data.user));
                
                this.showError(errorDiv, '', true);
                this.showSuccess('Вход выполнен успешно!');
                
                console.log('🎯 Перенаправление на:', data.redirectTo);
                
                // Перенаправляем на указанную страницу
                setTimeout(() => {
                    window.location.href = data.redirectTo || this.getRedirectPageForRole(data.user.role);
                }, 1000);
                
            } else {
                console.log('❌ Ошибка входа:', data.error);
                this.showError(errorDiv, data.error || 'Ошибка входа');
            }
        } catch (error) {
            console.error('❌ Ошибка входа:', error);
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

        console.log('👤 Попытка регистрации:', username);

        // Валидация
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
            console.log('🔄 Отправка запроса на регистрацию...');

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

            console.log('📊 Статус ответа:', response.status);

            const data = await response.json();
            console.log('📨 Ответ сервера:', data);

            if (response.ok && data.success) {
                console.log('✅ Регистрация успешна:', data.user.username);
                this.showError(errorDiv, '', true);
                this.showSuccess('Регистрация успешна! Теперь вы можете войти.');
                
                // Переключаем на форму логина
                document.getElementById('loginForm').classList.add('active');
                document.getElementById('registerForm').classList.remove('active');
                document.getElementById('showLoginBtn').classList.add('active');
                document.getElementById('showRegisterBtn').classList.remove('active');
                
                // Очищаем форму
                document.getElementById('registerUsername').value = '';
                document.getElementById('registerTelegram').value = '';
                document.getElementById('registerPassword').value = '';
                document.getElementById('registerConfirmPassword').value = '';
                
            } else {
                console.log('❌ Ошибка регистрации от сервера:', data.error);
                this.showError(errorDiv, data.error || 'Ошибка регистрации');
            }
        } catch (error) {
            console.error('❌ Ошибка регистрации:', error);
            this.showError(errorDiv, 'Ошибка соединения с сервером');
        } finally {
            this.setLoading(submitBtn, false);
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
        if (!errorElement) {
            console.error('❌ Элемент ошибки не найден');
            return;
        }
        
        errorElement.textContent = message;
        errorElement.className = 'error-message';
        
        if (isSuccess) {
            errorElement.classList.add('success');
        } else if (message) {
            errorElement.classList.add('show');
        } else {
            errorElement.classList.remove('show', 'success');
        }
    }

    showSuccess(message) {
        console.log('✅', message);
        
        // Создаем временное уведомление об успехе
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            background: #4CAF50;
            color: white;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            animation: slideInRight 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 3000);
    }

    setLoading(button, isLoading) {
        if (!button) {
            console.error('❌ Кнопка не найдена');
            return;
        }
        
        if (isLoading) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка...';
        } else {
            button.disabled = false;
            if (button.id === 'loginSubmitBtn') {
                button.innerHTML = '<i class="fas fa-sign-in-alt"></i> Войти';
            } else {
                button.innerHTML = '<i class="fas fa-user-plus"></i> Зарегистрироваться';
            }
        }
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
