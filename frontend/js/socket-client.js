class SocketClient {
    constructor(chatManager) {
        this.chatManager = chatManager;
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.init();
    }

    init() {
        this.connect();
    }

    connect() {
        try {
            this.socket = io('http://spokoyniyrassvet.webtm.ru', {
                transports: ['websocket', 'polling']
            });

            this.setupEventListeners();
            this.chatManager.socket = this.socket;

        } catch (error) {
            console.error('Socket connection error:', error);
            this.handleReconnect();
        }
    }

    setupEventListeners() {
        this.socket.on('connect', () => {
            console.log('✅ WebSocket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.authenticate();
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ WebSocket disconnected:', reason);
            this.isConnected = false;
            this.handleReconnect();
        });

        this.socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            this.isConnected = false;
        });

        this.socket.on('authenticated', (userData) => {
            console.log('🔑 Socket authenticated for user:', userData.username);
            this.chatManager.currentUser = userData;
        });

        this.socket.on('auth_error', (error) => {
            console.error('Socket auth error:', error);
            this.chatManager.showMessage('Ошибка аутентификации', 'error');
        });

        this.socket.on('new_message', (message) => {
            this.handleNewMessage(message);
        });

        this.socket.on('user_typing', (data) => {
            this.handleUserTyping(data);
        });

        this.socket.on('user_stop_typing', (data) => {
            this.handleUserStopTyping(data);
        });

        this.socket.on('user_status_change', (data) => {
            this.handleUserStatusChange(data);
        });

        this.socket.on('new_notification', (notification) => {
            this.handleNewNotification(notification);
        });

        this.socket.on('system_message', (message) => {
            this.handleSystemMessage(message);
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.chatManager.showMessage('Ошибка соединения', 'error');
        });
    }

    authenticate() {
        const token = localStorage.getItem('token');
        if (token) {
            this.socket.emit('authenticate', token);
        }
    }

    handleNewMessage(message) {
        // Проверяем, что сообщение относится к текущему чату
        if (this.chatManager.currentChat && message.chat_id === this.chatManager.currentChat.id) {
            const messagesContainer = document.getElementById('messagesContainer');
            const messageElement = this.chatManager.createMessageElement(message);
            messagesContainer.appendChild(messageElement);
            this.chatManager.scrollToBottom();
        }
        
        // Обновляем список чатов если нужно
        this.updateChatsList();
    }

    handleUserTyping(data) {
        if (this.chatManager.currentChat && data.chatId === this.chatManager.currentChat.id) {
            const typingIndicator = document.getElementById('typingIndicator');
            const typingUser = document.getElementById('typingUser');
            
            typingUser.textContent = data.username;
            typingIndicator.style.display = 'block';
        }
    }

    handleUserStopTyping(data) {
        if (this.chatManager.currentChat && data.chatId === this.chatManager.currentChat.id) {
            document.getElementById('typingIndicator').style.display = 'none';
        }
    }

    handleUserStatusChange(data) {
        // Обновляем статус пользователя в интерфейсе
        this.updateUserStatus(data.userId, data.isOnline);
        
        // Обновляем список активных пользователей
        if (this.chatManager.currentUser.role === 'user') {
            this.chatManager.loadAvailableListeners();
        }
        this.chatManager.loadActiveUsers();
    }

    handleNewNotification(notification) {
        this.showNotification(notification);
    }

    handleSystemMessage(message) {
        this.chatManager.showMessage(message, 'info');
    }

    updateUserStatus(userId, isOnline) {
        // Находим элементы с этим пользователем и обновляем статус
        const userElements = document.querySelectorAll(`[data-user-id="${userId}"]`);
        userElements.forEach(element => {
            const statusElement = element.querySelector('.user-status');
            if (statusElement) {
                statusElement.className = isOnline ? 'status-online' : 'status-offline';
                statusElement.textContent = isOnline ? '● онлайн' : '● оффлайн';
            }
        });
    }

    updateChatsList() {
        // Здесь можно обновить список чатов при новом сообщении
        console.log('Updating chats list...');
    }

    showNotification(notification) {
        // Создаем уведомление в правом верхнем углу
        const notificationEl = document.createElement('div');
        notificationEl.className = `message ${notification.type}`;
        notificationEl.style.position = 'fixed';
        notificationEl.style.top = '20px';
        notificationEl.style.right = '20px';
        notificationEl.style.zIndex = '1001';
        notificationEl.innerHTML = `
            <strong>${notification.title}</strong>
            <p>${notification.message}</p>
        `;

        document.body.appendChild(notificationEl);

        // Автоматически скрываем через 5 секунд
        setTimeout(() => {
            notificationEl.remove();
        }, 5000);
    }

    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * this.reconnectAttempts, 10000);
            
            console.log(`🔄 Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
            
            setTimeout(() => {
                this.connect();
            }, delay);
        } else {
            console.error('❌ Max reconnection attempts reached');
            this.chatManager.showMessage('Потеряно соединение с сервером', 'error');
        }
    }

    // Публичные методы для отправки событий
    sendMessage(chatId, content, messageType = 'text', mediaUrl = null) {
        if (this.isConnected) {
            this.socket.emit('send_message', {
                chatId,
                content,
                messageType,
                mediaUrl
            });
        } else {
            console.error('Cannot send message: socket not connected');
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
            this.socket.emit('typing_start', { chatId });
        }
    }

    stopTyping(chatId) {
        if (this.isConnected) {
            this.socket.emit('typing_stop', { chatId });
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    // SocketClient будет инициализирован в chat.js
    console.log('Socket client module loaded');
});
