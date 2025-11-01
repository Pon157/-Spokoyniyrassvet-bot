class SettingsManager {
    constructor() {
        this.currentUser = null;
        this.settings = {};
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.loadUserData();
        this.setupEventListeners();
        this.loadSettings();
        this.loadSessions();
        this.loadNotifications();
    }

    async checkAuth() {
        const token = localStorage.getItem('chat_token');
        const userData = localStorage.getItem('user_data');

        if (!token || !userData) {
            window.location.href = '/';
            return;
        }

        try {
            const response = await fetch('/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Невалидный токен');
            }

            const data = await response.json();
            this.currentUser = data.user;
            
        } catch (error) {
            console.error('Ошибка аутентификации:', error);
            this.logout();
        }
    }

    loadUserData() {
        document.getElementById('username').value = this.currentUser.username;
        document.getElementById('email').value = this.currentUser.email;
        
        if (this.currentUser.avatar_url) {
            document.getElementById('avatarPreview').src = this.currentUser.avatar_url;
        }
    }

    setupEventListeners() {
        // Навигация по табам
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Загрузка аватара
        document.getElementById('avatarInput').addEventListener('change', (e) => {
            this.handleAvatarUpload(e.target.files[0]);
        });

        // Сохранение профиля
        document.getElementById('profileForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProfile();
        });

        // Смена пароля
        document.getElementById('passwordForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.changePassword();
        });

        // Выбор темы
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', (e) => {
                this.selectTheme(e.currentTarget.dataset.theme);
            });
        });

        // Автоматическая тема
        document.getElementById('autoTheme').addEventListener('change', (e) => {
            this.toggleAutoTheme(e.target.checked);
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Tab`).classList.add('active');
    }

    async handleAvatarUpload(file) {
        if (!file) return;

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

            const response = await fetch('/user/upload-avatar', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                
                // Обновляем аватар предпросмотра
                document.getElementById('avatarPreview').src = data.avatar_url;
                
                // Обновляем данные пользователя
                this.currentUser.avatar_url = data.avatar_url;
                localStorage.setItem('user_data', JSON.stringify(this.currentUser));
                
                this.showNotification('Аватар успешно обновлен', 'success');
            } else {
                throw new Error('Ошибка загрузки аватара');
            }
        } catch (error) {
            console.error('Ошибка загрузки аватара:', error);
            this.showNotification('Ошибка загрузки аватара', 'error');
        }
    }

    async removeAvatar() {
        try {
            const response = await fetch('/user/remove-avatar', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                // Возвращаем аватар по умолчанию
                document.getElementById('avatarPreview').src = 'images/default-avatar.png';
                
                // Обновляем данные пользователя
                this.currentUser.avatar_url = null;
                localStorage.setItem('user_data', JSON.stringify(this.currentUser));
                
                this.showNotification('Аватар удален', 'success');
            } else {
                throw new Error('Ошибка удаления аватара');
            }
        } catch (error) {
            console.error('Ошибка удаления аватара:', error);
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

        try {
            const response = await fetch('/user/update-profile', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`,
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
                
                // Обновляем данные пользователя
                this.currentUser = data.user;
                localStorage.setItem('user_data', JSON.stringify(data.user));
                
                this.showNotification('Профиль успешно обновлен', 'success');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка обновления профиля');
            }
        } catch (error) {
            console.error('Ошибка обновления профиля:', error);
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
            const response = await fetch('/user/change-password', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });

            if (response.ok) {
                this.showNotification('Пароль успешно изменен', 'success');
                document.getElementById('passwordForm').reset();
                document.getElementById('passwordStrength').className = 'password-strength-bar';
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка смены пароля');
            }
        } catch (error) {
            console.error('Ошибка смены пароля:', error);
            this.showNotification(error.message, 'error');
        }
    }

    checkPasswordStrength() {
        const password = document.getElementById('newPassword').value;
        const strengthBar = document.getElementById('passwordStrength');
        
        let strength = 0;
        
        if (password.length >= 6) strength++;
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;
        
        strengthBar.className = 'password-strength-bar';
        
        if (password.length === 0) {
            strengthBar.style.width = '0%';
        } else if (strength <= 2) {
            strengthBar.classList.add('weak');
        } else if (strength <= 4) {
            strengthBar.classList.add('medium');
        } else {
            strengthBar.classList.add('strong');
        }
    }

    selectTheme(themeName) {
        // Обновляем активную тему
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
        });
        document.querySelector(`[data-theme="${themeName}"]`).classList.add('active');
        
        // Применяем тему
        const themeLink = document.getElementById('theme');
        themeLink.href = `css/${themeName}-theme.css`;
        
        // Сохраняем в настройках
        this.settings.theme = themeName;
        this.saveSettings();
        
        this.showNotification(`Тема "${themeName}" применена`, 'success');
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
            const response = await fetch('/user/settings', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.settings = data.settings || {};
                this.applySettings();
            }
        } catch (error) {
            console.error('Ошибка загрузки настроек:', error);
        }
    }

    applySettings() {
        // Применяем тему
        if (this.settings.theme) {
            const themeOption = document.querySelector(`[data-theme="${this.settings.theme}"]`);
            if (themeOption) {
                themeOption.classList.add('active');
                document.getElementById('theme').href = `css/${this.settings.theme}-theme.css`;
            }
        }

        // Применяем другие настройки
        if (this.settings.autoTheme !== undefined) {
            document.getElementById('autoTheme').checked = this.settings.autoTheme;
        }

        if (this.settings.showTimestamps !== undefined) {
            document.getElementById('showTimestamps').checked = this.settings.showTimestamps;
        }

        if (this.settings.soundNotifications !== undefined) {
            document.getElementById('soundNotifications').checked = this.settings.soundNotifications;
        }

        if (this.settings.desktopNotifications !== undefined) {
            document.getElementById('desktopNotifications').checked = this.settings.desktopNotifications;
        }
    }

    async saveSettings() {
        try {
            const response = await fetch('/user/settings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    settings: this.settings
                })
            });

            if (!response.ok) {
                throw new Error('Ошибка сохранения настроек');
            }
        } catch (error) {
            console.error('Ошибка сохранения настроек:', error);
        }
    }

    async saveNotificationSettings() {
        const settings = {
            emailNotifications: document.getElementById('emailNotifications').checked,
            pushNotifications: document.getElementById('pushNotifications').checked,
            newMessageNotifications: document.getElementById('newMessageNotifications').checked,
            chatRequestNotifications: document.getElementById('chatRequestNotifications').checked,
            reviewNotifications: document.getElementById('reviewNotifications').checked
        };

        try {
            const response = await fetch('/user/notification-settings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`,
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
            console.error('Ошибка сохранения настроек уведомлений:', error);
            this.showNotification('Ошибка сохранения настроек', 'error');
        }
    }

    async loadSessions() {
        try {
            const response = await fetch('/user/sessions', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderSessions(data.sessions);
            }
        } catch (error) {
            console.error('Ошибка загрузки сессий:', error);
        }
    }

    renderSessions(sessions) {
        const container = document.getElementById('sessionsList');
        container.innerHTML = '';

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
        try {
            const response = await fetch('/user/logout-session', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`,
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
            console.error('Ошибка завершения сессии:', error);
            this.showNotification('Ошибка завершения сессии', 'error');
        }
    }

    async logoutAllSessions() {
        if (!confirm('Вы уверены, что хотите выйти со всех устройств?')) {
            return;
        }

        try {
            const response = await fetch('/user/logout-all-sessions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`
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
            console.error('Ошибка выхода со всех устройств:', error);
            this.showNotification('Ошибка выхода со всех устройств', 'error');
        }
    }

    async loadNotifications() {
        try {
            const response = await fetch('/user/notifications', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderNotifications(data.notifications);
            }
        } catch (error) {
            console.error('Ошибка загрузки уведомлений:', error);
        }
    }

    renderNotifications(notifications) {
        const container = document.getElementById('technicalNotifications');
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
            const response = await fetch('/user/mark-notification-read', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ notification_id: notificationId })
            });

            if (response.ok) {
                this.loadNotifications();
            }
        } catch (error) {
            console.error('Ошибка отметки уведомления:', error);
        }
    }

    async deleteNotification(notificationId) {
        try {
            const response = await fetch('/user/delete-notification', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ notification_id: notificationId })
            });

            if (response.ok) {
                this.loadNotifications();
                this.showNotification('Уведомление удалено', 'success');
            }
        } catch (error) {
            console.error('Ошибка удаления уведомления:', error);
            this.showNotification('Ошибка удаления уведомления', 'error');
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            ${message}
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
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
        localStorage.removeItem('chat_token');
        localStorage.removeItem('user_data');
        window.location.href = '/';
    }
}

// Глобальный экземпляр менеджера настроек
const settings = new SettingsManager();
