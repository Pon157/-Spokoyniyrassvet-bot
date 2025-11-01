class ChatApp {
    constructor() {
        this.currentUser = null;
        this.socket = null;
        this.currentChat = null;
        this.chats = [];
        this.listeners = [];
        this.stickers = [];
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.initSocket();
        this.loadUserData();
        this.setupEventListeners();
        this.loadStickers();
        
        if (this.currentUser.role === 'listener') {
            this.showListenerFeatures();
        }
    }

    async checkAuth() {
        const token = localStorage.getItem('chat_token');
        const userData = localStorage.getItem('user_data');

        if (!token || !userData) {
            window.location.href = '/';
            return;
        }

        try {
            const response = await fetch('/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Невалидный токен');
            }

            const data = await response.json();
            this.currentUser = data.user;
            
        } catch (error) {
            console.error('Ошибка аутентификации:', error);
            this.logout();
        }
    }

    initSocket() {
        this.socket = io({
            auth: {
                token: localStorage.getItem('chat_token')
            }
        });

        this.socket.on('connect', () => {
            console.log('✅ WebSocket подключен');
        });

        this.socket.on('disconnect', () => {
            console.log('❌ WebSocket отключен');
        });

        this.socket.on('error', (error) => {
            this.showNotification(error.message, 'error');
        });

        // Обработчики событий WebSocket
        this.socket.on('new_message', (message) => {
            this.handleNewMessage(message);
        });

        this.socket.on('user_typing', (data) => {
            this.showTypingIndicator(data);
        });

        this.socket.on('user_status_changed', (data) => {
            this.updateUserStatus(data);
        });
    }

    loadUserData() {
        document.getElementById('username').textContent = this.currentUser.username;
        document.getElementById('userRole').textContent = this.getRoleDisplayName(this.currentUser.role);
        
        if (this.currentUser.avatar_url) {
            document.getElementById('userAvatar').src = this.currentUser.avatar_url;
        }

        this.loadChats();
        this.loadListeners();
    }

    setupEventListeners() {
        // Навигация по табам
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchSidebarTab(e.target.dataset.tab);
            });
        });

        // Кнопка настроек
        document.getElementById('settingsBtn').addEventListener('click', () => {
            window.location.href = 'settings.html';
        });

        // Новый чат
        document.getElementById('newChatBtn').addEventListener('click', () => {
            this.createNewChat();
        });

        // Поиск
        document.getElementById('chatSearch').addEventListener('input', (e) => {
            this.filterChats(e.target.value);
        });

        document.getElementById('listenerSearch').addEventListener('input', (e) => {
            this.filterListeners(e.target.value);
        });

        // Закрытие чата
        document.getElementById('closeChatBtn').addEventListener('click', () => {
            this.closeCurrentChat();
        });
    }

    switchSidebarTab(tabName) {
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Tab`).classList.add('active');
    }

    showListenerFeatures() {
        document.getElementById('listenersTab').style.display = 'flex';
        document.getElementById('reviewsTab').style.display = 'flex';
        this.loadReviews();
    }

    async loadChats() {
        try {
            const response = await fetch('/chat/chats', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.chats = data.chats;
                this.renderChats();
            }
        } catch (error) {
            console.error('Ошибка загрузки чатов:', error);
        }
    }

    async loadListeners() {
        try {
            const response = await fetch('/chat/listeners', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.listeners = data.listeners;
                this.renderListeners();
            }
        } catch (error) {
            console.error('Ошибка загрузки слушателей:', error);
        }
    }

    async loadReviews() {
        try {
            const response = await fetch('/listener/reviews', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderReviews(data.reviews);
            }
        } catch (error) {
            console.error('Ошибка загрузки отзывов:', error);
        }
    }

    async loadStickers() {
        try {
            const response = await fetch('/chat/stickers', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.stickers = data.stickers;
                this.renderStickers();
            }
        } catch (error) {
            console.error('Ошибка загрузки стикеров:', error);
        }
    }

    renderChats() {
        const container = document.getElementById('chatsList');
        container.innerHTML = '';

        this.chats.forEach(chat => {
            const chatElement = this.createChatElement(chat);
            container.appendChild(chatElement);
        });
    }

    createChatElement(chat) {
        const div = document.createElement('div');
        div.className = `chat-item ${chat.unread_count > 0 ? 'unread' : ''}`;
        div.innerHTML = `
            <img src="${chat.partner_avatar || 'images/default-avatar.png'}" class="avatar">
            <div class="chat-info">
                <div class="chat-header">
                    <span class="chat-name">${chat.partner_name}</span>
                    <span class="chat-time">${this.formatTime(chat.last_message_time)}</span>
                </div>
                <div class="chat-preview">${chat.last_message || 'Нет сообщений'}</div>
                ${chat.unread_count > 0 ? `<span class="unread-badge">${chat.unread_count}</span>` : ''}
            </div>
        `;

        div.addEventListener('click', () => {
            this.selectChat(chat);
        });

        return div;
    }

    renderListeners() {
        const container = document.getElementById('listenersList');
        container.innerHTML = '';

        this.listeners.forEach(listener => {
            const listenerElement = this.createListenerElement(listener);
            container.appendChild(listenerElement);
        });
    }

    createListenerElement(listener) {
        const div = document.createElement('div');
        div.className = 'listener-item';
        div.innerHTML = `
            <img src="${listener.avatar_url || 'images/default-avatar.png'}" class="avatar">
            <div class="listener-info">
                <div class="listener-name">${listener.username}</div>
                <div class="listener-status ${listener.is_online ? 'online' : 'offline'}">
                    ${listener.is_online ? 'Online' : 'Offline'}
                </div>
                <div class="listener-rating">
                    ${this.generateStarRating(listener.avg_rating || 0)}
                </div>
            </div>
            <button class="btn btn-sm btn-primary start-chat-btn">
                <i class="fas fa-comment"></i>
            </button>
        `;

        div.querySelector('.start-chat-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.startChatWithListener(listener.id);
        });

        return div;
    }

    renderReviews(reviews) {
        const container = document.getElementById('reviewsContainer');
        container.innerHTML = '';

        if (reviews.length === 0) {
            container.innerHTML = '<p class="no-reviews">Пока нет отзывов</p>';
            return;
        }

        reviews.forEach(review => {
            const reviewElement = this.createReviewElement(review);
            container.appendChild(reviewElement);
        });
    }

    createReviewElement(review) {
        const div = document.createElement('div');
        div.className = 'review-item';
        div.innerHTML = `
            <div class="review-header">
                <span class="review-user">${review.user_name}</span>
                <span class="review-rating">${this.generateStarRating(review.rating)}</span>
            </div>
            <div class="review-comment">${review.comment || 'Без комментария'}</div>
            <div class="review-date">${this.formatTime(review.created_at)}</div>
        `;
        return div;
    }

    renderStickers() {
        const container = document.getElementById('stickersGrid');
        container.innerHTML = '';

        this.stickers.forEach(sticker => {
            const stickerElement = document.createElement('div');
            stickerElement.className = 'sticker-item';
            stickerElement.innerHTML = `<img src="${sticker.url}" alt="${sticker.name}">`;
            
            stickerElement.addEventListener('click', () => {
                this.sendSticker(sticker.url);
                this.closeStickerModal();
            });

            container.appendChild(stickerElement);
        });
    }

    async selectChat(chat) {
        this.currentChat = chat;
        
        document.getElementById('chatPlaceholder').style.display = 'none';
        document.getElementById('chatContainer').style.display = 'flex';
        
        document.getElementById('partnerName').textContent = chat.partner_name;
        document.getElementById('partnerAvatar').src = chat.partner_avatar || 'images/default-avatar.png';
        document.getElementById('partnerStatus').textContent = chat.partner_online ? 'online' : 'offline';
        
        this.socket.emit('join_chat', chat.id);
        await this.loadMessages(chat.id);
    }

    async loadMessages(chatId) {
        try {
            const response = await fetch(`/chat/messages/${chatId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderMessages(data.messages);
            }
        } catch (error) {
            console.error('Ошибка загрузки сообщений:', error);
        }
    }

    renderMessages(messages) {
        const container = document.getElementById('messages');
        container.innerHTML = '';

        messages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            container.appendChild(messageElement);
        });

        this.scrollToBottom();
    }

    createMessageElement(message) {
        const div = document.createElement('div');
        const isOwn = message.sender_id === this.currentUser.id;
        
        div.className = `message ${isOwn ? 'own-message' : 'other-message'}`;
        
        let content = '';
        switch (message.message_type) {
            case 'text':
                content = `<div class="message-text">${this.escapeHtml(message.content)}</div>`;
                break;
            case 'image':
                content = `<img src="${message.media_url}" class="message-media" onclick="app.openMedia('${message.media_url}')">`;
                break;
            case 'video':
                content = `<video src="${message.media_url}" controls class="message-media"></video>`;
                break;
            case 'audio':
                content = `<audio src="${message.media_url}" controls class="message-audio"></audio>`;
                break;
            case 'sticker':
                content = `<img src="${message.sticker_url}" class="message-sticker">`;
                break;
        }

        div.innerHTML = `
            <div class="message-content">
                ${!isOwn ? `<div class="message-sender">${message.sender.username}</div>` : ''}
                ${content}
                <div class="message-time">${this.formatTime(message.created_at)}</div>
            </div>
        `;

        return div;
    }

    handleNewMessage(message) {
        if (this.currentChat && message.chat_id === this.currentChat.id) {
            const container = document.getElementById('messages');
            const messageElement = this.createMessageElement(message);
            container.appendChild(messageElement);
            this.scrollToBottom();
        } else {
            // Обновляем список чатов
            this.loadChats();
        }
    }

    showTypingIndicator(data) {
        const indicator = document.getElementById('typingIndicator');
        const typingUser = document.getElementById('typingUser');
        
        if (data.is_typing) {
            typingUser.textContent = data.username;
            indicator.style.display = 'block';
        } else {
            indicator.style.display = 'none';
        }
    }

    updateUserStatus(data) {
        // Обновляем статус в активном чате
        if (this.currentChat && 
            (this.currentChat.partner_id === data.user_id || 
             this.currentChat.user_id === data.user_id)) {
            document.getElementById('partnerStatus').textContent = 
                data.is_online ? 'online' : 'offline';
        }
        
        // Обновляем статус в списках
        this.loadChats();
        this.loadListeners();
    }

    async createNewChat() {
        try {
            const response = await fetch('/chat/create', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            if (response.ok) {
                const data = await response.json();
                this.chats.unshift(data.chat);
                this.renderChats();
                this.selectChat(data.chat);
            }
        } catch (error) {
            console.error('Ошибка создания чата:', error);
            this.showNotification('Ошибка создания чата', 'error');
        }
    }

    async startChatWithListener(listenerId) {
        try {
            const response = await fetch('/chat/create', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ listener_id: listenerId })
            });

            if (response.ok) {
                const data = await response.json();
                this.chats.unshift(data.chat);
                this.renderChats();
                this.selectChat(data.chat);
            }
        } catch (error) {
            console.error('Ошибка создания чата:', error);
            this.showNotification('Ошибка создания чата', 'error');
        }
    }

    closeCurrentChat() {
        this.currentChat = null;
        document.getElementById('chatPlaceholder').style.display = 'flex';
        document.getElementById('chatContainer').style.display = 'none';
        
        if (this.currentChat) {
            this.socket.emit('leave_chat', this.currentChat.id);
        }
    }

    // Вспомогательные методы
    formatTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'только что';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
        if (diff < 86400000) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        return date.toLocaleDateString('ru-RU');
    }

    generateStarRating(rating) {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(i <= rating ? '★' : '☆');
        }
        return stars.join('');
    }

    getRoleDisplayName(role) {
        const roles = {
            'user': 'Пользователь',
            'listener': 'Слушатель',
            'admin': 'Администратор',
            'coowner': 'Совладелец',
            'owner': 'Владелец'
        };
        return roles[role] || role;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        const container = document.getElementById('messagesContainer');
        container.scrollTop = container.scrollHeight;
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationsContainer');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            ${message}
        `;

        container.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    logout() {
        localStorage.removeItem('chat_token');
        localStorage.removeItem('user_data');
        window.location.href = '/';
    }
}

// Глобальный экземпляр приложения
const app = new ChatApp();
