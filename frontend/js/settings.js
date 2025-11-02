class SettingsManager {
    constructor() {
        this.currentUser = null;
        this.settings = {};
        this.init();
    }

    async init() {
        console.log('🎯 Инициализация улучшенных настроек...');
        
        try {
            await this.checkAuth();
            this.loadUserData();
            this.setupAllEventListeners();
            await this.loadSettings();
            this.loadAccountInfo();
            
            console.log('✅ Настройки готовы');
        } catch (error) {
            console.error('❌ Ошибка инициализации:', error);
            this.showNotification('Ошибка загрузки настроек', 'error');
        }
    }

    async checkAuth() {
        const token = localStorage.getItem('auth_token');
        const userData = localStorage.getItem('user_data');

        if (!token || !userData) {
            console.log('🔐 Нет данных аутентификации');
            return;
        }

        try {
            this.currentUser = JSON.parse(userData);
        } catch (error) {
            console.error('❌ Ошибка парсинга пользователя:', error);
        }
    }

    loadUserData() {
        if (!this.currentUser) return;

        document.getElementById('username').value = this.currentUser.username || '';
        document.getElementById('bio').value = this.currentUser.bio || '';
        
        if (this.currentUser.avatar_url) {
            document.getElementById('avatarPreview').src = this.currentUser.avatar_url;
        }
    }

    setupAllEventListeners() {
        // Навигация
        document.querySelectorAll('.nav-item').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchTab(e.currentTarget.dataset.tab);
            });
        });

        // Формы
        document.getElementById('profileForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProfile();
        });

        document.getElementById('passwordForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.changePassword();
        });

        // Темы
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', (e) => {
                this.selectTheme(e.currentTarget.dataset.theme);
            });
        });

        // Чекбоксы
        document.querySelectorAll('.modern-checkbox input').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.saveSettings();
            });
        });

        // Аватар
        document.getElementById('avatarInput').addEventListener('change', (e) => {
            this.handleAvatarUpload(e.target.files[0]);
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.nav-item').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Tab`).classList.add('active');
    }

    async saveProfile() {
        const username = document.getElementById('username').value;
        const bio = document.getElementById('bio').value;

        if (!username) {
            this.showNotification('Имя пользователя обязательно', 'error');
            return;
        }

        try {
            // Здесь будет реальный API вызов
            console.log('💾 Сохранение профиля:', { username, bio });
            this.showNotification('Профиль успешно обновлен', 'success');
        } catch (error) {
            console.error('❌ Ошибка сохранения профиля:', error);
            this.showNotification('Ошибка сохранения профиля', 'error');
        }
    }

    async changePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showNotification('Заполните все поля', 'error');
            return;
        }

        if (newPassword.length < 6) {
            this.showNotification('Пароль должен содержать минимум 6 символов', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showNotification('Пароли не совпадают', 'error');
            return;
        }

        try {
            // Здесь будет реальный API вызов
            console.log('🔑 Смена пароля');
            this.showNotification('Пароль успешно изменен', 'success');
            document.getElementById('passwordForm').reset();
        } catch (error) {
            console.error('❌ Ошибка смены пароля:', error);
            this.showNotification('Ошибка смены пароля', 'error');
        }
    }

    selectTheme(themeName) {
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
        });
        document.querySelector(`[data-theme="${themeName}"]`).classList.add('active');

        // Применяем тему
        const themeLink = document.getElementById('theme');
        if (themeLink) {
            themeLink.href = `css/${themeName}-theme.css`;
        }

        this.settings.theme = themeName;
        this.saveSettings();
        this.showNotification(`Тема "${this.getThemeName(themeName)}" применена`, 'success');
    }

    getThemeName(theme) {
        const themes = {
            'light': 'Светлая',
            'dark': 'Темная', 
            'blue': 'Синяя'
        };
        return themes[theme] || theme;
    }

    async saveSettings() {
        const settings = {
            theme: this.settings.theme || 'light',
            showTimestamps: document.getElementById('showTimestamps').checked,
            showAvatars: document.getElementById('showAvatars').checked,
            compactMode: document.getElementById('compactMode').checked,
            pushNotifications: document.getElementById('pushNotifications').checked,
            soundNotifications: document.getElementById('soundNotifications').checked,
            showOnlineStatus: document.getElementById('showOnlineStatus').checked,
            profileVisibility: document.getElementById('profileVisibility').checked
        };

        try {
            // Здесь будет реальный API вызов
            console.log('⚙️ Сохранение настроек:', settings);
            this.showNotification('Настройки сохранены', 'success');
        } catch (error) {
            console.error('❌ Ошибка сохранения настроек:', error);
        }
    }

    async loadSettings() {
        try {
            // Загрузка настроек с сервера
            this.settings = {
                theme: 'light',
                showTimestamps: true,
                showAvatars: true,
                compactMode: false,
                pushNotifications: true,
                soundNotifications: true,
                showOnlineStatus: true,
                profileVisibility: true
            };
            this.applySettings();
        } catch (error) {
            console.error('❌ Ошибка загрузки настроек:', error);
        }
    }

    applySettings() {
        // Применяем настройки к интерфейсу
        document.getElementById('showTimestamps').checked = this.settings.showTimestamps;
        document.getElementById('showAvatars').checked = this.settings.showAvatars;
        document.getElementById('compactMode').checked = this.settings.compactMode;
        document.getElementById('pushNotifications').checked = this.settings.pushNotifications;
        document.getElementById('soundNotifications').checked = this.settings.soundNotifications;
        document.getElementById('showOnlineStatus').checked = this.settings.showOnlineStatus;
        document.getElementById('profileVisibility').checked = this.settings.profileVisibility;

        // Применяем тему
        if (this.settings.theme) {
            const themeOption = document.querySelector(`[data-theme="${this.settings.theme}"]`);
            if (themeOption) {
                themeOption.classList.add('active');
            }
        }
    }

    async handleAvatarUpload(file) {
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.showNotification('Пожалуйста, выберите изображение', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            this.showNotification('Размер файла не должен превышать 5MB', 'error');
            return;
        }

        try {
            // Здесь будет загрузка на сервер
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('avatarPreview').src = e.target.result;
                this.showNotification('Аватар успешно обновлен', 'success');
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('❌ Ошибка загрузки аватара:', error);
            this.showNotification('Ошибка загрузки аватара', 'error');
        }
    }

    async removeAvatar() {
        if (!confirm('Вы уверены, что хотите удалить аватар?')) return;

        try {
            document.getElementById('avatarPreview').src = 'images/default-avatar.svg';
            this.showNotification('Аватар удален', 'success');
        } catch (error) {
            console.error('❌ Ошибка удаления аватара:', error);
            this.showNotification('Ошибка удаления аватара', 'error');
        }
    }

    checkPasswordStrength() {
        const password = document.getElementById('newPassword').value;
        const strengthFill = document.getElementById('passwordStrength');
        const strengthText = document.getElementById('passwordStrengthText');
        
        if (!password) {
            strengthFill.style.width = '0%';
            strengthText.textContent = 'Введите пароль';
            return;
        }
        
        let strength = 0;
        if (password.length >= 6) strength++;
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;
        
        if (strength <= 2) {
            strengthFill.style.width = '33%';
            strengthFill.style.background = '#ef4444';
            strengthText.textContent = 'Слабый';
        } else if (strength <= 4) {
            strengthFill.style.width = '66%';
            strengthFill.style.background = '#f59e0b';
            strengthText.textContent = 'Средний';
        } else {
            strengthFill.style.width = '100%';
            strengthFill.style.background = '#10b981';
            strengthText.textContent = 'Сильный';
        }
    }

    loadAccountInfo() {
        if (!this.currentUser) return;
        // Загрузка информации об аккаунте
    }

    showDeleteConfirm() {
        if (confirm('Вы уверены, что хотите удалить аккаунт? Это действие необратимо.')) {
            this.deleteAccount();
        }
    }

    async deleteAccount() {
        try {
            // Здесь будет вызов API удаления аккаунта
            console.log('🗑️ Удаление аккаунта');
            this.showNotification('Аккаунт удален', 'success');
            setTimeout(() => this.logout(), 2000);
        } catch (error) {
            console.error('❌ Ошибка удаления аккаунта:', error);
            this.showNotification('Ошибка удаления аккаунта', 'error');
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
                <span style="color: var(--text-primary); font-weight: 500;">${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; margin-left: auto;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    saveAll() {
        this.saveSettings();
        this.showNotification('Все настройки сохранены', 'success');
    }

    goBack() {
        window.history.back();
    }

    logout() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        window.location.href = '/';
    }
}

// Инициализация
const settings = new SettingsManager();
