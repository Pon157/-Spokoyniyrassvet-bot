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
        document.getElementById('bioInput').value = this.currentUser.bio || '';
        
        if (this.currentUser.avatar) {
            document.getElementById('currentAvatar').src = this.currentUser.avatar;
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
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        document.getElementById('profileForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateProfile();
        });

        document.getElementById('passwordForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.changePassword();
        });

        document.getElementById('uploadAvatarBtn').addEventListener('click', () => {
            document.getElementById('avatarInput').click();
        });

        document.getElementById('avatarInput').addEventListener('change', (e) => {
            this.handleAvatarUpload(e.target.files[0]);
        });

        document.getElementById('themeSelectSettings').addEventListener('change', (e) => {
            this.changeTheme(e.target.value);
        });

        document.getElementById('themeToggle').addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById('themeDropdown');
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        });

        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', (e) => {
                this.changeTheme(e.target.dataset.theme);
            });
        });

        document.addEventListener('click', () => {
            document.getElementById('themeDropdown').style.display = 'none';
        });
    }

    async updateProfile() {
        const username = document.getElementById('usernameInput').value.trim();
        const email = document.getElementById('emailInput').value.trim();
        const bio = document.getElementById('bioInput').value.trim();

        try {
            const response = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ username, email, bio })
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

        if (newPassword.length < 6) {
            this.showMessage('Пароль должен быть не менее 6 символов', 'error');
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

        // В реальном приложении здесь была бы загрузка на сервер
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
        document.getElementById('theme-style').href = `css/${theme}-theme.css`;
        document.getElementById('themeSelectSettings').value = theme;
        localStorage.setItem('theme', theme);
        
        const dropdown = document.getElementById('themeDropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
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

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SettingsManager();
});
