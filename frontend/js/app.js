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
    }

    initializeSocket() {
        this.socket = io({
            auth: {
                token: localStorage.getItem('token')
            }
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
    }

    enableChatInput() {
        document.getElementById('messageInput').disabled = false;
        document.getElementById('sendBtn').disabled = false;
    }

    disableChatInput() {
        document.getElementById('messageInput').disabled = true;
        document.getElementById('sendBtn').disabled = true;
    }

    async loadListeners() {
        try {
            const response = await fetch('/api/user/listeners', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            const listeners = await response.json();
            this.displayListeners(listeners);
        } catch (error) {
            console.error('Error loading listeners:', error);
        }
    }

    displayListeners(listeners) {
        const container = document.getElementById('listenersList');
        container.innerHTML = '';

        listeners.forEach(listener => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <img src="${listener.avatar || '/images/default-avatar.png'}" alt="Avatar" class="avatar">
                <div>
                    <div>${listener.username}</div>
                    <small>${listener.lastSeen ? this.formatLastSeen(listener.lastSeen) : 'Не в сети'}</small>
                </div>
            `;
            
            item.addEventListener('click', () => {
                this.createChatWithListener(listener._id);
            });
            
            container.appendChild(item);
        });
    }

    async createChatWithListener(listenerId) {
        this.socket.emit('create-chat', { listenerId });
    }

    joinChat(chatId) {
        if (this.currentChat) {
            this.socket.emit('leave-chat', this.currentChat);
        }
        
        this.currentChat = chatId;
        this.socket.emit('join-chat', chatId);
        this.socket.emit('get-messages', chatId);
        
        this.updateChatInterface();
    }

    updateChatInterface() {
        document.getElementById('leaveChatBtn').classList.remove('hidden');
        
        if (this.currentUser.role === 'user') {
            document.getElementById('addReviewBtn').classList.remove('hidden');
        }
    }

    sendMessage() {
        const input = document.getElementById('messageInput');
        const content = input.value.trim();
        
        if (!content || !this.currentChat) return;

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
                return `<img src="${message.mediaUrl}" alt="Image" class="message-media">`;
            case 'video':
                return `<video src="${message.mediaUrl}" controls class="message-media"></video>`;
            case 'audio':
                return `<audio src="${message.mediaUrl}" controls></audio>`;
            case 'sticker':
                return `<img src="${message.mediaUrl}" alt="Sticker" class="message-sticker">`;
            default:
                return message.content;
        }
    }

    displayMessagesHistory(messages) {
        const container = document.getElementById('messagesList');
        container.innerHTML = '';
        
        messages.forEach(message => this.displayMessage(message));
    }

    async handleMediaUpload(file) {
        if (!file) return;

        // Здесь должна быть реализация загрузки файла на сервер
        // Для демонстрации используем временный URL
        const mediaUrl = URL.createObjectURL(file);
        
        this.socket.emit('send-message', {
            chatId: this.currentChat,
            content: 'Медиа файл',
            type: this.getMediaType(file.type),
            mediaUrl: mediaUrl
        });
    }

    getMediaType(mimeType) {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
        return 'text';
    }

    handleStickerUpload(file) {
        if (!file || !file.type.startsWith('image/')) return;

        const stickerUrl = URL.createObjectURL(file);
        
        this.socket.emit('send-message', {
            chatId: this.currentChat,
            content: 'Стикер',
            type: 'sticker',
            mediaUrl: stickerUrl
        });
    }

    showReviewModal() {
        document.getElementById('reviewModal').classList.remove('hidden');
    }

    hideReviewModal() {
        document.getElementById('reviewModal').classList.add('hidden');
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

        try {
            const response = await fetch('/api/user/review', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    listenerId: this.getCurrentListenerId(),
                    chatId: this.currentChat,
                    rating: parseInt(rating),
                    comment: comment
                })
            });

            if (response.ok) {
                this.showNotification('Отзыв успешно отправлен', 'success');
                this.hideReviewModal();
            } else {
                this.showNotification('Ошибка отправки отзыва', 'error');
            }
        } catch (error) {
            this.showNotification('Ошибка соединения', 'error');
        }
    }

    getCurrentListenerId() {
        // Здесь должна быть логика получения ID текущего слушателя
        // Для демонстрации возвращаем null
        return null;
    }

    async loadUserChats() {
        try {
            const response = await fetch('/api/user/chats', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            const chats = await response.json();
            this.displayChats(chats);
        } catch (error) {
            console.error('Error loading chats:', error);
        }
    }

    displayChats(chats) {
        const container = document.getElementById('chatsList');
        container.innerHTML = '';

        chats.forEach(chat => {
            const otherUser = chat.participants.find(p => p._id !== this.currentUser.id);
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <img src="${otherUser.avatar || '/images/default-avatar.png'}" alt="Avatar" class="avatar">
                <div>${otherUser.username}</div>
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
            
            const reviews = await response.json();
            this.displayReviews(reviews);
        } catch (error) {
            console.error('Error loading reviews:', error);
        }
    }

    displayReviews(reviews) {
        const container = document.getElementById('reviewsList');
        container.innerHTML = '';

        reviews.forEach(review => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <div>
                    <strong>${review.userId.username}</strong>
                    <div>Оценка: ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
                    ${review.comment ? `<div>${review.comment}</div>` : ''}
                    <small>${this.formatTime(review.createdAt)}</small>
                </div>
            `;
            container.appendChild(item);
        });
    }

    async loadActiveChats() {
        try {
            const response = await fetch('/api/listener/active-chats', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            const chats = await response.json();
            this.displayActiveChats(chats);
        } catch (error) {
            console.error('Error loading active chats:', error);
        }
    }

    displayActiveChats(chats) {
        const container = document.getElementById('activeChats');
        container.innerHTML = '';

        chats.forEach(chat => {
            const otherUser = chat.participants.find(p => p._id !== this.currentUser.id);
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <img src="${otherUser.avatar || '/images/default-avatar.png'}" alt="Avatar" class="avatar">
                <div>${otherUser.username}</div>
            `;
            
            item.addEventListener('click', () => {
                this.joinChat(chat._id);
            });
            
            container.appendChild(item);
        });
    }

    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatLastSeen(timestamp) {
        const now = new Date();
        const lastSeen = new Date(timestamp);
        const diffMinutes = Math.floor((now - lastSeen) / (1000 * 60));
        
        if (diffMinutes < 1) return 'Только что';
        if (diffMinutes < 60) return `${diffMinutes} мин назад`;
        if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} ч назад`;
        return `${Math.floor(diffMinutes / 1440)} дн назад`;
    }

    showNotification(message, type) {
        // Простая реализация уведомлений
        alert(`${type.toUpperCase()}: ${message}`);
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    }

    async loadInterfaceData() {
        // Загрузка дополнительных данных интерфейса
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});
