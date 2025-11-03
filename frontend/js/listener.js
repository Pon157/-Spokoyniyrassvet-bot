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
        this.socket = null;
        this.init();
    }

    init() {
        console.log('=== ИНИЦИАЛИЗАЦИЯ ИНТЕРФЕЙСА СЛУШАТЕЛЯ ===');
        
        try {
            this.checkAuth();
            this.bindEvents();
            this.loadUserData();
            this.setupSocketConnection();
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
        const onlineStatus = document.getElementById('onlineStatus');
        if (onlineStatus) {
            onlineStatus.addEventListener('click', () => {
                this.toggleOnlineStatus();
            });
        }

        // Уведомления
        const notificationsBtn = document.getElementById('notificationsBtn');
        if (notificationsBtn) {
            notificationsBtn.addEventListener('click', () => {
                this.toggleNotifications();
            });
        }

        const closeNotifications = document.getElementById('closeNotifications');
        if (closeNotifications) {
            closeNotifications.addEventListener('click', () => {
                this.hideNotifications();
            });
        }

        // Кнопки управления
        const refreshChats = document.getElementById('refreshChats');
        if (refreshChats) {
            refreshChats.addEventListener('click', () => {
                this.loadUserChats();
            });
        }

        const refreshListeners = document.getElementById('refreshListeners');
        if (refreshListeners) {
            refreshListeners.addEventListener('click', () => {
                this.loadOnlineListeners();
            });
        }

        // Сообщения
        const sendListenerMessage = document.getElementById('sendListenerMessage');
        if (sendListenerMessage) {
            sendListenerMessage.addEventListener('click', () => {
                this.sendListenerMessage();
            });
        }

        const listenerMessageText = document.getElementById('listenerMessageText');
        if (listenerMessageText) {
            listenerMessageText.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendListenerMessage();
                }
            });
        }

        // Выход
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }

        // Клик вне уведомлений
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('notificationsPanel');
            const btn = document.getElementById('notificationsBtn');
            if (panel && btn && !e.target.closest('.notifications-panel') && !e.target.closest('#notificationsBtn')) {
                this.hideNotifications();
            }
        });

        // Закрытие модальных окон
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal') || e.target.classList.contains('close-modal')) {
                this.closeModal();
            }
        });

        console.log('✅ Все события привязаны');
    }

    setupSocketConnection() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.warn('⚠️ Нет токена для WebSocket подключения');
                return;
            }

            // Ждем загрузки socket.io
            if (typeof io === 'undefined') {
                console.warn('⚠️ Socket.io не загружен, откладываем подключение');
                setTimeout(() => this.setupSocketConnection(), 2000);
                return;
            }

            console.log('🔄 Создаем WebSocket подключение...');
            this.socket = io({
                auth: { token },
                transports: ['websocket', 'polling']
            });
            
            this.setupSocketListeners();
            
        } catch (error) {
            console.error('❌ Ошибка подключения WebSocket:', error);
            // Продолжаем работу без WebSocket
            console.log('ℹ️ Продолжаем работу без WebSocket подключения');
        }
    }

    setupSocketListeners() {
        if (!this.socket) {
            console.warn('⚠️ WebSocket не инициализирован');
            return;
        }

        this.socket.on('connect', () => {
            console.log('✅ WebSocket подключен');
            this.updateConnectionStatus(true);
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ WebSocket отключен:', reason);
            this.updateConnectionStatus(false);
            
            // Автопереподключение
            if (reason === 'io server disconnect') {
                this.socket.connect();
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ Ошибка подключения WebSocket:', error);
            this.updateConnectionStatus(false);
        });

        this.socket.on('new_message', (data) => {
            this.handleNewMessage(data);
        });

        this.socket.on('new_notification', (data) => {
            this.handleNewNotification(data);
        });

        this.socket.on('listener_status_update', (data) => {
            this.handleListenerStatusUpdate(data);
        });

        this.socket.on('new_listener_message', (data) => {
            this.handleNewListenerMessage(data);
        });

        this.socket.on('chat_accepted', (data) => {
            this.handleChatAccepted(data);
        });

        this.socket.on('error', (error) => {
            console.error('❌ WebSocket ошибка:', error);
            this.showToast('Ошибка соединения');
        });
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('onlineStatus');
        if (statusElement) {
            if (connected) {
                statusElement.classList.remove('offline');
                const statusText = statusElement.querySelector('.status-text');
                if (statusText) statusText.textContent = 'Онлайн';
            } else {
                statusElement.classList.add('offline');
                const statusText = statusElement.querySelector('.status-text');
                if (statusText) statusText.textContent = 'Оффлайн';
            }
        }
    }

    async loadUserData() {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const userName = document.getElementById('userName');
            const userAvatar = document.getElementById('userAvatar');
            
            if (userName && user.username) {
                userName.textContent = user.username;
            }
            if (userAvatar) {
                userAvatar.src = user.avatar_url || '/images/default-avatar.svg';
                userAvatar.onerror = function() {
                    this.src = '/images/default-avatar.svg';
                };
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
        const activeNav = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeNav) activeNav.classList.add('active');

        // Показываем соответствующий контент
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        const activeTab = document.getElementById(tabName);
        if (activeTab) activeTab.classList.add('active');

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

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка обновления статуса');
            }

            const result = await response.json();
            
            // Отправляем статус через WebSocket
            if (this.socket) {
                this.socket.emit('listener_status', {
                    listenerId: this.getUserId(),
                    online: this.isOnline
                });
            }

            this.showToast(this.isOnline ? '✅ Вы теперь онлайн' : '🔕 Вы теперь оффлайн');
        } catch (error) {
            console.error('❌ Ошибка обновления статуса:', error);
            // Откатываем статус
            this.isOnline = !this.isOnline;
            this.updateStatusDisplay();
            this.showError(`Ошибка обновления статуса: ${error.message}`);
        }
    }

    updateStatusDisplay() {
        const statusElement = document.getElementById('onlineStatus');
        const userStatus = document.getElementById('userStatus');
        
        if (this.isOnline) {
            if (statusElement) {
                statusElement.classList.remove('offline');
                const statusText = statusElement.querySelector('.status-text');
                if (statusText) statusText.textContent = 'Онлайн';
            }
            if (userStatus) {
                userStatus.textContent = 'Онлайн';
                userStatus.className = 'user-status status-online';
            }
        } else {
            if (statusElement) {
                statusElement.classList.add('offline');
                const statusText = statusElement.querySelector('.status-text');
                if (statusText) statusText.textContent = 'Оффлайн';
            }
            if (userStatus) {
                userStatus.textContent = 'Оффлайн';
                userStatus.className = 'user-status status-offline';
            }
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

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка загрузки чатов');
            }

            const data = await response.json();
            this.currentChats = data.chats || [];
            this.renderUserChats(this.currentChats);
            this.updateChatsBadge();

        } catch (error) {
            console.error('❌ Ошибка загрузки чатов:', error);
            this.showError('chatsList', `Ошибка загрузки чатов: ${error.message}`);
        }
    }

    renderUserChats(chats) {
        const chatsList = document.getElementById('chatsList');
        if (!chatsList) return;
        
        if (!chats || chats.length === 0) {
            chatsList.innerHTML = this.getEmptyState(
                '💬 Нет активных чатов', 
                'Новые чаты появятся здесь, когда пользователи обратятся за помощью'
            );
            return;
        }

        chatsList.innerHTML = chats.map(chat => `
            <div class="chat-item ${chat.unread_count > 0 ? 'unread' : ''}" data-chat-id="${chat.id}">
                <div class="chat-avatar">
                    ${chat.user_avatar ? 
                        `<img src="${chat.user_avatar}" alt="${chat.user_name}" onerror="this.style.display='none'; this.parentElement.innerHTML=this.alt.charAt(0)">` : 
                        `<span>${(chat.user_name || 'П').charAt(0)}</span>`
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
                const chatId = item.dataset.chatId;
                this.openUserChat(chatId);
            });
        });
    }

    async openUserChat(chatId) {
        console.log('💬 Открытие чата с пользователем:', chatId);
        const chat = this.currentChats.find(c => c.id === chatId);
        if (!chat) {
            this.showToast('❌ Чат не найден');
            return;
        }

        // Открываем модальное окно чата
        this.openChatModal(chat);
    }

    openChatModal(chat) {
        // Закрываем предыдущее модальное окно если есть
        this.closeModal();

        // Создаем модальное окно для чата
        const modalHtml = `
            <div class="modal" id="chatModal">
                <div class="modal-content large">
                    <div class="modal-header">
                        <h3>💬 Чат с ${this.escapeHtml(chat.user_name)}</h3>
                        <button class="btn-icon close-modal">✕</button>
                    </div>
                    <div class="modal-body">
                        <div class="chat-interface">
                            <div class="chat-messages" id="modalChatMessages">
                                <div class="loading-state">
                                    <div class="loading-spinner"></div>
                                    <p>Загрузка сообщений...</p>
                                </div>
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
        
        // Загружаем историю сообщений
        this.loadChatHistory(chat.id, 'modalChatMessages');
        
        // Обработчики событий для модального окна
        const modal = document.getElementById('chatModal');
        if (!modal) return;

        const messageInput = modal.querySelector('#modalMessageText');
        const sendButton = modal.querySelector('#sendModalMessage');
        
        if (sendButton) {
            sendButton.addEventListener('click', () => {
                this.sendUserMessage(chat.id, messageInput);
            });
        }

        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendUserMessage(chat.id, messageInput);
                }
            });
        }

        // Фокусируемся на поле ввода
        setTimeout(() => {
            if (messageInput) messageInput.focus();
        }, 100);
    }

    closeModal() {
        const modal = document.getElementById('chatModal');
        if (modal) {
            modal.remove();
        }
    }

    async loadChatHistory(chatId, containerId) {
        try {
            const response = await fetch(`/api/chats/${chatId}/messages`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Ошибка загрузки сообщений');
            }

            const data = await response.json();
            this.renderChatMessages(data.messages, containerId);
            
            // Помечаем сообщения как прочитанные
            this.markMessagesAsRead(chatId);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки истории чата:', error);
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = this.getErrorState('Ошибка загрузки сообщений');
            }
        }
    }

    async markMessagesAsRead(chatId) {
        try {
            await fetch(`/api/chats/${chatId}/read`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            // Обновляем бейдж
            this.loadUserChats();
        } catch (error) {
            console.error('❌ Ошибка отметки сообщений как прочитанных:', error);
        }
    }

    renderChatMessages(messages, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (!messages || messages.length === 0) {
            container.innerHTML = this.getEmptyState('💭 Нет сообщений', 'Начните общение первым сообщением');
            return;
        }

        const userId = this.getUserId();
        container.innerHTML = messages.map(message => `
            <div class="message ${message.sender_id === userId ? 'message-outgoing' : 'message-incoming'}">
                <div class="message-content">${this.escapeHtml(message.content)}</div>
                <div class="message-time">${this.formatTime(message.created_at)}</div>
            </div>
        `).join('');

        // Прокручиваем вниз
        container.scrollTop = container.scrollHeight;
    }

    async sendUserMessage(chatId, inputElement) {
        if (!inputElement) return;
        
        const message = inputElement.value.trim();
        if (!message) {
            this.showToast('💭 Введите сообщение');
            return;
        }

        try {
            const response = await fetch(`/api/chats/${chatId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ content: message })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка отправки сообщения');
            }

            // Очищаем поле ввода
            inputElement.value = '';
            
            // Обновляем историю сообщений
            this.loadChatHistory(chatId, 'modalChatMessages');
            
            // Обновляем список чатов
            this.loadUserChats();
            
        } catch (error) {
            console.error('❌ Ошибка отправки сообщения:', error);
            this.showToast(`❌ Ошибка отправки: ${error.message}`);
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

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка загрузки слушателей');
            }

            const data = await response.json();
            this.onlineListeners = data.listeners || [];
            this.renderOnlineListeners(this.onlineListeners);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки слушателей:', error);
            this.showError('listenersList', `Ошибка загрузки слушателей: ${error.message}`);
        }
    }

    renderOnlineListeners(listeners) {
        const listenersList = document.getElementById('listenersList');
        if (!listenersList) return;
        
        if (!listeners || listeners.length === 0) {
            listenersList.innerHTML = this.getEmptyState(
                '👥 Нет онлайн слушателей',
                'Другие слушатели появятся здесь, когда будут онлайн'
            );
            return;
        }

        listenersList.innerHTML = listeners.map(listener => `
            <div class="listener-item ${this.selectedListener?.id === listener.id ? 'active' : ''}" 
                 data-listener-id="${listener.id}">
                <div class="listener-avatar">
                    ${listener.avatar ? 
                        `<img src="${listener.avatar}" alt="${listener.name}" onerror="this.style.display='none'; this.parentElement.innerHTML=this.alt.charAt(0)">` : 
                        `<span>${(listener.name || 'С').charAt(0)}</span>`
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
        
        if (!this.selectedListener) {
            this.showToast('❌ Слушатель не найден');
            return;
        }

        // Обновляем UI
        document.querySelectorAll('.listener-item').forEach(item => {
            item.classList.remove('active');
        });
        const selectedItem = document.querySelector(`[data-listener-id="${listenerId}"]`);
        if (selectedItem) selectedItem.classList.add('active');

        // Показываем поле ввода сообщения
        const messageInputContainer = document.getElementById('listenerMessageInput');
        if (messageInputContainer) messageInputContainer.classList.remove('hidden');
        
        // Загружаем историю сообщений
        this.loadListenerChatHistory(listenerId);
        
        // Фокусируемся на поле ввода
        setTimeout(() => {
            const messageInput = document.getElementById('listenerMessageText');
            if (messageInput) messageInput.focus();
        }, 100);
    }

    async loadListenerChatHistory(listenerId) {
        try {
            this.showLoading('listenerChatMessages');
            
            const response = await fetch(`/api/listener/chats/${listenerId}/messages`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Ошибка загрузки истории чата');
            }

            const data = await response.json();
            this.renderListenerChatMessages(data.messages);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки истории чата:', error);
            this.showError('listenerChatMessages', 'Ошибка загрузки сообщений');
        }
    }

    renderListenerChatMessages(messages) {
        const container = document.getElementById('listenerChatMessages');
        if (!container) return;
        
        if (!messages || messages.length === 0) {
            container.innerHTML = this.getEmptyState(
                '💭 Нет сообщений', 
                `Начните общение с ${this.selectedListener?.name || 'слушателем'}`
            );
            return;
        }

        const userId = this.getUserId();
        container.innerHTML = messages.map(message => `
            <div class="message ${message.sender_id === userId ? 'message-outgoing' : 'message-incoming'}">
                <div class="message-content">${this.escapeHtml(message.content)}</div>
                <div class="message-time">${this.formatTime(message.created_at)}</div>
            </div>
        `).join('');

        container.scrollTop = container.scrollHeight;
    }

    async sendListenerMessage() {
        const messageInput = document.getElementById('listenerMessageText');
        if (!messageInput) return;
        
        const message = messageInput.value.trim();
        
        if (!message) {
            this.showToast('💭 Введите сообщение');
            return;
        }

        if (!this.selectedListener) {
            this.showToast('👥 Выберите слушателя для общения');
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

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка отправки сообщения');
            }

            // Очищаем поле ввода
            messageInput.value = '';
            
            // Добавляем сообщение в UI
            this.addListenerMessageToUI({
                id: Date.now().toString(),
                content: message,
                sender_id: this.getUserId(),
                created_at: new Date().toISOString()
            });
            
            this.showToast('✅ Сообщение отправлено');
            
        } catch (error) {
            console.error('❌ Ошибка отправки сообщения:', error);
            this.showToast(`❌ Ошибка отправки: ${error.message}`);
        }
    }

    addListenerMessageToUI(message) {
        const container = document.getElementById('listenerChatMessages');
        if (!container) return;
        
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

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка загрузки отзывов');
            }

            const data = await response.json();
            this.renderReviews(data);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки отзывов:', error);
            this.showError('reviewsList', `Ошибка загрузки отзывов: ${error.message}`);
        }
    }

    renderReviews(data) {
        try {
            // Обновляем статистику
            const avgRating = document.getElementById('avgRating');
            const totalReviews = document.getElementById('totalReviews');
            
            if (avgRating) {
                avgRating.textContent = data.averageRating?.toFixed(1) || '0.0';
            }
            if (totalReviews) {
                totalReviews.textContent = data.totalReviews || data.reviews?.length || 0;
            }

            const reviewsList = document.getElementById('reviewsList');
            if (!reviewsList) return;
            
            if (!data.reviews || data.reviews.length === 0) {
                reviewsList.innerHTML = this.getEmptyState(
                    '⭐ Пока нет отзывов',
                    'Отзывы появятся здесь после завершения чатов с пользователями'
                );
                return;
            }

            reviewsList.innerHTML = data.reviews.map(review => `
                <div class="review-item">
                    <div class="review-header">
                        <span class="review-user">👤 ${this.escapeHtml(review.user_name || 'Пользователь')}</span>
                        <span class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5-review.rating)}</span>
                        <span class="review-date">${this.formatDate(review.created_at)}</span>
                    </div>
                    <div class="review-text">${this.escapeHtml(review.comment || 'Без комментария')}</div>
                </div>
            `).join('');
        } catch (error) {
            console.error('❌ Ошибка рендеринга отзывов:', error);
        }
    }

    async loadStatistics() {
        try {
            this.showLoading('statistics');
            
            const response = await fetch('/api/listener/statistics', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Ошибка загрузки статистики');
            }

            const stats = await response.json();
            this.renderStatistics(stats);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
            this.renderStatistics(this.getMockStatistics());
        }
    }

    renderStatistics(stats) {
        try {
            // Безопасно обновляем элементы
            const elements = {
                totalSessions: document.getElementById('totalSessions'),
                activeChats: document.getElementById('activeChats'),
                avgSessionTime: document.getElementById('avgSessionTime'),
                helpfulness: document.getElementById('helpfulness')
            };

            // Проверяем существование элементов перед обновлением
            if (elements.totalSessions) {
                elements.totalSessions.textContent = stats.totalSessions || 0;
            }
            if (elements.activeChats) {
                elements.activeChats.textContent = stats.activeChats || 0;
            }
            if (elements.avgSessionTime) {
                elements.avgSessionTime.textContent = stats.averageSessionTime || 0;
            }
            if (elements.helpfulness) {
                elements.helpfulness.textContent = `${stats.helpfulness || 0}%`;
            }

            // Рендерим график активности
            this.renderActivityChart(stats.weeklyActivity || {});
            
        } catch (error) {
            console.error('❌ Ошибка рендеринга статистики:', error);
        }
    }

    renderActivityChart(activityData) {
        const chartContainer = document.getElementById('activityChart');
        if (!chartContainer) {
            console.warn('⚠️ Контейнер графика не найден');
            return;
        }
        
        if (!activityData || Object.keys(activityData).length === 0) {
            chartContainer.innerHTML = this.getEmptyState('📊 Нет данных', 'Активность появится после работы с пользователями');
            return;
        }

        try {
            const days = Object.keys(activityData);
            const values = Object.values(activityData);
            const maxValue = Math.max(...values, 1);

            chartContainer.innerHTML = days.map((day, index) => {
                const value = values[index];
                const height = Math.max((value / maxValue) * 80, 10);
                const date = new Date(day);
                const label = `${date.getDate()}.${date.getMonth() + 1}`;
                
                return `
                    <div class="chart-bar" style="height: ${height}%" title="${label}: ${value} сессий">
                        <span class="chart-value">${value}</span>
                        <span class="chart-label">${label}</span>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('❌ Ошибка рендеринга графика:', error);
            chartContainer.innerHTML = this.getErrorState('Ошибка загрузки графика');
        }
    }

    toggleNotifications() {
        const panel = document.getElementById('notificationsPanel');
        if (panel) {
            panel.classList.toggle('hidden');
            
            if (!panel.classList.contains('hidden')) {
                this.loadNotifications();
                this.markNotificationsAsRead();
            }
        }
    }

    hideNotifications() {
        const panel = document.getElementById('notificationsPanel');
        if (panel) panel.classList.add('hidden');
    }

    async loadNotifications() {
        try {
            const response = await fetch('/api/listener/notifications', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.notifications = data.notifications || [];
                this.renderNotifications();
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки уведомлений:', error);
        }
    }

    async markNotificationsAsRead() {
        try {
            await fetch('/api/notifications/read', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            // Скрываем бейдж
            const badge = document.getElementById('notificationBadge');
            if (badge) badge.classList.add('hidden');
            
        } catch (error) {
            console.error('❌ Ошибка отметки уведомлений:', error);
        }
    }

    // WebSocket обработчики
    handleNewMessage(data) {
        console.log('📨 Новое сообщение:', data);
        this.loadUserChats();
        this.showNotification(`💬 Новое сообщение от пользователя`, 'message');
    }

    handleNewNotification(notification) {
        console.log('🔔 Новое уведомление:', notification);
        this.notifications.unshift(notification);
        this.updateNotificationsBadge();
        this.renderNotifications();
        this.showToast(notification.message);
    }

    handleListenerStatusUpdate(data) {
        console.log('🔄 Обновление статуса слушателя:', data);
        if (this.currentTab === 'listener-chat') {
            this.loadOnlineListeners();
        }
    }

    handleNewListenerMessage(data) {
        console.log('💬 Новое сообщение от слушателя:', data);
        if (this.selectedListener && data.sender_id === this.selectedListener.id) {
            this.addListenerMessageToUI(data);
        }
    }

    handleChatAccepted(data) {
        console.log('✅ Чат принят:', data);
        this.loadUserChats();
        this.showToast('✅ Чат успешно принят');
    }

    updateNotificationsBadge() {
        const unreadCount = this.notifications.filter(n => !n.read).length;
        const badge = document.getElementById('notificationBadge');
        
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    }

    updateChatsBadge() {
        const unreadCount = this.currentChats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);
        const badge = document.getElementById('userChatsBadge');
        
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    }

    renderNotifications() {
        const list = document.getElementById('notificationsList');
        if (!list) return;
        
        if (this.notifications.length === 0) {
            list.innerHTML = this.getEmptyState('🔕 Нет уведомлений');
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
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Загрузка...</p>
                </div>
            `;
        }
    }

    showError(containerId, message = 'Произошла ошибка') {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = this.getErrorState(message);
        }
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
                <p>❌ ${message}</p>
                <button class="btn-secondary" onclick="location.reload()">🔄 Обновить</button>
            </div>
        `;
    }

    showToast(message) {
        // Удаляем предыдущие тосты
        document.querySelectorAll('.toast-notification').forEach(toast => toast.remove());
        
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 4000);
    }

    showNotification(message, type = 'info') {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Спокойный рассвет', {
                body: message,
                icon: '/images/icon.png',
                badge: '/images/badge.png'
            });
        }
        
        // Также показываем toast
        this.showToast(message);
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
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatTime(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } catch (error) {
            return '';
        }
    }

    formatDate(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ru-RU');
        } catch (error) {
            return '';
        }
    }

    loadInitialData() {
        try {
            // Загружаем данные для активного таба
            this.loadUserChats();
            
            // Предзагружаем остальные данные с задержкой
            setTimeout(() => {
                try {
                    this.loadReviews();
                    this.loadStatistics();
                } catch (error) {
                    console.error('❌ Ошибка предзагрузки данных:', error);
                }
            }, 1000);
            
            // Запрашиваем разрешение на уведомления
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission().then(permission => {
                    console.log('🔔 Разрешение на уведомления:', permission);
                });
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки начальных данных:', error);
        }
    }

    logout() {
        if (this.socket) {
            this.socket.disconnect();
        }
        
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM загружен, инициализация интерфейса слушателя');
    
    // Проверяем поддержку Service Worker для PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('✅ Service Worker зарегистрирован'))
            .catch(error => console.log('❌ Ошибка регистрации Service Worker:', error));
    }
    
    window.listenerApp = new ListenerInterface();
});
