class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('chat_token');
        this.isLoginForm = true;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadTheme();
        this.checkExistingAuth();
        this.initializeAnimations();
    }

    setupEventListeners() {
        // Переключение между входом и регистрацией
        document.getElementById('switchBtn').addEventListener('click', () => {
            this.switchForms();
        });

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

        // Переключение видимости пароля
        document.getElementById('toggleLoginPassword').addEventListener('click', () => {
            this.togglePasswordVisibility('loginPassword');
        });

        document.getElementById('toggleRegisterPassword').addEventListener('click', () => {
            this.togglePasswordVisibility('registerPassword');
        });

        // Настройки темы
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleThemeOptions();
        });

        document.querySelectorAll('.theme-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.changeTheme(e.currentTarget.dataset.theme);
            });
        });

        // Закрытие выбора темы при клике вне
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.theme-settings')) {
                document.getElementById('themeOptions').classList.remove('show');
            }
        });
    }

    initializeAnimations() {
        // Анимация появления элементов
        const elements = document.querySelectorAll('.auth-card > *');
        elements.forEach((el, index) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            setTimeout(() => {
                el.style.transition = 'all 0.6s ease';
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    switchForms() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const switchText = document.getElementById('switchText');
        const switchBtn = document.getElementById('switchBtn');

        this.isLoginForm = !this.isLoginForm;

        if (this.isLoginForm) {
            loginForm.classList.add('active');
            registerForm.classList.remove('active');
            switchText.textContent = 'Нет аккаунта?';
            switchBtn.textContent = 'Создать аккаунт';
        } else {
            loginForm.classList.remove('active');
            registerForm.classList.add('active');
            switchText.textContent = 'Уже есть аккаунт?';
            switchBtn.textContent = 'Войти';
        }

        // Анимация перехода
        const activeForm = this.isLoginForm ? loginForm : registerForm;
        activeForm.style.animation = 'none';
        setTimeout(() => {
            activeForm.style.animation = 'slideIn 0.3s ease';
        }, 10);
    }

    async handleLogin() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        if (!this.validateEmail(email)) {
            this.showNotification('Пожалуйста, введите корректный email', 'error');
            return;
        }

        if (!password) {
            this.showNotification('Введите пароль', 'error');
            return;
        }

        this.setLoading(true, 'login');

        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Ошибка входа');
            }

            this.token = data.token;
            this.currentUser = data.user;

            localStorage.setItem('chat_token', this.token);
            localStorage.setItem('user_data', JSON.stringify(data.user));

            this.showNotification('Успешный вход! Перенаправление...', 'success');
            
            // Плавный переход к интерфейсу
            setTimeout(() => {
                this.redirectByRole(data.user.role);
            }, 1500);

        } catch (error) {
            this.showNotification(error.message, 'error');
        } finally {
            this.setLoading(false, 'login');
        }
    }

    async handleRegister() {
        const username = document.getElementById('registerUsername').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const acceptTerms = document.getElementById('acceptTerms').checked;

        if (!username || username.length < 3) {
            this.showNotification('Имя пользователя должно содержать минимум 3 символа', 'error');
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

        if (!acceptTerms) {
            this.showNotification('Необходимо принять условия использования', 'error');
            return;
        }

        this.setLoading(true, 'register');

        try {
            const response = await fetch('/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Ошибка регистрации');
            }

            this.token = data.token;
            this.currentUser = data.user;

            localStorage.setItem('chat_token', this.token);
            localStorage.setItem('user_data', JSON.stringify(data.user));

            this.showNotification('Регистрация успешна! Добро пожаловать!', 'success');
            
            setTimeout(() => {
                this.redirectByRole(data.user.role);
            }, 1500);

        } catch (error) {
            this.showNotification(error.message, 'error');
        } finally {
            this.setLoading(false, 'register');
        }
    }

    async checkExistingAuth() {
        if (!this.token) return;

        try {
            const response = await fetch('/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                
                // Плавный переход к интерфейсу
                setTimeout(() => {
                    this.redirectByRole(data.user.role);
                }, 500);
            } else {
                localStorage.removeItem('chat_token');
                localStorage.removeItem('user_data');
            }
        } catch (error) {
            console.error('Ошибка проверки токена:', error);
            localStorage.removeItem('chat_token');
            localStorage.removeItem('user_data');
        }
    }

    redirectByRole(role) {
        const rolePages = {
            'user': 'chat.html',
            'listener': 'chat.html',
            'admin': 'admin.html',
            'coowner': 'coowner.html',
            'owner': 'owner.html'
        };

        const page = rolePages[role] || 'chat.html';
        
        // Плавный переход
        document.querySelector('.auth-card').style.transform = 'translateY(-20px)';
        document.querySelector('.auth-card').style.opacity = '0';
        
        setTimeout(() => {
            window.location.href = page;
        }, 300);
    }

    togglePasswordVisibility(inputId) {
        const input = document.getElementById(inputId);
        const icon = input.parentNode.querySelector('.toggle-password i');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }

    toggleThemeOptions() {
        const options = document.getElementById('themeOptions');
        options.classList.toggle('show');
    }

    changeTheme(themeName) {
        const themeLink = document.getElementById('theme');
        if (themeLink) {
            themeLink.href = `css/${themeName}-theme.css`;
        }
        
        // Сохраняем тему
        localStorage.setItem('chat_theme', themeName);
        
        // Обновляем data-theme атрибут
        document.documentElement.setAttribute('data-theme', themeName);
        
        this.showNotification(`Тема "${this.getThemeDisplayName(themeName)}" применена`, 'success');
        
        // Закрываем меню выбора темы
        document.getElementById('themeOptions').classList.remove('show');
    }

    getThemeDisplayName(themeName) {
        const themes = {
            'light': 'Светлая',
            'dark': 'Темная', 
            'blue': 'Синяя',
            'purple': 'Фиолетовая'
        };
        return themes[themeName] || themeName;
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('chat_theme') || 'light';
        this.changeTheme(savedTheme);
    }

    setLoading(loading, formType) {
        const submitBtn = document.querySelector(`#${formType}Form .auth-submit`);
        
        if (loading) {
            submitBtn.classList.add('loading');
            submitBtn.disabled = true;
        } else {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    showNotification(message, type = 'info') {
        // Удаляем существующие уведомления
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
        `;

        document.getElementById('notificationsContainer').appendChild(notification);

        // Автоматическое скрытие
        setTimeout(() => {
            notification.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 4000);
    }

    getNotificationIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new AuthSystem();
});
