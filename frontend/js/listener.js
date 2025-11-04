class ListenerInterface {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.isOnline = false;
        this.currentChatId = null;
        this.currentListenerChat = null;
        
        this.init();
    }

    init() {
        console.log('🎧 Инициализация интерфейса слушателя');
        console.log('=== ИНИЦИАЛИЗАЦИЯ ИНТЕРФЕЙСА СЛУШАТЕЛЯ ===');
        
        this.loadCurrentUser();
        this.bindEvents();
        this.setupSocketConnection();
        this.loadInitialData();
        
        console.log('=== ИНИЦИАЛИЗАЦИЯ ЗАВЕРШЕНА ===');
    }

    async loadCurrentUser() {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                window.location.href = '/index.html';
                return;
            }

            const response = await fetch('/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                this.currentUser = data.user;
                this.updateUserInterface();
            } else {
                window.location.href = '/index.html';
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки пользователя:', error);
            window.location.href = '/index.html';
        }
    }

    updateUserInterface() {
        // Обновляем информацию о пользователе
        const userNameElement = document.getElementById('userName');
        const userAvatarElement = document.getElementById('userAvatar');
        
        if (userNameElement) {
            userNameElement.textContent = this.currentUser.username;
        }
        
        if (userAvatarElement && this.currentUser.avatar_url) {
            userAvatarElement.src = this.currentUser.avatar_url;
        }
    }

    bindEvents() {
        console.log('🔗 Привязка событий...');
        
        // Навигация по табам
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.switchTab(e.currentTarget.dataset.tab);
            });
        });

        // Статус онлайн/оффлайн
        const onlineStatus = document.getElementById('onlineStatus');
        if (onlineStatus) {
            onlineStatus.addEventListener('click', () => {
                this.toggleOnlineStatus();
            });
        }

        // Уведомления
        const notificationsBtn = document.getElementById('notificationsBtn');
        const closeNotifications = document.getElementById('closeNotifications');
        const notificationsPanel = document.getElementById('notificationsPanel');
        
        if (notificationsBtn) {
            notificationsBtn.addEventListener('click', () => {
                notificationsPanel.classList.toggle('hidden');
            });
        }
        
        if (closeNotifications) {
            closeNotifications.addEventListener('click', () => {
                notificationsPanel.classList.add('hidden');
            });
        }

        // Обновление чатов
        const refreshChats = document.getElementById('refreshChats');
        if (refreshChats) {
            refreshChats.addEventListener('click', () => {
                this.loadUserChats();
            });
        }

        // Отправка сообщений слушателям
        const sendListenerMessage = document.getElementById('sendListenerMessage');
        const listenerMessageInput = document.getElementById('listenerMessageInputField');
        
        if (sendListenerMessage && listenerMessageInput) {
            sendListenerMessage.addEventListener('click', () => {
                this.sendListenerMessage();
            });
            
            listenerMessageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendListenerMessage();
                }
            });
        }

        console.log('✅ Все события привязаны');
    }

    switchTab(tabName) {
        // Скрыть все табы
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Показать выбранный таб
        const targetTab = document.getElementById(`${tabName}Tab`);
        if (targetTab) {
            targetTab.classList.add('active');
        }
        
        // Обновить активную кнопку навигации
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Загрузить данные для таба
        switch(tabName) {
            case 'chats':
                this.loadUserChats();
                break;
            case 'reviews':
                this.loadReviews();
                break;
            case 'statistics':
                this.loadStatistics();
                break;
            case 'listeners':
                this.loadOnlineListeners();
                break;
        }
    }

    setupSocketConnection() {
        console.log('🔌 Настройка подключения Socket.io...');
        
        if (typeof io !== 'undefined') {
            this.initializeSocket();
        } else {
            console.log('⚠️ Socket.io не загружен, попытка загрузить...');
            setTimeout(() => {
                if (typeof io !== 'undefined') {
                    this.initializeSocket();
                } else {
                    console.error('❌ Socket.io не удалось загрузить');
                }
            }, 1000);
        }
    }

    initializeSocket() {
        try {
            console.log('🔌 Создаем Socket подключение...');
            
            if (typeof io === 'undefined') {
                throw new Error('Socket.io не доступен');
            }
            
            this.socket = io();
            console.log('✅ Socket.io подключен');
            
            this.setupSocketListeners();
            
        } catch (error) {
            console.error('❌ Ошибка подключения WebSocket:', error);
            console.log('ℹ️ Продолжаем работу без WebSocket подключения');
        }
    }

    setupSocketListeners() {
        if (!this.socket) {
            console.log('⚠️ WebSocket не инициализирован');
            return;
        }

        this.socket.on('connect', () => {
            console.log('✅ Подключение к серверу установлено');
            
            if (this.currentUser) {
                this.socket.emit('user_connected', {
                    id: this.currentUser.id,
                    username: this.currentUser.username,
                    role: this.currentUser.role
                });
            }
        });

        this.socket.on('disconnect', () => {
            console.log('🔌 Отключение от сервера');
        });

        this.socket.on('new_message', (data) => {
            console.log('📨 Новое сообщение через Socket:', data);
            this.handleNewMessage(data);
        });

        this.socket.on('user_online', (userData) => {
            console.log('👤 Пользователь онлайн:', userData.username);
            this.updateUserOnlineStatus(userData.id, true);
        });

        this.socket.on('user_offline', (userData) => {
            console.log('👤 Пользователь оффлайн:', userData.username);
            this.updateUserOnlineStatus(userData.id, false);
        });

        this.socket.on('chat_accepted', (data) => {
            console.log('✅ Чат принят:', data);
            this.handleChatAccepted(data);
        });

        console.log('✅ Слушатели Socket.io настроены');
    }

    async loadInitialData() {
        console.log('📦 Загрузка начальных данных...');
        await this.loadUserChats();
        await this.loadReviews();
        await this.loadStatistics();
        await this.loadOnlineListeners();
    }

    async loadUserChats() {
        try {
            console.log('📨 Загрузка чатов...');
            const token = localStorage.getItem('authToken');
            
            const response = await fetch('/api/listener/chats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Ошибка загрузки чатов');
            }

            const data = await response.json();
            this.renderChats(data.chats);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки чатов:', error);
            this.showError('Ошибка загрузки чатов');
        }
    }

    renderChats(chats) {
        const chatsList = document.getElementById('chatsList');
        if (!chatsList) return;

        if (!chats || chats.length === 0) {
            chatsList.innerHTML = `
                <div class="empty-state">
                    <p>Нет активных чатов</p>
                    <p class="text-muted">Когда появятся новые чаты, они отобразятся здесь</p>
                </div>
            `;
            return;
        }

        chatsList.innerHTML = chats.map(chat => `
            <div class="chat-item ${chat.unread_count > 0 ? 'unread' : ''}" data-chat-id="${chat.id}">
                <div class="chat-avatar">
                    ${chat.user_avatar ? 
                        `<img src="${chat.user_avatar}" alt="${chat.user_name}">` : 
                        chat.user_name?.charAt(0) || 'U'
                    }
                </div>
                <div class="chat-info">
                    <div class="chat-user">${chat.user_name || 'Пользователь'}</div>
                    <div class="chat-last-message">${chat.last_message || 'Нет сообщений'}</div>
                </div>
                <div class="chat-meta">
                    <div class="chat-time">${this.formatTime(chat.last_message_time)}</div>
                    ${chat.unread_count > 0 ? 
                        `<div class="chat-unread">${chat.unread_count}</div>` : 
                        ''
                    }
                </div>
            </div>
        `).join('');

        // Добавляем обработчики клика на чаты
        chatsList.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', () => {
                const chatId = item.dataset.chatId;
                this.openChat(chatId);
            });
        });
    }

    async loadReviews() {
        try {
            console.log('⭐ Загрузка отзывов...');
            const token = localStorage.getItem('authToken');
            
            const response = await fetch('/api/listener/reviews', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Ошибка загрузки отзывов');
            }

            const data = await response.json();
            this.renderReviews(data);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки отзывов:', error);
            this.showError('Ошибка загрузки отзывов');
        }
    }

    renderReviews(data) {
        // Обновляем статистику
        const avgRating = document.getElementById('avgRating');
        const totalReviews = document.getElementById('totalReviews');
        
        if (avgRating) avgRating.textContent = data.averageRating?.toFixed(1) || '0.0';
        if (totalReviews) totalReviews.textContent = data.totalReviews || '0';

        // Рендерим отзывы
        const reviewsList = document.getElementById('reviewsList');
        if (!reviewsList) return;

        if (!data.reviews || data.reviews.length === 0) {
            reviewsList.innerHTML = `
                <div class="empty-state">
                    <p>Пока нет отзывов</p>
                    <p class="text-muted">Отзывы от пользователей появятся здесь</p>
                </div>
            `;
            return;
        }

        reviewsList.innerHTML = data.reviews.map(review => `
            <div class="review-item">
                <div class="review-header">
                    <div class="review-user">${review.user_name || 'Аноним'}</div>
                    <div class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
                    <div class="review-date">${this.formatDate(review.created_at)}</div>
                </div>
                <div class="review-text">${review.comment || 'Без комментария'}</div>
            </div>
        `).join('');
    }

    async loadStatistics() {
        try {
            console.log('📊 Загрузка статистики...');
            const token = localStorage.getItem('authToken');
            
            const response = await fetch('/api/listener/statistics', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Ошибка загрузки статистики');
            }

            const data = await response.json();
            this.renderStatistics(data);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
            this.showError('Ошибка загрузки статистики');
        }
    }

    renderStatistics(data) {
        // Обновляем основные статистики
        const totalSessions = document.getElementById('totalSessions');
        const activeChats = document.getElementById('activeChats');
        const avgSessionTime = document.getElementById('avgSessionTime');
        const helpfulness = document.getElementById('helpfulness');
        
        if (totalSessions) totalSessions.textContent = data.totalSessions || '0';
        if (activeChats) activeChats.textContent = data.activeChats || '0';
        if (avgSessionTime) avgSessionTime.textContent = data.averageSessionTime || '0';
        if (helpfulness) helpfulness.textContent = `${data.helpfulness || '0'}%`;

        // Рендерим график активности
        this.renderActivityChart(data.weeklyActivity);
    }

    renderActivityChart(weeklyActivity) {
        const chartContainer = document.getElementById('activityChart');
        if (!chartContainer || !weeklyActivity) return;

        const days = Object.keys(weeklyActivity);
        const values = Object.values(weeklyActivity);
        const maxValue = Math.max(...values, 1); // Минимум 1 чтобы избежать деления на 0

        chartContainer.innerHTML = days.map((day, index) => {
            const value = values[index];
            const height = (value / maxValue) * 100;
            
            return `
                <div class="chart-bar" style="height: ${height}%" title="${day}: ${value}">
                    <span class="chart-value">${value}</span>
                    <span class="chart-label">${day}</span>
                </div>
            `;
        }).join('');
    }

    async loadOnlineListeners() {
        try {
            console.log('👥 Загрузка онлайн слушателей...');
            const token = localStorage.getItem('authToken');
            
            const response = await fetch('/api/listener/online-listeners', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Ошибка загрузки слушателей');
            }

            const data = await response.json();
            this.renderOnlineListeners(data.listeners);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки слушателей:', error);
            this.showError('Ошибка загрузки слушателей');
        }
    }

    renderOnlineListeners(listeners) {
        const listenersList = document.getElementById('listenersList');
        if (!listenersList) return;

        if (!listeners || listeners.length === 0) {
            listenersList.innerHTML = `
                <div class="empty-state">
                    <p>Нет онлайн слушателей</p>
                    <p class="text-muted">Другие слушатели появятся здесь когда будут онлайн</p>
                </div>
            `;
            return;
        }

        listenersList.innerHTML = listeners.map(listener => `
            <div class="listener-item" data-listener-id="${listener.id}">
                <div class="listener-avatar">
                    ${listener.avatar ? 
                        `<img src="${listener.avatar}" alt="${listener.name}">` : 
                        listener.name?.charAt(0) || 'L'
                    }
                </div>
                <div class="listener-info">
                    <div class="listener-name">${listener.name}</div>
                    <div class="listener-status ${listener.is_online ? 'status-online' : 'status-offline'}">
                        <span class="status-dot"></span>
                        <span>${listener.is_online ? 'Онлайн' : 'Оффлайн'}</span>
                    </div>
                </div>
            </div>
        `).join('');

        // Добавляем обработчики для выбора слушателя
        listenersList.querySelectorAll('.listener-item').forEach(item => {
            item.addEventListener('click', () => {
                const listenerId = item.dataset.listenerId;
                this.selectListener(listenerId, listeners.find(l => l.id == listenerId));
            });
        });
    }

    async toggleOnlineStatus() {
        try {
            this.isOnline = !this.isOnline;
            const token = localStorage.getItem('authToken');
            
            const response = await fetch('/api/listener/status', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    online: this.isOnline
                })
            });

            if (response.ok) {
                this.updateOnlineStatusUI();
                this.showNotification(`Статус изменен: ${this.isOnline ? 'онлайн' : 'оффлайн'}`, 'success');
            }
            
        } catch (error) {
            console.error('❌ Ошибка изменения статуса:', error);
            this.isOnline = !this.isOnline; // Откатываем изменение
            this.showError('Ошибка изменения статуса');
        }
    }

    updateOnlineStatusUI() {
        const onlineStatus = document.getElementById('onlineStatus');
        const statusText = onlineStatus?.querySelector('.status-text');
        const userStatus = document.getElementById('userStatus');
        
        if (onlineStatus) {
            onlineStatus.classList.toggle('offline', !this.isOnline);
        }
        
        if (statusText) {
            statusText.textContent = this.isOnline ? 'Онлайн' : 'Оффлайн';
        }
        
        if (userStatus) {
            userStatus.className = `user-status ${this.isOnline ? 'status-online' : 'status-offline'}`;
            userStatus.innerHTML = `<span class="status-dot"></span><span>${this.isOnline ? 'Онлайн' : 'Оффлайн'}</span>`;
        }
    }

    selectListener(listenerId, listenerData) {
        this.currentListenerChat = listenerData;
        
        // Обновляем заголовок чата
        const chatTitle = document.getElementById('currentChatTitle');
        if (chatTitle) {
            chatTitle.textContent = `Чат с ${listenerData.name}`;
        }
        
        // Показываем поле ввода сообщения
        const messageInput = document.getElementById('listenerMessageInput');
        if (messageInput) {
            messageInput.classList.remove('hidden');
        }
        
        // Очищаем сообщения и показываем приветствие
        const messagesContainer = document.getElementById('listenerChatMessages');
        if (messagesContainer) {
            messagesContainer.innerHTML = `
                <div class="message message-incoming">
                    <div class="message-content">
                        Привет! Начинаем общение с ${listenerData.name}
                        <div class="message-time">${this.formatTime(new Date())}</div>
                    </div>
                </div>
            `;
        }
        
        // Обновляем активный элемент в списке
        document.querySelectorAll('.listener-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-listener-id="${listenerId}"]`).classList.add('active');
    }

    sendListenerMessage() {
        const input = document.getElementById('listenerMessageInputField');
        if (!input || !input.value.trim() || !this.currentListenerChat) return;
        
        const message = input.value.trim();
        const messagesContainer = document.getElementById('listenerChatMessages');
        
        // Добавляем сообщение в интерфейс
        if (messagesContainer) {
            const messageElement = document.createElement('div');
            messageElement.className = 'message message-outgoing';
            messageElement.innerHTML = `
                <div class="message-content">
                    ${message}
                    <div class="message-time">${this.formatTime(new Date())}</div>
                </div>
            `;
            messagesContainer.appendChild(messageElement);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        
        // Отправляем через Socket.io если доступно
        if (this.socket && this.currentListenerChat) {
            this.socket.emit('send_message', {
                chatId: `listener_${this.currentListenerChat.id}`,
                message: message,
                sender: this.currentUser.username,
                timestamp: new Date().toISOString()
            });
        }
        
        // Очищаем поле ввода
        input.value = '';
    }

    handleNewMessage(data) {
        // Обработка новых сообщений через WebSocket
        if (data.chatId === this.currentChatId) {
            this.addMessageToChat(data);
        }
    }

    addMessageToChat(messageData) {
        const messagesContainer = document.getElementById('listenerChatMessages');
        if (!messagesContainer) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${messageData.sender === this.currentUser.username ? 'message-outgoing' : 'message-incoming'}`;
        messageElement.innerHTML = `
            <div class="message-content">
                ${messageData.message}
                <div class="message-time">${this.formatTime(messageData.timestamp)}</div>
            </div>
        `;
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    openChat(chatId) {
        this.currentChatId = chatId;
        // Здесь можно добавить логику открытия конкретного чата
        this.showNotification(`Открыт чат #${chatId}`, 'info');
    }

    updateUserOnlineStatus(userId, isOnline) {
        const userElement = document.querySelector(`[data-user-id="${userId}"]`);
        if (userElement) {
            const statusElement = userElement.querySelector('.user-status');
            if (statusElement) {
                statusElement.className = `user-status ${isOnline ? 'status-online' : 'status-offline'}`;
                statusElement.innerHTML = `<span class="status-dot"></span><span>${isOnline ? 'Онлайн' : 'Оффлайн'}</span>`;
            }
        }
    }

    handleChatAccepted(data) {
        this.showNotification(`Чат #${data.chatId} был принят`, 'success');
        this.loadUserChats();
    }

    // Вспомогательные методы
    formatTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    showNotification(message, type = 'info') {
        // Создаем уведомление
        const notification = document.createElement('div');
        notification.className = `toast-notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Удаляем через 5 секунд
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    showError(message) {
        this.showNotification(message, 'error');
    }
}

// Инициализация когда DOM загружен
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM загружен, инициализация интерфейса слушателя');
    window.listenerInterface = new ListenerInterface();
});
