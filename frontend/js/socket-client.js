class SocketClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 3000;
    }

    connect(token) {
        try {
            this.socket = io({
                auth: {
                    token: token
                },
                transports: ['websocket', 'polling']
            });

            this.setupEventHandlers();
        } catch (error) {
            console.error('Ошибка подключения WebSocket:', error);
            this.handleConnectionError();
        }
    }

    setupEventHandlers() {
        this.socket.on('connect', () => {
            console.log('✅ WebSocket подключен');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.onConnect();
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ WebSocket отключен:', reason);
            this.isConnected = false;
            this.onDisconnect(reason);
            
            if (reason === 'io server disconnect') {
                // Сервер принудительно отключил, нужно переподключиться
                this.socket.connect();
            } else {
                // Обычное отключение, пытаемся переподключиться
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

        this.socket.on('error', (error) => {
            console.error('WebSocket ошибка:', error);
            this.onError(error);
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

    // Методы для отправки событий
    sendMessage(chatId, content, messageType = 'text', mediaUrl = null, stickerUrl = null) {
        if (!this.isConnected) {
            this.onError(new Error('Нет подключения к серверу'));
            return false;
        }

        try {
            this.socket.emit('send_message', {
                chat_id: chatId,
                content: content,
                message_type: messageType,
                media_url: mediaUrl,
                sticker_url: stickerUrl
            });
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

    // Колбэки (должны быть переопределены в основном приложении)
    onConnect() {
        console.log('WebSocket connected');
    }

    onDisconnect(reason) {
        console.log('WebSocket disconnected:', reason);
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

    onError(error) {
        console.error('WebSocket error:', error);
    }

    onConnectionError() {
        console.error('WebSocket connection error');
    }

    onReconnectFailed() {
        console.error('WebSocket reconnect failed');
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
    }
}

// Глобальный экземпляр клиента WebSocket
const socketClient = new SocketClient();
