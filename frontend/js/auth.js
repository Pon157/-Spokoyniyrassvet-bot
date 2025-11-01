class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('chat_token');
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadTheme();
        this.checkExistingAuth();
    }

    setupEventListeners() {
        // Переключение табов
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
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
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.toggleThemeSelector();
        });

        document.querySelectorAll('.theme-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.changeTheme(e.target.dataset.theme);
            });
        });
    }

    switchTab(tabName) {
        // Обновляем активные табы
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Form`).classList.add('active');
    }

    async handleLogin() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            this.showNotification('Заполните все поля', 'error');
            return;
        }

        this.showLoading(true);

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

            this.showNotification('Успешный вход!', 'success');
            
            // Перенаправление по роли
            setTimeout(() => {
                this.redirectByRole(data.user.role);
            }, 1000);

        } catch (error) {
            this.showNotification(error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async handleRegister() {
        const username = document.getElementById('registerUsername').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!username || !email || !password || !confirmPassword) {
            this.showNotification('Заполните все поля', 'error');
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

        this.showLoading(true);

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

            this.showNotification('Регистрация успешна!', 'success');
            
            setTimeout(() => {
                this.redirectByRole(data.user.role);
            }, 1000);

        } catch (error) {
            this.showNotification(error.message, 'error');
        } finally {
            this.showLoading(false);
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
                this.redirectByRole(data.user.role);
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
        window.location.href = page;
    }

    togglePasswordVisibility(inputId) {
        const input = document.getElementById(inputId);
        const icon = input.nextElementSibling.querySelector('i');
        
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

    toggleThemeSelector() {
        const selector = document.getElementById('themeSelector');
        selector.style.display = selector.style.display === 'none' ? 'block' : 'none';
    }

    changeTheme(themeName) {
        const themeLink = document.getElementById('theme');
        themeLink.href = `css/${themeName}-theme.css`;
        
        localStorage.setItem('chat_theme', themeName);
        this.showNotification(`Тема "${themeName}" применена`, 'success');
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('chat_theme') || 'light';
        this.changeTheme(savedTheme);
    }

    showNotification(message, type = 'info') {
        // Удаляем существующие уведомления
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            ${message}
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
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

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        overlay.style.display = show ? 'flex' : 'none';
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new AuthSystem();
});
