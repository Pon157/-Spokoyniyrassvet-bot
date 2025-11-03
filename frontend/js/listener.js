class ListenerInterface {
    constructor() {
        console.log('🎧 Инициализация интерфейса слушателя');
        this.currentTab = 'user-chat';
        this.isOnline = true;
        this.notifications = [];
        this.currentChats = [];
        this.onlineListeners = [];
        this.selectedListener = null;
        this.activeUserChat = null;
        this.init();
    }

    init() {
        console.log('=== ИНИЦИАЛИЗАЦИЯ ИНТЕРФЕЙСА СЛУШАТЕЛЯ ===');
        
        try {
            this.checkAuth();
            this.bindEvents();
            this.loadUserData();
            this.setupSocketListeners();
            this.loadInitialData();
            
            console.log('=== ИНИЦИАЛИЗАЦИЯ ЗАВЕРШЕНА ===');
        } catch (error) {
            console.error('❌ Ошибка инициализации:', error);
            this.showError('Ошибка инициализации интерфейса');
        }
    }

    checkAuth() {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (!token || !user.id) {
            console.warn('⚠️ Пользователь не авторизован, перенаправление...');
            window.location.href = 'index.html';
            return;
        }

        if (user.role !== 'listener') {
            console.warn('⚠️ Доступ запрещен: роль не "listener"');
            window.location.href = 'index.html';
            return;
        }
    }

    bindEvents() {
        console.log('🔗 Привязка событий...');
        
        // Навигация
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.switchTab(e.currentTarget.dataset.tab);
            });
        });

        // Статус онлайн
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

        // Кнопки управления
        document.getElementById('refreshChats').addEventListener('click', () => {
            this.loadUserChats();
        });

        document.getElementById('refreshListeners').addEventListener('click', () => {
            this.loadOnlineListeners();
        });

        // Сообщения
        document.getElementById('sendListenerMessage').addEventListener('click', () => {
            this.sendListenerMessage();
        });

        document.getElementById('listenerMessageText').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendListenerMessage();
            }
        });

        // Выход
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Клик вне уведомлений
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.notifications-panel') && !e.target.closest('#notificationsBtn')) {
                this.hideNotifications();
            }
        });

        console.log('✅ Все события привязаны');
    }

    async loadUserData() {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user.username) {
                document.getElementById('userName').textContent = user.username;
                document.getElementById('userAvatar').src = user.avatar_url || '/images/default-avatar.svg';
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки данных пользователя:', error);
        }
    }

    switchTab(tabName) {
        console.log('📁 Переключение на таб:', tabName);
        
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

        try {
            const response = await fetch('/api/listener/status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ online: this.isOnline })
            });

            if (!response.ok) throw new Error('Ошибка обновления статуса');

            // Отправляем статус через WebSocket
            if (window.socket) {
                window.socket.emit('listener_status', {
                    listenerId: this.getUserId(),
                    online: this.isOnline
                });
            }

            this.showToast(this.isOnline ? 'Вы теперь онлайн' : 'Вы теперь оффлайн');
        } catch (error) {
            console.error('❌ Ошибка обновления статуса:', error);
            this.isOnline = !this.isOnline;
            this.updateStatusDisplay();
            this.showError('Ошибка обновления статуса');
        }
    }

    updateStatusDisplay() {
        const statusElement = document.getElementById('onlineStatus');
        const userStatus = document.getElementById('userStatus');
        
        if (this.isOnline) {
            statusElement.classList.remove('offline');
            statusElement.querySelector('.status-text').textContent = 'Онлайн';
            userStatus.textContent = 'Онлайн';
            userStatus.className = 'user-status status-online';
        } else {
            statusElement.classList.add('offline');
            statusElement.querySelector('.status-text').textContent = 'Оффлайн';
            userStatus.textContent = 'Оффлайн';
            userStatus.className = 'user-status status-offline';
        }
    }

    async loadUserChats() {
        try {
            this.showLoading('chatsList');
            
            const response = await fetch('/api/listener/chats', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
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
            console.error('❌ Ошибка загрузки чатов:', error);
            this.showError('chatsList', 'Ошибка загрузки чатов');
        }
    }

    renderUserChats(chats) {
        const chatsList = document.getElementById('chatsList');
        
        if (chats.length === 0) {
            chatsList.innerHTML = this.getEmptyState('Нет активных чатов', 'Новые чаты появятся здесь, когда пользователи обратятся за помощью');
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
                    <div class="chat-user">${this.escapeHtml(chat.user_name || 'Пользователь')}</div>
                    <div class="chat-last-message">${this.escapeHtml(chat.last_message || 'Чат начат')}</div>
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
                this.openUserChat(item.dataset.chatId);
            });
        });
    }

    async openUserChat(chatId) {
        console.log('💬 Открытие чата с пользователем:', chatId);
        const chat = this.currentChats.find(c => c.id === chatId);
        if (!chat) return;

        // Открываем модальное окно чата
        this.openChatModal(chat);
    }

    openChatModal(chat) {
        // Создаем модальное окно для чата
        const modalHtml = `
            <div class="modal" id="chatModal">
                <div class="modal-content large">
                    <div class="modal-header">
                        <h3>Чат с ${this.escapeHtml(chat.user_name)}</h3>
                        <button class="btn-icon close-modal">✕</button>
                    </div>
                    <div class="modal-body">
                        <div class="chat-interface">
                            <div class="chat-messages" id="modalChatMessages">
                                <div class="loading-state">Загрузка сообщений...</div>
                            </div>
                            <div class="message-input-container">
                                <div class="message-input">
                                    <input type="text" placeholder="Введите сообщение..." id="modalMessageText">
                                    <button class="btn-primary" id="sendModalMessage">Отправить</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Добавляем модальное окно в DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('chatModal');
        
        // Загружаем историю сообщений
        this.loadChatHistory(chat.id, 'modalChatMessages');
        
        // Обработчики событий для модального окна
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.remove();
        });

        modal.querySelector('#sendModalMessage').addEventListener('click', () => {
            this.sendUserMessage(chat.id, modal.querySelector('#modalMessageText'));
        });

        modal.querySelector('#modalMessageText').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendUserMessage(chat.id, modal.querySelector('#modalMessageText'));
            }
        });

        // Клик вне модального окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    async loadChatHistory(chatId, containerId) {
        try {
            const response = await fetch(`/api/chats/${chatId}/messages`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderChatMessages(data.messages, containerId);
            } else {
                throw new Error('Ошибка загрузки сообщений');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки истории чата:', error);
            document.getElementById(containerId).innerHTML = this.getErrorState('Ошибка загрузки сообщений');
        }
    }

    renderChatMessages(messages, containerId) {
        const container = document.getElementById(containerId);
        
        if (!messages || messages.length === 0) {
            container.innerHTML = this.getEmptyState('Нет сообщений', 'Начните общение');
            return;
        }

        container.innerHTML = messages.map(message => `
            <div class="message ${message.sender_id === this.getUserId() ? 'message-outgoing' : 'message-incoming'}">
                <div class="message-content">${this.escapeHtml(message.content)}</div>
                <div class="message-time">${this.formatTime(message.created_at)}</div>
            </div>
        `).join('');

        container.scrollTop = container.scrollHeight;
    }

    async sendUserMessage(chatId, inputElement) {
        const message = inputElement.value.trim();
        if (!message) return;

        try {
            const response = await fetch(`/api/chats/${chatId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ content: message })
            });

            if (response.ok) {
                inputElement.value = '';
                // Обновляем историю сообщений
                this.loadChatHistory(chatId, 'modalChatMessages');
            } else {
                throw new Error('Ошибка отправки сообщения');
            }
        } catch (error) {
            console.error('❌ Ошибка отправки сообщения:', error);
            this.showError('Ошибка отправки сообщения');
        }
    }

    async loadListenerChat() {
        await this.loadOnlineListeners();
    }

    async loadOnlineListeners() {
        try {
            this.showLoading('listenersList');
            
            const response = await fetch('/api/listener/online-listeners', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.onlineListeners = data.listeners || [];
                this.renderOnlineListeners(this.onlineListeners);
            } else {
                throw new Error('Ошибка загрузки слушателей');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки слушателей:', error);
            this.showError('listenersList', 'Ошибка загрузки слушателей');
        }
    }

    renderOnlineListeners(listeners) {
        const listenersList = document.getElementById('listenersList');
        
        if (listeners.length === 0) {
            listenersList.innerHTML = this.getEmptyState('Нет онлайн слушателей');
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
                    <div class="listener-name">${this.escapeHtml(listener.name)}</div>
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
                this.selectListener(item.dataset.listenerId);
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
        try {
            this.showLoading('listenerChatMessages');
            
            const response = await fetch(`/api/listener/chats/${listenerId}/messages`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderListenerChatMessages(data.messages);
            } else {
                throw new Error('Ошибка загрузки истории чата');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки истории чата:', error);
            this.showError('listenerChatMessages', 'Ошибка загрузки сообщений');
        }
    }

    renderListenerChatMessages(messages) {
        const container = document.getElementById('listenerChatMessages');
        
        if (!messages || messages.length === 0) {
            container.innerHTML = this.getEmptyState('Нет сообщений', `Начните общение с ${this.selectedListener?.name}`);
            return;
        }

        container.innerHTML = messages.map(message => `
            <div class="message ${message.sender_id === this.getUserId() ? 'message-outgoing' : 'message-incoming'}">
                <div class="message-content">${this.escapeHtml(message.content)}</div>
                <div class="message-time">${this.formatTime(message.created_at)}</div>
            </div>
        `).join('');

        container.scrollTop = container.scrollHeight;
    }

    async sendListenerMessage() {
        const messageInput = document.getElementById('listenerMessageText');
        const message = messageInput.value.trim();
        
        if (!message || !this.selectedListener) {
            this.showToast('Выберите слушателя для общения');
            return;
        }

        try {
            const response = await fetch('/api/listener/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    receiver_id: this.selectedListener.id,
                    content: message
                })
            });

            if (response.ok) {
                messageInput.value = '';
                this.addListenerMessageToUI({
                    id: Date.now().toString(),
                    content: message,
                    sender_id: this.getUserId(),
                    created_at: new Date().toISOString()
                });
            } else {
                throw new Error('Ошибка отправки сообщения');
            }
        } catch (error) {
            console.error('❌ Ошибка отправки сообщения:', error);
            this.showError('Ошибка отправки сообщения');
        }
    }

    addListenerMessageToUI(message) {
        const container = document.getElementById('listenerChatMessages');
        
        // Убираем empty state если есть
        if (container.querySelector('.empty-state')) {
            container.innerHTML = '';
        }

        const messageElement = document.createElement('div');
        messageElement.className = `message message-outgoing`;
        messageElement.innerHTML = `
            <div class="message-content">${this.escapeHtml(message.content)}</div>
            <div class="message-time">${this.formatTime(message.created_at)}</div>
        `;

        container.appendChild(messageElement);
        container.scrollTop = container.scrollHeight;
    }

    async loadReviews() {
        try {
            this.showLoading('reviewsList');
            
            const response = await fetch('/api/listener/reviews', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderReviews(data);
            } else {
                throw new Error('Ошибка загрузки отзывов');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки отзывов:', error);
            this.showError('reviewsList', 'Ошибка загрузки отзывов');
        }
    }

    renderReviews(data) {
        document.getElementById('avgRating').textContent = data.averageRating?.toFixed(1) || '0.0';
        document.getElementById('totalReviews').textContent = data.totalReviews || data.reviews?.length || 0;

        const reviewsList = document.getElementById('reviewsList');
        
        if (!data.reviews || data.reviews.length === 0) {
            reviewsList.innerHTML = this.getEmptyState('Пока нет отзывов', 'Отзывы появятся здесь после завершения чатов с пользователями');
            return;
        }

        reviewsList.innerHTML = data.reviews.map(review => `
            <div class="review-item">
                <div class="review-header">
                    <span class="review-user">${this.escapeHtml(review.user_name || 'Пользователь')}</span>
                    <span class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5-review.rating)}</span>
                    <span class="review-date">${this.formatDate(review.created_at)}</span>
                </div>
                <div class="review-text">${this.escapeHtml(review.comment || 'Без комментария')}</div>
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
            } else {
                throw new Error('Ошибка загрузки статистики');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
            this.renderStatistics(this.getMockStatistics());
        }
    }

    renderStatistics(stats) {
        document.getElementById('totalSessions').textContent = stats.totalSessions || 0;
        document.getElementById('activeChats').textContent = stats.activeChats || 0;
        document.getElementById('avgSessionTime').textContent = stats.averageSessionTime || 0;
        document.getElementById('helpfulness').textContent = `${stats.helpfulness || 0}%`;

        this.renderActivityChart(stats.weeklyActivity || {});
    }

    renderActivityChart(activityData) {
        const chartContainer = document.getElementById('activityChart');
        const days = Object.keys(activityData);
        const values = Object.values(activityData);
        const maxValue = Math.max(...values, 1);

        chartContainer.innerHTML = days.map((day, index) => {
            const value = values[index];
            const height = (value / maxValue) * 100;
            const date = new Date(day);
            const label = `${date.getDate()}.${date.getMonth() + 1}`;
            
            return `
                <div class="chart-bar" style="height: ${height}%" title="${label}: ${value} сессий">
                    <span class="chart-value">${value}</span>
                    <span class="chart-label">${label}</span>
                </div>
            `;
        }).join('');
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
        try {
            await fetch('/api/notifications/read', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            document.getElementById('notificationBadge').classList.add('hidden');
        } catch (error) {
            console.error('❌ Ошибка отметки уведомлений:', error);
        }
    }

    setupSocketListeners() {
        if (!window.socket) {
            console.warn('⚠️ WebSocket не инициализирован');
            return;
        }

        window.socket.on('new_message', (data) => {
            this.handleNewMessage(data);
        });

        window.socket.on('new_notification', (data) => {
            this.handleNewNotification(data);
        });

        window.socket.on('listener_status_update', (data) => {
            this.handleListenerStatusUpdate(data);
        });

        window.socket.on('new_listener_message', (data) => {
            this.handleNewListenerMessage(data);
        });
    }

    handleNewMessage(data) {
        this.loadUserChats();
        this.showNotification(`Новое сообщение от пользователя`, 'message');
    }

    handleNewNotification(notification) {
        this.notifications.unshift(notification);
        this.updateNotificationsBadge();
        this.renderNotifications();
        this.showToast(notification.message);
    }

    handleListenerStatusUpdate(data) {
        if (this.currentTab === 'listener-chat') {
            this.loadOnlineListeners();
        }
    }

    handleNewListenerMessage(data) {
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
            list.innerHTML = this.getEmptyState('Нет уведомлений');
            return;
        }

        list.innerHTML = this.notifications.map(notification => `
            <div class="notification-item ${notification.read ? '' : 'unread'}">
                <div class="notification-content">${this.escapeHtml(notification.message)}</div>
                <div class="notification-time">${this.formatTime(notification.created_at)}</div>
            </div>
        `).join('');
    }

    // Вспомогательные методы
    showLoading(containerId) {
        document.getElementById(containerId).innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Загрузка...</p>
            </div>
        `;
    }

    showError(containerId, message = 'Произошла ошибка') {
        document.getElementById(containerId).innerHTML = this.getErrorState(message);
    }

    getEmptyState(title, subtitle = '') {
        return `
            <div class="empty-state">
                <p>${title}</p>
                ${subtitle ? `<p class="text-muted">${subtitle}</p>` : ''}
            </div>
        `;
    }

    getErrorState(message) {
        return `
            <div class="empty-state">
                <p>${message}</p>
                <button class="btn-secondary" onclick="location.reload()">Обновить</button>
            </div>
        `;
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    showNotification(message, type = 'info') {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Спокойный рассвет', {
                body: message,
                icon: '/images/icon.png'
            });
        }
    }

    getMockStatistics() {
        return {
            totalSessions: Math.floor(Math.random() * 50) + 10,
            activeChats: Math.floor(Math.random() * 5) + 1,
            averageSessionTime: Math.floor(Math.random() * 30) + 10,
            helpfulness: Math.floor(Math.random() * 30) + 70,
            weeklyActivity: {
                [this.getDateString(-6)]: Math.floor(Math.random() * 10),
                [this.getDateString(-5)]: Math.floor(Math.random() * 15),
                [this.getDateString(-4)]: Math.floor(Math.random() * 8),
                [this.getDateString(-3)]: Math.floor(Math.random() * 12),
                [this.getDateString(-2)]: Math.floor(Math.random() * 6),
                [this.getDateString(-1)]: Math.floor(Math.random() * 14),
                [this.getDateString(0)]: Math.floor(Math.random() * 9)
            }
        };
    }

    getDateString(daysOffset) {
        const date = new Date();
        date.setDate(date.getDate() + daysOffset);
        return date.toISOString().split('T')[0];
    }

    getUserId() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return user.id;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
        
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM загружен, инициализация интерфейса слушателя');
    window.listenerApp = new ListenerInterface();
});
