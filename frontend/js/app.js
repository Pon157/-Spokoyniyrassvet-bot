/**
 * ChatApp - Основной класс приложения чата
 */
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
    }

    async init() {
        console.log('🚀 Инициализация чата для:', this.currentUser?.username);
        
        // Проверяем аутентификацию
        const isAuthenticated = await this.verifyAuth();
        if (!isAuthenticated) {
            this.logout();
            return;
        }
        
        this.initSocket();
        this.loadUserData();
        this.setupEventListeners();
        this.loadStickers();
    }

    async verifyAuth() {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                console.log('❌ Токен не найден');
                return false;
            }

            const response = await fetch('/api/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                return false;
            }

            const data = await response.json();
            
            if (data.success) {
                localStorage.setItem('user_data', JSON.stringify(data.user));
                this.currentUser = data.user;
                return true;
            } else {
                return false;
            }
        } catch (error) {
            console.error('❌ Ошибка проверки аутентификации:', error);
            return false;
        }
    }

    initSocket() {
        const token = localStorage.getItem('auth_token');
        
        try {
            // Проверяем, что Socket.io доступен
            if (typeof io === 'undefined') {
                console.error('❌ Socket.io не загружен');
                setTimeout(() => this.initSocket(), 3000);
                return;
            }

            console.log('🔌 Инициализация WebSocket подключения...');
            
            this.socket = io({
                auth: {
                    token: token
                },
                transports: ['websocket', 'polling'],
                timeout: 10000
            });

            this.socket.on('connect', () => {
                console.log('✅ WebSocket подключен');
                this.showNotification('Подключено к чату', 'success');
            });

            this.socket.on('disconnect', (reason) => {
                console.log('❌ WebSocket отключен:', reason);
                this.showNotification('Соединение прервано', 'error');
            });

            this.socket.on('connect_error', (error) => {
                console.error('❌ Ошибка подключения WebSocket:', error);
                this.showNotification('Ошибка подключения', 'error');
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

        } catch (error) {
            console.error('❌ Ошибка инициализации WebSocket:', error);
            setTimeout(() => this.initSocket(), 5000);
        }
    }

    loadUserData() {
        // Обновляем интерфейс пользователя
        const usernameElement = document.getElementById('username');
        const userRoleElement = document.getElementById('userRole');
        const userAvatarElement = document.getElementById('userAvatar');
        
        if (usernameElement) usernameElement.textContent = this.currentUser.username;
        if (userRoleElement) userRoleElement.textContent = this.getRoleDisplayName(this.currentUser.role);
        if (userAvatarElement) {
            userAvatarElement.src = this.currentUser.avatar_url || '/images/default-avatar.svg';
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

        // Отправка сообщения
        const messageInput = document.getElementById('messageInput');
        const sendMessageBtn = document.getElementById('sendMessageBtn');
        
        if (messageInput && sendMessageBtn) {
            sendMessageBtn.addEventListener('click', () => {
                this.sendMessage();
            });
            
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // Новый чат
        const newChatBtn = document.getElementById('newChatBtn');
        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => {
                this.createNewChat();
            });
        }
    }

    async switchSidebarTab(tabName) {
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

        switch(tabName) {
            case 'chats':
                await this.loadChats();
                break;
            case 'listeners':
                await this.loadListeners();
                break;
        }
    }

    async loadChats() {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/chat/chats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.chats = data.chats;
                    this.renderChats();
                }
            } else {
                console.error('❌ Ошибка загрузки чатов:', response.status);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки чатов:', error);
        }
    }

    async loadListeners() {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/chat/listeners', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.listeners = data.listeners;
                    this.renderListeners();
                }
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки слушателей:', error);
        }
    }

    async loadStickers() {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/chat/stickers', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.stickers = data.stickers;
                }
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки стикеров:', error);
        }
    }

    renderChats() {
        const chatsContainer = document.getElementById('chatsContainer');
        if (!chatsContainer) return;

        if (this.chats.length === 0) {
            chatsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comments"></i>
                    <p>У вас пока нет чатов</p>
                    <button class="btn btn-primary" onclick="window.chatApp.createNewChat()">Начать первый чат</button>
                </div>
            `;
            return;
        }

        chatsContainer.innerHTML = this.chats.map(chat => `
            <div class="chat-item ${this.currentChat?.id === chat.id ? 'active' : ''}" 
                 onclick="window.chatApp.selectChat('${chat.id}')">
                <img src="${chat.partner_avatar}" 
                     class="chat-avatar"
                     onerror="this.src='/images/default-avatar.svg'">
                <div class="chat-info">
                    <div class="chat-header">
                        <span class="chat-partner">${chat.partner_name}</span>
                        <span class="chat-time">${this.formatTime(chat.last_message_time)}</span>
                    </div>
                    <div class="chat-preview">
                        <span class="last-message">${chat.last_message}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderListeners() {
        const listenersContainer = document.getElementById('listenersContainer');
        if (!listenersContainer) return;

        listenersContainer.innerHTML = this.listeners.map(listener => `
            <div class="listener-item">
                <img src="${listener.avatar_url}" 
                     class="listener-avatar"
                     onerror="this.src='/images/default-avatar.svg'">
                <div class="listener-info">
                    <div class="listener-header">
                        <span class="listener-name">${listener.username}</span>
                        <span class="listener-status online">
                            <div class="status-dot"></div>
                            Online
                        </span>
                    </div>
                    <div class="listener-details">
                        <span class="listener-specialty">${listener.specialty}</span>
                        <span class="listener-rating">⭐ ${listener.avg_rating}</span>
                    </div>
                </div>
                <button class="btn btn-sm btn-primary"
                        onclick="window.chatApp.startChatWithListener('${listener.id}')">
                    💬 Чат
                </button>
            </div>
        `).join('');
    }

    selectChat(chatId) {
        console.log('💬 Выбор чата:', chatId);
        this.currentChat = this.chats.find(chat => chat.id === chatId);
        
        if (this.currentChat) {
            this.renderChats();
            this.loadChatMessages(chatId);
            
            // Присоединяемся к комнате чата
            if (this.socket) {
                this.socket.emit('join_chat', chatId);
            }
        }
    }

    async loadChatMessages(chatId) {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/chat/messages/${chatId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.renderMessages(data.messages);
                }
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки сообщений:', error);
        }
    }

    renderMessages(messages) {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) return;

        messagesContainer.innerHTML = messages.map(message => `
            <div class="message ${message.sender_id === this.currentUser.id ? 'outgoing' : 'incoming'}">
                <div class="message-content">
                    <div class="message-text">${message.content}</div>
                    <div class="message-time">${this.formatTime(message.created_at)}</div>
                </div>
            </div>
        `).join('');

        // Прокручиваем вниз
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        if (!messageInput || !this.currentChat) return;

        const content = messageInput.value.trim();
        if (!content) return;

        try {
            if (this.socket && this.socket.connected) {
                // Отправляем через WebSocket
                this.socket.emit('send_message', {
                    chat_id: this.currentChat.id,
                    content: content,
                    message_type: 'text'
                });
            } else {
                // Fallback через HTTP
                const token = localStorage.getItem('auth_token');
                const response = await fetch('/api/chat/send-message', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        chat_id: this.currentChat.id,
                        content: content,
                        message_type: 'text'
                    })
                });

                if (!response.ok) {
                    throw new Error('Ошибка отправки сообщения');
                }
            }

            // Очищаем поле ввода
            messageInput.value = '';
            
        } catch (error) {
            console.error('❌ Ошибка отправки сообщения:', error);
            this.showNotification('Ошибка отправки сообщения', 'error');
        }
    }

    handleNewMessage(message) {
        if (this.currentChat && message.chat_id === this.currentChat.id) {
            // Добавляем сообщение в текущий чат
            this.renderMessages([message]);
        }
        
        // Обновляем список чатов
        this.loadChats();
    }

    showTypingIndicator(data) {
        // Реализация индикатора набора текста
        console.log('Пользователь печатает:', data);
    }

    async startChatWithListener(listenerId) {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/chat/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    listener_id: listenerId
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.showNotification('Чат создан!', 'success');
                    this.selectChat(data.chat.id);
                    this.switchSidebarTab('chats');
                }
            }
        } catch (error) {
            console.error('❌ Ошибка создания чата:', error);
            this.showNotification('Ошибка создания чата', 'error');
        }
    }

    createNewChat() {
        this.switchSidebarTab('listeners');
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

    formatTime(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }

    showNotification(message, type = 'info') {
        // Простая реализация уведомлений
        console.log(`🔔 ${type}: ${message}`);
        
        // Можно добавить красивый toast
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
            color: white;
            border-radius: 8px;
            z-index: 10000;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    logout() {
        if (this.socket) {
            this.socket.disconnect();
        }
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        window.location.href = '/';
    }
}

// Проверка аутентификации при загрузке
document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    
    if (!token || !userData) {
        window.location.href = '/';
        return;
    }
    
    try {
        const user = JSON.parse(userData);
        
        // Проверяем, что пользователь на правильной странице
        const currentPage = window.location.pathname;
        const correctPage = getCorrectPageForRole(user.role);
        
        if (currentPage !== correctPage) {
            window.location.href = correctPage;
            return;
        }
        
        // Инициализируем приложение
        window.chatApp = new ChatApp();
        window.chatApp.init();
        
    } catch (error) {
        console.error('Ошибка загрузки пользователя:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        window.location.href = '/';
    }
});

function getCorrectPageForRole(role) {
    const routes = {
        'owner': '/owner.html',
        'admin': '/admin.html',
        'coowner': '/coowner.html',
        'listener': '/listener.html',
        'user': '/chat.html'
    };
    return routes[role] || '/chat.html';
}
