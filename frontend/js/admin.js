class AdminPanel {
    constructor() {
        this.currentUser = null;
        this.selectedUser = null;
        this.currentAction = null;
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.checkAdminAccess();
        this.loadStats();
        this.loadUsers();
        this.loadChats();
        this.setupEventListeners();
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

    checkAdminAccess() {
        const allowedRoles = ['admin', 'coowner', 'owner'];
        if (!allowedRoles.includes(this.currentUser.role)) {
            window.location.href = '/chat';
            return;
        }
    }

    async loadStats() {
        try {
            const response = await fetch('/api/admin/stats', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const stats = await response.json();
                this.displayStats(stats);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    displayStats(stats) {
        document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
        document.getElementById('totalListeners').textContent = stats.totalListeners || 0;
        document.getElementById('totalChats').textContent = stats.totalChats || 0;
        document.getElementById('totalMessages').textContent = stats.totalMessages || 0;
    }

    async loadUsers() {
        try {
            const response = await fetch('/api/admin/users', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const users = await response.json();
                this.displayUsers(users);
            }
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    displayUsers(users) {
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';

        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="user-cell">
                        <img src="${user.avatar || '/images/default-avatar.png'}" alt="Avatar" class="avatar-small">
                        <div>
                            <div class="username">${user.username}</div>
                            ${user.bio ? `<div class="user-bio">${user.bio}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td>
                    <span class="role-badge role-${user.role}">${this.getRoleDisplayName(user.role)}</span>
                </td>
                <td>
                    <div class="status-cell">
                        <span class="status-indicator ${user.isOnline ? 'online' : 'offline'}"></span>
                        ${user.isOnline ? 'Онлайн' : this.formatLastSeen(user.lastSeen)}
                        ${user.isBlocked ? '<div class="blocked-badge">🚫 Заблокирован</div>' : ''}
                    </div>
                </td>
                <td>
                    <div class="activity-cell">
                        <div>Создан: ${this.formatDate(user.createdAt)}</div>
                        <div>Последняя активность: ${this.formatLastSeen(user.lastSeen)}</div>
                    </div>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-secondary" onclick="adminPanel.showUserActions('${user._id}')">
                            Действия
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async loadChats() {
        try {
            const response = await fetch('/api/admin/chats', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const chats = await response.json();
                this.displayChats(chats);
            }
        } catch (error) {
            console.error('Error loading chats:', error);
        }
    }

    displayChats(chats) {
        const container = document.getElementById('allChatsGrid');
        container.innerHTML = '';

        chats.forEach(chat => {
            const participants = chat.participants.map(p => p.username).join(', ');
            const chatCard = document.createElement('div');
            chatCard.className = 'chat-card-admin';
            chatCard.innerHTML = `
                <div class="chat-header">
                    <h4>Чат ${chat._id}</h4>
                    <span class="chat-status">${chat.status}</span>
                </div>
                <div class="chat-participants">
                    <strong>Участники:</strong> ${participants}
                </div>
                <div class="chat-meta">
                    <div>Создан: ${this.formatDate(chat.createdAt)}</div>
                    <div>Обновлен: ${this.formatDate(chat.updatedAt)}</div>
                </div>
                <div class="chat-actions">
                    <button class="btn btn-sm btn-primary" onclick="adminPanel.viewChatMessages('${chat._id}')">
                        Просмотр сообщений
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="adminPanel.joinChat('${chat._id}')">
                        Присоединиться
                    </button>
                </div>
            `;
            container.appendChild(chatCard);
        });
    }

    showUserActions(userId) {
        // Находим пользователя и показываем модальное окно действий
        this.selectedUser = userId;
        document.getElementById('userActionsModal').classList.remove('hidden');
    }

    async viewChatMessages(chatId) {
        try {
            const response = await fetch(`/api/admin/chats/${chatId}/messages`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const messages = await response.json();
                this.displayChatMessages(messages);
            }
        } catch (error) {
            console.error('Error loading chat messages:', error);
        }
    }

    displayChatMessages(messages) {
        const container = document.getElementById('modalMessagesList');
        container.innerHTML = '';

        messages.forEach(message => {
            const messageEl = document.createElement('div');
            messageEl.className = `message-item-admin ${message.senderId._id === this.currentUser.id ? 'own' : 'other'}`;
            messageEl.innerHTML = `
                <div class="message-sender">${message.senderId.username}</div>
                <div class="message-content">${message.content}</div>
                <div class="message-time">${this.formatTime(message.timestamp)}</div>
            `;
            container.appendChild(messageEl);
        });

        document.getElementById('chatMessagesModal').classList.remove('hidden');
    }

    setupEventListeners() {
        // Обновление данных
        document.getElementById('refreshUsers').addEventListener('click', () => this.loadUsers());
        document.getElementById('refreshChats').addEventListener('click', () => this.loadChats());

        // Закрытие модальных окон
        document.getElementById('closeModal').addEventListener('click', () => {
            document.getElementById('userActionsModal').classList.add('hidden');
        });

        document.getElementById('closeMessagesModal').addEventListener('click', () => {
            document.getElementById('chatMessagesModal').classList.add('hidden');
        });

        // Действия с пользователями
        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.closest('[data-action]').dataset.action;
                this.handleUserAction(action);
            });
        });

        // Поиск пользователей
        document.getElementById('userSearch').addEventListener('input', (e) => {
            this.filterUsers(e.target.value);
        });

        // Быстрые действия
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.closest('.action-btn').dataset.action;
                this.handleQuickAction(action);
            });
        });
    }

    handleUserAction(action) {
        this.currentAction = action;
        document.getElementById('userActionsModal').classList.add('hidden');
        
        const actionTitles = {
            'warn': 'Отправка предупреждения',
            'mute': 'Выдача мута пользователю', 
            'block': 'Блокировка пользователя'
        };

        document.getElementById('actionTitle').textContent = actionTitles[action] || 'Действие';
        
        // Показываем поле длительности для мута
        document.getElementById('muteDurationGroup').classList.toggle('hidden', action !== 'mute');
        
        document.getElementById('actionReasonModal').classList.remove('hidden');
    }

    async handleQuickAction(action) {
        switch (action) {
            case 'join-chat':
                this.joinHelpChat();
                break;
            case 'send-notification':
                this.sendNotification();
                break;
            case 'view-logs':
                this.viewLogs();
                break;
        }
    }

    async joinHelpChat() {
        // Реализация входа в чат помощи
        alert('Функция входа в чат помощи будет реализована');
    }

    async sendNotification() {
        const message = prompt('Введите текст уведомления:');
        if (message) {
            try {
                const response = await fetch('/api/admin/notifications', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ message })
                });

                if (response.ok) {
                    alert('Уведомление отправлено!');
                }
            } catch (error) {
                alert('Ошибка отправки уведомления');
            }
        }
    }

    async viewLogs() {
        if (['coowner', 'owner'].includes(this.currentUser.role)) {
            window.location.href = '/coowner?tab=logs';
        } else {
            alert('Недостаточно прав для просмотра логов');
        }
    }

    // Вспомогательные методы
    getRoleDisplayName(role) {
        const roles = {
            'user': '👤 Пользователь',
            'listener': '👂 Слушатель', 
            'admin': '🛠️ Администратор',
            'coowner': '👑 Совладелец',
            'owner': '👑 Владелец'
        };
        return roles[role] || role;
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('ru-RU');
    }

    formatTime(date) {
        return new Date(date).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatLastSeen(date) {
        const now = new Date();
        const lastSeen = new Date(date);
        const diffMs = now - lastSeen;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        
        if (diffMins < 1) return 'только что';
        if (diffMins < 60) return `${diffMins} мин назад`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)} ч назад`;
        return `${Math.floor(diffMins / 1440)} дн назад`;
    }
}

// Инициализация админ-панели
const adminPanel = new AdminPanel();

// Глобальные функции для обработки событий в HTML
window.adminPanel = adminPanel;
