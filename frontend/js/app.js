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

        this.showRoleSpecificSections();
    }

    getRoleDisplayName(role) {
        const roleNames = {
            'user': '👤 Пользователь',
            'listener': '👂 Слушатель',
            'admin': '🛠️ Администратор',
            'coowner': '👑 Совладелец',
            'owner': '👑 Владелец'
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
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        document.getElementById('sendBtn').addEventListener('click', () => {
            this.sendMessage();
        });

        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        document.getElementById('themeToggle').addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById('themeDropdown');
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        });

        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', (e) => {
                this.changeTheme(e.target.dataset.theme);
            });
        });

        document.addEventListener('click', () => {
            document.getElementById('themeDropdown').style.display = 'none';
        });
    }

    initializeSocket() {
        const token = localStorage.getItem('token');
        const serverUrl = window.location.origin;
        
        this.socket = io(serverUrl, {
            auth: { token },
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
    }

    async loadListeners() {
        try {
            const response = await fetch('/api/user/listeners', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const listeners = await response.json();
                this.displayListeners(listeners);
            }
        } catch (error) {
            console.error('Error loading listeners:', error);
        }
    }

    displayListeners(listeners) {
        const container = document.getElementById('listenersList');
        container.innerHTML = '';

        listeners.forEach(listener => {
            const item = document.createElement('div');
            item.className = 'listener-card';
            item.innerHTML = `
                <img src="${listener.avatar || '/images/default-avatar.png'}" alt="Avatar" class="avatar">
                <div class="listener-info">
                    <div class="listener-name">${listener.username}</div>
                    <div class="listener-rating">⭐ ${listener.rating || 'Нет оценок'}</div>
                    <div class="listener-status">
                        <span class="status-indicator ${listener.isOnline ? 'online' : 'offline'}"></span>
                        ${listener.isOnline ? 'Онлайн' : 'Не в сети'}
                    </div>
                </div>
            `;
            
            item.addEventListener('click', () => {
                this.createChatWithListener(listener._id);
            });
            
            container.appendChild(item);
        });
    }

    async createChatWithListener(listenerId) {
        try {
            const response = await fetch('/api/user/create-chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ listenerId })
            });

            if (response.ok) {
                const data = await response.json();
                this.joinChat(data.chatId);
            }
        } catch (error) {
            console.error('Error creating chat:', error);
        }
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
        document.getElementById('messageInputContainer').classList.remove('hidden');
        document.getElementById('leaveChatBtn').classList.remove('hidden');
        document.getElementById('chatTitle').textContent = 'Активный чат';
        
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
            <div class="message-content">${message.content}</div>
            <div class="message-timestamp">${this.formatTime(message.timestamp)}</div>
        `;
        
        container.appendChild(messageEl);
        container.scrollTop = container.scrollHeight;
    }

    displayMessagesHistory(messages) {
        const container = document.getElementById('messagesList');
        container.innerHTML = '';
        
        messages.forEach(message => this.displayMessage(message));
    }

    enableChatInput() {
        document.getElementById('messageInput').disabled = false;
        document.getElementById('sendBtn').disabled = false;
    }

    disableChatInput() {
        document.getElementById('messageInput').disabled = true;
        document.getElementById('sendBtn').disabled = true;
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
            
            if (response.ok) {
                const chats = await response.json();
                this.displayChats(chats);
            }
        } catch (error) {
            console.error('Error loading chats:', error);
        }
    }

    displayChats(chats) {
        const container = this.currentUser.role === 'listener' 
            ? document.getElementById('listenerChatsList')
            : document.getElementById('userChatsList');
        
        container.innerHTML = '';

        chats.forEach(chat => {
            const otherUser = chat.participants.find(p => p._id !== this.currentUser.id);
            if (!otherUser) return;
            
            const item = document.createElement('div');
            item.className = `chat-card ${this.currentChat === chat._id ? 'active' : ''}`;
            item.innerHTML = `
                <img src="${otherUser.avatar || '/images/default-avatar.png'}" alt="Avatar" class="avatar">
                <div class="chat-info">
                    <div class="chat-partner">${otherUser.username}</div>
                    <div class="chat-user-role">${this.getRoleDisplayName(otherUser.role)}</div>
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
    }

    async loadListenerReviews() {
        try {
            const response = await fetch('/api/listener/reviews', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const reviews = await response.json();
                this.displayReviews(reviews);
            }
        } catch (error) {
            console.error('Error loading reviews:', error);
        }
    }

    displayReviews(reviews) {
        const container = document.getElementById('reviewsList');
        container.innerHTML = '';

        reviews.forEach(review => {
            const item = document.createElement('div');
            item.className = 'review-item';
            item.innerHTML = `
                <div class="review-header">
                    <strong>${review.userId.username}</strong>
                    <div class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
                </div>
                ${review.comment ? `<div class="review-comment">${review.comment}</div>` : ''}
                <small class="review-date">${this.formatTime(review.createdAt)}</small>
            `;
            container.appendChild(item);
        });
    }

    changeTheme(theme) {
        document.getElementById('theme-style').href = `css/${theme}-theme.css`;
        localStorage.setItem('theme', theme);
        document.getElementById('themeDropdown').style.display = 'none';
    }

    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    showNotification(message, type) {
        alert(`${type.toUpperCase()}: ${message}`);
    }

    logout() {
        if (this.socket) {
            this.socket.disconnect();
        }
        
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});
