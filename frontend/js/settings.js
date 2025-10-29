class SettingsManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.loadUserData();
        this.setupEventListeners();
        this.loadTheme();
    }

    async checkAuth() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        
        if (!token || !user) {
            window.location.href = '/';
            return;
        }
        
        this.currentUser = JSON.parse(user);
    }

    loadUserData() {
        document.getElementById('usernameInput').value = this.currentUser.username;
        document.getElementById('emailInput').value = this.currentUser.email;
        
        if (this.currentUser.avatar) {
            document.getElementById('currentAvatar').src = this.currentUser.avatar;
        } else {
            document.getElementById('currentAvatar').src = '/images/default-avatar.png';
        }

        // Показать административные настройки для соответствующих ролей
        if (['admin', 'coowner', 'owner'].includes(this.currentUser.role)) {
            document.getElementById('adminSettings').style.display = 'block';
            
            if (['coowner', 'owner'].includes(this.currentUser.role)) {
                document.getElementById('goToCoownerPanel').style.display = 'inline-block';
            }
            
            if (this.currentUser.role === 'owner') {
                document.getElementById('goToOwnerPanel').style.display = 'inline-block';
            }
        }
    }

    setupEventListeners() {
        // Навигация
        document.getElementById('backToChat').addEventListener('click', () => {
            window.location.href = '/chat';
        });

        document.getElementById('goToAdminPanel').addEventListener('click', () => {
            window.location.href = '/admin';
        });

        document.getElementById('goToCoownerPanel').addEventListener('click', () => {
            window.location.href = '/coowner';
        });

        document.getElementById('goToOwnerPanel').addEventListener('click', () => {
            window.location.href = '/owner';
        });

        // Формы
        document.getElementById('profileForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateProfile();
        });

        document.getElementById('passwordForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.changePassword();
        });

        // Загрузка аватара
        document.getElementById('uploadAvatarBtn').addEventListener('click', () => {
            document.getElementById('avatarInput').click();
        });

        document.getElementById('avatarInput').addEventListener('change', (e) => {
            this.handleAvatarUpload(e.target.files[0]);
        });

        // Тема
        document.getElementById('themeSelectSettings').addEventListener('change', (e) => {
            this.changeTheme(e.target.value);
        });
    }

    async updateProfile() {
        const username = document.getElementById('usernameInput').value;
        const email = document.getElementById('emailInput').value;

        try {
            const response = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ username, email })
            });

            if (response.ok) {
                const data = await response.json();
                this.updateLocalUser(data.user);
                this.showMessage('Профиль успешно обновлен', 'success');
            } else {
                const error = await response.json();
                this.showMessage(error.error, 'error');
            }
        } catch (error) {
            this.showMessage('Ошибка соединения с сервером', 'error');
        }
    }

    async changePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            this.showMessage('Пароли не совпадают', 'error');
            return;
        }

        try {
            const response = await fetch('/api/user/password', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            if (response.ok) {
                this.showMessage('Пароль успешно изменен', 'success');
                document.getElementById('passwordForm').reset();
            } else {
                const error = await response.json();
                this.showMessage(error.error, 'error');
            }
        } catch (error) {
            this.showMessage('Ошибка соединения с сервером', 'error');
        }
    }

    async handleAvatarUpload(file) {
        if (!file || !file.type.startsWith('image/')) {
            this.showMessage('Пожалуйста, выберите изображение', 'error');
            return;
        }

        // Здесь должна быть реализация загрузки файла на сервер
        // Для демонстрации используем временный URL
        const avatarUrl = URL.createObjectURL(file);
        document.getElementById('currentAvatar').src = avatarUrl;

        try {
            const response = await fetch('/api/user/avatar', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ avatar: avatarUrl })
            });

            if (response.ok) {
                const data = await response.json();
                this.updateLocalUser(data.user);
                this.showMessage('Аватар успешно обновлен', 'success');
            }
        } catch (error) {
            this.showMessage('Ошибка обновления аватара', 'error');
        }
    }

    changeTheme(theme) {
        const themeStyle = document.getElementById('theme-style');
        themeStyle.href = `css/${theme}-theme.css`;
        localStorage.setItem('theme', theme);

        // Обновление темы в профиле пользователя
        this.updateUserTheme(theme);
    }

    async updateUserTheme(theme) {
        try {
            await fetch('/api/user/theme', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ theme })
            });
        } catch (error) {
            console.error('Error updating theme:', error);
        }
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.getElementById('themeSelectSettings').value = savedTheme;
        this.changeTheme(savedTheme);
    }

    updateLocalUser(userData) {
        this.currentUser = { ...this.currentUser, ...userData };
        localStorage.setItem('user', JSON.stringify(this.currentUser));
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
    new SettingsManager();
});
