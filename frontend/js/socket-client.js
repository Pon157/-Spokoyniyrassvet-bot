class SocketClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 3000;
        this.messageQueue = [];
        this.eventCallbacks = new Map();
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
                console.error('❌ Socket.io не загружен');
                setTimeout(() => this.connect(), 3000);
                return;
            }

            console.log('🔄 Подключение к WebSocket...');
            
            // Используем тот же origin что и для HTTP запросов
            const serverUrl = window.location.origin;
            
            this.socket = io(serverUrl, {
                auth: { 
                    token: token 
                },
                transports: ['websocket', 'polling'],
                timeout: 10000,
                reconnectionAttempts: 3,
                reconnectionDelay: 1000
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
            this.emit('connect');
            this.processMessageQueue();
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ WebSocket отключен:', reason);
            this.isConnected = false;
            this.emit('disconnect', reason);
            
            if (reason === 'io server disconnect') {
                this.socket.connect();
            } else {
                this.attemptReconnect();
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ Ошибка подключения WebSocket:', error);
            this.emit('connection_error', error);
            this.attemptReconnect();
        });

        this.socket.on('authenticated', (data) => {
            console.log('✅ WebSocket аутентифицирован');
            this.emit('authenticated', data);
        });

        this.socket.on('auth_error', (error) => {
            console.error('❌ Ошибка аутентификации WebSocket:', error);
            this.emit('auth_error', error);
        });

        // Основные события чата
        this.socket.on('new_message', (message) => {
            this.emit('new_message', message);
        });

        this.socket.on('user_typing', (data) => {
            this.emit('user_typing', data);
        });

        this.socket.on('user_status_changed', (data) => {
            this.emit('user_status_changed', data);
        });

        this.socket.on('notification', (notification) => {
            this.emit('notification', notification);
        });

        this.socket.on('chat_updated', (data) => {
            this.emit('chat_updated', data);
        });

        // События для слушателей
        this.socket.on('active_listeners_list', (listeners) => {
            this.emit('active_listeners_list', listeners);
        });

        this.socket.on('new_chat_request', (data) => {
            this.emit('new_chat_request', data);
        });

        this.socket.on('chat_accepted', (data) => {
            this.emit('chat_accepted', data);
        });

        this.socket.on('chat_created', (data) => {
            this.emit('chat_created', data);
        });

        this.socket.on('listener_online', (listener) => {
            this.emit('listener_online', listener);
        });

        this.socket.on('listener_offline', (data) => {
            this.emit('listener_offline', data);
        });

        this.socket.on('error', (error) => {
            console.error('WebSocket ошибка:', error);
            this.emit('error', error);
        });
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
            
            setTimeout(() => {
                if (this.socket) {
                    this.socket.connect();
                } else {
                    this.connect();
                }
            }, this.reconnectInterval * this.reconnectAttempts);
        } else {
            console.error('❌ Превышено максимальное количество попыток переподключения');
            this.emit('reconnect_failed');
        }
    }

    processMessageQueue() {
        while (this.messageQueue.length > 0 && this.isConnected) {
            const message = this.messageQueue.shift();
            this.sendMessageDirect(message);
        }
    }

    // Методы для отправки событий
    sendMessage(chatId, content, messageType = 'text') {
        const message = {
            chat_id: chatId,
            content: content,
            message_type: messageType
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
            this.emit('error', error);
            return false;
        }
    }

    joinChat(chatId) {
        if (this.isConnected) {
            this.socket.emit('join_chat', chatId);
            return true;
        }
        return false;
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

    // Методы для работы со слушателями
    getActiveListeners() {
        if (this.isConnected) {
            this.socket.emit('get_active_listeners');
            return true;
        }
        return false;
    }

    startChatWithListener(listenerId) {
        if (this.isConnected) {
            this.socket.emit('start_chat_with_listener', { 
                listener_id: listenerId 
            });
            return true;
        }
        return false;
    }

    acceptChatRequest(chatId) {
        if (this.isConnected) {
            this.socket.emit('listener_accept_chat', { chat_id: chatId });
            return true;
        }
        return false;
    }

    // Система обработки событий
    on(event, callback) {
        if (!this.eventCallbacks.has(event)) {
            this.eventCallbacks.set(event, []);
        }
        this.eventCallbacks.get(event).push(callback);
    }

    off(event, callback) {
        if (this.eventCallbacks.has(event)) {
            const callbacks = this.eventCallbacks.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.eventCallbacks.has(event)) {
            this.eventCallbacks.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Ошибка в обработчике события ${event}:`, error);
                }
            });
        }
    }

    // Утилиты
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
