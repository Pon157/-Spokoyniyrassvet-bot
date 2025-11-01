class AuthManager {
    constructor() {
        this.currentUser = null;
        this.API_BASE = window.location.origin; // ИСПРАВЛЕНО: используем текущий origin
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadTheme();
        this.checkAuthStatus();
    }

    setupEventListeners() {
        // Табы
        const tabButtons = document.querySelectorAll('.tab-btn');
        if (tabButtons.length > 0) {
            tabButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.switchTab(e.target.dataset.tab);
                });
            });
        }

        // Формы
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.login();
            });
        }

        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.register();
            });
        }

        // Тема
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = document.getElementById('themeDropdown');
                if (dropdown) {
                    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
                }
            });
        }

        const themeOptions = document.querySelectorAll('.theme-option');
        if (themeOptions.length > 0) {
            themeOptions.forEach(option => {
                option.addEventListener('click', (e) => {
                    this.changeTheme(e.target.dataset.theme);
                });
            });
        }

        // Закрытие dropdown
        document.addEventListener('click', () => {
            const dropdown = document.getElementById('themeDropdown');
            if (dropdown) {
                dropdown.style.display = 'none';
            }
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.toggle('active', form.id === `${tabName}Form`);
        });
    }

    async login() {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            this.showMessage('Заполните все поля', 'error');
            return;
        }

        try {
            console.log('Login attempt:', { email }); // Не логируем пароль
            
            const response = await fetch(`${this.API_BASE}/auth/login`, { // ИСПРАВЛЕНО
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            console.log('Login response status:', response.status);

            const data = await response.json();

            if (response.ok) {
                this.handleAuthSuccess(data);
            } else {
                this.showMessage(data.error || 'Ошибка входа', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showMessage('Ошибка соединения с сервером', 'error');
        }
    }

    async register() {
        const username = document.getElementById('regUsername').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;

        if (!username || !email || !password) {
            this.showMessage('Заполните все поля', 'error');
            return;
        }

        if (password.length < 6) {
            this.showMessage('Пароль должен быть не менее 6 символов', 'error');
            return;
        }

        try {
            console.log('Register attempt:', { username, email });
            
            const response = await fetch(`${this.API_BASE}/auth/register`, { // ИСПРАВЛЕНО
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password }),
            });

            console.log('Register response status:', response.status);

            const data = await response.json();

            if (response.ok) {
                this.handleAuthSuccess(data);
            } else {
                this.showMessage(data.error || 'Ошибка регистрации', 'error');
            }
        } catch (error) {
            console.error('Register error:', error);
            this.showMessage('Ошибка соединения с сервером', 'error');
        }
    }

    handleAuthSuccess(data) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        this.showMessage('Успешная авторизация!', 'success');
        
        setTimeout(() => {
            this.redirectToApp(data.user.role);
        }, 1000);
    }

    redirectToApp(role) {
        if (['admin', 'coowner', 'owner'].includes(role)) {
            window.location.href = `${this.API_BASE}/admin.html`; // ИСПРАВЛЕНО
        } else {
            window.location.href = `${this.API_BASE}/chat.html`; // ИСПРАВЛЕНО
        }
    }

    checkAuthStatus() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        
        if (token && user) {
            try {
                this.currentUser = JSON.parse(user);
                this.redirectToApp(this.currentUser.role);
            } catch (e) {
                console.error('Error parsing user data:', e);
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        }
    }

    changeTheme(theme) {
        const themeStyle = document.getElementById('theme-style');
        if (themeStyle) {
            themeStyle.href = `css/${theme}-theme.css`; // ИСПРАВЛЕНО
        }
        localStorage.setItem('theme', theme);
        
        const dropdown = document.getElementById('themeDropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.changeTheme(savedTheme);
    }

    showMessage(text, type) {
        const messageEl = document.getElementById('message');
        if (messageEl) {
            messageEl.textContent = text;
            messageEl.className = `message ${type}`;
            
            setTimeout(() => {
                messageEl.textContent = '';
                messageEl.className = 'message';
            }, 5000);
        }
    }
}

// Инициализация когда DOM готов
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});
