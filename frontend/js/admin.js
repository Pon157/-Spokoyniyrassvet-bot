class AdminPanel {
    constructor() {
        this.currentUser = null;
        this.users = [];
        this.chats = [];
        this.logs = [];
        this.selectedUser = null;
        this.selectedChat = null;
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.loadUserData();
        this.setupEventListeners();
        this.loadStats();
        this.loadUsers();
        this.loadChats();
        this.loadLogs();
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
            
            // Проверка прав доступа
            if (!['admin', 'coowner', 'owner'].includes(this.currentUser.role)) {
                window.location.href = 'chat.html';
                return;
            }
            
        } catch (error) {
            console.error('Ошибка аутентификации:', error);
            this.logout();
        }
    }

    loadUserData() {
        document.getElementById('adminName').textContent = this.currentUser.username;
    }

    setupEventListeners() {
        // Навигация по табам
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Поиск пользователей
        document.getElementById('userSearch').addEventListener('input', (e) => {
            this.filterUsers(e.target.value);
        });

        // Обновление чатов
        document.getElementById('refreshChats').addEventListener('click', () => {
            this.loadChats();
        });

        // Закрытие модальных окон
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });

        // Клик вне модального окна
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Tab`).classList.add('active');
    }

    async loadStats() {
        try {
            const response = await fetch('/admin/stats', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.updateStats(data.stats);
            }
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
            this.showNotification('Ошибка загрузки статистики', 'error');
        }
    }

    updateStats(stats) {
        document.getElementById('totalUsers').textContent = stats.totalUsers;
        document.getElementById('totalListeners').textContent = stats.totalListeners;
        document.getElementById('totalChats').textContent = stats.totalChats;
        document.getElementById('totalMessages').textContent = stats.totalMessages;
        document.getElementById('activeChats').textContent = stats.activeChats;
    }

    async loadUsers() {
        try {
            const response = await fetch('/admin/users', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.users = data.users;
                this.renderUsers();
                this.updateUserSelects();
            }
        } catch (error) {
            console.error('Ошибка загрузки пользователей:', error);
            this.showNotification('Ошибка загрузки пользователей', 'error');
        }
    }

    renderUsers() {
        const container = document.getElementById('usersTable');
        container.innerHTML = '';

        this.users.forEach(user => {
            const row = this.createUserRow(user);
            container.appendChild(row);
        });
    }

    createUserRow(user) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id.substring(0, 8)}...</td>
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${user.avatar_url || 'images/default-avatar.png'}" 
                         style="width: 30px; height: 30px; border-radius: 50%;">
                    ${user.username}
                    ${user.is_online ? '<span class="badge success">Online</span>' : ''}
                </div>
            </td>
            <td>${user.email}</td>
            <td>
                <span class="badge ${this.getRoleBadgeClass(user.role)}">
                    ${this.getRoleDisplayName(user.role)}
                </span>
            </td>
            <td>
                ${user.is_blocked ? '<span class="badge danger">Заблокирован</span>' : 
                  user.is_muted ? '<span class="badge warning">В муте</span>' : 
                  '<span class="badge success">Активен</span>'}
            </td>
            <td>${new Date(user.created_at).toLocaleDateString('ru-RU')}</td>
            <td>
                <div class="user-actions">
                    <button class="btn btn-sm btn-info" onclick="admin.viewUser('${user.id}')"
                            title="Просмотр">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="admin.showActionsModal('${user.id}')"
                            title="Действия">
                        <i class="fas fa-cog"></i>
                    </button>
                </div>
            </td>
        `;
        return row;
    }

    async loadChats() {
        try {
            const response = await fetch('/admin/chats', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.chats = data.chats;
                this.renderChats();
            }
        } catch (error) {
            console.error('Ошибка загрузки чатов:', error);
            this.showNotification('Ошибка загрузки чатов', 'error');
        }
    }

    renderChats() {
        const container = document.getElementById('chatsTable');
        container.innerHTML = '';

        this.chats.forEach(chat => {
            const row = this.createChatRow(chat);
            container.appendChild(row);
        });
    }

    createChatRow(chat) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${chat.id.substring(0, 8)}...</td>
            <td>${chat.user_name}</td>
            <td>${chat.listener_name || 'Не назначен'}</td>
            <td>
                <span class="badge ${chat.status === 'active' ? 'success' : 'secondary'}">
                    ${this.getChatStatusDisplay(chat.status)}
                </span>
            </td>
            <td>${chat.message_count}</td>
            <td>${new Date(chat.created_at).toLocaleDateString('ru-RU')}</td>
            <td>
                <div class="user-actions">
                    <button class="btn btn-sm btn-info" onclick="admin.viewChat('${chat.id}')">
                        <i class="fas fa-eye"></i> Просмотр
                    </button>
                    ${chat.status === 'active' ? `
                    <button class="btn btn-sm btn-warning" onclick="admin.closeChat('${chat.id}')">
                        <i class="fas fa-times"></i> Закрыть
                    </button>
                    ` : ''}
                </div>
            </td>
        `;
        return row;
    }

    async loadLogs() {
        try {
            const response = await fetch('/admin/logs', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.logs = data.logs;
                this.renderLogs();
            }
        } catch (error) {
            console.error('Ошибка загрузки логов:', error);
            this.showNotification('Ошибка загрузки логов', 'error');
        }
    }

    renderLogs() {
        const container = document.getElementById('logsTable');
        container.innerHTML = '';

        this.logs.forEach(log => {
            const row = this.createLogRow(log);
            container.appendChild(row);
        });
    }

    createLogRow(log) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(log.created_at).toLocaleString('ru-RU')}</td>
            <td>${log.user_name || 'Система'}</td>
            <td>${this.getActionDisplayName(log.action)}</td>
            <td>${log.details ? JSON.stringify(log.details) : '-'}</td>
            <td>${log.ip_address || '-'}</td>
        `;
        return row;
    }

    // Модерационные действия
    async blockUser() {
        const userId = document.getElementById('blockUserSelect').value;
        const reason = document.getElementById('blockReason').value;

        if (!userId || !reason) {
            this.showNotification('Заполните все поля', 'error');
            return;
        }

        try {
            const response = await fetch('/admin/block-user', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: userId,
                    reason: reason
                })
            });

            if (response.ok) {
                this.showNotification('Пользователь заблокирован', 'success');
                this.loadUsers();
                this.clearModerationForms();
            } else {
                throw new Error('Ошибка блокировки');
            }
        } catch (error) {
            console.error('Ошибка блокировки:', error);
            this.showNotification('Ошибка блокировки пользователя', 'error');
        }
    }

    async muteUser() {
        const userId = document.getElementById('muteUserSelect').value;
        const duration = document.getElementById('muteDuration').value;
        const reason = document.getElementById('muteReason').value;

        if (!userId || !duration || !reason) {
            this.showNotification('Заполните все поля', 'error');
            return;
        }

        try {
            const response = await fetch('/admin/mute-user', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: userId,
                    duration: parseInt(duration),
                    reason: reason
                })
            });

            if (response.ok) {
                this.showNotification('Пользователь замучен', 'success');
                this.loadUsers();
                this.clearModerationForms();
            } else {
                throw new Error('Ошибка мута');
            }
        } catch (error) {
            console.error('Ошибка мута:', error);
            this.showNotification('Ошибка мута пользователя', 'error');
        }
    }

    async warnUser(userId) {
        const reason = prompt('Введите причину предупреждения:');
        if (!reason) return;

        try {
            const response = await fetch('/admin/warn-user', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: userId,
                    reason: reason
                })
            });

            if (response.ok) {
                this.showNotification('Предупреждение выдано', 'success');
                this.loadUsers();
            } else {
                throw new Error('Ошибка выдачи предупреждения');
            }
        } catch (error) {
            console.error('Ошибка предупреждения:', error);
            this.showNotification('Ошибка выдачи предупреждения', 'error');
        }
    }

    // Вспомогательные методы
    updateUserSelects() {
        const blockSelect = document.getElementById('blockUserSelect');
        const muteSelect = document.getElementById('muteUserSelect');
        
        blockSelect.innerHTML = '<option value="">-- Выберите --</option>';
        muteSelect.innerHTML = '<option value="">-- Выберите --</option>';

        this.users.forEach(user => {
            if (!user.is_blocked) {
                const option = `<option value="${user.id}">${user.username} (${user.email})</option>`;
                blockSelect.innerHTML += option;
                muteSelect.innerHTML += option;
            }
        });
    }

    clearModerationForms() {
        document.getElementById('blockUserSelect').value = '';
        document.getElementById('blockReason').value = '';
        document.getElementById('muteUserSelect').value = '';
        document.getElementById('muteDuration').value = '60';
        document.getElementById('muteReason').value = '';
    }

    filterUsers(searchTerm) {
        const filteredUsers = this.users.filter(user => 
            user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        const container = document.getElementById('usersTable');
        container.innerHTML = '';
        filteredUsers.forEach(user => {
            const row = this.createUserRow(user);
            container.appendChild(row);
        });
    }

    getRoleBadgeClass(role) {
        const classes = {
            'user': 'secondary',
            'listener': 'info',
            'admin': 'warning',
            'coowner': 'primary',
            'owner': 'danger'
        };
        return classes[role] || 'secondary';
    }

    getRoleDisplayName(role) {
        const names = {
            'user': 'Пользователь',
            'listener': 'Слушатель',
            'admin': 'Администратор',
            'coowner': 'Совладелец',
            'owner': 'Владелец'
        };
        return names[role] || role;
    }

    getChatStatusDisplay(status) {
        const statuses = {
            'active': 'Активен',
            'closed': 'Закрыт',
            'archived': 'Архив'
        };
        return statuses[status] || status;
    }

    getActionDisplayName(action) {
        const actions = {
            'LOGIN': 'Вход в систему',
            'LOGOUT': 'Выход из системы',
            'REGISTER': 'Регистрация',
            'CHAT_CREATE': 'Создание чата',
            'MESSAGE_SEND': 'Отправка сообщения',
            'MEDIA_UPLOAD': 'Загрузка медиа',
            'REVIEW_CREATE': 'Создание отзыва'
        };
        return actions[action] || action;
    }

    showActionsModal(userId) {
        this.selectedUser = this.users.find(u => u.id === userId);
        if (!this.selectedUser) return;

        const modal = document.getElementById('userActionsModal');
        const infoDiv = document.getElementById('modalUserInfo');
        
        infoDiv.innerHTML = `
            <h4>${this.selectedUser.username}</h4>
            <p>Email: ${this.selectedUser.email}</p>
            <p>Роль: ${this.getRoleDisplayName(this.selectedUser.role)}</p>
            <p>Статус: ${this.selectedUser.is_blocked ? 'Заблокирован' : 
                         this.selectedUser.is_muted ? 'В муте' : 'Активен'}</p>
        `;

        modal.style.display = 'block';
    }

    async viewChat(chatId) {
        try {
            const response = await fetch(`/admin/chat/${chatId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.selectedChat = data.chat;
                this.showChatModal();
            }
        } catch (error) {
            console.error('Ошибка загрузки чата:', error);
            this.showNotification('Ошибка загрузки чата', 'error');
        }
    }

    showChatModal() {
        const modal = document.getElementById('chatViewModal');
        const messagesDiv = document.getElementById('chatMessages');
        
        messagesDiv.innerHTML = '';
        
        this.selectedChat.messages.forEach(message => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${message.sender_id === this.selectedChat.user_id ? 'user-message' : 'listener-message'}`;
            messageDiv.innerHTML = `
                <strong>${message.sender.username}:</strong>
                <span>${message.content}</span>
                <small>${new Date(message.created_at).toLocaleString('ru-RU')}</small>
            `;
            messagesDiv.appendChild(messageDiv);
        });

        modal.style.display = 'block';
    }

    async joinChat() {
        if (this.selectedChat) {
            // Сохраняем текущую роль и временно становимся участником чата
            localStorage.setItem('admin_original_role', this.currentUser.role);
            
            // Переходим в интерфейс чата
            window.location.href = `chat.html?chat_id=${this.selectedChat.id}&admin_join=true`;
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

// Глобальный экземпляр админ-панели
const admin = new AdminPanel();
