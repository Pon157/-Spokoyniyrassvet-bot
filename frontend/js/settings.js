// Temporary mock auth verification
window.mockAuth = {
    async verifyToken(token) {
        // Имитируем успешную проверку токена
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const userData = localStorage.getItem('user_data');
        if (!userData) {
            return { success: false, valid: false };
        }
        
        return {
            success: true,
            valid: true,
            user: JSON.parse(userData)
        };
    }
};

// Переопределяем fetch для auth проверки
const originalFetch = window.fetch;
window.fetch = async function(url, options = {}) {
    // Mock для проверки аутентификации
    if (url === '/api/auth/verify' || url.includes('/auth/verify')) {
        const token = options.headers?.Authorization?.replace('Bearer ', '');
        const result = await mockAuth.verifyToken(token);
        return new Response(JSON.stringify(result), { status: 200 });
    }
    
    // Mock для других API endpoints если нужно
    if (url.includes('/api/user/settings') && options.method === 'GET') {
        const settings = localStorage.getItem('user_settings');
        return new Response(JSON.stringify({ 
            success: true, 
            settings: settings ? JSON.parse(settings) : null 
        }), { status: 200 });
    }
    
    if (url.includes('/api/user/settings') && options.method === 'POST') {
        const data = JSON.parse(options.body);
        localStorage.setItem('user_settings', JSON.stringify(data.settings));
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    
    // Для остальных запросов используем оригинальный fetch
    return originalFetch(url, options);
};

// ========== НАЧАЛО КЛАССА SettingsManager ==========
class SettingsManager {
    constructor() {
        this.currentUser = null;
        this.settings = {};
        this.isAuthenticated = false;
        this.init();
    }
class SettingsManager {
    constructor() {
        this.currentUser = null;
        this.settings = {};
        this.isAuthenticated = false;
        this.apiBase = '/api';
        this.init();
    }

    async init() {
        console.log('🎯 Инициализация настроек...');
        
        try {
            await this.checkAuth();
            
            if (this.isAuthenticated) {
                this.loadUserData();
                this.setupAllEventListeners();
                await this.loadSettings();
                this.loadAccountInfo();
                
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
                setTimeout(() => window.location.href = '/index.html', 2000);
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
            
            const response = await fetch(`${this.apiBase}/auth/verify`, {
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
            
            if (result.success && result.valid) {
                this.isAuthenticated = true;
                console.log('✅ Аутентификация успешна');
                
                if (result.user) {
                    this.currentUser = result.user;
                    localStorage.setItem('user_data', JSON.stringify(result.user));
                }
            } else {
                throw new Error('Токен невалиден');
            }
        } catch (error) {
            console.error('❌ Ошибка аутентификации:', error);
            this.isAuthenticated = false;
            
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            
            this.showNotification('Сессия истекла. Пожалуйста, войдите снова.', 'error');
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 2000);
            throw error;
        }
    }

    async makeRequest(url, options = {}) {
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
            window.location.href = '/index.html';
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

        const telegramInput = document.getElementById('telegram');
        if (telegramInput && this.currentUser.telegram_username) {
            telegramInput.value = this.currentUser.telegram_username;
        }
    }

    setupAllEventListeners() {
        document.querySelectorAll('.nav-item').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.isAuthenticated) {
                    this.switchTab(e.currentTarget.dataset.tab);
                }
            });
        });

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

        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', (e) => {
                if (this.isAuthenticated) {
                    this.selectTheme(e.currentTarget.dataset.theme, true);
                }
            });
        });

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

        document.querySelectorAll('.modern-checkbox input').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                if (this.isAuthenticated) this.saveSettings();
            });
        });

        const avatarInput = document.getElementById('avatarInput');
        if (avatarInput) {
            avatarInput.addEventListener('change', (e) => {
                if (this.isAuthenticated && e.target.files[0]) {
                    this.handleAvatarUpload(e.target.files[0]);
                }
            });
        }

        const enableNotifications = document.getElementById('enableNotifications');
        if (enableNotifications) {
            enableNotifications.addEventListener('change', (e) => {
                if (this.isAuthenticated) {
                    this.toggleNotificationPermission(e.target.checked);
                }
            });
        }

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
        const telegram = document.getElementById('telegram')?.value.trim() || '';

        if (!username) {
            this.showNotification('Имя пользователя обязательно', 'error');
            return;
        }

        if (username.length < 3 || username.length > 20) {
            this.showNotification('Имя пользователя должно быть от 3 до 20 символов', 'error');
            return;
        }

        if (telegram && !telegram.startsWith('@')) {
            this.showNotification('Telegram username должен начинаться с @', 'error');
            return;
        }

        try {
            const result = await this.makeRequest(`${this.apiBase}/user/update-profile`, {
                method: 'POST',
                body: JSON.stringify({ 
                    username, 
                    bio,
                    telegram_username: telegram,
                    user_id: this.currentUser.id 
                })
            });

            if (result.success) {
                this.currentUser.username = username;
                this.currentUser.bio = bio;
                this.currentUser.telegram_username = telegram;
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
            const result = await this.makeRequest(`${this.apiBase}/user/change-password`, {
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

        this.applyTheme(themeName);

        this.settings.theme = themeName;
        this.saveSettings();
        
        if (showNotification) {
            this.showNotification(`Тема "${this.getThemeName(themeName)}" применена`, 'success');
        }
    }

    applyTheme(themeName) {
        const existingTheme = document.getElementById('dynamic-theme');
        if (existingTheme) {
            existingTheme.remove();
        }

        const themeLink = document.createElement('link');
        themeLink.id = 'dynamic-theme';
        themeLink.rel = 'stylesheet';
        themeLink.href = `css/${themeName}-theme.css`;
        
        document.head.appendChild(themeLink);

        localStorage.setItem('selected-theme', themeName);
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

        document.documentElement.style.setProperty('--font-family', fontFamilyValue);
        document.documentElement.style.setProperty('--font-size-base', fontSizeValue);
        document.documentElement.style.setProperty('--font-weight', fontWeightValue);

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
            const result = await this.makeRequest(`${this.apiBase}/user/settings`, {
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
            const result = await this.makeRequest(`${this.apiBase}/user/settings?user_id=${this.currentUser.id}`);
            
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

        const fontFamily = document.getElementById('fontFamily');
        const fontSize = document.getElementById('fontSize');
        const fontWeight = document.getElementById('fontWeight');
        const fontSizeValue = document.getElementById('fontSizeValue');

        if (fontFamily) fontFamily.value = this.settings.fontFamily || 'Inter';
        if (fontSize) fontSize.value = parseInt(this.settings.fontSize) || 14;
        if (fontWeight) fontWeight.value = this.settings.fontWeight || '400';
        if (fontSizeValue) fontSizeValue.textContent = fontSize ? fontSize.value : '14';

        const themeToApply = this.settings.theme || 'light';
        this.applyTheme(themeToApply);

        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
        });
        const activeTheme = document.querySelector(`[data-theme="${themeToApply}"]`);
        if (activeTheme) {
            activeTheme.classList.add('active');
        }
    }

    async handleAvatarUpload(file) {
        if (!this.isAuthenticated) return;
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
            const response = await fetch(`${this.apiBase}/user/upload-avatar`, {
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
        if (!this.isAuthenticated) return;
        if (!confirm('Вы уверены, что хотите удалить аватар?')) return;

        try {
            const result = await this.makeRequest(`${this.apiBase}/user/remove-avatar`, {
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
        if (!this.isAuthenticated) return;

        if (enabled) {
            if ('Notification' in window) {
                const permission = await Notification.requestPermission();
                
                if (permission === 'granted') {
                    this.showNotification('Уведомления включены', 'success');
                    
                    if (this.settings.pushNotifications) {
                        new Notification('Спокойный рассвет', {
                            body: 'Уведомления успешно включены!',
                            icon: '/images/logo.png'
                        });
                    }
                    
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
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('✅ Service Worker зарегистрирован');

                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array('YOUR_VAPID_PUBLIC_KEY_HERE')
                });

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
            await this.makeRequest(`${this.apiBase}/user/push-subscription`, {
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
        if (!this.currentUser || !this.isAuthenticated) return;

        const accountId = document.getElementById('accountId');
        const accountRole = document.getElementById('accountRole');
        const accountCreated = document.getElementById('accountCreated');
        const accountTelegram = document.getElementById('accountTelegram');

        if (accountId) accountId.textContent = this.currentUser.id || '-';
        if (accountRole) accountRole.textContent = this.getRoleName(this.currentUser.role);
        if (accountCreated) accountCreated.textContent = this.currentUser.created_at ? 
            new Date(this.currentUser.created_at).toLocaleDateString('ru-RU') : '-';
        if (accountTelegram) accountTelegram.textContent = this.currentUser.telegram_username || 'Не указан';
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
        if (!this.isAuthenticated) return;
        
        if (confirm('Вы уверены, что хотите удалить аккаунт? Это действие необратимо.')) {
            this.deleteAccount();
        }
    }

    async deleteAccount() {
        if (!this.isAuthenticated) return;

        const password = prompt('Введите ваш пароль для подтверждения:');
        if (!password) return;

        try {
            const result = await this.makeRequest(`${this.apiBase}/user/delete-account`, {
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
        const role = this.currentUser?.role || 'user';
        switch(role) {
            case 'owner':
                window.location.href = '/owner.html';
                break;
            case 'admin':
                window.location.href = '/admin.html';
                break;
            case 'coowner':
                window.location.href = '/coowner.html';
                break;
            case 'listener':
                window.location.href = '/listener.html';
                break;
            default:
                window.location.href = '/chat.html';
        }
    }

    logout() {
        this.isAuthenticated = false;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('selected-theme');
        window.location.href = '/index.html';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    window.settings = new SettingsManager();
});
