class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadTheme();
        this.checkAuthStatus();
    }

    setupEventListeners() {
        // Переключение между вкладками
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Форма входа
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        // Форма регистрации
        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.register();
        });

        // Выбор темы
        document.getElementById('themeSelect').addEventListener('change', (e) => {
            this.changeTheme(e.target.value);
        });
    }

    switchTab(tabName) {
        // Обновление активных кнопок
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Показать активную форму
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.toggle('active', form.id === `${tabName}Form`);
        });
    }

    async login() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                this.handleAuthSuccess(data);
            } else {
                this.showMessage(data.error, 'error');
            }
        } catch (error) {
            this.showMessage('Ошибка соединения с сервером', 'error');
        }
    }

    async register() {
        const username = document.getElementById('regUsername').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const role = document.getElementById('regRole').value;

        try {
            const response = await fetch('/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password, role }),
            });

            const data = await response.json();

            if (response.ok) {
                this.handleAuthSuccess(data);
            } else {
                this.showMessage(data.error, 'error');
            }
        } catch (error) {
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
        // Перенаправление в зависимости от роли
        switch (role) {
            case 'admin':
            case 'coowner':
            case 'owner':
                window.location.href = '/admin';
                break;
            default:
                window.location.href = '/chat';
        }
    }

    checkAuthStatus() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        
        if (token && user) {
            this.currentUser = JSON.parse(user);
            this.redirectToApp(this.currentUser.role);
        }
    }

    changeTheme(theme) {
        const themeStyle = document.getElementById('theme-style');
        themeStyle.href = `css/${theme}-theme.css`;
        localStorage.setItem('theme', theme);
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.getElementById('themeSelect').value = savedTheme;
        this.changeTheme(savedTheme);
    }

    showMessage(text, type) {
        const messageEl = document.getElementById('message');
        messageEl.textContent = text;
        messageEl.className = `message ${type}`;
        
        setTimeout(() => {
            messageEl.textContent = '';
            messageEl.className = 'message';
        }, 5000);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});
