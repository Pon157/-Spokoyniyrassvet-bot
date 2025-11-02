class SettingsManager {
    constructor() {
        this.currentUser = null;
        this.settings = {};
        this.isAuthenticated = false;
        this.init();
    }

    async init() {
        console.log('🎯 Инициализация настроек...');
        
        try {
            // Сначала проверяем аутентификацию
            await this.checkAuth();
            
            // Если аутентификация успешна, загружаем остальные данные
            if (this.isAuthenticated) {
                this.loadUserData();
                this.setupAllEventListeners();
                await this.loadSettings();
                this.loadAccountInfo();
                
                // Применяем сохраненную тему из localStorage
                const savedTheme = localStorage.getItem('selected-theme');
                if (savedTheme) {
                    this.selectTheme(savedTheme, false);
                }
                
                console.log('✅ Настройки готовы');
            }
        } catch (error) {
            console.error('❌ Ошибка инициализации:', error);
            if (!this.isAuthenticated) {
                this.showNotification('Требуется авторизация', 'error');
                setTimeout(() => window.location.href = '/login.html', 2000);
            } else {
                this.showNotification('Ошибка загрузки настроек', 'error');
            }
        }
    }

    async checkAuth() {
        const token = localStorage.getItem('auth_token');
        const userData = localStorage.getItem('user_data');

        if (!token || !userData) {
            console.log('🔐 Нет данных аутентификации');
            this.isAuthenticated = false;
            throw new Error('Not authenticated');
        }

        try {
            this.currentUser = JSON.parse(userData);
            console.log('👤 Текущий пользователь:', this.currentUser);
            
            // Проверяем токен через API
            const response = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('🔑 Результат проверки токена:', result);
            
            if (result.valid) {
                this.isAuthenticated = true;
                console.log('✅ Аутентификация успешна');
            } else {
                throw new Error('Токен невалиден');
            }
        } catch (error) {
            console.error('❌ Ошибка аутентификации:', error);
            this.isAuthenticated = false;
            
            // Очищаем невалидные данные
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            
            this.showNotification('Сессия истекла. Пожалуйста, войдите снова.', 'error');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
            throw error;
        }
    }

    async makeRequest(url, options = {}) {
        // Проверяем аутентификацию перед каждым запросом
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated');
        }

        const token = localStorage.getItem('auth_token');
        
        try {
            const defaultOptions = {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            };
            
            const response = await fetch(url, { ...defaultOptions, ...options });
            
            // Если получили 401 Unauthorized, разлогиниваем пользователя
            if (response.status === 401) {
                this.handleUnauthorized();
                throw new Error('Authentication required');
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('❌ Ошибка запроса:', error);
            
            // Если ошибка аутентификации, перенаправляем на логин
            if (error.message.includes('Authentication') || error.message.includes('401')) {
                this.handleUnauthorized();
            }
            
            throw error;
        }
    }

    handleUnauthorized() {
        this.isAuthenticated = false;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        this.showNotification('Сессия истекла', 'error');
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 2000);
    }

    loadUserData() {
        if (!this.currentUser || !this.isAuthenticated) return;

        const usernameInput = document.getElementById('username');
        const bioInput = document.getElementById('bio');
        const avatarPreview = document.getElementById('avatarPreview');

        if (usernameInput) {
            usernameInput.value = this.currentUser.username || '';
        }
        
        if (bioInput) {
            bioInput.value = this.currentUser.bio || '';
        }
        
        if (avatarPreview && this.currentUser.avatar_url) {
            avatarPreview.src = this.currentUser.avatar_url + '?t=' + Date.now();
        }
    }

    setupAllEventListeners() {
        // Навигация
        document.querySelectorAll('.nav-item').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.isAuthenticated) {
                    this.switchTab(e.currentTarget.dataset.tab);
                }
            });
        });

        // Формы - добавляем проверку аутентификации
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (this.isAuthenticated) {
                    this.saveProfile();
                } else {
                    this.showNotification('Требуется авторизация', 'error');
                }
            });
        }

        const passwordForm = document.getElementById('passwordForm');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (this.isAuthenticated) {
                    this.changePassword();
                } else {
                    this.showNotification('Требуется авторизация', 'error');
                }
            });
        }

        // Темы
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', (e) => {
                if (this.isAuthenticated) {
                    this.selectTheme(e.currentTarget.dataset.theme, true);
                }
            });
        });

        // Настройки шрифтов
        const fontFamily = document.getElementById('fontFamily');
        const fontSize = document.getElementById('fontSize');
        const fontWeight = document.getElementById('fontWeight');

        if (fontFamily) {
            fontFamily.addEventListener('change', () => {
                if (this.isAuthenticated) this.applyFontSettings();
            });
        }

        if (fontSize) {
            fontSize.addEventListener('input', (e) => {
                const fontSizeValue = document.getElementById('fontSizeValue');
                if (fontSizeValue) {
                    fontSizeValue.textContent = e.target.value;
                }
                if (this.isAuthenticated) this.applyFontSettings();
            });
        }

        if (fontWeight) {
            fontWeight.addEventListener('change', () => {
                if (this.isAuthenticated) this.applyFontSettings();
            });
        }

        // Чекбоксы
        document.querySelectorAll('.modern-checkbox input').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                if (this.isAuthenticated) this.saveSettings();
            });
        });

        // Аватар
        const avatarInput = document.getElementById('avatarInput');
        if (avatarInput) {
            avatarInput.addEventListener('change', (e) => {
                if (this.isAuthenticated && e.target.files[0]) {
                    this.handleAvatarUpload(e.target.files[0]);
                }
            });
        }

        // Уведомления
        const enableNotifications = document.getElementById('enableNotifications');
        if (enableNotifications) {
            enableNotifications.addEventListener('change', (e) => {
                if (this.isAuthenticated) {
                    this.toggleNotificationPermission(e.target.checked);
                }
            });
        }

        // Сила пароля
        const newPassword = document.getElementById('newPassword');
        if (newPassword) {
            newPassword.addEventListener('input', () => {
                this.checkPasswordStrength();
            });
        }
    }

    switchTab(tabName) {
        if (!this.isAuthenticated) return;

        document.querySelectorAll('.nav-item').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        const activeContent = document.getElementById(`${tabName}Tab`);

        if (activeTab) activeTab.classList.add('active');
        if (activeContent) activeContent.classList.add('active');
    }

    async saveProfile() {
        if (!this.isAuthenticated) {
            this.showNotification('Требуется авторизация', 'error');
            return;
        }

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
        if (!this.isAuthenticated) {
            this.showNotification('Требуется авторизация', 'error');
            return;
        }

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
        if (!this.isAuthenticated) return;

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
        if (!this.isAuthenticated) return;

        const fontFamily = document.getElementById('fontFamily');
        const fontSize = document.getElementById('fontSize');
        const fontWeight = document.getElementById('fontWeight');

        if (!fontFamily || !fontSize || !fontWeight) return;

        const fontFamilyValue = fontFamily.value;
        const fontSizeValue = fontSize.value + 'px';
        const fontWeightValue = fontWeight.value;

        // Применяем настройки шрифта
        document.documentElement.style.setProperty('--font-family', fontFamilyValue);
        document.documentElement.style.setProperty('--font-size-base', fontSizeValue);
        document.documentElement.style.setProperty('--font-weight', fontWeightValue);

        // Сохраняем настройки
        this.settings.fontFamily = fontFamilyValue;
        this.settings.fontSize = fontSizeValue;
        this.settings.fontWeight = fontWeightValue;
        this.saveSettings();
    }

    async saveSettings() {
        if (!this.isAuthenticated) return;

        const showTimestamps = document.getElementById('showTimestamps');
        const showAvatars = document.getElementById('showAvatars');
        const compactMode = document.getElementById('compactMode');
        const pushNotifications = document.getElementById('pushNotifications');
        const soundNotifications = document.getElementById('soundNotifications');
        const showOnlineStatus = document.getElementById('showOnlineStatus');
        const profileVisibility = document.getElementById('profileVisibility');
        const enableNotifications = document.getElementById('enableNotifications');

        const settings = {
            theme: this.settings.theme || 'light',
            fontFamily: this.settings.fontFamily || 'Inter',
            fontSize: this.settings.fontSize || '14px',
            fontWeight: this.settings.fontWeight || '400',
            showTimestamps: showTimestamps ? showTimestamps.checked : true,
            showAvatars: showAvatars ? showAvatars.checked : true,
            compactMode: compactMode ? compactMode.checked : false,
            pushNotifications: pushNotifications ? pushNotifications.checked : true,
            soundNotifications: soundNotifications ? soundNotifications.checked : true,
            showOnlineStatus: showOnlineStatus ? showOnlineStatus.checked : true,
            profileVisibility: profileVisibility ? profileVisibility.checked : true,
            enableNotifications: enableNotifications ? enableNotifications.checked : false
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
        if (!this.isAuthenticated) return;

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
        if (!this.isAuthenticated) return;

        // Применяем настройки к интерфейсу
        const showTimestamps = document.getElementById('showTimestamps');
        const showAvatars = document.getElementById('showAvatars');
        const compactMode = document.getElementById('compactMode');
        const pushNotifications = document.getElementById('pushNotifications');
        const soundNotifications = document.getElementById('soundNotifications');
        const showOnlineStatus = document.getElementById('showOnlineStatus');
        const profileVisibility = document.getElementById('profileVisibility');
        const enableNotifications = document.getElementById('enableNotifications');

        if (showTimestamps) showTimestamps.checked = this.settings.showTimestamps !== false;
        if (showAvatars) showAvatars.checked = this.settings.showAvatars !== false;
        if (compactMode) compactMode.checked = this.settings.compactMode || false;
        if (pushNotifications) pushNotifications.checked = this.settings.pushNotifications !== false;
        if (soundNotifications) soundNotifications.checked = this.settings.soundNotifications !== false;
        if (showOnlineStatus) showOnlineStatus.checked = this.settings.showOnlineStatus !== false;
        if (profileVisibility) profileVisibility.checked = this.settings.profileVisibility !== false;
        if (enableNotifications) enableNotifications.checked = this.settings.enableNotifications || false;

        // Применяем настройки шрифтов
        const fontFamily = document.getElementById('fontFamily');
        const fontSize = document.getElementById('fontSize');
        const fontWeight = document.getElementById('fontWeight');
        const fontSizeValue = document.getElementById('fontSizeValue');

        if (fontFamily) fontFamily.value = this.settings.fontFamily || 'Inter';
        if (fontSize) fontSize.value = parseInt(this.settings.fontSize) || 14;
        if (fontWeight) fontWeight.value = this.settings.fontWeight || '400';
        if (fontSizeValue) fontSizeValue.textContent = fontSize ? fontSize.value : '14';

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

    // ... остальные методы остаются такими же, но с проверкой this.isAuthenticated

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
        if (!this.isAuthenticated) {
            this.showNotification('Требуется авторизация', 'error');
            return;
        }
        this.saveSettings();
        this.showNotification('Все настройки сохранены', 'success');
    }

    goBack() {
        window.history.back();
    }

    logout() {
        this.isAuthenticated = false;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('selected-theme');
        window.location.href = '/login.html';
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    window.settings = new SettingsManager();
});
