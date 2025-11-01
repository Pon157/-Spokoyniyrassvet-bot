// ПРОВЕРКА АУТЕНТИФИКАЦИИ ПРИ ЗАГРУЗКЕ ЧАТА
document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    
    console.log('🔐 Проверка аутентификации для чата...');
    console.log('Токен:', token ? 'есть' : 'нет');
    console.log('Данные пользователя:', userData ? 'есть' : 'нет');
    
    // Если нет токена - перенаправляем на главную
    if (!token || !userData) {
        console.log('❌ Нет аутентификации, перенаправляем на главную');
        window.location.href = '/';
        return;
    }
    
    try {
        const user = JSON.parse(userData);
        console.log('✅ Пользователь аутентифицирован:', user.username);
        
        // Инициализируем приложение чата
        window.app = new ChatApp();
        
    } catch (error) {
        console.error('Ошибка загрузки пользователя:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        window.location.href = '/';
    }
});

class ChatApp {
    constructor() {
        this.currentUser = null;
        this.socket = null;
        this.currentChat = null;
        this.chats = [];
        this.listeners = [];
        this.stickers = [];
        
        // Получаем данные пользователя из localStorage
        const userData = localStorage.getItem('user_data');
        if (userData) {
            this.currentUser = JSON.parse(userData);
        }
        
        this.init();
    }

    async init() {
        console.log('🚀 Инициализация чата для:', this.currentUser.username);
        
        // Проверяем аутентификацию через API
        const isAuthenticated = await this.verifyAuth();
        if (!isAuthenticated) {
            this.logout();
            return;
        }
        
        this.initSocket();
        this.loadUserData();
        this.setupEventListeners();
        this.loadStickers();
        
        if (this.currentUser.role === 'listener') {
            this.showListenerFeatures();
        }
    }

