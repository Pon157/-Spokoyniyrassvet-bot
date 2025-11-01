class SettingsManager {
    constructor() {
        this.currentUser = null;
        this.API_BASE = 'http://spokoyniyrassvet.webtm.ru';
        this.avatarFile = null;
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.setupEventListeners();
        this.loadUserProfile();
        this.loadSettings();
    }

    async checkAuth() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');

        if (!token || !user) {
            window.location.href = '/';
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE}/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Not authenticated');
            }

            const data = await response.json();
            this.currentUser = data.user;
            document.getElementById('userWelcome').textContent = `Настройки: ${this.currentUser.username}`;
            
        } catch (error) {
            console.error('Auth check failed:', error);
            this.logout();
        }
    }

    setupEventListeners() {
        // Навигация по табам
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Загрузка аватара
        document.getElementById('avatarUpload').addEventListener('change', (e) => {
            this.handleAvatarSelect(e.target.files[0]);
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

        // Темы
        document.querySelectorAll('.theme-option-card').forEach(card => {
            card.addEventListener('click', (e) => {
                this.changeTheme(card.dataset.theme);
            });
        });

        // Настройки интерфейса
        document.getElementById('compactMode').addEventListener('change', this.saveSettings.bind(this));
        document.getElementById('showAvatars').addEventListener('change', this.saveSettings.bind(this));
        document.getElementById('animationsEnabled').addEventListener('change', this.saveSettings.bind(this));

        // Уведомления
        document.getElementById('pushEnabled').addEventListener('change', this.saveSettings.bind(this));
        document.getElementById('notifyNewMessages').addEventListener('change', this.saveSettings.bind(this));
        document.getElementById('notifyMentions').addEventListener('change', this.saveSettings.bind(this));
        document.getElementById('notifySystem').addEventListener('change', this.saveSettings.bind(this));
        document.getElementById('notifyPromotions').addEventListener('change', this.saveSettings.bind(this));
        document.getElementById('soundsEnabled').addEventListener('change', this.saveSettings.bind(this));
        document.getElementById('notificationSound').addEventListener('change', this.saveSettings.bind(this));

        // Конфиденциальность
        document.querySelectorAll('input[name="profileVisibility"]').forEach(radio => {
            radio.addEventListener('change', this.saveSettings.bind(this));
        });
        document.querySelectorAll('input[name="messagePermissions"]').forEach(radio => {
            radio.addEventListener('change', this.saveSettings.bind(this));
        });
    }

    switchTab(tabName) {
        // Обновляем активные кнопки навигации
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Показываем активный таб
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.toggle('active', tab.id === `${tabName}-tab`);
        });
    }

    async loadUserProfile() {
        try {
            const response = await fetch(`${this.API_BASE}/users/profile`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.populateProfileForm(data.user);
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        }
    }

    populateProfileForm(user) {
        document.getElementById('username').value = user.username || '';
        document.getElementById('email').value = user.email || '';
        document.getElementById('bio').value = user.bio || '';
        
        if (user.avatar_url) {
            document.getElementById('avatarPreview').src = user.avatar_url;
        }
    }

    handleAvatarSelect(file) {
        if (!file) return;

        // Проверяем тип файла
        if (!file.type.startsWith('image/')) {
            this.showMessage('Пожалуйста, выберите изображение', 'error');
            return;
        }

        // Проверяем размер файла (максимум 5MB)
        if (file.size > 5 * 1024 * 1024) {
            this.showMessage('Размер файла не должен превышать 5MB', 'error');
            return;
        }

        this.avatarFile = file;

        // Показываем превью
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('avatarPreview').src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    async uploadAvatar() {
        if (!this.avatarFile) {
            this.showMessage('Выберите файл для загрузки', 'error');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('avatar', this.avatarFile);

            const response = await fetch(`${this.API_BASE}/users/avatar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                this.showMessage('Аватар успешно обновлен', 'success');
                
                // Обновляем аватар в интерфейсе
                document.getElementById('avatarPreview').src = data.avatar_url;
                
                // Обновляем аватар в localStorage
                const user = JSON.parse(localStorage.getItem('user'));
                user.avatar_url = data.avatar_url;
                localStorage.setItem('user', JSON.stringify(user));
                
            } else {
                const error = await response.json();
                this.showMessage(error.error, 'error');
            }
        } catch (error) {
            console.error('Error uploading avatar:', error);
            this.showMessage('Ошибка загрузки аватара', 'error');
        }
    }

    async updateProfile() {
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const bio = document.getElementById('bio').value.trim();

        if (!username || !email) {
            this.showMessage('Заполните обязательные поля', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE}/users/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    username,
                    email,
                    bio
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.showMessage('Профиль успешно обновлен', 'success');
                
                // Обновляем данные в localStorage
                const user = JSON.parse(localStorage.getItem('user'));
                user.username = data.user.username;
                user.email = data.user.email;
                localStorage.setItem('user', JSON.stringify(user));
                
            } else {
                const error = await response.json();
                this.showMessage(error.error, 'error');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            this.showMessage('Ошибка обновления профиля', 'error');
        }
    }

    async changePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showMessage('Заполните все поля', 'error');
            return;
        }

        if (newPassword.length < 6) {
            this.showMessage('Пароль должен быть не менее 6 символов', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showMessage('Пароли не совпадают', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE}/users/password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            if (response.ok) {
                this.showMessage('Пароль успешно изменен', 'success');
                document.getElementById('passwordForm').reset();
            } else {
                const error = await response.json();
                this.showMessage(error.error, 'error');
            }
        } catch (error) {
            console.error('Error changing password:', error);
            this.showMessage('Ошибка смены пароля', 'error');
        }
    }

    loadSettings() {
        const settings = JSON.parse(localStorage.getItem('userSettings') || '{}');
        
        // Внешний вид
        document.getElementById('compactMode').checked = settings.compactMode || false;
        document.getElementById('showAvatars').checked = settings.showAvatars !== false;
        document.getElementById('animationsEnabled').checked = settings.animationsEnabled !== false;

        // Уведомления
        document.getElementById('pushEnabled').checked = settings.pushEnabled !== false;
        document.getElementById('notifyNewMessages').checked = settings.notifyNewMessages !== false;
        document.getElementById('notifyMentions').checked = settings.notifyMentions !== false;
        document.getElementById('notifySystem').checked = settings.notifySystem !== false;
        document.getElementById('notifyPromotions').checked = settings.notifyPromotions || false;
        document.getElementById('soundsEnabled').checked = settings.soundsEnabled !== false;
        document.getElementById('notificationSound').value = settings.notificationSound || 'default';

        // Конфиденциальность
        const profileVisibility = settings.profileVisibility || 'public';
        document.querySelector(`input[name="profileVisibility"][value="${profileVisibility}"]`).checked = true;
        
        const messagePermissions = settings.messagePermissions || 'everyone';
        document.querySelector(`input[name="messagePermissions"][value="${messagePermissions}"]`).checked = true;

        // Загружаем тему
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.changeTheme(savedTheme, false);
    }

    saveSettings() {
        const settings = {
            // Внешний вид
            compactMode: document.getElementById('compactMode').checked,
            showAvatars: document.getElementById('showAvatars').checked,
            animationsEnabled: document.getElementById('animationsEnabled').checked,
            
            // Уведомления
            pushEnabled: document.getElementById('pushEnabled').checked,
            notifyNewMessages: document.getElementById('notifyNewMessages').checked,
            notifyMentions: document.getElementById('notifyMentions').checked,
            notifySystem: document.getElementById('notifySystem').checked,
            notifyPromotions: document.getElementById('notifyPromotions').checked,
            soundsEnabled: document.getElementById('soundsEnabled').checked,
            notificationSound: document.getElementById('notificationSound').value,
            
            // Конфиденциальность
            profileVisibility: document.querySelector('input[name="profileVisibility"]:checked').value,
            messagePermissions: document.querySelector('input[name="messagePermissions"]:checked').value
        };

        localStorage.setItem('userSettings', JSON.stringify(settings));
        this.showMessage('Настройки сохранены', 'success');
    }

    changeTheme(theme, save = true) {
        const themeStyle = document.getElementById('theme-style');
        themeStyle.href = `css/${theme}-theme.css`;
        
        if (save) {
            localStorage.setItem('theme', theme);
            this.showMessage(`Тема "${theme}" применена`, 'success');
        }

        // Обновляем активную тему в выборе
        document.querySelectorAll('.theme-option-card').forEach(card => {
            card.classList.toggle('active', card.dataset.theme === theme);
        });
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

// Глобальные функции
function goBack() {
    window.history.back();
}

function logout() {
    settingsManager.logout();
}

function uploadAvatar() {
    settingsManager.uploadAvatar();
}

function manageBlockedUsers() {
    alert('Функция управления блокировками в разработке');
}

function exportData() {
    alert('Функция экспорта данных в разработке');
}

function deleteAccount() {
    if (confirm('Вы уверены, что хотите удалить аккаунт? Это действие нельзя отменить.')) {
        alert('Функция удаления аккаунта в разработке');
    }
}

function logoutAllSessions() {
    if (confirm('Вы уверены, что хотите выйти со всех устройств?')) {
        alert('Функция выхода со всех устройств в разработке');
    }
}

// Инициализация
const settingsManager = new SettingsManager();
