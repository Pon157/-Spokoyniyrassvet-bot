class AdminPanel {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.checkAdminAccess();
        this.setupEventListeners();
        this.loadStats();
        this.loadUsers();
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

    setupEventListeners() {
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        document.getElementById('refreshUsers').addEventListener('click', () => {
            this.loadUsers();
        });

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

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">Пользователи не найдены</td></tr>';
            return;
        }

        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="user-cell">
                        <img src="${user.avatar || '/images/default-avatar.png'}" alt="Avatar" class="avatar-small">
                        <div>
                            <div class="username">${user.username}</div>
                            <div class="user-email">${user.email}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="role-badge role-${user.role}">${this.getRoleDisplayName(user.role)}</span>
                </td>
                <td>
                    <div class="status-cell">
                        <span class="status-indicator ${user.isOnline ? 'online' : 'offline'}"></span>
                        ${user.isOnline ? 'Онлайн' : 'Не в сети'}
                        ${user.isBlocked ? '<div class="blocked-badge">🚫 Заблокирован</div>' : ''}
                    </div>
                </td>
                <td>
                    <div class="action-buttons">
                        ${!user.isBlocked ? 
                            `<button class="btn btn-sm btn-danger" onclick="adminPanel.blockUser('${user._id}')">Блокировать</button>` :
                            `<button class="btn btn-sm btn-success" onclick="adminPanel.unblockUser('${user._id}')">Разблокировать</button>`
                        }
                        <button class="btn btn-sm btn-warning" onclick="adminPanel.warnUser('${user._id}')">Предупредить</button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

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

    async blockUser(userId) {
        const reason = prompt('Укажите причину блокировки:');
        if (!reason) return;

        try {
            const response = await fetch(`/api/admin/users/${userId}/block`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ reason })
            });

            if (response.ok) {
                this.showMessage('Пользователь заблокирован', 'success');
                this.loadUsers();
            } else {
                this.showMessage('Ошибка блокировки пользователя', 'error');
            }
        } catch (error) {
            this.showMessage('Ошибка соединения', 'error');
        }
    }

    async unblockUser(userId) {
        try {
            const response = await fetch(`/api/admin/users/${userId}/unblock`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                this.showMessage('Пользователь разблокирован', 'success');
                this.loadUsers();
            } else {
                this.showMessage('Ошибка разблокировки', 'error');
            }
        } catch (error) {
            this.showMessage('Ошибка соединения', 'error');
        }
    }

    async warnUser(userId) {
        const reason = prompt('Укажите причину предупреждения:');
        if (!reason) return;

        try {
            const response = await fetch(`/api/admin/users/${userId}/warn`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ reason })
            });

            if (response.ok) {
                this.showMessage('Предупреждение отправлено', 'success');
            } else {
                this.showMessage('Ошибка отправки предупреждения', 'error');
            }
        } catch (error) {
            this.showMessage('Ошибка соединения', 'error');
        }
    }

    async sendNotification() {
        const message = prompt('Введите текст уведомления для всех пользователей:');
        if (message) {
            try {
                const response = await fetch('/api/coowner/notifications', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ 
                        title: 'Системное уведомление',
                        message: message,
                        type: 'info'
                    })
                });

                if (response.ok) {
                    this.showMessage('Уведомление отправлено!', 'success');
                } else {
                    this.showMessage('Недостаточно прав для отправки уведомлений', 'error');
                }
            } catch (error) {
                this.showMessage('Ошибка отправки уведомления', 'error');
            }
        }
    }

    async viewLogs() {
        if (['coowner', 'owner'].includes(this.currentUser.role)) {
            window.location.href = '/coowner';
        } else {
            this.showMessage('Недостаточно прав для просмотра логов', 'error');
        }
    }

    changeTheme(theme) {
        document.getElementById('theme-style').href = `css/${theme}-theme.css`;
        localStorage.setItem('theme', theme);
        document.getElementById('themeDropdown').style.display = 'none';
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

// Инициализация админ-панели
const adminPanel = new AdminPanel();
window.adminPanel = adminPanel;
