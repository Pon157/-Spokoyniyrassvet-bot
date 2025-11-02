<script src="js/push-manager.js"></script>
<script src="js/telegram-notifications.js"></script>
<script src="sw.js"></script>
<script src="js/settings.js"></script>

// Temporary mock for demonstration
window.mockAPI = {
    async verifyToken(token) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const userData = localStorage.getItem('user_data');
        if (!userData) return { success: false, valid: false };
        
        return {
            success: true,
            valid: true,
            user: JSON.parse(userData)
        };
    },

    async updateProfile(data) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
        const updatedUser = { ...userData, ...data };
        localStorage.setItem('user_data', JSON.stringify(updatedUser));
        return { success: true, user: updatedUser };
    },

    async changePassword(data) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true };
    },

    async saveSettings(data) {
        await new Promise(resolve => setTimeout(resolve, 300));
        localStorage.setItem('user_settings', JSON.stringify(data.settings));
        return { success: true };
    },

    async loadSettings(userId) {
        await new Promise(resolve => setTimeout(resolve, 300));
        const settings = localStorage.getItem('user_settings');
        return { 
            success: true, 
            settings: settings ? JSON.parse(settings) : null 
        };
    },

    async uploadAvatar(formData) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Имитируем загрузку аватара - создаем data URL
        return new Promise((resolve) => {
            const file = formData.get('avatar');
            const reader = new FileReader();
            reader.onload = function(e) {
                resolve({
                    success: true,
                    avatar_url: e.target.result
                });
            };
            reader.readAsDataURL(file);
        });
    }
};

