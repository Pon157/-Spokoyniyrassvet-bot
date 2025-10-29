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
        console.log('Setting up event listeners...');
        
        // Переключение между вкладками
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                console.log('Tab clicked:', e.target.dataset.tab);
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Форма входа
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('Login form submitted');
                this.login();
            });
        }

        // Форма регистрации
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('Register form submitted');
                this.register();
            });
        }

        // Выбор темы
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const theme = e.target.getAttribute('data-theme');
                console.log('Theme selected:', theme);
                this.changeTheme(theme);
            });
        });

        // Закрытие dropdown при клике вне его
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.theme-selector')) {
                const dropdown = document.getElementById('themeDropdown');
                if (dropdown) {
                    dropdown.style.display = 'none';
                }
            }
        });

        // Открытие dropdown темы
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
    }

    switchTab(tabName) {
        console.log('Switching to tab:', tabName);
        
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

        console.log('Login attempt:', { email, password });

        if (!email || !password) {
            this.showMessage('Заполните все поля', 'error');
            return;
        }

        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();
            console.log('Login response:', data);

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
        const username = document.getElementById('regUsername').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const role = document.getElementById('regRole').value;

        console.log('Register attempt:', { username, email, password, role });

        if (!username || !email || !password) {
            this.showMessage('Заполните все обязательные поля', 'error');
            return;
        }

        try {
            const response = await fetch('/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password, role }),
            });

            const data = await response.json();
            console.log('Register response:', data);

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
        console.log('Auth success:', data);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        this.showMessage('Успешная авторизация! Перенаправление...', 'success');
        
        setTimeout(() => {
            this.redirectToApp(data.user.role);
        }, 1000);
    }

    redirectToApp(role) {
        console.log('Redirecting for role:', role);
        
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
            console.log('User already logged in:', this.currentUser);
            this.redirectToApp(this.currentUser.role);
        }
    }

    changeTheme(theme) {
        console.log('Changing theme to:', theme);
        const themeStyle = document.getElementById('theme-style');
        if (themeStyle) {
            themeStyle.href = `css/${theme}-theme.css`;
            localStorage.setItem('theme', theme);
        }
        
        // Закрыть dropdown после выбора
        const dropdown = document.getElementById('themeDropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        console.log('Loading theme:', savedTheme);
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

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing AuthManager...');
    new AuthManager();
});
