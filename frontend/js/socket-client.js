class SocketClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
    }

    connect(token) {
        try {
            // Явно указываем URL для Timeweb
            const serverUrl = 'https://pon157-git--f288.twc1.net';
            
            console.log('Connecting to:', serverUrl); // ДЛЯ ОТЛАДКИ
            
            this.socket = io(serverUrl, {
                auth: {
                    token: token
                },
                transports: ['websocket', 'polling']
            });

            this.setupEventHandlers();
        } catch (error) {
            console.error('Socket connection error:', error);
        }
    }

    setupEventHandlers() {
        this.socket.on('connect', () => {
            console.log('✅ Connected to server');
            this.isConnected = true;
            this.onConnect && this.onConnect();
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ Disconnected from server:', reason);
            this.isConnected = false;
            this.onDisconnect && this.onDisconnect(reason);
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.isConnected = false;
            this.onConnectError && this.onConnectError(error);
        });

        this.socket.on('new-message', (message) => {
            this.onNewMessage && this.onNewMessage(message);
        });

        this.socket.on('chat-created', (data) => {
            this.onChatCreated && this.onChatCreated(data);
        });

        this.socket.on('messages-history', (messages) => {
            this.onMessagesHistory && this.onMessagesHistory(messages);
        });

        this.socket.on('error', (data) => {
            this.onError && this.onError(data);
        });
    }

    // Методы для отправки событий
    createChat(listenerId) {
        this.socket.emit('create-chat', { listenerId });
    }

    sendMessage(chatId, content, type = 'text', mediaUrl = null) {
        this.socket.emit('send-message', {
            chatId,
            content,
            type,
            mediaUrl
        });
    }

    joinChat(chatId) {
        this.socket.emit('join-chat', chatId);
    }

    leaveChat(chatId) {
        this.socket.emit('leave-chat', chatId);
    }

    getMessages(chatId) {
        this.socket.emit('get-messages', chatId);
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }

    // Callbacks
    set onConnect(callback) {
        this._onConnect = callback;
    }

    set onDisconnect(callback) {
        this._onDisconnect = callback;
    }

    set onConnectError(callback) {
        this._onConnectError = callback;
    }

    set onNewMessage(callback) {
        this._onNewMessage = callback;
    }

    set onChatCreated(callback) {
        this._onChatCreated = callback;
    }

    set onMessagesHistory(callback) {
        this._onMessagesHistory = callback;
    }

    set onError(callback) {
        this._onError = callback;
    }
}

// Глобальный экземпляр
window.socketClient = new SocketClient();
