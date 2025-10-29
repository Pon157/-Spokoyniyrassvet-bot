class ChatApp {
    constructor() {
        this.currentUser = null;
        this.currentChat = null;
        this.socket = null;
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.loadUserData();
        this.setupEventListeners();
        this.initializeSocket();
        this.loadInterfaceData();
    }

    async checkAuth() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        
        if (!token || !user) {
            window.location.href = '/';
            return;
        }
        
        this.currentUser = JSON.parse(user);
    }

    loadUserData() {
        document.getElementById('userName').textContent = this.currentUser.username;
        document.getElementById('userRole').textContent = this.getRoleDisplayName(this.currentUser.role);
        
        if (this.currentUser.avatar) {
            document.getElementById('userAvatar').src = this.currentUser.avatar;
        } else {
            document.getElementById('userAvatar').src = '/images/default-avatar.png';
        }

        // Показать соответствующие секции в зависимости от роли
        this.showRoleSpecificSections();
    }

    getRoleDisplayName(role) {
        const roleNames = {
            'user': 'Пользователь',
            'listener': 'Слушатель',
            'admin': 'Администратор',
            'coowner': 'Совладелец',
            'owner': 'Владелец'
        };
        return roleNames[role] || role;
    }

    showRoleSpecificSections() {
        const userSection = document.getElementById('userSection');
        const listenerSection = document.getElementById('listenerSection');
        
        if (this.currentUser.role === 'user') {
            userSection.classList.remove('hidden');
            this.loadListeners();
        } else if (this.currentUser.role === 'listener') {
            listenerSection.classList.remove('hidden');
            this.loadListenerData();
        }
        
        this.loadUserChats();
    }

    setupEventListeners() {
        // Навигация
        document.getElementById('settingsBtn').addEventListener('click', () => {
            window.location.href = '/settings';
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Отправка сообщений
        document.getElementById('sendBtn').addEventListener('click', () => {
            this.sendMessage();
        });

        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // Медиа
        document.getElementById('mediaBtn').addEventListener('click', () => {
            document.getElementById('mediaInput').click();
        });

        document.getElementById('stickerBtn').addEventListener('click', () => {
            document.getElementById('stickerInput').click();
        });

        document.getElementById('mediaInput').addEventListener('change', (e) => {
            this.handleMediaUpload(e.target.files[0]);
        });

        document.getElementById('stickerInput').addEventListener('change', (e) => {
            this.handleStickerUpload(e.target.files[0]);
        });

        // Отзывы
        document.getElementById('addReviewBtn').addEventListener('click', () => {
            this.showReviewModal();
        });

        document.getElementById('cancelReview').addEventListener('click', () => {
            this.hideReviewModal();
        });

        document.getElementById('reviewForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitReview();
        });

        // Рейтинг
        document.querySelectorAll('.star').forEach(star => {
            star.addEventListener('click', () => {
                this.setRating(star.dataset.rating);
            });
        });

        // Покидание чата
        document.getElementById('leaveChatBtn').addEventListener('click', () => {
            this.leaveCurrentChat();
        });
    }

    initializeSocket() {
        const token = localStorage.getItem('token');
        
        // Автоматическое определение URL для production/development
        const serverUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000' 
            : window.location.origin;
        
        this.socket = io(serverUrl, {
            auth: {
                token: token
            },
            transports: ['websocket', 'polling']
        });

        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.enableChatInput();
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.disableChatInput();
        });

        this.socket.on('new-message', (message) => {
            this.displayMessage(message);
        });

        this.socket.on('chat-created', (data) => {
            this.joinChat(data.chatId);
        });

        this.socket.on('error', (data) => {
            this.showNotification(data.message, 'error');
        });

        this.socket.on('messages-history', (messages) => {
            this.displayMessagesHistory(messages);
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.showNotification('Ошибка подключения к серверу', 'error');
        });
    }

    enableChatInput() {
        document.getElementById('messageInput').disabled = false;
        document.getElementById('sendBtn').disabled = false;
        document.getElementById('messageInput').placeholder = 'Введите сообщение...';
    }

    disableChatInput() {
        document.getElementById('messageInput').disabled = true;
        document.getElementById('sendBtn').disabled = true;
        document.getElementById('messageInput').placeholder = 'Подключение...';
    }

    async loadListeners() {
        try {
            const response = await fetch('/api/user/listeners', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load listeners');
            }
            
            const listeners = await response.json();
            this.displayListeners(listeners);
        } catch (error) {
            console.error('Error loading listeners:', error);
            this.showNotification('Ошибка загрузки слушателей', 'error');
        }
    }

    displayListeners(listeners) {
        const container = document.getElementById('listenersList');
        container.innerHTML = '';

        if (listeners.length === 0) {
            container.innerHTML = '<div class="list-item">Нет доступных слушателей</div>';
            return;
        }

        listeners.forEach(listener => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <img src="${listener.avatar || '/images/default-avatar.png'}" alt="Avatar" class="avatar" onerror="this.src='/images/default-avatar.png'">
                <div>
                    <div class="listener-name">${listener.username}</div>
                    <small class="listener-status">${listener.lastSeen ? this.formatLastSeen(listener.lastSeen) : 'Не в сети'}</small>
                </div>
            `;
            
            item.addEventListener('click', () => {
                this.createChatWithListener(listener._id);
            });
            
            container.appendChild(item);
        });
    }

    async createChatWithListener(listenerId) {
        if (!this.socket || !this.socket.connected) {
            this.showNotification('Нет подключения к серверу', 'error');
            return;
        }

        this.socket.emit('create-chat', { listenerId });
        this.showNotification('Создание чата...', 'info');
    }

    joinChat(chatId) {
        if (this.currentChat) {
            this.socket.emit('leave-chat', this.currentChat);
        }
        
        this.currentChat = chatId;
        this.socket.emit('join-chat', chatId);
        this.socket.emit('get-messages', chatId);
        
        this.updateChatInterface();
        this.showNotification('Чат подключен', 'success');
    }

    leaveCurrentChat() {
        if (this.currentChat) {
            this.socket.emit('leave-chat', this.currentChat);
            this.currentChat = null;
        }
        
        this.resetChatInterface();
        this.showNotification('Чат покинут', 'info');
    }

    updateChatInterface() {
        document.getElementById('leaveChatBtn').classList.remove('hidden');
        document.getElementById('chatWith').textContent = 'Активный чат';
        
        if (this.currentUser.role === 'user') {
            document.getElementById('addReviewBtn').classList.remove('hidden');
        }
    }

    resetChatInterface() {
        document.getElementById('leaveChatBtn').classList.add('hidden');
        document.getElementById('addReviewBtn').classList.add('hidden');
        document.getElementById('chatWith').textContent = 'Выберите чат';
        document.getElementById('messagesList').innerHTML = '';
    }

    sendMessage() {
        const input = document.getElementById('messageInput');
        const content = input.value.trim();
        
        if (!content || !this.currentChat) {
            this.showNotification('Введите сообщение', 'warning');
            return;
        }

        if (!this.socket || !this.socket.connected) {
            this.showNotification('Нет подключения к серверу', 'error');
            return;
        }

        this.socket.emit('send-message', {
            chatId: this.currentChat,
            content: content,
            type: 'text'
        });

        input.value = '';
    }

    displayMessage(message) {
        const container = document.getElementById('messagesList');
        const messageEl = document.createElement('div');
        
        const isOwn = message.senderId._id === this.currentUser.id;
        messageEl.className = `message-item ${isOwn ? 'own' : 'other'}`;
        
        messageEl.innerHTML = `
            ${!isOwn ? `<div class="message-sender">${message.senderId.username}</div>` : ''}
            <div class="message-content">${this.formatMessageContent(message)}</div>
            <div class="message-timestamp">${this.formatTime(message.timestamp)}</div>
        `;
        
        container.appendChild(messageEl);
        container.scrollTop = container.scrollHeight;
    }

    formatMessageContent(message) {
        switch (message.type) {
            case 'image':
                return `<img src="${message.mediaUrl}" alt="Image" class="message-media" onerror="this.style.display='none'">`;
            case 'video':
                return `<video src="${message.mediaUrl}" controls class="message-media"></video>`;
            case 'audio':
                return `<audio src="${message.mediaUrl}" controls></audio>`;
            case 'sticker':
                return `<img src="${message.mediaUrl}" alt="Sticker" class="message-sticker">`;
            default:
                // Экранирование HTML для безопасности
                return this.escapeHtml(message.content);
        }
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    displayMessagesHistory(messages) {
        const container = document.getElementById('messagesList');
        container.innerHTML = '';
        
        if (messages.length === 0) {
            container.innerHTML = '<div class="no-messages">Нет сообщений</div>';
            return;
        }
        
        messages.forEach(message => this.displayMessage(message));
    }

    async handleMediaUpload(file) {
        if (!file) return;
        
        if (!this.currentChat) {
            this.showNotification('Выберите чат для отправки медиа', 'warning');
            return;
        }

        // Проверка размера файла (макс 10MB)
        if (file.size > 10 * 1024 * 1024) {
            this.showNotification('Файл слишком большой (макс. 10MB)', 'error');
            return;
        }

        // Здесь должна быть реализация загрузки файла на сервер
        // Для демонстрации используем временный URL
        try {
            const mediaUrl = URL.createObjectURL(file);
            
            this.socket.emit('send-message', {
                chatId: this.currentChat,
                content: 'Медиа файл',
                type: this.getMediaType(file.type),
                mediaUrl: mediaUrl
            });
            
            this.showNotification('Медиа отправлено', 'success');
        } catch (error) {
            this.showNotification('Ошибка загрузки медиа', 'error');
        }
    }

    getMediaType(mimeType) {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
        return 'text';
    }

    handleStickerUpload(file) {
        if (!file || !file.type.startsWith('image/')) {
            this.showNotification('Выберите изображение для стикера', 'warning');
            return;
        }

        if (!this.currentChat) {
            this.showNotification('Выберите чат для отправки стикера', 'warning');
            return;
        }

        try {
            const stickerUrl = URL.createObjectURL(file);
            
            this.socket.emit('send-message', {
                chatId: this.currentChat,
                content: 'Стикер',
                type: 'sticker',
                mediaUrl: stickerUrl
            });
            
            this.showNotification('Стикер отправлен', 'success');
        } catch (error) {
            this.showNotification('Ошибка отправки стикера', 'error');
        }
    }

    showReviewModal() {
        if (!this.currentChat) {
            this.showNotification('Выберите чат для отзыва', 'warning');
            return;
        }
        document.getElementById('reviewModal').classList.remove('hidden');
    }

    hideReviewModal() {
        document.getElementById('reviewModal').classList.add('hidden');
        // Сброс формы
        document.getElementById('reviewForm').reset();
        this.setRating(5); // Сброс рейтинга к 5
    }

    setRating(rating) {
        document.getElementById('reviewRating').value = rating;
        
        document.querySelectorAll('.star').forEach((star, index) => {
            star.classList.toggle('active', index < rating);
        });
    }

    async submitReview() {
        const rating = document.getElementById('reviewRating').value;
        const comment = document.getElementById('reviewComment').value;

        if (!this.currentChat) {
            this.showNotification('Ошибка: чат не выбран', 'error');
            return;
        }

        try {
            const response = await fetch('/api/user/review', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    listenerId: this.getCurrentListenerId(), // Нужно реализовать получение ID слушателя
                    chatId: this.currentChat,
                    rating: parseInt(rating),
                    comment: comment
                })
            });

            if (response.ok) {
                this.showNotification('Отзыв успешно отправлен', 'success');
                this.hideReviewModal();
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Ошибка отправки отзыва', 'error');
            }
        } catch (error) {
            this.showNotification('Ошибка соединения с сервером', 'error');
        }
    }

    getCurrentListenerId() {
        // В реальном приложении здесь должна быть логика получения ID слушателя из текущего чата
        // Для демонстрации возвращаем null - нужно будет доработать
        console.warn('getCurrentListenerId not implemented');
        return null;
    }

    async loadUserChats() {
        try {
            const endpoint = this.currentUser.role === 'listener' 
                ? '/api/listener/active-chats' 
                : '/api/user/chats';
                
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load chats');
            }
            
            const chats = await response.json();
            this.displayChats(chats);
        } catch (error) {
            console.error('Error loading chats:', error);
            this.showNotification('Ошибка загрузки чатов', 'error');
        }
    }

    displayChats(chats) {
        const container = document.getElementById('chatsList');
        container.innerHTML = '';

        if (chats.length === 0) {
            container.innerHTML = '<div class="list-item">Нет активных чатов</div>';
            return;
        }

        chats.forEach(chat => {
            const otherUser = chat.participants.find(p => p._id !== this.currentUser.id);
            if (!otherUser) return;
            
            const item = document.createElement('div');
            item.className = `list-item ${this.currentChat === chat._id ? 'active' : ''}`;
            item.innerHTML = `
                <img src="${otherUser.avatar || '/images/default-avatar.png'}" alt="Avatar" class="avatar" onerror="this.src='/images/default-avatar.png'">
                <div>
                    <div class="chat-user-name">${otherUser.username}</div>
                    <small class="chat-user-role">${this.getRoleDisplayName(otherUser.role)}</small>
                </div>
            `;
            
            item.addEventListener('click', () => {
                this.joinChat(chat._id);
            });
            
            container.appendChild(item);
        });
    }

    async loadListenerData() {
        await this.loadListenerReviews();
        await this.loadActiveChats();
    }

    async loadListenerReviews() {
        try {
            const response = await fetch('/api/listener/reviews', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load reviews');
            }
            
            const reviews = await response.json();
            this.displayReviews(reviews);
        } catch (error) {
            console.error('Error loading reviews:', error);
            this.showNotification('Ошибка загрузки отзывов', 'error');
        }
    }

    displayReviews(reviews) {
        const container = document.getElementById('reviewsList');
        container.innerHTML = '';

        if (reviews.length === 0) {
            container.innerHTML = '<div class="list-item">Пока нет отзывов</div>';
            return;
        }

        reviews.forEach(review => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <div class="review-item">
                    <div class="review-header">
                        <strong>${review.userId.username}</strong>
                        <div class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
                    </div>
                    ${review.comment ? `<div class="review-comment">${this.escapeHtml(review.comment)}</div>` : ''}
                    <small class="review-date">${this.formatTime(review.createdAt)}</small>
                </div>
            `;
            container.appendChild(item);
        });
    }

    async loadActiveChats() {
        // Уже загружается в loadUserChats для слушателей
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'только что';
        if (diffMins < 60) return `${diffMins} мин назад`;
        if (diffHours < 24) return `${diffHours} ч назад`;
        if (diffDays < 7) return `${diffDays} дн назад`;
        
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }

    formatLastSeen(timestamp) {
        const now = new Date();
        const lastSeen = new Date(timestamp);
        const diffMinutes = Math.floor((now - lastSeen) / (1000 * 60));
        
        if (diffMinutes < 1) return 'онлайн';
        if (diffMinutes < 60) return `${diffMinutes} мин назад`;
        if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} ч назад`;
        return `${Math.floor(diffMinutes / 1440)} дн назад`;
    }

    showNotification(message, type = 'info') {
        // Создаем уведомление если нет системы уведомлений
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${this.getNotificationColor(type)};
            color: white;
            border-radius: 5px;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    getNotificationColor(type) {
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        return colors[type] || colors.info;
    }

    logout() {
        if (this.socket) {
            this.socket.disconnect();
        }
        
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    }

    async loadInterfaceData() {
        // Дополнительная загрузка данных интерфейса
        try {
            // Загрузка темы пользователя
            const savedTheme = localStorage.getItem('theme') || this.currentUser.theme || 'light';
            this.applyTheme(savedTheme);
        } catch (error) {
            console.error('Error loading interface data:', error);
        }
    }

    applyTheme(theme) {
        const themeStyle = document.getElementById('theme-style');
        if (themeStyle) {
            themeStyle.href = `css/${theme}-theme.css`;
        }
    }
}

// Вспомогательные функции
function formatDate(date) {
    return new Date(date).toLocaleDateString('ru-RU');
}

function formatDateTime(date) {
    return new Date(date).toLocaleString('ru-RU');
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    // Проверка поддержки необходимых API
    if (!window.io) {
        console.error('Socket.io not loaded');
        document.body.innerHTML = '<div style="padding: 20px; text-align: center; color: red;">Ошибка загрузки приложения. Проверьте подключение к интернету.</div>';
        return;
    }

    try {
        new ChatApp();
    } catch (error) {
        console.error('Failed to initialize chat app:', error);
        document.body.innerHTML = `
            <div style="padding: 20px; text-align: center;">
                <h2>Ошибка загрузки приложения</h2>
                <p>${error.message}</p>
                <button onclick="window.location.reload()">Перезагрузить</button>
            </div>
        `;
    }
});

// Глобальные обработчики ошибок
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});