// Mock fetch for API calls
const originalFetch = window.fetch;
window.fetch = async function(url, options = {}) {
    console.log('🔧 Mock fetch:', url, options.method);
    
    // Auth verification
    if (url.includes('/auth/verify')) {
        const token = options.headers?.Authorization?.replace('Bearer ', '');
        const result = await mockAPI.verifyToken(token);
        return new Response(JSON.stringify(result), { status: 200 });
    }
    
    // Update profile
    if (url.includes('/user/update-profile') && options.method === 'POST') {
        const data = JSON.parse(options.body);
        const result = await mockAPI.updateProfile(data);
        return new Response(JSON.stringify(result), { status: 200 });
    }
    
    // Change password
    if (url.includes('/user/change-password') && options.method === 'POST') {
        const data = JSON.parse(options.body);
        const result = await mockAPI.changePassword(data);
        return new Response(JSON.stringify(result), { status: 200 });
    }
    
    // Save settings
    if (url.includes('/user/settings') && options.method === 'POST') {
        const data = JSON.parse(options.body);
        const result = await mockAPI.saveSettings(data);
        return new Response(JSON.stringify(result), { status: 200 });
    }
    
    // Load settings
    if (url.includes('/user/settings') && options.method === 'GET') {
        const urlObj = new URL(url, 'http://localhost');
        const userId = urlObj.searchParams.get('user_id');
        const result = await mockAPI.loadSettings(userId);
        return new Response(JSON.stringify(result), { status: 200 });
    }
    
    // Upload avatar
    if (url.includes('/user/upload-avatar') && options.method === 'POST') {
        const formData = options.body;
        const result = await mockAPI.uploadAvatar(formData);
        return new Response(JSON.stringify(result), { status: 200 });
    }
    
    // Remove avatar
    if (url.includes('/user/remove-avatar') && options.method === 'POST') {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    
    return originalFetch(url, options);
};

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
            await this.simpleCheckAuth();
            
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
        }
    }

    async simpleCheckAuth() {
        const token = localStorage.getItem('auth_token');
        const userData = localStorage.getItem('user_data');

        console.log('🔐 Проверка аутентификации...');

        if (!token || !userData) {
            console.log('❌ Нет данных аутентификации');
            this.isAuthenticated = false;
            this.showNotification('Требуется авторизация', 'error');
            setTimeout(() => window.location.href = '/index.html', 2000);
            throw new Error('Not authenticated');
        }

        try {
            this.currentUser = JSON.parse(userData);
            this.isAuthenticated = true;
            console.log('✅ Аутентификация пройдена:', this.currentUser.username);
            
        } catch (error) {
            console.error('❌ Ошибка проверки аутентификации:', error);
            this.isAuthenticated = false;
            this.showNotification('Ошибка аутентификации', 'error');
            setTimeout(() => window.location.href = '/index.html', 2000);
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
            
            const finalOptions = { ...defaultOptions, ...options };
            
            // Для FormData убираем Content-Type
            if (options.body instanceof FormData) {
                delete finalOptions.headers['Content-Type'];
            }
            
            const response = await fetch(url, finalOptions);
            
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
            throw error;
        }
    }

    handleUnauthorized() {
        this.isAuthenticated = false;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        this.showNotification('Сессия истекла', 'error');
        setTimeout(() => window.location.href = '/index.html', 2000);
    }

    loadUserData() {
        if (!this.currentUser || !this.isAuthenticated) return;

        console.log('👤 Загрузка данных пользователя:', this.currentUser);

        // Устанавливаем значения в форму
        const usernameInput = document.getElementById('username');
        const bioInput = document.getElementById('bio');
        const avatarPreview = document.getElementById('avatarPreview');
        const telegramInput = document.getElementById('telegram');

        if (usernameInput) usernameInput.value = this.currentUser.username || '';
        if (bioInput) bioInput.value = this.currentUser.bio || '';
        if (telegramInput) telegramInput.value = this.currentUser.telegram_username || '';
        
        if (avatarPreview) {
            avatarPreview.src = this.currentUser.avatar_url || 'images/default-avatar.svg';
        }
    }

    setupAllEventListeners() {
        console.log('🔧 Настройка обработчиков событий...');
        
        // Навигация
        document.querySelectorAll('.nav-item').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchTab(e.currentTarget.dataset.tab);
            });
        });

        // Форма профиля
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveProfile();
            });
        }

        // Форма смены пароля
        const passwordForm = document.getElementById('passwordForm');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.changePassword();
            });
        }

        // Выбор темы
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', (e) => {
                this.selectTheme(e.currentTarget.dataset.theme, true);
            });
        });

        // Настройки шрифтов
        const fontFamily = document.getElementById('fontFamily');
        const fontSize = document.getElementById('fontSize');
        const fontWeight = document.getElementById('fontWeight');

        if (fontFamily) {
            fontFamily.addEventListener('change', () => this.applyFontSettings());
        }
        if (fontSize) {
            fontSize.addEventListener('input', (e) => {
                document.getElementById('fontSizeValue').textContent = e.target.value;
                this.applyFontSettings();
            });
        }
        if (fontWeight) {
            fontWeight.addEventListener('change', () => this.applyFontSettings());
        }

        // Чекбоксы
        document.querySelectorAll('.modern-checkbox input').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.saveSettings());
        });

        // Загрузка аватара
        const avatarInput = document.getElementById('avatarInput');
        if (avatarInput) {
            avatarInput.addEventListener('change', (e) => {
                if (e.target.files[0]) {
                    this.handleAvatarUpload(e.target.files[0]);
                }
            });
        }

        // Уведомления
        const enableNotifications = document.getElementById('enableNotifications');
        if (enableNotifications) {
            enableNotifications.addEventListener('change', (e) => {
                this.toggleNotificationPermission(e.target.checked);
            });
        }

        // Сила пароля
        const newPassword = document.getElementById('newPassword');
        if (newPassword) {
            newPassword.addEventListener('input', () => this.checkPasswordStrength());
        }

        // Кнопка удаления аватара
        const removeAvatarBtn = document.querySelector('[onclick="settings.removeAvatar()"]');
        if (removeAvatarBtn) {
            removeAvatarBtn.addEventListener('click', () => this.removeAvatar());
        }

        // Кнопка сохранения всех настроек
        const saveAllBtn = document.querySelector('.liquid-btn[onclick="settings.saveAll()"]');
        if (saveAllBtn) {
            saveAllBtn.addEventListener('click', () => this.saveAll());
        }

        // Кнопка назад
        const backBtn = document.querySelector('.btn-back');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.goBack());
        }

        console.log('✅ Все обработчики событий настроены');
    }

    switchTab(tabName) {
        console.log('📁 Переключение на вкладку:', tabName);
        
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
        console.log('💾 Сохранение профиля...');
        
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

        this.showNotification('Сохранение профиля...', 'info');

        try {
            const result = await this.makeRequest('/api/user/update-profile', {
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
        console.log('🔑 Смена пароля...');
        
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

        this.showNotification('Смена пароля...', 'info');

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
        console.log('🎨 Применение темы:', themeName);
        
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

        // Для демо - просто меняем CSS переменные
        if (themeName === 'dark') {
            document.documentElement.style.setProperty('--bg-primary', '#0f172a');
            document.documentElement.style.setProperty('--bg-secondary', '#1e293b');
            document.documentElement.style.setProperty('--text-primary', '#f1f5f9');
        } else {
            document.documentElement.style.setProperty('--bg-primary', '#ffffff');
            document.documentElement.style.setProperty('--bg-secondary', '#f8fafc');
            document.documentElement.style.setProperty('--text-primary', '#1e293b');
        }

        localStorage.setItem('selected-theme', themeName);
    }

    applyFontSettings() {
        console.log('🔤 Применение настроек шрифта...');
        
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
        console.log('⚙️ Сохранение настроек...');
        
        const settings = {
            theme: this.settings.theme || 'light',
            fontFamily: this.settings.fontFamily || 'Inter',
            fontSize: this.settings.fontSize || '14px',
            fontWeight: this.settings.fontWeight || '400',
            showTimestamps: document.getElementById('showTimestamps')?.checked ?? true,
            showAvatars: document.getElementById('showAvatars')?.checked ?? true,
            compactMode: document.getElementById('compactMode')?.checked ?? false,
            pushNotifications: document.getElementById('pushNotifications')?.checked ?? true,
            soundNotifications: document.getElementById('soundNotifications')?.checked ?? true,
            showOnlineStatus: document.getElementById('showOnlineStatus')?.checked ?? true,
            profileVisibility: document.getElementById('profileVisibility')?.checked ?? true,
            enableNotifications: document.getElementById('enableNotifications')?.checked ?? false
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
        console.log('📥 Загрузка настроек...');
        
        try {
            const result = await this.makeRequest(`/api/user/settings?user_id=${this.currentUser.id}`);
            
            if (result.success && result.settings) {
                this.settings = result.settings;
                console.log('✅ Настройки загружены:', this.settings);
            } else {
                this.settings = this.getDefaultSettings();
                console.log('⚙️ Используются настройки по умолчанию');
            }
            
            this.applySettings();
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
        console.log('🔧 Применение настроек к интерфейсу...');
        
        // Чекбоксы
        const checkboxes = {
            'showTimestamps': this.settings.showTimestamps !== false,
            'showAvatars': this.settings.showAvatars !== false,
            'compactMode': this.settings.compactMode || false,
            'pushNotifications': this.settings.pushNotifications !== false,
            'soundNotifications': this.settings.soundNotifications !== false,
            'showOnlineStatus': this.settings.showOnlineStatus !== false,
            'profileVisibility': this.settings.profileVisibility !== false,
            'enableNotifications': this.settings.enableNotifications || false
        };

        Object.entries(checkboxes).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.checked = value;
        });

        // Настройки шрифтов
        const fontFamily = document.getElementById('fontFamily');
        const fontSize = document.getElementById('fontSize');
        const fontWeight = document.getElementById('fontWeight');
        const fontSizeValue = document.getElementById('fontSizeValue');

        if (fontFamily) fontFamily.value = this.settings.fontFamily || 'Inter';
        if (fontSize) fontSize.value = parseInt(this.settings.fontSize) || 14;
        if (fontWeight) fontWeight.value = this.settings.fontWeight || '400';
        if (fontSizeValue) fontSizeValue.textContent = fontSize ? fontSize.value : '14';

        // Тема
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
        console.log('🖼️ Загрузка аватара:', file.name);
        
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.showNotification('Пожалуйста, выберите изображение', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            this.showNotification('Размер файла не должен превышать 5MB', 'error');
            return;
        }

        this.showNotification('Загрузка аватара...', 'info');

        try {
            const formData = new FormData();
            formData.append('avatar', file);
            formData.append('user_id', this.currentUser.id);

            const result = await this.makeRequest('/api/user/upload-avatar', {
                method: 'POST',
                body: formData
            });

            if (result.success) {
                const avatarPreview = document.getElementById('avatarPreview');
                if (avatarPreview) {
                    avatarPreview.src = result.avatar_url + '?t=' + Date.now();
                }
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
        console.log('🗑️ Удаление аватара...');
        
        if (!confirm('Вы уверены, что хотите удалить аватар?')) return;

        try {
            const result = await this.makeRequest('/api/user/remove-avatar', {
                method: 'POST',
                body: JSON.stringify({ user_id: this.currentUser.id })
            });

            if (result.success) {
                const avatarPreview = document.getElementById('avatarPreview');
                if (avatarPreview) {
                    avatarPreview.src = 'images/default-avatar.svg';
                }
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
        console.log('🔔 Настройка уведомлений:', enabled);
        
        if (enabled) {
            if ('Notification' in window) {
                const permission = await Notification.requestPermission();
                
                if (permission === 'granted') {
                    this.showNotification('Уведомления включены', 'success');
                    
                    // Тестовое уведомление
                    new Notification('Спокойный рассвет', {
                        body: 'Уведомления успешно включены!',
                        icon: '/images/logo.png',
                        tag: 'test-notification'
                    });

                    // Настройка Push уведомлений
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
        console.log('📱 Настройка Push уведомлений...');
        
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            try {
                // Регистрируем Service Worker
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('✅ Service Worker зарегистрирован');

                // Подписываем на push-уведомления
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array('BEl62iUYgUivzhIh8B46w5X6kAR2HjZ7X2p2bVgK7zQ')
                });

                console.log('✅ Push подписка создана:', subscription);
                
                // Сохраняем подписку на сервере
                await this.savePushSubscription(subscription);
                
                this.showNotification('Push уведомления настроены', 'success');
                
            } catch (error) {
                console.error('❌ Ошибка настройки push-уведомлений:', error);
                this.showNotification('Ошибка настройки push-уведомлений', 'error');
            }
        } else {
            console.log('❌ Браузер не поддерживает push уведомления');
            this.showNotification('Ваш браузер не поддерживает push уведомления', 'warning');
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
            console.log('✅ Push подписка сохранена на сервере');
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
        const lastLogin = document.getElementById('lastLogin');

        if (accountId) accountId.textContent = this.currentUser.id || '-';
        if (accountRole) accountRole.textContent = this.getRoleName(this.currentUser.role);
        if (accountCreated) accountCreated.textContent = this.currentUser.created_at ? 
            new Date(this.currentUser.created_at).toLocaleDateString('ru-RU') : '-';
        if (accountTelegram) accountTelegram.textContent = this.currentUser.telegram_username || 'Не указан';
        if (lastLogin) lastLogin.textContent = new Date().toLocaleString('ru-RU');
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
        
        // Создаем модальное окно для подтверждения
        const modal = document.getElementById('deleteConfirmModal');
        if (modal) {
            modal.style.display = 'block';
            
            const confirmBtn = document.getElementById('confirmDeleteBtn');
            const cancelBtn = document.getElementById('cancelDeleteBtn');
            const passwordInput = document.getElementById('deletePassword');
            const closeBtn = document.getElementById('closeDeleteModal');
            
            const cleanup = () => {
                modal.style.display = 'none';
                passwordInput.value = '';
                confirmBtn.disabled = true;
                confirmBtn.removeEventListener('click', confirmHandler);
                cancelBtn.removeEventListener('click', cancelHandler);
                closeBtn.removeEventListener('click', cancelHandler);
            };
            
            const confirmHandler = () => {
                if (passwordInput.value) {
                    this.deleteAccount(passwordInput.value);
                    cleanup();
                }
            };
            
            const cancelHandler = () => {
                cleanup();
            };
            
            passwordInput.addEventListener('input', () => {
                confirmBtn.disabled = !passwordInput.value;
            });
            
            confirmBtn.addEventListener('click', confirmHandler);
            cancelBtn.addEventListener('click', cancelHandler);
            closeBtn.addEventListener('click', cancelHandler);
        } else {
            // Fallback на обычный confirm
            if (confirm('Вы уверены, что хотите удалить аккаунт? Это действие необратимо.')) {
                const password = prompt('Введите ваш пароль для подтверждения:');
                if (password) {
                    this.deleteAccount(password);
                }
            }
        }
    }

    async deleteAccount(password) {
        if (!this.isAuthenticated) return;

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

    async logoutAllDevices() {
        if (!this.isAuthenticated) return;
        
        if (confirm('Вы уверены, что хотите выйти со всех устройств?')) {
            try {
                const result = await this.makeRequest('/api/user/logout-all', {
                    method: 'POST',
                    body: JSON.stringify({ user_id: this.currentUser.id })
                });

                if (result.success) {
                    this.showNotification('Выход со всех устройств выполнен', 'success');
                    setTimeout(() => this.logout(), 1000);
                }
            } catch (error) {
                console.error('❌ Ошибка выхода со всех устройств:', error);
                this.showNotification('Ошибка выхода со всех устройств', 'error');
            }
        }
    }

    async exportData() {
        console.log('📤 Экспорт данных...');
        
        try {
            const userData = {
                profile: this.currentUser,
                settings: this.settings,
                export_date: new Date().toISOString()
            };
            
            const dataStr = JSON.stringify(userData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `user-data-${this.currentUser.username}-${Date.now()}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            this.showNotification('Данные успешно экспортированы', 'success');
        } catch (error) {
            console.error('❌ Ошибка экспорта данных:', error);
            this.showNotification('Ошибка экспорта данных', 'error');
        }
    }

    manageBlockedUsers() {
        console.log('🚫 Управление блокировками...');
        this.showNotification('Функция управления блокировками в разработке', 'info');
    }

    showNotification(message, type = 'info') {
        console.log(`📢 Уведомление [${type}]:`, message);
        
        // Удаляем предыдущие уведомления
        document.querySelectorAll('.notification').forEach(notification => {
            notification.remove();
        });

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 20px;
            background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
            color: white;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 300px;
            max-width: 400px;
        `;

        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            <span style="flex: 1; font-weight: 500;">${message}</span>
            <button style="background: none; border: none; color: white; cursor: pointer; opacity: 0.8;">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Обработчик закрытия
        const closeBtn = notification.querySelector('button');
        closeBtn.addEventListener('click', () => {
            notification.remove();
        });

        document.body.appendChild(notification);

        // Автоматическое закрытие через 5 секунд
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 300);
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
        const pages = {
            'owner': '/owner.html',
            'admin': '/admin.html', 
            'coowner': '/coowner.html',
            'listener': '/listener.html',
            'user': '/chat.html'
        };
        
        const targetPage = pages[role] || '/chat.html';
        window.location.href = targetPage;
    }

    logout() {
        this.isAuthenticated = false;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('selected-theme');
        window.location.href = '/index.html';
    }
}

// Добавляем CSS анимации для уведомлений
if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    window.settings = new SettingsManager();
});
