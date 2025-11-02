class ListenerInterface {
    constructor() {
        this.currentTab = 'user-chat';
        this.isOnline = true;
        this.notifications = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadInitialData();
        this.setupSocketListeners();
    }

    bindEvents() {
        // Навигация по табам
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.switchTab(e.currentTarget.dataset.tab);
            });
        });

        // Онлайн/оффлайн статус
        document.getElementById('onlineStatus').addEventListener('click', () => {
            this.toggleOnlineStatus();
        });

        // Уведомления
        document.getElementById('notificationsBtn').addEventListener('click', () => {
            this.toggleNotifications();
        });

        document.getElementById('closeNotifications').addEventListener('click', () => {
            this.hideNotifications();
        });

        // Настройки
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.openSettings();
        });

        // Выход
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Обновление чатов
        document.getElementById('refreshChats').addEventListener('click', () => {
            this.loadUserChats();
        });

        // Закрытие модальных окон
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.add('hidden');
            });
        });
    }

    switchTab(tabName) {
        // Обновляем активную кнопку навигации
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Показываем соответствующий контент
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');

        this.currentTab = tabName;

        // Загружаем данные для активного таба
        switch(tabName) {
            case 'user-chat':
                this.loadUserChats();
                break;
            case 'listener-chat':
                this.loadListenerChat();
                break;
            case 'reviews':
                this.loadReviews();
                break;
            case 'statistics':
                this.loadStatistics();
                break;
        }
    }

    async toggleOnlineStatus() {
        this.isOnline = !this.isOnline;
        const statusElement = document.getElementById('onlineStatus');
        
        if (this.isOnline) {
            statusElement.classList.remove('offline');
            statusElement.querySelector('.status-text').textContent = 'Онлайн';
        } else {
            statusElement.classList.add('offline');
            statusElement.querySelector('.status-text').textContent = 'Оффлайн';
        }

        // Отправляем статус на сервер
        try {
            const response = await fetch('/api/listener/status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ online: this.isOnline })
            });

            if (!response.ok) {
                throw new Error('Ошибка обновления статуса');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            // Возвращаем предыдущий статус в случае ошибки
            this.isOnline = !this.isOnline;
            this.updateStatusDisplay();
        }
    }

    updateStatusDisplay() {
        const statusElement = document.getElementById('onlineStatus');
        if (this.isOnline) {
            statusElement.classList.remove('offline');
            statusElement.querySelector('.status-text').textContent = 'Онлайн';
        } else {
            statusElement.classList.add('offline');
            statusElement.querySelector('.status-text').textContent = 'Оффлайн';
        }
    }

    async loadUserChats() {
        try {
            const response = await fetch('/api/listener/chats', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const chats = await response.json();
                this.renderUserChats(chats);
            }
        } catch (error) {
            console.error('Ошибка загрузки чатов:', error);
        }
    }

    renderUserChats(chats) {
        const chatsList = document.getElementById('chatsList');
        
        if (chats.length === 0) {
            chatsList.innerHTML = `
                <div class="empty-state">
                    <p>Нет активных чатов</p>
                </div>
            `;
            return;
        }

        chatsList.innerHTML = chats.map(chat => `
            <div class="chat-item" data-chat-id="${chat.id}">
                <div class="chat-avatar">${chat.userName.charAt(0)}</div>
                <div class="chat-info">
                    <div class="chat-user">${chat.userName}</div>
                    <div class="chat-last-message">${chat.lastMessage}</div>
                </div>
                <div class="chat-meta">
                    <div class="chat-time">${this.formatTime(chat.lastMessageTime)}</div>
                    ${chat.unreadCount > 0 ? `<div class="chat-unread">${chat.unreadCount}</div>` : ''}
                </div>
            </div>
        `).join('');

        // Добавляем обработчики кликов для чатов
        chatsList.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', () => {
                const chatId = item.dataset.chatId;
                this.openChat(chatId);
            });
        });
    }

    async loadListenerChat() {
        try {
            const [listenersResponse, messagesResponse] = await Promise.all([
                fetch('/api/listeners/online'),
                fetch('/api/listener-chat/messages')
            ]);

            if (listenersResponse.ok) {
                const listeners = await listenersResponse.json();
                this.renderOnlineListeners(listeners);
            }

            if (messagesResponse.ok) {
                const messages = await messagesResponse.json();
                this.renderListenerChatMessages(messages);
            }
        } catch (error) {
            console.error('Ошибка загрузки чата слушателей:', error);
        }
    }

    renderOnlineListeners(listeners) {
        const listenersList = document.getElementById('listenersList');
        listenersList.innerHTML = listeners.map(listener => `
            <div class="listener-item" data-listener-id="${listener.id}">
                <div class="listener-avatar">${listener.name.charAt(0)}</div>
                <div class="listener-info">
                    <div class="listener-name">${listener.name}</div>
                    <div class="listener-status status-online">Онлайн</div>
                </div>
            </div>
        `).join('');
    }

    async loadReviews() {
        try {
            const response = await fetch('/api/listener/reviews', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderReviews(data);
            }
        } catch (error) {
            console.error('Ошибка загрузки отзывов:', error);
        }
    }

    renderReviews(data) {
        document.getElementById('avgRating').textContent = data.averageRating.toFixed(1);
        document.getElementById('totalReviews').textContent = data.reviews.length;

        const reviewsList = document.getElementById('reviewsList');
        reviewsList.innerHTML = data.reviews.map(review => `
            <div class="review-item">
                <div class="review-header">
                    <span class="review-user">${review.userName}</span>
                    <span class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5-review.rating)}</span>
                    <span class="review-date">${this.formatDate(review.createdAt)}</span>
                </div>
                <div class="review-text">${review.text}</div>
            </div>
        `).join('');
    }

    async loadStatistics() {
        try {
            const response = await fetch('/api/listener/statistics', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const stats = await response.json();
                this.renderStatistics(stats);
            }
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
    }

    renderStatistics(stats) {
        document.getElementById('totalSessions').textContent = stats.totalSessions;
        document.getElementById('avgSessionTime').textContent = stats.averageSessionTime;
        document.getElementById('activeChats').textContent = stats.activeChats;
        document.getElementById('helpfulness').textContent = `${stats.helpfulness}%`;

        // Здесь можно добавить отрисовку графиков с помощью Chart.js
        this.renderCharts(stats.chartData);
    }

    renderCharts(chartData) {
        // Пример реализации графиков (требуется Chart.js)
        const ctx = document.getElementById('sessionsChart').getContext('2d');
        // new Chart(ctx, { ... });
    }

    toggleNotifications() {
        const panel = document.getElementById('notificationsPanel');
        panel.classList.toggle('hidden');
        
        if (!panel.classList.contains('hidden')) {
            this.markNotificationsAsRead();
        }
    }

    hideNotifications() {
        document.getElementById('notificationsPanel').classList.add('hidden');
    }

    async markNotificationsAsRead() {
        // Помечаем уведомления как прочитанные
        try {
            await fetch('/api/notifications/read', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            document.getElementById('notificationBadge').classList.add('hidden');
        } catch (error) {
            console.error('Ошибка отметки уведомлений:', error);
        }
    }

    openSettings() {
        // Используем существующий модуль настроек
        if (typeof SettingsManager !== 'undefined') {
            SettingsManager.openModal();
        } else {
            // Fallback: простая реализация
            window.location.href = 'settings.html';
        }
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    }

    setupSocketListeners() {
        // Слушаем новые сообщения
        socket.on('new_message', (data) => {
            this.handleNewMessage(data);
        });

        // Слушаем новые уведомления
        socket.on('new_notification', (data) => {
            this.handleNewNotification(data);
        });

        // Слушаем обновления статусов слушателей
        socket.on('listener_status_update', (data) => {
            this.handleListenerStatusUpdate(data);
        });
    }

    handleNewMessage(data) {
        // Обработка нового сообщения
        if (data.chatType === 'user') {
            this.updateChatList(data);
        } else if (data.chatType === 'listener') {
            this.addListenerChatMessage(data);
        }
    }

    handleNewNotification(notification) {
        this.notifications.unshift(notification);
        this.updateNotificationsBadge();
        this.renderNotifications();
        
        // Показываем toast уведомление
        this.showToast(notification.message);
    }

    handleListenerStatusUpdate(data) {
        // Обновляем список онлайн слушателей
        if (this.currentTab === 'listener-chat') {
            this.loadListenerChat();
        }
    }

    updateNotificationsBadge() {
        const unreadCount = this.notifications.filter(n => !n.read).length;
        const badge = document.getElementById('notificationBadge');
        
        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    renderNotifications() {
        const list = document.getElementById('notificationsList');
        list.innerHTML = this.notifications.map(notification => `
            <div class="notification-item ${notification.read ? '' : 'unread'}">
                <div class="notification-content">${notification.message}</div>
                <div class="notification-time">${this.formatTime(notification.createdAt)}</div>
            </div>
        `).join('');
    }

    showToast(message) {
        // Создаем и показываем toast уведомление
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    formatTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU');
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем авторизацию
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!token || user.role !== 'listener') {
        window.location.href = 'index.html';
        return;
    }

    // Инициализируем интерфейс слушателя
    window.listenerApp = new ListenerInterface();
});
