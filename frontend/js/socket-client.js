class SocketClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.init();
    }

    init() {
        console.log('🔌 Инициализация SocketClient');
        
        if (typeof io === 'undefined') {
            console.error('❌ Socket.io не загружен');
            setTimeout(() => this.init(), 3000);
            return;
        }
        
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

            console.log('🔄 Подключение к WebSocket...');
            this.socket = io({
                auth: { token },
                transports: ['websocket', 'polling']
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
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ WebSocket отключен:', reason);
            this.isConnected = false;
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ Ошибка подключения WebSocket:', error);
        });
    }

    sendMessage(chatId, content) {
        if (!this.isConnected) {
            console.log('❌ WebSocket не подключен');
            return false;
        }

        try {
            this.socket.emit('send_message', {
                chat_id: chatId,
                content: content,
                message_type: 'text'
            });
            return true;
        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
            return false;
        }
    }

    joinChat(chatId) {
        if (this.isConnected) {
            this.socket.emit('join_chat', chatId);
        }
    }
}

// Глобальный экземпляр
window.socketClient = new SocketClient();
