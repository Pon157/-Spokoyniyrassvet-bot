class SocketClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 3000;
        this.messageQueue = [];
        this.init();
    }

    init() {
        console.log('🔌 Инициализация SocketClient');
        this.connect();
    }

    connect() {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                console.warn('⚠️ Нет токена для WebSocket подключения');
                setTimeout(() => this.connect(), 5000);
                return;
            }

            if (typeof io === 'undefined') {
                console.warn('⚠️ Socket.io не загружен');
                setTimeout(() => this.connect(), 3000);
                return;
            }

            console.log('🔄 Подключение к WebSocket...');
            this.socket = io({
                auth: { token },
                transports: ['websocket', 'polling'],
                timeout: 10000
            });

            this.setupEventHandlers();
        } catch (error) {
            console.error('❌ Ошибка подключения WebSocket:', error);
            setTimeout(() => this.connect(), 5000);
        }
    }

    setupEventHandlers() {
        this.socket.on('connect', () => {
            console.log('✅ WebSocket подключен');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.onConnect();
            this.processMessageQueue();
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ WebSocket отключен:', reason);
            this.isConnected = false;
            this.onDisconnect(reason);
            
            if (reason === 'io server disconnect') {
                this.socket.connect();
            } else {
                this.attemptReconnect();
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ Ошибка подключения WebSocket:', error);
            this.handleConnectionError();
        });

        this.socket.on('new_message', (message) => {
            this.onNewMessage(message);
        });

        this.socket.on('user_typing', (data) => {
            this.onUserTyping(data);
        });

        this.socket.on('user_status_changed', (data) => {
            this.onUserStatusChanged(data);
        });

        this.socket.on('notification', (notification) => {
            this.onNotification(notification);
        });

        this.socket.on('chat_updated', (data) => {
            this.onChatUpdated(data);
        });

        this.socket.on('user_banned', (data) => {
            this.onUserBanned(data);
        });

        this.socket.on('error', (error) => {
            console.error('WebSocket ошибка:', error);
            this.onError(error);
        });

        this.socket.on('authenticated', (data) => {
            console.log('✅ WebSocket аутентифицирован');
            this.onAuthenticated(data);
        });

        this.socket.on('auth_error', (error) => {
            console.error('❌ Ошибка аутентификации WebSocket:', error);
            this.onAuthError(error);
        });

        // Новые события для слушателей
        this.socket.on('active_listeners_list', (listeners) => {
            this.onActiveListenersList(listeners);
        });

        this.socket.on('new_chat_request', (data) => {
            this.onNewChatRequest(data);
        });

        this.socket.on('chat_accepted', (data) => {
            this.onChatAccepted(data);
        });

        this.socket.on('chat_created', (data) => {
            this.onChatCreated(data);
        });

        this.socket.on('listener_online', (listener) => {
            this.onListenerOnline(listener);
        });

        this.socket.on('listener_offline', (data) => {
            this.onListenerOffline(data);
        });

        this.socket.on('listener_availability_changed', (data) => {
            this.onListenerAvailabilityChanged(data);
        });
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
            
            setTimeout(() => {
                if (this.socket) {
                    this.socket.connect();
                }
            }, this.reconnectInterval * this.reconnectAttempts);
        } else {
            console.error('❌ Превышено максимальное количество попыток переподключения');
            this.onReconnectFailed();
        }
    }

    handleConnectionError() {
        this.isConnected = false;
        this.onConnectionError();
    }

    processMessageQueue() {
        while (this.messageQueue.length > 0 && this.isConnected) {
            const message = this.messageQueue.shift();
            this.sendMessageDirect(message);
        }
    }

    sendMessage(chatId, content, messageType = 'text', mediaUrl = null, stickerUrl = null) {
        const message = {
            chat_id: chatId,
            content: content,
            message_type: messageType,
            media_url: mediaUrl,
            sticker_url: stickerUrl
        };

        if (!this.isConnected) {
            console.log('💾 Сообщение добавлено в очередь (нет подключения)');
            this.messageQueue.push(message);
            return false;
        }

        return this.sendMessageDirect(message);
    }

    sendMessageDirect(message) {
        try {
            this.socket.emit('send_message', message);
            return true;
        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
            this.onError(error);
            return false;
        }
    }

    joinChat(chatId) {
        if (this.isConnected) {
            this.socket.emit('join_chat', chatId);
        } else {
            console.log('❌ Нет подключения для присоединения к чату');
        }
    }

    leaveChat(chatId) {
        if (this.isConnected) {
            this.socket.emit('leave_chat', chatId);
        }
    }

    startTyping(chatId) {
        if (this.isConnected) {
            this.socket.emit('typing_start', { chat_id: chatId });
        }
    }

    stopTyping(chatId) {
        if (this.isConnected) {
            this.socket.emit('typing_stop', { chat_id: chatId });
        }
    }

    requestUserStatus(userId) {
        if (this.isConnected) {
            this.socket.emit('get_user_status', { user_id: userId });
        }
    }

    reportMessage(messageId, reason) {
        if (this.isConnected) {
            this.socket.emit('report_message', {
                message_id: messageId,
                reason: reason
            });
        }
    }

    // Методы для работы со слушателями
    getActiveListeners() {
        if (this.isConnected) {
            this.socket.emit('get_active_listeners');
        }
    }

    startChatWithListener(listenerId) {
        if (this.isConnected) {
            this.socket.emit('start_chat_with_listener', { 
                listener_id: listenerId 
            });
        }
    }

    acceptChatRequest(chatId) {
        if (this.isConnected) {
            this.socket.emit('listener_accept_chat', { chat_id: chatId });
        }
    }

    updateListenerAvailability(isAvailable) {
        if (this.isConnected) {
            this.socket.emit('update_listener_availability', { 
                is_available: isAvailable 
            });
        }
    }

    // Колбэки (должны быть переопределены в основном приложении)
    onConnect() {
        console.log('WebSocket connected');
    }

    onDisconnect(reason) {
        console.log('WebSocket disconnected:', reason);
    }

    onAuthenticated(data) {
        console.log('WebSocket authenticated:', data);
    }

    onAuthError(error) {
        console.error('WebSocket auth error:', error);
    }

    onNewMessage(message) {
        console.log('New message:', message);
    }

    onUserTyping(data) {
        console.log('User typing:', data);
    }

    onUserStatusChanged(data) {
        console.log('User status changed:', data);
    }

    onNotification(notification) {
        console.log('New notification:', notification);
    }

    onChatUpdated(data) {
        console.log('Chat updated:', data);
    }

    onUserBanned(data) {
        console.log('User banned:', data);
    }

    onError(error) {
        console.error('WebSocket error:', error);
    }

    onConnectionError() {
        console.error('WebSocket connection error');
    }

    onReconnectFailed() {
        console.error('WebSocket reconnect failed');
    }

    // Новые колбэки для слушателей
    onActiveListenersList(listeners) {
        console.log('Active listeners list:', listeners);
    }

    onNewChatRequest(data) {
        console.log('New chat request:', data);
    }

    onChatAccepted(data) {
        console.log('Chat accepted:', data);
    }

    onChatCreated(data) {
        console.log('Chat created:', data);
    }

    onListenerOnline(listener) {
        console.log('Listener online:', listener);
    }

    onListenerOffline(data) {
        console.log('Listener offline:', data);
    }

    onListenerAvailabilityChanged(data) {
        console.log('Listener availability changed:', data);
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
    }

    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            queueLength: this.messageQueue.length
        };
    }
}

// Глобальный экземпляр клиента WebSocket
window.socketClient = new SocketClient();
