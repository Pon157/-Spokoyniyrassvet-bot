class ListenerInterface {
    constructor() {
        this.currentTab = 'user-chat';
        this.isOnline = true;
        this.notifications = [];
        this.currentChats = [];
        this.onlineListeners = [];
        this.selectedListener = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadUserData();
        this.setupSocketListeners();
        this.loadInitialData();
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

        // Обновление слушателей
        document.getElementById('refreshListeners').addEventListener('click', () => {
            this.loadOnlineListeners();
        });

        // Отправка сообщения слушателю
        document.getElementById('sendListenerMessage').addEventListener('click', () => {
            this.sendListenerMessage();
        });

        document.getElementById('listenerMessageText').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendListenerMessage();
            }
        });

        // Закрытие модальных окон
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.add('hidden');
            });
        });

        // Клик вне уведомлений
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.notifications-panel') && !e.target.closest('#notificationsBtn')) {
                this.hideNotifications();
            }
        });
    }

    async loadUserData() {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user.username) {
                document.getElementById('userName').textContent = user.username;
                if (user.avatar_url) {
                    document.getElementById('userAvatar').src = user.avatar_url;
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки данных пользователя:', error);
        }
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
        this.updateStatusDisplay();

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

            // Отправляем статус через WebSocket
            if (window.socket) {
                window.socket.emit('listener_status', {
                    listenerId: this.getUserId(),
                    online: this.isOnline
                });
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
        const userStatus = document.getElementById('userStatus');
        
        if (this.isOnline) {
            statusElement.classList.remove('offline');
            statusElement.classList.add('online');
            statusElement.querySelector('.status-text').textContent = 'Онлайн';
            userStatus.textContent = 'Онлайн';
            userStatus.className = 'user-status status-online';
        } else {
            statusElement.classList.remove('online');
            statusElement.classList.add('offline');
            statusElement.querySelector('.status-text').textContent = 'Оффлайн';
            userStatus.textContent = 'Оффлайн';
            userStatus.className = 'user-status status-offline';
        }
    }

    async loadUserChats() {
        try {
            document.getElementById('chatsList').innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    Загрузка чатов...
                </div>
            `;

            const token = localStorage.getItem('token');
            const response = await fetch('/api/listener/chats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.currentChats = data.chats || [];
                this.renderUserChats(this.currentChats);
                this.updateChatsBadge();
            } else {
                throw new Error('Ошибка загрузки чатов');
            }
        } catch (error) {
            console.error('Ошибка загрузки чатов:', error);
            document.getElementById('chatsList').innerHTML = `
                <div class="empty-state">
                    <p>Ошибка загрузки чатов</p>
                    <button class="btn-secondary" onclick="listenerApp.loadUserChats()">Повторить</button>
                </div>
            `;
        }
    }

    renderUserChats(chats) {
        const chatsList = document.getElementById('chatsList');
        
        if (chats.length === 0) {
            chatsList.innerHTML = `
                <div class="empty-state">
                    <p>Нет активных чатов</p>
                    <p class="text-muted">Новые чаты появятся здесь, когда пользователи обратятся за помощью</p>
                </div>
            `;
            return;
        }

        chatsList.innerHTML = chats.map(chat => `
            <div class="chat-item ${chat.unread_count > 0 ? 'unread' : ''}" data-chat-id="${chat.id}">
                <div class="chat-avatar">
                    ${chat.user_avatar ? 
                        `<img src="${chat.user_avatar}" alt="${chat.user_name}">` : 
                        chat.user_name?.charAt(0) || 'П'
                    }
                </div>
                <div class="chat-info">
                    <div class="chat-user">${chat.user_name || 'Пользователь'}</div>
                    <div class="chat-last-message">${chat.last_message || 'Чат начат'}</div>
                </div>
                <div class="chat-meta">
                    <div class="chat-time">${this.formatTime(chat.last_message_time || chat.created_at)}</div>
                    ${chat.unread_count > 0 ? `<div class="chat-unread">${chat.unread_count}</div>` : ''}
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
        await this.loadOnlineListeners();
    }

    async loadOnlineListeners() {
        try {
            document.getElementById('listenersList').innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    Загрузка слушателей...
                </div>
            `;

            const token = localStorage.getItem('token');
            const response = await fetch('/api/listener/online-listeners', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.onlineListeners = data.listeners || [];
                this.renderOnlineListeners(this.onlineListeners);
            } else {
                // Fallback к мок данным
                this.renderOnlineListeners(this.getMockListeners());
            }
        } catch (error) {
            console.error('Ошибка загрузки слушателей:', error);
            // Используем мок данные при ошибке
            this.renderOnlineListeners(this.getMockListeners());
        }
    }

    getMockListeners() {
        return [
            {
                id: '2',
                name: 'Анна Слушатель',
                avatar: '/images/default-avatar.svg',
                is_online: true,
                bio: 'Психолог с 5-летним опытом',
                rating: 4.8
            },
            {
                id: '3', 
                name: 'Максим Помощник',
                avatar: '/images/default-avatar.svg',
                is_online: false,
                bio: 'Специалист по кризисным ситуациям',
                rating: 4.9
            }
        ];
    }

    renderOnlineListeners(listeners) {
        const listenersList = document.getElementById('listenersList');
        
        if (listeners.length === 0) {
            listenersList.innerHTML = `
                <div class="empty-state">
                    <p>Нет онлайн слушателей</p>
                </div>
            `;
            return;
        }

        listenersList.innerHTML = listeners.map(listener => `
            <div class="listener-item ${this.selectedListener?.id === listener.id ? 'active' : ''}" 
                 data-listener-id="${listener.id}">
                <div class="listener-avatar">
                    ${listener.avatar ? 
                        `<img src="${listener.avatar}" alt="${listener.name}">` : 
                        listener.name?.charAt(0) || 'С'
                    }
                </div>
                <div class="listener-info">
                    <div class="listener-name">${listener.name}</div>
                    <div class="listener-status ${listener.is_online ? 'status-online' : 'status-offline'}">
                        <span class="status-dot"></span>
                        ${listener.is_online ? 'Онлайн' : 'Оффлайн'}
                    </div>
                </div>
            </div>
        `).join('');

        // Добавляем обработчики кликов для слушателей
        listenersList.querySelectorAll('.listener-item').forEach(item => {
            item.addEventListener('click', () => {
                const listenerId = item.dataset.listenerId;
                this.selectListener(listenerId);
            });
        });
    }

    selectListener(listenerId) {
        this.selectedListener = this.onlineListeners.find(l => l.id === listenerId);
        
        // Обновляем UI
        document.querySelectorAll('.listener-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-listener-id="${listenerId}"]`).classList.add('active');

        // Показываем поле ввода сообщения
        document.getElementById('listenerMessageInput').classList.remove('hidden');
        
        // Загружаем историю сообщений
        this.loadListenerChatHistory(listenerId);
    }

    async loadListenerChatHistory(listenerId) {
        // Заглушка для загрузки истории сообщений
        const messagesContainer = document.getElementById('listenerChatMessages');
        messagesContainer.innerHTML = `
            <div class="empty-state">
                <p>Начните общение с ${this.selectedListener?.name}</p>
            </div>
        `;
    }

    async sendListenerMessage() {
        const messageInput = document.getElementById('listenerMessageText');
        const message = messageInput.value.trim();
        
        if (!message || !this.selectedListener) return;

        // Отправляем сообщение через WebSocket
        if (window.socket) {
            window.socket.emit('send_message', {
                chat_id: `listener_${this.selectedListener.id}`,
                content: message,
                message_type: 'text'
            });
        }

        // Очищаем поле ввода
        messageInput.value = '';

        // Добавляем сообщение в UI
        this.addListenerMessageToUI({
            id: Date.now().toString(),
            content: message,
            sender_id: this.getUserId(),
            created_at: new Date().toISOString(),
            sender: {
                username: 'Вы',
                avatar_url: '/images/default-avatar.svg'
            }
        });
    }

    addListenerMessageToUI(message) {
        const messagesContainer = document.getElementById('listenerChatMessages');
        
        // Убираем empty state если есть
        if (messagesContainer.querySelector('.empty-state')) {
            messagesContainer.innerHTML = '';
        }

        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.sender_id === this.getUserId() ? 'message-outgoing' : 'message-incoming'}`;
        messageElement.innerHTML = `
            <div class="message-content">${message.content}</div>
            <div class="message-time">${this.formatTime(message.created_at)}</div>
        `;

        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async loadReviews() {
        try {
            document.getElementById('reviewsList').innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    Загрузка отзывов...
                </div>
            `;

            const token = localStorage.getItem('token');
            const response = await fetch('/api/listener/reviews', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderReviews(data);
            } else {
                throw new Error('Ошибка загрузки отзывов');
            }
        } catch (error) {
            console.error('Ошибка загрузки отзывов:', error);
            // Показываем мок данные
            this.renderReviews({
                reviews: [],
                averageRating: 0,
                totalReviews: 0
            });
        }
    }

    renderReviews(data) {
        document.getElementById('avgRating').textContent = data.averageRating?.toFixed(1) || '0.0';
        document.getElementById('totalReviews').textContent = data.totalReviews || data.reviews?.length || 0;

        const reviewsList = document.getElementById('reviewsList');
        
        if (!data.reviews || data.reviews.length === 0) {
            reviewsList.innerHTML = `
                <div class="empty-state">
                    <p>Пока нет отзывов</p>
                    <p class="text-muted">Отзывы появятся здесь после завершения чатов с пользователями</p>
                </div>
            `;
            return;
        }

        reviewsList.innerHTML = data.reviews.map(review => `
            <div class="review-item">
                <div class="review-header">
                    <span class="review-user">${review.user_name || 'Пользователь'}</span>
                    <span class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5-review.rating)}</span>
                    <span class="review-date">${this.formatDate(review.created_at)}</span>
                </div>
                <div class="review-text">${review.comment || 'Без комментария'}</div>
            </div>
        `).join('');
    }

    async loadStatistics() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/listener/statistics', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const stats = await response.json();
                this.renderStatistics(stats);
            } else {
                throw new Error('Ошибка загрузки статистики');
            }
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
            // Показываем мок статистику
            this.renderStatistics({
                totalSessions: 12,
                activeChats: 3,
                averageSessionTime: 25,
                helpfulness: 85,
                weeklyActivity: {
                    '01.01': 5,
                    '02.01': 8,
                    '03.01': 12,
                    '04.01': 6,
                    '05.01': 9,
                    '06.01': 11,
                    '07.01': 7
                }
            });
        }
    }

    renderStatistics(stats) {
        document.getElementById('totalSessions').textContent = stats.totalSessions || 0;
        document.getElementById('activeChats').textContent = stats.activeChats || 0;
        document.getElementById('avgSessionTime').textContent = stats.averageSessionTime || 0;
        document.getElementById('helpfulness').textContent = `${stats.helpfulness || 0}%`;

        // Рендерим график активности
        this.renderActivityChart(stats.weeklyActivity || {});
    }

    renderActivityChart(activityData) {
        const chartContainer = document.getElementById('activityChart');
        const days = Object.keys(activityData);
        const values = Object.values(activityData);
        const maxValue = Math.max(...values, 1); // Минимум 1 чтобы избежать деления на 0

        chartContainer.innerHTML = days.map((day, index) => {
            const value = values[index];
            const height = (value / maxValue) * 100;
            
            return `
                <div class="chart-bar" style="height: ${height}%" title="${day}: ${value} сессий">
                    <span class="chart-value">${value}</span>
                    <span class="chart-label">${day.split('.')[0]}.${day.split('.')[1]}</span>
                </div>
            `;
        }).join('');
    }

    async openChat(chatId) {
        // Используем существующий чат интерфейс
        if (typeof ChatManager !== 'undefined') {
            ChatManager.openChat(chatId);
        } else {
            // Fallback: открываем в модальном окне
            this.openChatModal(chatId);
        }
    }

    openChatModal(chatId) {
        const chat = this.currentChats.find(c => c.id === chatId);
        if (!chat) return;

        document.getElementById('chatModalTitle').textContent = `Чат с ${chat.user_name}`;
        document.getElementById('chatModal').classList.remove('hidden');
        
        // Здесь можно загрузить историю сообщений чата
        document.getElementById('chatInterface').innerHTML = `
            <div class="empty-state">
                <p>Загрузка истории сообщений...</p>
            </div>
        `;
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
            // Fallback: переходим на страницу настроек
            window.location.href = 'settings.html';
        }
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    }

    setupSocketListeners() {
        if (!window.socket) return;

        // Слушаем новые сообщения от пользователей
        window.socket.on('new_message', (data) => {
            this.handleNewMessage(data);
        });

        // Слушаем новые уведомления
        window.socket.on('new_notification', (data) => {
            this.handleNewNotification(data);
        });

        // Слушаем обновления статусов слушателей
        window.socket.on('listener_status_update', (data) => {
            this.handleListenerStatusUpdate(data);
        });

        // Слушаем новые сообщения от слушателей
        window.socket.on('new_listener_message', (data) => {
            this.handleNewListenerMessage(data);
        });
    }

    handleNewMessage(data) {
        // Обновляем список чатов если есть новое сообщение
        this.loadUserChats();
        
        // Показываем уведомление
        this.showNotification(`Новое сообщение в чате`, 'message');
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
            this.loadOnlineListeners();
        }
    }

    handleNewListenerMessage(data) {
        // Добавляем сообщение в UI если это выбранный слушатель
        if (this.selectedListener && data.sender_id === this.selectedListener.id) {
            this.addListenerMessageToUI(data);
        }
    }

    updateNotificationsBadge() {
        const unreadCount = this.notifications.filter(n => !n.read).length;
        const badge = document.getElementById('notificationBadge');
        
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    updateChatsBadge() {
        const unreadCount = this.currentChats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);
        const badge = document.getElementById('userChatsBadge');
        
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    renderNotifications() {
        const list = document.getElementById('notificationsList');
        
        if (this.notifications.length === 0) {
            list.innerHTML = '<div class="empty-state">Нет уведомлений</div>';
            return;
        }

        list.innerHTML = this.notifications.map(notification => `
            <div class="notification-item ${notification.read ? '' : 'unread'}">
                <div class="notification-content">${notification.message}</div>
                <div class="notification-time">${this.formatTime(notification.created_at)}</div>
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

    showNotification(message, type = 'info') {
        // Можно интегрировать с системой уведомлений браузера
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Спокойный рассвет', {
                body: message,
                icon: '/images/icon.png'
            });
        }
    }

    getUserId() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return user.id;
    }

    formatTime(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU');
    }

    loadInitialData() {
        this.loadUserChats();
        this.loadReviews();
        this.loadStatistics();
        
        // Запрашиваем разрешение на уведомления
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем авторизацию
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // Проверяем роль (для тестирования пропускаем)
    if (user.role !== 'listener') {
        console.warn('Пользователь не является слушателем, но доступ разрешен для тестирования');
    }

    // Инициализируем интерфейс слушателя
    window.listenerApp = new ListenerInterface();
});
