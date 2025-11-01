class AdminManager {
    constructor() {
        this.currentUser = null;
        this.API_BASE = 'http://spokoyniyrassvet.webtm.ru';
        this.selectedUser = null;
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.checkAdminRights();
        this.setupEventListeners();
        this.loadTheme();
        this.loadStats();
        this.loadUsers();
        this.loadChats();
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
            document.getElementById('userWelcome').textContent = `Админ: ${this.currentUser.username}`;
            
        } catch (error) {
            console.error('Auth check failed:', error);
            this.logout();
        }
    }

    checkAdminRights() {
        const allowedRoles = ['admin', 'coowner', 'owner'];
        if (!allowedRoles.includes(this.currentUser.role)) {
            this.showMessage('Недостаточно прав для доступа к админ панели', 'error');
            setTimeout(() => {
                window.location.href = '/chat.html';
            }, 2000);
        }
    }

    setupEventListeners() {
        // Тема
        document.getElementById('themeToggle').addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById('themeDropdown');
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        });

        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', (e) => {
                this.changeTheme(e.target.dataset.theme);
            });
        });

        document.addEventListener('click', () => {
            document.getElementById('themeDropdown').style.display = 'none';
        });
    }

    async loadStats() {
        try {
            const response = await fetch(`${this.API_BASE}/admin/stats`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderStats(data.stats);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    renderStats(stats) {
        document.getElementById('totalUsers').textContent = stats.totalUsers;
        document.getElementById('totalListeners').textContent = stats.totalListeners;
        document.getElementById('totalChats').textContent = stats.totalChats;
        document.getElementById('activeChats').textContent = stats.activeChats;
        document.getElementById('totalMessages').textContent = stats.totalMessages;
    }

    async loadUsers(page = 1) {
        try {
            const roleFilter = document.getElementById('roleFilter').value;
            const params = new URLSearchParams({
                page: page,
                limit: 20,
                ...(roleFilter && { role: roleFilter })
            });

            const response = await fetch(`${this.API_BASE}/admin/users?${params}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderUsers(data.users, data.pagination);
            }
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    renderUsers(users, pagination) {
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';

        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="flex items-center gap-2">
                        <img src="${user.avatar_url || 'images/default-avatar.png'}" 
                             alt="${user.username}" class="user-avatar">
                        <div>
                            <strong>${user.username}</strong>
                            <div>${user.email}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="role-badge role-${user.role}">${this.getRoleName(user.role)}</span>
                </td>
                <td>
                    <span class="${user.is_online ? 'status-online' : 'status-offline'}">
                        ${user.is_online ? '● онлайн' : '● оффлайн'}
                    </span>
                    ${user.is_banned ? '<br><span class="status-banned">🚫 забанен</span>' : ''}
                    ${user.is_muted ? '<br><span class="status-muted">🔇 в муте</span>' : ''}
                </td>
                <td>${new Date(user.created_at).toLocaleDateString('ru-RU')}</td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="adminManager.openUserActions('${user.id}')">
                        Действия
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        this.renderPagination(pagination, 'loadUsers');
    }

    async loadChats() {
        try {
            const response = await fetch(`${this.API_BASE}/admin/chats`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderChats(data.chats);
            }
        } catch (error) {
            console.error('Error loading chats:', error);
        }
    }

    renderChats(chats) {
        const tbody = document.getElementById('chatsTableBody');
        tbody.innerHTML = '';

        chats.forEach(chat => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${chat.id.slice(0, 8)}...</td>
                <td>${chat.user?.username || 'Неизвестно'}</td>
                <td>${chat.listener?.username || 'Нет'}</td>
                <td>
                    <span class="status-${chat.status}">${this.getChatStatusName(chat.status)}</span>
                </td>
                <td>${chat.message_count || 0}</td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="adminManager.viewChat('${chat.id}')">
                        Просмотр
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    openUserActions(userId) {
        this.selectedUser = userId;
        // Здесь можно загрузить дополнительную информацию о пользователе
        document.getElementById('userActionsModal').style.display = 'block';
    }

    async moderateUser(action, reason, durationMinutes = null) {
        if (!this.selectedUser) return;

        try {
            const response = await fetch(`${this.API_BASE}/admin/moderate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    userId: this.selectedUser,
                    action: action,
                    reason: reason,
                    durationMinutes: durationMinutes
                })
            });

            if (response.ok) {
                this.showMessage('Действие применено успешно', 'success');
                this.loadUsers();
                this.closeModals();
            } else {
                const error = await response.json();
                this.showMessage(error.error, 'error');
            }
        } catch (error) {
            console.error('Error moderating user:', error);
            this.showMessage('Ошибка применения действия', 'error');
        }
    }

    sendNotification() {
        document.getElementById('notificationModal').style.display = 'block';
    }

    async sendNotificationToUsers() {
        const title = document.getElementById('notificationTitle').value;
        const message = document.getElementById('notificationMessage').value;
        const type = document.getElementById('notificationType').value;

        if (!title || !message) {
            this.showMessage('Заполните все поля', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE}/admin/notification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    title,
                    message,
                    type
                })
            });

            if (response.ok) {
                this.showMessage('Уведомление отправлено', 'success');
                this.closeModals();
            } else {
                const error = await response.json();
                this.showMessage(error.error, 'error');
            }
        } catch (error) {
            console.error('Error sending notification:', error);
            this.showMessage('Ошибка отправки уведомления', 'error');
        }
    }

    getRoleName(role) {
        const roles = {
            'user': 'Пользователь',
            'listener': 'Слушатель',
            'admin': 'Администратор',
            'coowner': 'СоВладелец',
            'owner': 'Владелец'
        };
        return roles[role] || role;
    }

    getChatStatusName(status) {
        const statuses = {
            'active': 'Активен',
            'closed': 'Завершен',
            'archived': 'Архив'
        };
        return statuses[status] || status;
    }

    renderPagination(pagination, callback) {
        const container = document.getElementById('usersPagination');
        if (!container) return;

        const { page, limit, total } = pagination;
        const totalPages = Math.ceil(total / limit);

        let html = '';
        if (totalPages > 1) {
            html += '<div class="pagination-buttons">';
            
            if (page > 1) {
                html += `<button class="btn btn-outline btn-sm" onclick="${callback}(${page - 1})">← Назад</button>`;
            }
            
            html += `<span>Страница ${page} из ${totalPages}</span>`;
            
            if (page < totalPages) {
                html += `<button class="btn btn-outline btn-sm" onclick="${callback}(${page + 1})">Вперед →</button>`;
            }
            
            html += '</div>';
        }

        container.innerHTML = html;
    }

    changeTheme(theme) {
        const themeStyle = document.getElementById('theme-style');
        themeStyle.href = `css/${theme}-theme.css`;
        localStorage.setItem('theme', theme);
        document.getElementById('themeDropdown').style.display = 'none';
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.changeTheme(savedTheme);
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

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    }
}

// Глобальные функции
function openSettings() {
    window.location.href = '/settings.html';
}

function openChat() {
    window.location.href = '/chat.html';
}

function logout() {
    adminManager.logout();
}

function closeUserActionsModal() {
    document.getElementById('userActionsModal').style.display = 'none';
}

function closeNotificationModal() {
    document.getElementById('notificationModal').style.display = 'none';
}

// Инициализация
const adminManager = new AdminManager();