    async verifyAuth() {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                console.log('✅ Аутентификация подтверждена');
                return true;
            } else {
                console.log('❌ Аутентификация не прошла:', data.error);
                return false;
            }
        } catch (error) {
            console.error('Ошибка проверки аутентификации:', error);
            return false;
        }
    }

    initSocket() {
        const token = localStorage.getItem('auth_token');
        
        this.socket = io({
            auth: {
                token: token
            }
        });

        this.socket.on('connect', () => {
            console.log('✅ WebSocket подключен');
        });

        this.socket.on('disconnect', () => {
            console.log('❌ WebSocket отключен');
        });

        this.socket.on('auth_error', (error) => {
            console.log('❌ Ошибка аутентификации WebSocket:', error);
            this.showNotification('Ошибка подключения к чату', 'error');
            this.logout();
        });

        // Обработчики событий WebSocket
        this.socket.on('authenticated', (data) => {
            console.log('✅ WebSocket аутентифицирован');
        });

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
        // Обновляем интерфейс пользователя
        const usernameElement = document.getElementById('username');
        const userRoleElement = document.getElementById('userRole');
        const userAvatarElement = document.getElementById('userAvatar');
        
        if (usernameElement) usernameElement.textContent = this.currentUser.username;
        if (userRoleElement) userRoleElement.textContent = this.getRoleDisplayName(this.currentUser.role);
        if (userAvatarElement && this.currentUser.avatar_url) {
            userAvatarElement.src = this.currentUser.avatar_url;
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
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                window.location.href = 'settings.html';
            });
        }

        // Новый чат
        const newChatBtn = document.getElementById('newChatBtn');
        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => {
                this.createNewChat();
            });
        }

        // Поиск
        const chatSearch = document.getElementById('chatSearch');
        if (chatSearch) {
            chatSearch.addEventListener('input', (e) => {
                this.filterChats(e.target.value);
            });
        }

        const listenerSearch = document.getElementById('listenerSearch');
        if (listenerSearch) {
            listenerSearch.addEventListener('input', (e) => {
                this.filterListeners(e.target.value);
            });
        }

        // Закрытие чата
        const closeChatBtn = document.getElementById('closeChatBtn');
        if (closeChatBtn) {
            closeChatBtn.addEventListener('click', () => {
                this.closeCurrentChat();
            });
        }
    }

    switchSidebarTab(tabName) {
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        const activeContent = document.getElementById(`${tabName}Tab`);
        
        if (activeTab) activeTab.classList.add('active');
        if (activeContent) activeContent.classList.add('active');
    }

    showListenerFeatures() {
        const listenersTab = document.getElementById('listenersTab');
        const reviewsTab = document.getElementById('reviewsTab');
        
        if (listenersTab) listenersTab.style.display = 'flex';
        if (reviewsTab) reviewsTab.style.display = 'flex';
        
        this.loadReviews();
    }

    async loadChats() {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/chat/chats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.chats = data.chats || [];
                this.renderChats();
            } else {
                console.log('Ошибка загрузки чатов:', response.status);
            }
        } catch (error) {
            console.error('Ошибка загрузки чатов:', error);
        }
    }

    async loadListeners() {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/chat/listeners', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.listeners = data.listeners || [];
                this.renderListeners();
            } else {
                console.log('Ошибка загрузки слушателей:', response.status);
            }
        } catch (error) {
            console.error('Ошибка загрузки слушателей:', error);
        }
    }

    async loadReviews() {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/listener/reviews', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderReviews(data.reviews || []);
            }
        } catch (error) {
            console.error('Ошибка загрузки отзывов:', error);
        }
    }

    async loadStickers() {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/chat/stickers', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.stickers = data.stickers || [];
                this.renderStickers();
            }
        } catch (error) {
            console.error('Ошибка загрузки стикеров:', error);
        }
    }

    renderChats() {
        const container = document.getElementById('chatsList');
        if (!container) return;

        container.innerHTML = '';

        if (this.chats.length === 0) {
            container.innerHTML = '<div class="no-chats">Нет активных чатов</div>';
            return;
        }

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
                    <span class="chat-name">${chat.partner_name || 'Пользователь'}</span>
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
        if (!container) return;

        container.innerHTML = '';

        if (this.listeners.length === 0) {
            container.innerHTML = '<div class="no-listeners">Нет доступных слушателей</div>';
            return;
        }

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

        const startBtn = div.querySelector('.start-chat-btn');
        if (startBtn) {
            startBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.startChatWithListener(listener.id);
            });
        }

        return div;
    }

    renderReviews(reviews) {
        const container = document.getElementById('reviewsContainer');
        if (!container) return;

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
                <span class="review-user">${review.user_name || 'Пользователь'}</span>
                <span class="review-rating">${this.generateStarRating(review.rating)}</span>
            </div>
            <div class="review-comment">${review.comment || 'Без комментария'}</div>
            <div class="review-date">${this.formatTime(review.created_at)}</div>
        `;
        return div;
    }

    renderStickers() {
        const container = document.getElementById('stickersGrid');
        if (!container) return;

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
        
        const chatPlaceholder = document.getElementById('chatPlaceholder');
        const chatContainer = document.getElementById('chatContainer');
        
        if (chatPlaceholder) chatPlaceholder.style.display = 'none';
        if (chatContainer) chatContainer.style.display = 'flex';
        
        const partnerName = document.getElementById('partnerName');
        const partnerAvatar = document.getElementById('partnerAvatar');
        const partnerStatus = document.getElementById('partnerStatus');
        
        if (partnerName) partnerName.textContent = chat.partner_name || 'Пользователь';
        if (partnerAvatar) partnerAvatar.src = chat.partner_avatar || 'images/default-avatar.png';
        if (partnerStatus) partnerStatus.textContent = chat.partner_online ? 'online' : 'offline';
        
        if (this.socket) {
            this.socket.emit('join_chat', chat.id);
        }
        
        await this.loadMessages(chat.id);
    }

    async loadMessages(chatId) {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/chat/messages/${chatId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderMessages(data.messages || []);
            }
        } catch (error) {
            console.error('Ошибка загрузки сообщений:', error);
        }
    }

    renderMessages(messages) {
        const container = document.getElementById('messages');
        if (!container) return;

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
            default:
                content = `<div class="message-text">${this.escapeHtml(message.content)}</div>`;
        }

        div.innerHTML = `
            <div class="message-content">
                ${!isOwn ? `<div class="message-sender">${message.sender?.username || 'Пользователь'}</div>` : ''}
                ${content}
                <div class="message-time">${this.formatTime(message.created_at)}</div>
            </div>
        `;

        return div;
    }

    handleNewMessage(message) {
        if (this.currentChat && message.chat_id === this.currentChat.id) {
            const container = document.getElementById('messages');
            if (container) {
                const messageElement = this.createMessageElement(message);
                container.appendChild(messageElement);
                this.scrollToBottom();
            }
        } else {
            // Обновляем список чатов
            this.loadChats();
        }
    }

    showTypingIndicator(data) {
        const indicator = document.getElementById('typingIndicator');
        const typingUser = document.getElementById('typingUser');
        
        if (indicator && typingUser) {
            if (data.is_typing) {
                typingUser.textContent = data.username;
                indicator.style.display = 'block';
            } else {
                indicator.style.display = 'none';
            }
        }
    }

    updateUserStatus(data) {
        // Обновляем статус в активном чате
        if (this.currentChat && 
            (this.currentChat.partner_id === data.user_id || 
             this.currentChat.user_id === data.user_id)) {
            const partnerStatus = document.getElementById('partnerStatus');
            if (partnerStatus) {
                partnerStatus.textContent = data.is_online ? 'online' : 'offline';
            }
        }
        
        // Обновляем статус в списках
        this.loadChats();
        this.loadListeners();
    }

    async createNewChat() {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/chat/create', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
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
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/chat/create', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
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
        
        const chatPlaceholder = document.getElementById('chatPlaceholder');
        const chatContainer = document.getElementById('chatContainer');
        
        if (chatPlaceholder) chatPlaceholder.style.display = 'flex';
        if (chatContainer) chatContainer.style.display = 'none';
        
        if (this.currentChat && this.socket) {
            this.socket.emit('leave_chat', this.currentChat.id);
        }
    }

    sendSticker(stickerUrl) {
        if (!this.currentChat || !this.socket) return;

        try {
            this.socket.emit('send_message', {
                chat_id: this.currentChat.id,
                sticker_url: stickerUrl,
                message_type: 'sticker'
            });
        } catch (error) {
            console.error('Ошибка отправки стикера:', error);
            this.showNotification('Ошибка отправки стикера', 'error');
        }
    }

    closeStickerModal() {
        const modal = document.getElementById('stickerModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    openMedia(url) {
        window.open(url, '_blank');
    }

    // Вспомогательные методы
    formatTime(dateString) {
        if (!dateString) return '';
        
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
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        const container = document.getElementById('messagesContainer');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    showNotification(message, type = 'info') {
        // Создаем контейнер для уведомлений если его нет
        let container = document.getElementById('notificationsContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notificationsContainer';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            document.body.appendChild(container);
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            padding: 12px 16px;
            border-radius: 8px;
            color: white;
            background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        notification.textContent = message;

        container.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    logout() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        window.location.href = '/';
    }
}
