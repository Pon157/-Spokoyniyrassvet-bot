class SettingsManager {
    constructor() {
        this.currentUser = null;
        this.settings = {};
        this.init();
    }

    async init() {
        console.log('🎯 Инициализация настроек...');
        
        try {
            await this.checkAuth();
            this.loadUserData();
            this.setupAllEventListeners();
            await this.loadSettings();
            this.loadAccountInfo();
            
            // Применяем сохраненную тему из localStorage
            const savedTheme = localStorage.getItem('selected-theme');
            if (savedTheme) {
                this.selectTheme(savedTheme, false); // false - не показывать уведомление
            }
            
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
            this.showNotification('Требуется авторизация', 'error');
            setTimeout(() => window.location.href = '/', 2000);
            throw new Error('Not authenticated');
        }

        try {
            this.currentUser = JSON.parse(userData);
            
            // Проверяем токен через API
            const response = await fetch('/api/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Токен невалиден');
            }

            const result = await response.json();
            if (!result.valid) {
                throw new Error('Токен невалиден');
            }
        } catch (error) {
            console.error('❌ Ошибка аутентификации:', error);
            this.showNotification('Сессия истекла', 'error');
            setTimeout(() => {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_data');
                localStorage.removeItem('selected-theme');
                window.location.href = '/';
            }, 2000);
            throw error;
        }
    }

    async makeRequest(url, options = {}) {
        const token = localStorage.getItem('auth_token');
        
        try {
            const defaultOptions = {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            };
            
            const response = await fetch(url, { ...defaultOptions, ...options });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('❌ Ошибка запроса:', error);
            throw error;
        }
    }

    loadUserData() {
        if (!this.currentUser) return;

        document.getElementById('username').value = this.currentUser.username || '';
        document.getElementById('bio').value = this.currentUser.bio || '';
        
        if (this.currentUser.avatar_url) {
            document.getElementById('avatarPreview').src = this.currentUser.avatar_url + '?t=' + Date.now();
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
                this.selectTheme(e.currentTarget.dataset.theme, true);
            });
        });

        // Настройки шрифтов
        document.getElementById('fontFamily').addEventListener('change', () => {
            this.applyFontSettings();
        });

        document.getElementById('fontSize').addEventListener('input', (e) => {
            document.getElementById('fontSizeValue').textContent = e.target.value;
            this.applyFontSettings();
        });

        document.getElementById('fontWeight').addEventListener('change', () => {
            this.applyFontSettings();
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

        // Уведомления
        document.getElementById('enableNotifications').addEventListener('change', (e) => {
            this.toggleNotificationPermission(e.target.checked);
        });

        // Сила пароля
        document.getElementById('newPassword').addEventListener('input', () => {
            this.checkPasswordStrength();
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
        const username = document.getElementById('username').value.trim();
        const bio = document.getElementById('bio').value.trim();

        if (!username) {
            this.showNotification('Имя пользователя обязательно', 'error');
            return;
        }

        if (username.length < 3 || username.length > 20) {
            this.showNotification('Имя пользователя должно быть от 3 до 20 символов', 'error');
            return;
        }

        try {
            const result = await this.makeRequest('/api/user/update-profile', {
                method: 'POST',
                body: JSON.stringify({ 
                    username, 
                    bio,
                    user_id: this.currentUser.id 
                })
            });

            if (result.success) {
                // Обновляем данные пользователя
                this.currentUser.username = username;
                this.currentUser.bio = bio;
                localStorage.setItem('user_data', JSON.stringify(this.currentUser));
                this.showNotification('Профиль успешно обновлен', 'success');
            } else {
                throw new Error(result.error || 'Неизвестная ошибка');
            }
        } catch (error) {
            console.error('❌ Ошибка сохранения профиля:', error);
            this.showNotification(error.message || 'Ошибка сохранения профиля', 'error');
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
            const result = await this.makeRequest('/api/user/change-password', {
                method: 'POST',
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword,
                    user_id: this.currentUser.id
                })
            });

            if (result.success) {
                this.showNotification('Пароль успешно изменен', 'success');
                document.getElementById('passwordForm').reset();
                this.resetPasswordStrength();
            } else {
                throw new Error(result.error || 'Неизвестная ошибка');
            }
        } catch (error) {
            console.error('❌ Ошибка смены пароля:', error);
            this.showNotification(error.message || 'Ошибка смены пароля', 'error');
        }
    }

    selectTheme(themeName, showNotification = true) {
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
        });
        
        const themeElement = document.querySelector(`[data-theme="${themeName}"]`);
        if (themeElement) {
            themeElement.classList.add('active');
        }

        // Применяем тему
        this.applyTheme(themeName);

        // Сохраняем настройки
        this.settings.theme = themeName;
        this.saveSettings();
        
        if (showNotification) {
            this.showNotification(`Тема "${this.getThemeName(themeName)}" применена`, 'success');
        }
    }

    applyTheme(themeName) {
        // Удаляем предыдущую тему
        const existingTheme = document.getElementById('dynamic-theme');
        if (existingTheme) {
            existingTheme.remove();
        }

        // Создаем новую тему
        const themeLink = document.createElement('link');
        themeLink.id = 'dynamic-theme';
        themeLink.rel = 'stylesheet';
        
        // Правильный путь к темам
        themeLink.href = `css/${themeName}-theme.css`;
        
        document.head.appendChild(themeLink);

        // Сохраняем в localStorage для persistence
        localStorage.setItem('selected-theme', themeName);
        
        // Применяем настройки шрифта к новой теме
        this.applyFontSettings();
    }

    applyFontSettings() {
        const fontFamily = document.getElementById('fontFamily').value;
        const fontSize = document.getElementById('fontSize').value + 'px';
        const fontWeight = document.getElementById('fontWeight').value;

        // Применяем настройки шрифта
        document.documentElement.style.setProperty('--font-family', fontFamily);
        document.documentElement.style.setProperty('--font-size-base', fontSize);
        document.documentElement.style.setProperty('--font-weight', fontWeight);

        // Сохраняем настройки
        this.settings.fontFamily = fontFamily;
        this.settings.fontSize = fontSize;
        this.settings.fontWeight = fontWeight;
        this.saveSettings();
    }

    async saveSettings() {
        const settings = {
            theme: this.settings.theme || 'light',
            fontFamily: this.settings.fontFamily || 'Inter',
            fontSize: this.settings.fontSize || '14px',
            fontWeight: this.settings.fontWeight || '400',
            showTimestamps: document.getElementById('showTimestamps').checked,
            showAvatars: document.getElementById('showAvatars').checked,
            compactMode: document.getElementById('compactMode').checked,
            pushNotifications: document.getElementById('pushNotifications').checked,
            soundNotifications: document.getElementById('soundNotifications').checked,
            showOnlineStatus: document.getElementById('showOnlineStatus').checked,
            profileVisibility: document.getElementById('profileVisibility').checked,
            enableNotifications: document.getElementById('enableNotifications').checked
        };

        try {
            const result = await this.makeRequest('/api/user/settings', {
                method: 'POST',
                body: JSON.stringify({ 
                    settings,
                    user_id: this.currentUser.id 
                })
            });

            if (!result.success) {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('❌ Ошибка сохранения настроек:', error);
        }
    }

    async loadSettings() {
        try {
            const result = await this.makeRequest(`/api/user/settings?user_id=${this.currentUser.id}`);
            
            if (result.success && result.settings) {
                this.settings = result.settings;
                this.applySettings();
            } else {
                this.settings = this.getDefaultSettings();
                this.applySettings();
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки настроек:', error);
            this.settings = this.getDefaultSettings();
            this.applySettings();
        }
    }

    getDefaultSettings() {
        return {
            theme: 'light',
            fontFamily: 'Inter',
            fontSize: '14px',
            fontWeight: '400',
            showTimestamps: true,
            showAvatars: true,
            compactMode: false,
            pushNotifications: true,
            soundNotifications: true,
            showOnlineStatus: true,
            profileVisibility: true,
            enableNotifications: false
        };
    }

    applySettings() {
        // Применяем настройки к интерфейсу
        document.getElementById('showTimestamps').checked = this.settings.showTimestamps !== false;
        document.getElementById('showAvatars').checked = this.settings.showAvatars !== false;
        document.getElementById('compactMode').checked = this.settings.compactMode || false;
        document.getElementById('pushNotifications').checked = this.settings.pushNotifications !== false;
        document.getElementById('soundNotifications').checked = this.settings.soundNotifications !== false;
        document.getElementById('showOnlineStatus').checked = this.settings.showOnlineStatus !== false;
        document.getElementById('profileVisibility').checked = this.settings.profileVisibility !== false;
        document.getElementById('enableNotifications').checked = this.settings.enableNotifications || false;

        // Применяем настройки шрифтов
        document.getElementById('fontFamily').value = this.settings.fontFamily || 'Inter';
        document.getElementById('fontSize').value = parseInt(this.settings.fontSize) || 14;
        document.getElementById('fontWeight').value = this.settings.fontWeight || '400';
        document.getElementById('fontSizeValue').textContent = document.getElementById('fontSize').value;

        // Применяем тему
        const themeToApply = this.settings.theme || 'light';
        this.applyTheme(themeToApply);

        // Выбираем активную тему в интерфейсе
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
        });
        const activeTheme = document.querySelector(`[data-theme="${themeToApply}"]`);
        if (activeTheme) {
            activeTheme.classList.add('active');
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
            const formData = new FormData();
            formData.append('avatar', file);
            formData.append('user_id', this.currentUser.id);

            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/user/upload-avatar', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                document.getElementById('avatarPreview').src = result.avatar_url + '?t=' + Date.now();
                this.currentUser.avatar_url = result.avatar_url;
                localStorage.setItem('user_data', JSON.stringify(this.currentUser));
                this.showNotification('Аватар успешно обновлен', 'success');
            } else {
                throw new Error(result.error || 'Неизвестная ошибка');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки аватара:', error);
            this.showNotification(error.message || 'Ошибка загрузки аватара', 'error');
        }
    }

    async removeAvatar() {
        if (!confirm('Вы уверены, что хотите удалить аватар?')) return;

        try {
            const result = await this.makeRequest('/api/user/remove-avatar', {
                method: 'POST',
                body: JSON.stringify({ user_id: this.currentUser.id })
            });

            if (result.success) {
                document.getElementById('avatarPreview').src = 'images/default-avatar.svg';
                this.currentUser.avatar_url = null;
                localStorage.setItem('user_data', JSON.stringify(this.currentUser));
                this.showNotification('Аватар удален', 'success');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('❌ Ошибка удаления аватара:', error);
            this.showNotification(error.message || 'Ошибка удаления аватара', 'error');
        }
    }

    async toggleNotificationPermission(enabled) {
        if (enabled) {
            if ('Notification' in window) {
                const permission = await Notification.requestPermission();
                
                if (permission === 'granted') {
                    this.showNotification('Уведомления включены', 'success');
                    
                    // Создаем тестовое уведомление
                    if (this.settings.pushNotifications) {
                        new Notification('Спокойный рассвет', {
                            body: 'Уведомления успешно включены!',
                            icon: '/images/logo.png'
                        });
                    }
                    
                    // Настраиваем push-уведомления
                    await this.setupPushNotifications();
                } else {
                    this.showNotification('Разрешите уведомления в настройках браузера', 'warning');
                    document.getElementById('enableNotifications').checked = false;
                }
            } else {
                this.showNotification('Ваш браузер не поддерживает уведомления', 'warning');
                document.getElementById('enableNotifications').checked = false;
            }
        }
        
        this.settings.enableNotifications = enabled;
        this.saveSettings();
    }

    async setupPushNotifications() {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            try {
                // Регистрируем Service Worker
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('✅ Service Worker зарегистрирован');

                // Подписываем на push-уведомления
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array('YOUR_VAPID_PUBLIC_KEY_HERE')
                });

                // Отправляем подписку на сервер
                await this.savePushSubscription(subscription);
                
            } catch (error) {
                console.error('❌ Ошибка настройки push-уведомлений:', error);
            }
        }
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    async savePushSubscription(subscription) {
        try {
            await this.makeRequest('/api/user/push-subscription', {
                method: 'POST',
                body: JSON.stringify({
                    subscription,
                    user_id: this.currentUser.id
                })
            });
        } catch (error) {
            console.error('❌ Ошибка сохранения подписки:', error);
        }
    }

    checkPasswordStrength() {
        const password = document.getElementById('newPassword').value;
        const strengthFill = document.getElementById('passwordStrength');
        const strengthText = document.getElementById('passwordStrengthText');
        
        if (!password) {
            strengthFill.style.width = '0%';
            strengthText.textContent = 'Введите пароль';
            strengthText.style.color = 'var(--text-secondary)';
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
            strengthText.style.color = '#ef4444';
        } else if (strength <= 4) {
            strengthFill.style.width = '66%';
            strengthFill.style.background = '#f59e0b';
            strengthText.textContent = 'Средний';
            strengthText.style.color = '#f59e0b';
        } else {
            strengthFill.style.width = '100%';
            strengthFill.style.background = '#10b981';
            strengthText.textContent = 'Сильный';
            strengthText.style.color = '#10b981';
        }
    }

    resetPasswordStrength() {
        const strengthFill = document.getElementById('passwordStrength');
        const strengthText = document.getElementById('passwordStrengthText');
        
        strengthFill.style.width = '0%';
        strengthText.textContent = 'Введите пароль';
        strengthText.style.color = 'var(--text-secondary)';
    }

    loadAccountInfo() {
        if (!this.currentUser) return;

        document.getElementById('accountId').textContent = this.currentUser.id || '-';
        document.getElementById('accountRole').textContent = this.getRoleName(this.currentUser.role);
        document.getElementById('accountCreated').textContent = this.currentUser.created_at ? 
            new Date(this.currentUser.created_at).toLocaleDateString('ru-RU') : '-';
    }

    getRoleName(role) {
        const roles = {
            'user': 'Пользователь',
            'listener': 'Слушатель',
            'coowner': 'Совладелец', 
            'admin': 'Администратор',
            'owner': 'Владелец'
        };
        return roles[role] || role;
    }

    getThemeName(theme) {
        const themes = {
            'light': 'Светлая',
            'dark': 'Темная',
            'blue': 'Синяя',
            'green': 'Зеленая',
            'orange': 'Оранжевая',
            'purple': 'Фиолетовая'
        };
        return themes[theme] || theme;
    }

    showDeleteConfirm() {
        if (confirm('Вы уверены, что хотите удалить аккаунт? Это действие необратимо.')) {
            this.deleteAccount();
        }
    }

    async deleteAccount() {
        const password = prompt('Введите ваш пароль для подтверждения:');
        if (!password) return;

        try {
            const result = await this.makeRequest('/api/user/delete-account', {
                method: 'POST',
                body: JSON.stringify({ 
                    password,
                    user_id: this.currentUser.id 
                })
            });

            if (result.success) {
                this.showNotification('Аккаунт удален', 'success');
                setTimeout(() => this.logout(), 2000);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('❌ Ошибка удаления аккаунта:', error);
            this.showNotification(error.message || 'Ошибка удаления аккаунта', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Удаляем предыдущие уведомления
        document.querySelectorAll('.notification').forEach(notification => {
            notification.remove();
        });

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
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

    getNotificationIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
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
        localStorage.removeItem('selected-theme');
        window.location.href = '/';
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    window.settings = new SettingsManager();
});
