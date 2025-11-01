// Auth functionality
class AuthManager {
    constructor() {
        this.currentForm = 'login';
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuthState();
    }

    bindEvents() {
        // Форма входа
        document.getElementById('loginFormElement')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Форма регистрации
        document.getElementById('registerFormElement')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // Форма восстановления пароля
        document.getElementById('forgotPasswordFormElement')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleForgotPassword();
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

        // Прокрутить к верху
        window.scrollTo(0, 0);
    }

    async handleLogin() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('rememberMe').checked;

        if (!this.validateEmail(email)) {
            this.showNotification('Пожалуйста, введите корректный email', 'error');
            return;
        }

        if (password.length < 6) {
            this.showNotification('Пароль должен содержать минимум 6 символов', 'error');
            return;
        }

        this.setLoading('loginBtn', true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    password: password,
                    rememberMe: rememberMe
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showNotification('Успешный вход! Перенаправление...', 'success');
                
                // Сохраняем токен если есть
                if (data.token) {
                    localStorage.setItem('auth_token', data.token);
                    if (rememberMe) {
                        localStorage.setItem('remember_me', 'true');
                    }
                }

                // Перенаправление based on role
                setTimeout(() => {
                    this.redirectUser(data.user);
                }, 1500);

            } else {
                this.showNotification(data.message || 'Ошибка входа', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showNotification('Ошибка соединения с сервером', 'error');
        } finally {
            this.setLoading('loginBtn', false);
        }
    }

    async handleRegister() {
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;
        const agreeTerms = document.getElementById('agreeTerms').checked;

        // Валидация
        if (!name || name.length < 2) {
            this.showNotification('Имя должно содержать минимум 2 символа', 'error');
            return;
        }

        if (!this.validateEmail(email)) {
            this.showNotification('Пожалуйста, введите корректный email', 'error');
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

        if (!agreeTerms) {
            this.showNotification('Необходимо согласие с условиями использования', 'error');
            return;
        }

        this.setLoading('registerBtn', true);

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: name,
                    email: email,
                    password: password
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showNotification('Регистрация успешна! Вы можете войти.', 'success');
                
                // Переключаем на форму входа
                setTimeout(() => {
                    this.showForm('login');
                    // Очищаем форму регистрации
                    document.getElementById('registerFormElement').reset();
                }, 2000);

            } else {
                this.showNotification(data.message || 'Ошибка регистрации', 'error');
            }
        } catch (error) {
            console.error('Register error:', error);
            this.showNotification('Ошибка соединения с сервером', 'error');
        } finally {
            this.setLoading('registerBtn', false);
        }
    }

    async handleForgotPassword() {
        const email = document.getElementById('forgotEmail').value;

        if (!this.validateEmail(email)) {
            this.showNotification('Пожалуйста, введите корректный email', 'error');
            return;
        }

        this.setLoading('forgotBtn', true);

        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: email })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showNotification('Инструкции по восстановлению отправлены на ваш email', 'success');
                
                // Возврат к форме входа
                setTimeout(() => {
                    this.showForm('login');
                    document.getElementById('forgotPasswordForm').reset();
                }, 3000);

            } else {
                this.showNotification(data.message || 'Ошибка восстановления пароля', 'error');
            }
        } catch (error) {
            console.error('Forgot password error:', error);
            this.showNotification('Ошибка соединения с сервером', 'error');
        } finally {
            this.setLoading('forgotBtn', false);
        }
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    setLoading(buttonId, isLoading) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        const btnText = button.querySelector('.btn-text');
        const btnLoader = button.querySelector('.btn-loader');

        if (isLoading) {
            button.disabled = true;
            btnText.style.opacity = '0';
            btnLoader.style.display = 'block';
        } else {
            button.disabled = false;
            btnText.style.opacity = '1';
            btnLoader.style.display = 'none';
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        const messageEl = notification.querySelector('.notification-message');
        const successIcon = notification.querySelector('.notification-icon.success');
        const errorIcon = notification.querySelector('.notification-icon.error');

        // Set message and type
        messageEl.textContent = message;
        notification.className = 'notification show';
        notification.classList.add(type);

        // Show appropriate icon
        if (type === 'success') {
            successIcon.style.display = 'block';
            errorIcon.style.display = 'none';
        } else {
            successIcon.style.display = 'none';
            errorIcon.style.display = 'block';
        }

        // Auto hide
        setTimeout(() => {
            notification.classList.remove('show');
        }, 5000);
    }

    redirectUser(user) {
        // Based on user role, redirect to appropriate interface
        const role = user?.role || 'user';
        
        switch(role) {
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
                window.location.href = '/chat.html';
                break;
            default:
                window.location.href = '/chat.html';
        }
    }

    checkAuthState() {
        const token = localStorage.getItem('auth_token');
        if (token) {
            // Если есть токен, проверяем его валидность
            this.validateToken(token);
        }
    }

    async validateToken(token) {
        try {
            const response = await fetch('/api/auth/validate', {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.valid) {
                    this.redirectUser(data.user);
                }
            }
        } catch (error) {
            console.error('Token validation error:', error);
            // Если ошибка, остаемся на странице аутентификации
        }
    }
}

// Global functions for HTML onclick handlers
function showLoginForm() {
    authManager.showForm('login');
}

function showRegisterForm() {
    authManager.showForm('register');
}

function showForgotPassword() {
    authManager.showForm('forgotPassword');
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const toggleBtn = input.parentNode.querySelector('.password-toggle');
    const icon = toggleBtn.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.authManager = new AuthManager();
});

// Demo functions for testing (remove in production)
function demoLogin() {
    document.getElementById('loginEmail').value = 'demo@example.com';
    document.getElementById('loginPassword').value = 'password123';
    authManager.handleLogin();
}

function demoRegister() {
    document.getElementById('registerName').value = 'Demo User';
    document.getElementById('registerEmail').value = 'demo@example.com';
    document.getElementById('registerPassword').value = 'password123';
    document.getElementById('registerConfirmPassword').value = 'password123';
    document.getElementById('agreeTerms').checked = true;
}
