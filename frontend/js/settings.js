class SettingsManager {
    constructor() {
        this.currentUser = null;
        this.settings = {};
        this.init();
    }

    async init() {
        console.log('🚀 Инициализация панели настроек...');
        
        try {
            await this.checkAuth();
            this.loadUserData();
            this.setupAllEventListeners();
            await this.loadSettings();
            await this.loadSessions();
            await this.loadNotifications();
            this.loadAccountInfo();
            
            console.log('✅ Панель настроек готова');
        } catch (error) {
            console.error('❌ Ошибка инициализации:', error);
            this.showNotification('Ошибка загрузки настроек', 'error');
        }
    }

    async checkAuth() {
        // ИСПРАВЛЕНО: правильное название токена
        const token = localStorage.getItem('auth_token');
        const userData = localStorage.getItem('user_data');

        console.log('🔐 Проверка аутентификации...');
        console.log('Токен:', token ? 'есть' : 'нет');
        console.log('Данные:', userData ? 'есть' : 'нет');

        if (!token || !userData) {
            console.error('❌ Нет данных аутентификации');
            this.redirectToLogin();
            return;
        }

        try {
            // Парсим данные пользователя из localStorage
            this.currentUser = JSON.parse(userData);
            
            // Проверяем токен через API
            const response = await fetch('/auth/verify', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('📡 Ответ сервера:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Пользователь верифицирован:', data.user);
                this.currentUser = data.user;
                // Обновляем данные в localStorage
                localStorage.setItem('user_data', JSON.stringify(data.user));
            } else {
                console.warn('⚠️ Токен невалиден, пробуем использовать данные из localStorage');
                // Продолжаем с данными из localStorage
            }
            
        } catch (error) {
            console.error('❌ Ошибка проверки аутентификации:', error);
            // Если API недоступен, используем данные из localStorage
            if (!this.currentUser) {
                this.redirectToLogin();
            }
        }
    }

    redirectToLogin() {
        console.log('🔒 Перенаправление на страницу входа...');
        this.showNotification('Требуется авторизация', 'error');
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    }

    loadUserData() {
        if (!this.currentUser) {
            console.error('❌ Нет данных пользователя');
            return;
        }

        console.log('👤 Загрузка данных пользователя:', this.currentUser);

        // Устанавливаем значения в форму
        const usernameInput = document.getElementById('username');
        const emailInput = document.getElementById('email');
        const bioInput = document.getElementById('bio');
        const avatarPreview = document.getElementById('avatarPreview');

        if (usernameInput) usernameInput.value = this.currentUser.username || '';
        if (emailInput) emailInput.value = this.currentUser.email || '';
        if (bioInput) bioInput.value = this.currentUser.bio || '';
        
        if (avatarPreview && this.currentUser.avatar_url) {
            avatarPreview.src = this.currentUser.avatar_url;
        }
    }

    setupAllEventListeners() {
        console.log('🔧 Настройка обработчиков событий...');

        // Навигация по табам
        document.querySelectorAll('.nav-item').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.currentTarget.dataset.tab);
            });
        });

        // Загрузка аватара
        const avatarInput = document.getElementById('avatarInput');
        if (avatarInput) {
            avatarInput.addEventListener('change', (e) => {
                this.handleAvatarUpload(e.target.files[0]);
            });
        }

        // Сохранение профиля
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveProfile();
            });
        }

        // Смена пароля
        const passwordForm = document.getElementById('passwordForm');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.changePassword();
            });
        }

        // Сохранение настроек уведомлений
        const notificationForm = document.getElementById('notificationForm');
        if (notificationForm) {
            notificationForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveNotificationSettings();
            });
        }

        // Выбор темы
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', (e) => {
                this.selectTheme(e.currentTarget.dataset.theme);
            });
        });

        // Автоматическая тема
        const autoTheme = document.getElementById('autoTheme');
        if (autoTheme) {
            autoTheme.addEventListener('change', (e) => {
                this.toggleAutoTheme(e.target.checked);
            });
        }

        // Показать/скрыть пароль
        document.querySelectorAll('.toggle-password').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                this.togglePasswordVisibility(e.target);
            });
        });

        // Проверка силы пароля
        const newPasswordInput = document.getElementById('newPassword');
        if (newPasswordInput) {
            newPasswordInput.addEventListener('input', () => {
                this.checkPasswordStrength();
            });
        }

        // Дополнительные обработчики
        this.setupAdditionalListeners();
    }

    setupAdditionalListeners() {
        // Настройки чата
        ['showTimestamps', 'showAvatars', 'messageBubbles', 'enterToSend'].forEach(setting => {
            const element = document.getElementById(setting);
            if (element) {
                element.addEventListener('change', () => {
                    this.saveGeneralSettings();
                });
            }
        });

        // Настройки внешнего вида
        ['compactMode', 'highContrast'].forEach(setting => {
            const element = document.getElementById(setting);
            if (element) {
                element.addEventListener('change', () => {
                    this.saveGeneralSettings();
                });
            }
        });

        // Настройки приватности
        ['showOnlineStatus', 'showLastSeen', 'allowFriendRequests', 'profileVisibility'].forEach(setting => {
            const element = document.getElementById(setting);
            if (element) {
                element.addEventListener('change', () => {
                    this.savePrivacySettings();
                });
            }
        });

        // Двухфакторная аутентификация
        const twoFactorAuth = document.getElementById('twoFactorAuth');
        if (twoFactorAuth) {
            twoFactorAuth.addEventListener('change', (e) => {
                this.toggleTwoFactorAuth(e.target.checked);
            });
        }
    }

    switchTab(tabName) {
        console.log('📁 Переключение на вкладку:', tabName);

        // Обновляем активную навигацию
        document.querySelectorAll('.nav-item').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
        const tabContent = document.getElementById(`${tabName}Tab`);

        if (tabButton && tabContent) {
            tabButton.classList.add('active');
            tabContent.classList.add('active');
        }
    }

    async handleAvatarUpload(file) {
        if (!file) return;

        console.log('🖼️ Загрузка аватара:', file.name);

        // Проверка типа файла
        if (!file.type.startsWith('image/')) {
            this.showNotification('Пожалуйста, выберите изображение', 'error');
            return;
        }

        // Проверка размера файла (максимум 5MB)
        if (file.size > 5 * 1024 * 1024) {
            this.showNotification('Размер файла не должен превышать 5MB', 'error');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('avatar', file);

            // ИСПРАВЛЕНО: правильное название токена
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/user/upload-avatar', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Аватар загружен:', data.avatar_url);
                
                // Обновляем аватар предпросмотра
                const avatarPreview = document.getElementById('avatarPreview');
                if (avatarPreview) {
                    avatarPreview.src = data.avatar_url;
                }
                
                // Обновляем данные пользователя
                this.currentUser.avatar_url = data.avatar_url;
                localStorage.setItem('user_data', JSON.stringify(this.currentUser));
                
                this.showNotification('Аватар успешно обновлен', 'success');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка загрузки аватара');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки аватара:', error);
            this.showNotification(error.message, 'error');
        }
    }

    async removeAvatar() {
        if (!confirm('Вы уверены, что хотите удалить аватар?')) {
            return;
        }

        try {
            // ИСПРАВЛЕНО: правильное название токена
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/user/remove-avatar', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                console.log('✅ Аватар удален');
                
                // Возвращаем аватар по умолчанию
                const avatarPreview = document.getElementById('avatarPreview');
                if (avatarPreview) {
                    avatarPreview.src = 'images/default-avatar.svg';
                }
                
                // Обновляем данные пользователя
                this.currentUser.avatar_url = null;
                localStorage.setItem('user_data', JSON.stringify(this.currentUser));
                
                this.showNotification('Аватар удален', 'success');
            } else {
                throw new Error('Ошибка удаления аватара');
            }
        } catch (error) {
            console.error('❌ Ошибка удаления аватара:', error);
            this.showNotification('Ошибка удаления аватара', 'error');
        }
    }

    async saveProfile() {
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const bio = document.getElementById('bio').value;

        if (!username || !email) {
            this.showNotification('Имя пользователя и email обязательны', 'error');
            return;
        }

        if (username.length < 3 || username.length > 20) {
            this.showNotification('Имя пользователя должно быть от 3 до 20 символов', 'error');
            return;
        }

        try {
            // ИСПРАВЛЕНО: правильное название токена
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/user/update-profile', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    email,
                    bio
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Профиль обновлен:', data.user);
                
                // Обновляем данные пользователя
                this.currentUser = data.user;
                localStorage.setItem('user_data', JSON.stringify(data.user));
                
                this.showNotification('Профиль успешно обновлен', 'success');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка обновления профиля');
            }
        } catch (error) {
            console.error('❌ Ошибка обновления профиля:', error);
            this.showNotification(error.message, 'error');
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
            // ИСПРАВЛЕНО: правильное название токена
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/user/change-password', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });

            if (response.ok) {
                console.log('✅ Пароль изменен');
                this.showNotification('Пароль успешно изменен', 'success');
                document.getElementById('passwordForm').reset();
                this.resetPasswordStrength();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка смены пароля');
            }
        } catch (error) {
            console.error('❌ Ошибка смены пароля:', error);
            this.showNotification(error.message, 'error');
        }
    }

    togglePasswordVisibility(button) {
        const passwordInput = button.closest('.password-input').querySelector('input');
        const icon = button.querySelector('i');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            passwordInput.type = 'password';
            icon.className = 'fas fa-eye';
        }
    }

    checkPasswordStrength() {
        const password = document.getElementById('newPassword').value;
        const strengthFill = document.getElementById('passwordStrength');
        const strengthText = document.getElementById('passwordStrengthText');
        
        if (!password) {
            this.resetPasswordStrength();
            return;
        }
        
        let strength = 0;
        let feedback = '';
        
        // Длина пароля
        if (password.length >= 6) strength++;
        if (password.length >= 8) strength++;
        
        // Сложность
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;
        
        // Определяем уровень сложности
        if (strength <= 2) {
            strengthFill.className = 'strength-fill weak';
            feedback = 'Слабый';
        } else if (strength <= 4) {
            strengthFill.className = 'strength-fill medium';
            feedback = 'Средний';
        } else {
            strengthFill.className = 'strength-fill strong';
            feedback = 'Сильный';
        }
        
        strengthText.textContent = feedback;
    }

    resetPasswordStrength() {
        const strengthFill = document.getElementById('passwordStrength');
        const strengthText = document.getElementById('passwordStrengthText');
        
        strengthFill.className = 'strength-fill';
        strengthText.textContent = 'Введите пароль';
    }

    selectTheme(themeName) {
        console.log('🎨 Выбор темы:', themeName);

        // Обновляем активную тему
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
        });
        
        const selectedTheme = document.querySelector(`[data-theme="${themeName}"]`);
        if (selectedTheme) {
            selectedTheme.classList.add('active');
        }
        
        // Применяем тему
        const themeLink = document.getElementById('theme');
        if (themeLink) {
            themeLink.href = `css/${themeName}-theme.css`;
        }
        
        // Сохраняем в настройках
        this.settings.theme = themeName;
        this.saveSettings();
        
        this.showNotification(`Тема "${this.getThemeName(themeName)}" применена`, 'success');
    }

    getThemeName(theme) {
        const themes = {
            'light': 'Светлая',
            'dark': 'Темная',
            'blue': 'Синяя',
            'purple': 'Фиолетовая'
        };
        return themes[theme] || theme;
    }

    toggleAutoTheme(enabled) {
        this.settings.autoTheme = enabled;
        this.saveSettings();
        
        if (enabled) {
            // Определяем системную тему
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const systemTheme = isDark ? 'dark' : 'light';
            this.selectTheme(systemTheme);
            
            // Слушаем изменения системной темы
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                const newTheme = e.matches ? 'dark' : 'light';
                this.selectTheme(newTheme);
            });
        }
    }

    async loadSettings() {
        try {
            // ИСПРАВЛЕНО: правильное название токена
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/user/settings', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.settings = data.settings || {};
                this.applySettings();
                console.log('✅ Настройки загружены:', this.settings);
            } else {
                console.warn('⚠️ Не удалось загрузить настройки, используем по умолчанию');
                this.loadDefaultSettings();
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки настроек:', error);
            this.loadDefaultSettings();
        }
    }

    loadDefaultSettings() {
        this.settings = {
            theme: 'light',
            autoTheme: false,
            showTimestamps: true,
            soundNotifications: true,
            desktopNotifications: true,
            showAvatars: true,
            messageBubbles: true,
            enterToSend: true,
            compactMode: false,
            highContrast: false
        };
        this.applySettings();
    }

    applySettings() {
        console.log('⚙️ Применение настроек:', this.settings);

        // Применяем тему
        if (this.settings.theme) {
            const themeOption = document.querySelector(`[data-theme="${this.settings.theme}"]`);
            if (themeOption) {
                themeOption.classList.add('active');
                const themeLink = document.getElementById('theme');
                if (themeLink) {
                    themeLink.href = `css/${this.settings.theme}-theme.css`;
                }
            }
        }

        // Применяем другие настройки
        this.setCheckboxValue('autoTheme', this.settings.autoTheme);
        this.setCheckboxValue('showTimestamps', this.settings.showTimestamps);
        this.setCheckboxValue('soundNotifications', this.settings.soundNotifications);
        this.setCheckboxValue('desktopNotifications', this.settings.desktopNotifications);
        this.setCheckboxValue('showAvatars', this.settings.showAvatars);
        this.setCheckboxValue('messageBubbles', this.settings.messageBubbles);
        this.setCheckboxValue('enterToSend', this.settings.enterToSend);
        this.setCheckboxValue('compactMode', this.settings.compactMode);
        this.setCheckboxValue('highContrast', this.settings.highContrast);
    }

    setCheckboxValue(id, value) {
        const element = document.getElementById(id);
        if (element && value !== undefined) {
            element.checked = Boolean(value);
        }
    }

    async saveSettings() {
        try {
            // ИСПРАВЛЕНО: правильное название токена
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/user/settings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    settings: this.settings
                })
            });

            if (response.ok) {
                console.log('✅ Настройки сохранены');
            } else {
                console.error('❌ Ошибка сохранения настроек');
            }
        } catch (error) {
            console.error('❌ Ошибка сохранения настроек:', error);
        }
    }

    async saveGeneralSettings() {
        const settings = {
            showTimestamps: document.getElementById('showTimestamps').checked,
            showAvatars: document.getElementById('showAvatars').checked,
            messageBubbles: document.getElementById('messageBubbles').checked,
            enterToSend: document.getElementById('enterToSend').checked,
            compactMode: document.getElementById('compactMode').checked,
            highContrast: document.getElementById('highContrast').checked
        };

        // Обновляем локальные настройки
        this.settings = { ...this.settings, ...settings };
        await this.saveSettings();
        
        this.showNotification('Настройки сохранены', 'success');
    }

    async savePrivacySettings() {
        const settings = {
            showOnlineStatus: document.getElementById('showOnlineStatus').checked,
            showLastSeen: document.getElementById('showLastSeen').checked,
            allowFriendRequests: document.getElementById('allowFriendRequests').checked,
            profileVisibility: document.getElementById('profileVisibility').checked
        };

        // Обновляем локальные настройки
        this.settings = { ...this.settings, ...settings };
        await this.saveSettings();
        
        this.showNotification('Настройки приватности сохранены', 'success');
    }

    async saveNotificationSettings() {
        const settings = {
            emailNotifications: document.getElementById('emailNotifications').checked,
            pushNotifications: document.getElementById('pushNotifications').checked,
            soundNotifications: document.getElementById('soundNotifications').checked,
            desktopNotifications: document.getElementById('desktopNotifications').checked,
            newMessageNotifications: document.getElementById('newMessageNotifications').checked,
            mentionNotifications: document.getElementById('mentionNotifications').checked,
            chatRequestNotifications: document.getElementById('chatRequestNotifications').checked,
            chatActivityNotifications: document.getElementById('chatActivityNotifications').checked,
            systemNotifications: document.getElementById('systemNotifications').checked,
            updateNotifications: document.getElementById('updateNotifications').checked
        };

        try {
            // ИСПРАВЛЕНО: правильное название токена
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/user/notification-settings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });

            if (response.ok) {
                this.showNotification('Настройки уведомлений сохранены', 'success');
            } else {
                throw new Error('Ошибка сохранения настроек уведомлений');
            }
        } catch (error) {
            console.error('❌ Ошибка сохранения настроек уведомлений:', error);
            this.showNotification('Ошибка сохранения настроек', 'error');
        }
    }

    async toggleTwoFactorAuth(enabled) {
        try {
            // ИСПРАВЛЕНО: правильное название токена
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/user/toggle-2fa', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ enabled })
            });

            if (response.ok) {
                this.showNotification(
                    `Двухфакторная аутентификация ${enabled ? 'включена' : 'отключена'}`,
                    'success'
                );
            } else {
                throw new Error('Ошибка изменения настроек 2FA');
            }
        } catch (error) {
            console.error('❌ Ошибка изменения 2FA:', error);
            this.showNotification('Ошибка изменения настроек', 'error');
            // Возвращаем чекбокс в исходное состояние
            document.getElementById('twoFactorAuth').checked = !enabled;
        }
    }

    async loadSessions() {
        try {
            // ИСПРАВЛЕНО: правильное название токена
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/user/sessions', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderSessions(data.sessions);
                console.log('✅ Сессии загружены');
            } else {
                console.warn('⚠️ Не удалось загрузить сессии');
                this.renderSessions([]);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки сессий:', error);
            this.renderSessions([]);
        }
    }

    renderSessions(sessions) {
        const container = document.getElementById('sessionsList');
        if (!container) return;

        container.innerHTML = '';

        if (sessions.length === 0) {
            container.innerHTML = '<p>Нет активных сессий</p>';
            return;
        }

        sessions.forEach(session => {
            const sessionElement = document.createElement('div');
            sessionElement.className = 'session-item';
            sessionElement.innerHTML = `
                <div class="session-info">
                    <div class="session-device">
                        <i class="fas fa-${session.device_type === 'mobile' ? 'mobile-alt' : 'desktop'}"></i>
                        ${session.device_name}
                    </div>
                    <div class="session-details">
                        <span class="session-location">${session.location}</span>
                        <span class="session-time">${new Date(session.last_activity).toLocaleString('ru-RU')}</span>
                    </div>
                </div>
                ${session.is_current ? 
                    '<span class="badge success">Текущая</span>' : 
                    '<button class="btn btn-sm btn-danger" onclick="settings.logoutSession(\'' + session.id + '\')">Завершить</button>'
                }
            `;
            container.appendChild(sessionElement);
        });
    }

    async logoutSession(sessionId) {
        if (!confirm('Завершить эту сессию?')) {
            return;
        }

        try {
            // ИСПРАВЛЕНО: правильное название токена
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/user/logout-session', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ session_id: sessionId })
            });

            if (response.ok) {
                this.showNotification('Сессия завершена', 'success');
                this.loadSessions();
            } else {
                throw new Error('Ошибка завершения сессии');
            }
        } catch (error) {
            console.error('❌ Ошибка завершения сессии:', error);
            this.showNotification('Ошибка завершения сессии', 'error');
        }
    }

    async logoutAllSessions() {
        if (!confirm('Вы уверены, что хотите выйти со всех устройств?')) {
            return;
        }

        try {
            // ИСПРАВЛЕНО: правильное название токена
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/user/logout-all-sessions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                this.showNotification('Все сессии завершены', 'success');
                setTimeout(() => {
                    this.logout();
                }, 2000);
            } else {
                throw new Error('Ошибка выхода со всех устройств');
            }
        } catch (error) {
            console.error('❌ Ошибка выхода со всех устройств:', error);
            this.showNotification('Ошибка выхода со всех устройств', 'error');
        }
    }

    async loadNotifications() {
        try {
            // ИСПРАВЛЕНО: правильное название токена
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/user/notifications', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderNotifications(data.notifications);
                console.log('✅ Уведомления загружены');
            } else {
                console.warn('⚠️ Не удалось загрузить уведомления');
                this.renderNotifications([]);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки уведомлений:', error);
            this.renderNotifications([]);
        }
    }

    renderNotifications(notifications) {
        const container = document.getElementById('technicalNotifications');
        if (!container) return;

        container.innerHTML = '';

        if (notifications.length === 0) {
            container.innerHTML = '<p>Нет технических уведомлений</p>';
            return;
        }

        notifications.forEach(notification => {
            const notificationElement = document.createElement('div');
            notificationElement.className = `notification-item ${notification.is_read ? 'read' : 'unread'}`;
            notificationElement.innerHTML = `
                <div class="notification-header">
                    <strong>${notification.title}</strong>
                    <span class="notification-time">${new Date(notification.created_at).toLocaleString('ru-RU')}</span>
                </div>
                <div class="notification-message">${notification.message}</div>
                <div class="notification-actions">
                    ${!notification.is_read ? 
                        `<button class="btn btn-sm btn-primary" onclick="settings.markNotificationAsRead('${notification.id}')">
                            Отметить как прочитанное
                        </button>` : ''
                    }
                    <button class="btn btn-sm btn-danger" onclick="settings.deleteNotification('${notification.id}')">
                        Удалить
                    </button>
                </div>
            `;
            container.appendChild(notificationElement);
        });
    }

    async markNotificationAsRead(notificationId) {
        try {
            // ИСПРАВЛЕНО: правильное название токена
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/user/mark-notification-read', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ notification_id: notificationId })
            });

            if (response.ok) {
                this.loadNotifications();
            }
        } catch (error) {
            console.error('❌ Ошибка отметки уведомления:', error);
        }
    }

    async deleteNotification(notificationId) {
        try {
            // ИСПРАВЛЕНО: правильное название токена
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/user/delete-notification', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ notification_id: notificationId })
            });

            if (response.ok) {
                this.loadNotifications();
                this.showNotification('Уведомление удалено', 'success');
            }
        } catch (error) {
            console.error('❌ Ошибка удаления уведомления:', error);
            this.showNotification('Ошибка удаления уведомления', 'error');
        }
    }

    async loadAccountInfo() {
        if (!this.currentUser) return;

        document.getElementById('accountId').textContent = this.currentUser.id || '-';
        document.getElementById('accountRole').textContent = this.currentUser.role || 'Пользователь';
        document.getElementById('accountCreated').textContent = this.currentUser.created_at ? 
            new Date(this.currentUser.created_at).toLocaleDateString('ru-RU') : '-';
        document.getElementById('accountStatus').textContent = this.currentUser.is_active ? 'Активен' : 'Неактивен';
    }

    async exportData() {
        try {
            // ИСПРАВЛЕНО: правильное название токена
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/user/export-data', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                
                // Создаем и скачиваем файл
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `user-data-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                this.showNotification('Данные успешно экспортированы', 'success');
            } else {
                throw new Error('Ошибка экспорта данных');
            }
        } catch (error) {
            console.error('❌ Ошибка экспорта данных:', error);
            this.showNotification('Ошибка экспорта данных', 'error');
        }
    }

    async clearHistory() {
        if (!confirm('Вы уверены, что хотите очистить историю? Это действие нельзя отменить.')) {
            return;
        }

        try {
            // ИСПРАВЛЕНО: правильное название токена
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/user/clear-history', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                this.showNotification('История очищена', 'success');
            } else {
                throw new Error('Ошибка очистки истории');
            }
        } catch (error) {
            console.error('❌ Ошибка очистки истории:', error);
            this.showNotification('Ошибка очистки истории', 'error');
        }
    }

    async deactivateAccount() {
        if (!confirm('Вы уверены, что хотите деактивировать аккаунт? Вы сможете восстановить его позже.')) {
            return;
        }

        try {
            // ИСПРАВЛЕНО: правильное название токена
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/user/deactivate-account', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                this.showNotification('Аккаунт деактивирован', 'success');
                setTimeout(() => {
                    this.logout();
                }, 2000);
            } else {
                throw new Error('Ошибка деактивации аккаунта');
            }
        } catch (error) {
            console.error('❌ Ошибка деактивации аккаунта:', error);
            this.showNotification('Ошибка деактивации аккаунта', 'error');
        }
    }

    showLogoutConfirm() {
        document.getElementById('logoutConfirmModal').classList.add('active');
    }

    closeLogoutConfirm() {
        document.getElementById('logoutConfirmModal').classList.remove('active');
    }

    confirmLogout() {
        this.logout();
    }

    showDeleteAccountModal() {
        document.getElementById('deleteAccountModal').classList.add('active');
    }

    closeDeleteAccount() {
        document.getElementById('deleteAccountModal').classList.remove('active');
        document.getElementById('deletePassword').value = '';
    }

    async confirmDeleteAccount() {
        const password = document.getElementById('deletePassword').value;
        
        if (!password) {
            this.showNotification('Введите пароль для подтверждения', 'error');
            return;
        }

        try {
            // ИСПРАВЛЕНО: правильное название токена
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/user/delete-account', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });

            if (response.ok) {
                this.showNotification('Аккаунт успешно удален', 'success');
                setTimeout(() => {
                    this.logout();
                }, 2000);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка удаления аккаунта');
            }
        } catch (error) {
            console.error('❌ Ошибка удаления аккаунта:', error);
            this.showNotification(error.message, 'error');
        }
    }

    async saveAll() {
        // Сохраняем все открытые формы
        const activeTab = document.querySelector('.tab-content.active').id;
        
        switch (activeTab) {
            case 'profileTab':
                await this.saveProfile();
                break;
            case 'securityTab':
                // Пароль сохраняется отдельно через свою форму
                break;
            case 'appearanceTab':
                await this.saveGeneralSettings();
                break;
            case 'notificationsTab':
                await this.saveNotificationSettings();
                break;
            case 'privacyTab':
                await this.savePrivacySettings();
                break;
        }
        
        this.showNotification('Все изменения сохранены', 'success');
    }

    goBack() {
        window.history.back();
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        if (!container) {
            // Создаем контейнер если его нет
            const newContainer = document.createElement('div');
            newContainer.id = 'notificationContainer';
            newContainer.className = 'notification-container';
            document.body.appendChild(newContainer);
            container = newContainer;
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(notification);

        // Автоматическое удаление через 5 секунд
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

    logout() {
        console.log('🚪 Выход из системы...');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        window.location.href = '/';
    }
}

// Добавляем стили для уведомлений
const notificationStyles = `
.notification-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 400px;
}

.notification {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-lg);
    animation: slideInRight 0.3s ease;
    max-width: 400px;
}

.notification.success {
    border-left: 4px solid var(--success-color);
    background: var(--success-color-20);
}

.notification.error {
    border-left: 4px solid var(--danger-color);
    background: var(--danger-color-20);
}

.notification.warning {
    border-left: 4px solid var(--warning-color);
    background: var(--warning-color-20);
}

.notification.info {
    border-left: 4px solid var(--primary-color);
}

.notification-close {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0.25rem;
    margin-left: auto;
}

.notification-close:hover {
    color: var(--text-primary);
}

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
`;

// Добавляем стили в документ
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);

// Глобальный экземпляр менеджера настроек
const settings = new SettingsManager();
