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
        
        try {
            this.currentUser = JSON.parse(user);
            console.log('✅ User loaded:', this.currentUser);
        } catch (error) {
            console.error('❌ Error parsing user data:', error);
            this.logout();
        }
    }

    loadUserData() {
        // Безопасное обновление UI
        try {
            const userNameEl = document.getElementById('userName');
            const userRoleEl = document.getElementById('userRole');
            const userAvatarEl = document.getElementById('userAvatar');
            
            if (userNameEl) userNameEl.textContent = this.currentUser?.username || 'Пользователь';
            if (userRoleEl) userRoleEl.textContent = this.getRoleDisplayName(this.currentUser?.role);
            
            if (userAvatarEl && this.currentUser?.avatar_url) {
                userAvatarEl.src = this.currentUser.avatar_url;
            }

            this.showRoleSpecificSections();
        } catch (error) {
            console.error('❌ Error loading user data:', error);
        }
    }

    getRoleDisplayName(role) {
        const roleNames = {
            'user': '👤 Пользователь',
            'listener': '👂 Слушатель', 
            'admin': '🛠️ Администратор',
            'coowner': '👑 Совладелец',
            'owner': '👑 Владелец'
        };
        return roleNames[role] || role || 'Пользователь';
    }

    showRoleSpecificSections() {
        try {
            const userSection = document.getElementById('userSection');
            const listenerSection = document.getElementById('listenerSection');
            
            if (userSection && this.currentUser?.role === 'user') {
                userSection.classList.remove('hidden');
                this.loadListeners();
            } else if (listenerSection && this.currentUser?.role === 'listener') {
                listenerSection.classList.remove('hidden');
                this.loadListenerData();
            }
            
            this.loadUserChats();
        } catch (error) {
            console.error('❌ Error showing role sections:', error);
        }
    }

    setupEventListeners() {
        try {
            // Безопасное добавление обработчиков
            const logoutBtn = document.getElementById('logoutBtn');
            const sendBtn = document.getElementById('sendBtn');
            const messageInput = document.getElementById('messageInput');
            const themeToggle = document.getElementById('themeToggle');

            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => this.logout());
            }

            if (sendBtn) {
                sendBtn.addEventListener('click', () => this.sendMessage());
            }

            if (messageInput) {
                messageInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.sendMessage();
                    }
                });
            }

            if (themeToggle) {
                themeToggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const dropdown = document.getElementById('themeDropdown');
                    if (dropdown) {
                        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
                    }
                });
            }

            // Обработчики для тем
            document.querySelectorAll('.theme-option').forEach(option => {
                option.addEventListener('click', (e) => {
                    this.changeTheme(e.target.dataset.theme);
                });
            });

            document.addEventListener('click', () => {
                const dropdown = document.getElementById('themeDropdown');
                if (dropdown) {
                    dropdown.style.display = 'none';
                }
            });

        } catch (error) {
            console.error('❌ Error setting up event listeners:', error);
        }
    }

    initializeSocket() {
        try {
            const token = localStorage.getItem('token');
            const serverUrl = window.location.origin;
            
            console.log('🔌 Connecting to:', serverUrl);
            
            this.socket = io(serverUrl, {
                auth: { token },
                transports: ['websocket', 'polling']
            });

            this.socket.on('connect', () => {
                console.log('✅ Connected to server');
                this.enableChatInput();
            });

            this.socket.on('disconnect', () => {
                console.log('❌ Disconnected from server');
                this.disableChatInput();
            });

            this.socket.on('new_message', (message) => {
                console.log('💬 New message:', message);
                this.displayMessage(message);
            });

            this.socket.on('chat-created', (data) => {
                console.log('📝 Chat created:', data);
                this.joinChat(data.chatId);
            });

            this.socket.on('error', (data) => {
                console.error('❌ Socket error:', data);
                this.showNotification(data.message || 'Ошибка соединения', 'error');
            });

            this.socket.on('messages-history', (messages) => {
                console.log('📨 Messages history:', messages);
                this.displayMessagesHistory(messages);
            });

            // Новые обработчики для исправленного server.js
            this.socket.on('authenticated', (user) => {
                console.log('🔑 Socket authenticated:', user);
            });

            this.socket.on('new_message', (message) => {
                this.displayMessage(message);
            });

        } catch (error) {
            console.error('❌ Error initializing socket:', error);
        }
    }

    async loadListeners() {
        try {
            console.log('👥 Loading listeners...');
            const response = await fetch('/users/listeners', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.displayListeners(data.listeners || []);
            } else {
                console.warn('⚠️ No listeners endpoint, using mock data');
                this.displayMockListeners();
            }
        } catch (error) {
            console.error('❌ Error loading listeners:', error);
            this.displayMockListeners();
        }
    }

    displayMockListeners() {
        const container = document.getElementById('listenersList');
        if (!container) return;

        const mockListeners = [
            { id: '1', username: 'Анна Слушатель', avatar_url: null, rating: 4.8, is_online: true },
            { id: '2', username: 'Максим Помощник', avatar_url: null, rating: 4.9, is_online: false },
            { id: '3', username: 'Елена Консультант', avatar_url: null, rating: 4.7, is_online: true }
        ];

        this.displayListeners(mockListeners);
    }

    displayListeners(listeners) {
        const container = document.getElementById('listenersList');
        if (!container) return;

        container.innerHTML = '';

        listeners.forEach(listener => {
            const item = document.createElement('div');
            item.className = 'listener-card';
            item.innerHTML = `
                <img src="${listener.avatar_url || '/images/default-avatar.png'}" alt="Avatar" class="avatar" onerror="this.src='/images/default-avatar.png'">
                <div class="listener-info">
                    <div class="listener-name">${listener.username}</div>
                    <div class="listener-rating">⭐ ${listener.rating || 'Нет оценок'}</div>
                    <div class="listener-status">
                        <span class="status-indicator ${listener.is_online ? 'online' : 'offline'}"></span>
                        ${listener.is_online ? 'Онлайн' : 'Не в сети'}
                    </div>
                </div>
            `;
            
            item.addEventListener('click', () => {
                this.createChatWithListener(listener.id);
            });
            
            container.appendChild(item);
        });
    }

    async createChatWithListener(listenerId) {
        try {
            console.log('💬 Creating chat with listener:', listenerId);
            const response = await fetch('/chat/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ listenerId })
            });

            if (response.ok) {
                const data = await response.json();
                this.joinChat(data.chat.id);
                this.showNotification('Чат создан успешно!', 'success');
            } else {
                throw new Error('Failed to create chat');
            }
        } catch (error) {
            console.error('❌ Error creating chat:', error);
            this.showNotification('Ошибка создания чата', 'error');
            // Создаем mock чат для тестирования
            this.joinChat('mock-chat-' + Date.now());
        }
    }

    joinChat(chatId) {
        if (this.currentChat) {
            this.socket.emit('leave-chat', this.currentChat);
        }
        
        this.currentChat = chatId;
        console.log('🔗 Joining chat:', chatId);
        
        if (this.socket) {
            this.socket.emit('join-chat', chatId);
            this.socket.emit('get-messages', chatId);
        }
        
        this.updateChatInterface();
        this.showNotification(`Подключен к чату ${chatId}`, 'success');
    }

    updateChatInterface() {
        try {
            const messageInputContainer = document.getElementById('messageInputContainer');
            const leaveChatBtn = document.getElementById('leaveChatBtn');
            const chatTitle = document.getElementById('chatTitle');
            const addReviewBtn = document.getElementById('addReviewBtn');

            if (messageInputContainer) messageInputContainer.classList.remove('hidden');
            if (leaveChatBtn) leaveChatBtn.classList.remove('hidden');
            if (chatTitle) chatTitle.textContent = 'Активный чат';
            
            if (addReviewBtn && this.currentUser?.role === 'user') {
                addReviewBtn.classList.remove('hidden');
            }
        } catch (error) {
            console.error('❌ Error updating chat interface:', error);
        }
    }

    sendMessage() {
        try {
            const input = document.getElementById('messageInput');
            if (!input) return;
            
            const content = input.value.trim();
            
            if (!content || !this.currentChat) {
                this.showNotification('Введите сообщение', 'warning');
                return;
            }

            console.log('📤 Sending message:', content);

            if (this.socket) {
                this.socket.emit('send_message', {
                    chatId: this.currentChat,
                    content: content,
                    type: 'text'
                });
            } else {
                // Mock сообщение если сокет не работает
                this.displayMessage({
                    id: 'mock-msg-' + Date.now(),
                    content: content,
                    sender_id: this.currentUser.id,
                    sender: { username: this.currentUser.username, avatar_url: null, role: this.currentUser.role },
                    created_at: new Date().toISOString()
                });
            }

            input.value = '';
        } catch (error) {
            console.error('❌ Error sending message:', error);
        }
    }

    displayMessage(message) {
        try {
            const container = document.getElementById('messagesList');
            if (!container) return;

            const messageEl = document.createElement('div');
            
            const isOwn = message.sender_id === this.currentUser.id || 
                         message.sender?.id === this.currentUser.id;
            
            messageEl.className = `message-item ${isOwn ? 'own' : 'other'}`;
            
            messageEl.innerHTML = `
                ${!isOwn ? `<div class="message-sender">${message.sender?.username || 'Неизвестный'}</div>` : ''}
                <div class="message-content">${message.content}</div>
                <div class="message-timestamp">${this.formatTime(message.created_at || message.timestamp)}</div>
            `;
            
            container.appendChild(messageEl);
            container.scrollTop = container.scrollHeight;
        } catch (error) {
            console.error('❌ Error displaying message:', error);
        }
    }

    displayMessagesHistory(messages) {
        try {
            const container = document.getElementById('messagesList');
            if (!container) return;
            
            container.innerHTML = '';
            
            if (messages && messages.length > 0) {
                messages.forEach(message => this.displayMessage(message));
            } else {
                container.innerHTML = '<div class="no-messages">Нет сообщений</div>';
            }
        } catch (error) {
            console.error('❌ Error displaying messages history:', error);
        }
    }

    enableChatInput() {
        try {
            const messageInput = document.getElementById('messageInput');
            const sendBtn = document.getElementById('sendBtn');
            
            if (messageInput) messageInput.disabled = false;
            if (sendBtn) sendBtn.disabled = false;
        } catch (error) {
            console.error('❌ Error enabling chat input:', error);
        }
    }

    disableChatInput() {
        try {
            const messageInput = document.getElementById('messageInput');
            const sendBtn = document.getElementById('sendBtn');
            
            if (messageInput) messageInput.disabled = true;
            if (sendBtn) sendBtn.disabled = true;
        } catch (error) {
            console.error('❌ Error disabling chat input:', error);
        }
    }

    async loadUserChats() {
        try {
            console.log('💾 Loading user chats...');
            
            // Временная заглушка - всегда показываем mock чаты
            this.displayMockChats();
            
        } catch (error) {
            console.error('❌ Error loading chats:', error);
            this.displayMockChats();
        }
    }

    displayMockChats() {
        const mockChats = [
            {
                id: 'chat-1',
                participants: [
                    { id: this.currentUser.id, username: this.currentUser.username, role: this.currentUser.role },
                    { id: 'listener-1', username: 'Анна Слушатель', role: 'listener' }
                ]
            },
            {
                id: 'chat-2', 
                participants: [
                    { id: this.currentUser.id, username: this.currentUser.username, role: this.currentUser.role },
                    { id: 'listener-2', username: 'Максим Помощник', role: 'listener' }
                ]
            }
        ];

        this.displayChats(mockChats);
    }

    displayChats(chats) {
        try {
            let container;
            
            if (this.currentUser?.role === 'listener') {
                container = document.getElementById('listenerChatsList');
            } else {
                container = document.getElementById('userChatsList');
            }
            
            if (!container) return;

            container.innerHTML = '';

            chats.forEach(chat => {
                const otherUser = chat.participants.find(p => p.id !== this.currentUser.id);
                if (!otherUser) return;
                
                const item = document.createElement('div');
                item.className = `chat-card ${this.currentChat === chat.id ? 'active' : ''}`;
                item.innerHTML = `
                    <img src="${otherUser.avatar_url || '/images/default-avatar.png'}" alt="Avatar" class="avatar" onerror="this.src='/images/default-avatar.png'">
                    <div class="chat-info">
                        <div class="chat-partner">${otherUser.username}</div>
                        <div class="chat-user-role">${this.getRoleDisplayName(otherUser.role)}</div>
                    </div>
                `;
                
                item.addEventListener('click', () => {
                    this.joinChat(chat.id);
                });
                
                container.appendChild(item);
            });
        } catch (error) {
            console.error('❌ Error displaying chats:', error);
        }
    }

    async loadListenerData() {
        await this.loadListenerReviews();
    }

    async loadListenerReviews() {
        try {
            // Mock reviews для тестирования
            const mockReviews = [
                {
                    user_id: { username: 'Иван Иванов' },
                    rating: 5,
                    comment: 'Отличный слушатель! Очень помог.',
                    created_at: new Date().toISOString()
                },
                {
                    user_id: { username: 'Мария Петрова' },
                    rating: 4,
                    comment: 'Спасибо за поддержку',
                    created_at: new Date().toISOString()
                }
            ];
            
            this.displayReviews(mockReviews);
        } catch (error) {
            console.error('❌ Error loading reviews:', error);
        }
    }

    displayReviews(reviews) {
        const container = document.getElementById('reviewsList');
        if (!container) return;

        container.innerHTML = '';

        reviews.forEach(review => {
            const item = document.createElement('div');
            item.className = 'review-item';
            item.innerHTML = `
                <div class="review-header">
                    <strong>${review.user_id?.username || 'Аноним'}</strong>
                    <div class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
                </div>
                ${review.comment ? `<div class="review-comment">${review.comment}</div>` : ''}
                <small class="review-date">${this.formatTime(review.created_at)}</small>
            `;
            container.appendChild(item);
        });
    }

    changeTheme(theme) {
        try {
            const themeStyle = document.getElementById('theme-style');
            if (themeStyle) {
                themeStyle.href = `css/${theme}-theme.css`;
            }
            localStorage.setItem('theme', theme);
            
            const dropdown = document.getElementById('themeDropdown');
            if (dropdown) {
                dropdown.style.display = 'none';
            }
            
            this.showNotification(`Тема изменена на ${theme}`, 'success');
        } catch (error) {
            console.error('❌ Error changing theme:', error);
        }
    }

    formatTime(timestamp) {
        try {
            return new Date(timestamp).toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return '--:--';
        }
    }

    showNotification(message, type = 'info') {
        try {
            // Простая реализация через alert
            const typeEmoji = {
                'success': '✅',
                'error': '❌', 
                'warning': '⚠️',
                'info': 'ℹ️'
            };
            
            alert(`${typeEmoji[type] || 'ℹ️'} ${message}`);
        } catch (error) {
            console.log(`Notification [${type}]: ${message}`);
        }
    }

    logout() {
        try {
            if (this.socket) {
                this.socket.disconnect();
            }
            
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
        } catch (error) {
            console.error('❌ Error during logout:', error);
            window.location.href = '/';
        }
    }

    loadInterfaceData() {
        console.log('🎨 Interface loaded successfully');
        this.showNotification('Приложение загружено!', 'success');
    }
}

// Безопасная инициализация
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('🚀 Starting ChatApp...');
        new ChatApp();
    } catch (error) {
        console.error('❌ Failed to initialize ChatApp:', error);
        alert('Ошибка загрузки приложения. Проверьте консоль для деталей.');
    }
});
