// Удаляем существующий ChatApp если есть
if (window.ChatApp) {
    console.log('⚠️ Удаляем старый ChatApp');
    delete window.ChatApp;
}

// Проверяем что класс еще не объявлен
if (typeof ChatApp === 'undefined') {
    class ChatApp {
        constructor() {
            this.currentUser = null;
            this.currentChat = null;
            this.chats = [];
            this.listeners = [];
            this.init();
        }

        async init() {
            console.log('🚀 Инициализация чата');
            
            // Получаем данные пользователя
            const userData = localStorage.getItem('user_data');
            if (userData) {
                this.currentUser = JSON.parse(userData);
                console.log('👤 Пользователь:', this.currentUser.username);
            }

            // Проверяем аутентификацию
            const isAuthenticated = await this.verifyAuth();
            if (!isAuthenticated) {
                this.logout();
                return;
            }
            
            this.setupSocketClient();
            this.loadUserData();
            this.setupEventListeners();
        }

        async verifyAuth() {
            try {
                const token = localStorage.getItem('auth_token');
                const response = await fetch('/api/auth/verify', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data = await response.json();
                return data.success;
            } catch (error) {
                console.error('Ошибка проверки аутентификации:', error);
                return false;
            }
        }

        setupSocketClient() {
            // Используем глобальный socketClient
            this.socketClient = window.socketClient;
            
            // Настраиваем обработчики событий
            this.socketClient.on('connect', () => {
                console.log('✅ WebSocket подключен в ChatApp');
                this.showNotification('Подключено к чату', 'success');
            });

            this.socketClient.on('disconnect', (reason) => {
                console.log('❌ WebSocket отключен:', reason);
                this.showNotification('Соединение прервано', 'error');
            });

            this.socketClient.on('new_message', (message) => {
                this.handleNewMessage(message);
            });

            this.socketClient.on('active_listeners_list', (listeners) => {
                this.handleActiveListeners(listeners);
            });

            this.socketClient.on('chat_created', (data) => {
                this.handleChatCreated(data);
            });

            this.socketClient.on('new_chat_request', (data) => {
                this.handleNewChatRequest(data);
            });

            this.socketClient.on('chat_accepted', (data) => {
                this.handleChatAccepted(data);
            });

            this.socketClient.on('error', (error) => {
                console.error('Socket error:', error);
                this.showNotification('Ошибка соединения', 'error');
            });
        }

        async loadUserData() {
            // Обновляем интерфейс пользователя
            const usernameElement = document.getElementById('username');
            const userRoleElement = document.getElementById('userRole');
            
            if (usernameElement) usernameElement.textContent = this.currentUser.username;
            if (userRoleElement) userRoleElement.textContent = this.getRoleDisplayName(this.currentUser.role);

            await this.loadChats();
            await this.loadListeners();
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

        renderChats() {
            const chatsContainer = document.getElementById('chatsContainer');
            if (!chatsContainer) return;

            if (this.chats.length === 0) {
                chatsContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-comments"></i>
                        <p>У вас пока нет чатов</p>
                        <button class="btn btn-primary" id="startFirstChatBtn">Начать первый чат</button>
                    </div>
                `;
                
                document.getElementById('startFirstChatBtn')?.addEventListener('click', () => {
                    this.createNewChat();
                });
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
                            <span class="listener-status ${listener.is_online ? 'online' : 'offline'}">
                                <div class="status-dot"></div>
                                ${listener.is_online ? 'Online' : 'Offline'}
                            </span>
                        </div>
                        <div class="listener-details">
                            <span class="listener-specialty">${listener.specialties?.[0] || 'Психология'}</span>
                            <span class="listener-rating">⭐ ${listener.rating?.toFixed(1) || '4.5'}</span>
                        </div>
                    </div>
                    <button class="btn btn-sm btn-primary start-chat-btn"
                            onclick="window.chatApp.startChatWithListener('${listener.id}')"
                            ${!listener.is_online ? 'disabled' : ''}>
                        ${listener.is_online ? '💬 Чат' : '❌ Офлайн'}
                    </button>
                </div>
            `).join('');
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

            if (tabName === 'listeners') {
                this.socketClient.getActiveListeners();
            }
        }

        selectChat(chatId) {
            this.currentChat = this.chats.find(chat => chat.id === chatId);
            
            if (this.currentChat) {
                this.renderChats();
                this.loadChatMessages(chatId);
                this.socketClient.joinChat(chatId);
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

            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        sendMessage() {
            const messageInput = document.getElementById('messageInput');
            if (!messageInput || !this.currentChat) return;

            const content = messageInput.value.trim();
            if (!content) return;

            this.socketClient.sendMessage(this.currentChat.id, content);
            messageInput.value = '';
        }

        createNewChat() {
            this.switchSidebarTab('listeners');
        }

        startChatWithListener(listenerId) {
            this.socketClient.startChatWithListener(listenerId);
        }

        // Обработчики событий WebSocket
        handleNewMessage(message) {
            if (this.currentChat && message.chat_id === this.currentChat.id) {
                this.renderMessages([message]);
            }
            this.loadChats(); // Обновляем список чатов
        }

        handleActiveListeners(listeners) {
            this.listeners = listeners;
            this.renderListeners();
        }

        handleChatCreated(data) {
            this.showNotification(data.is_new ? 'Чат создан!' : 'Продолжаем существующий чат', 'success');
            this.selectChat(data.chat.id);
            this.loadChats();
        }

        handleNewChatRequest(data) {
            if (this.currentUser.role === 'listener') {
                this.showChatRequestNotification(data);
            }
        }

        handleChatAccepted(data) {
            this.showNotification(`Слушатель ${data.listener_name} принял ваш чат!`, 'success');
        }

        showChatRequestNotification(data) {
            const notification = `
                <div class="chat-request-notification">
                    <div class="notification-header">
                        <strong>${data.username}</strong>
                        <span>хочет начать чат</span>
                    </div>
                    <div class="notification-actions">
                        <button class="btn btn-sm btn-success" onclick="window.chatApp.acceptChatRequest('${data.chat_id}')">
                            Принять
                        </button>
                    </div>
                </div>
            `;
            this.showCustomNotification(notification, 'info', 10000);
        }

        acceptChatRequest(chatId) {
            this.socketClient.acceptChatRequest(chatId);
        }

        // Вспомогательные методы
        showNotification(message, type = 'info') {
            console.log(`🔔 ${type}: ${message}`);
            // Простая реализация уведомлений
            alert(`${type.toUpperCase()}: ${message}`);
        }

        showCustomNotification(html, type, duration) {
            // Можно реализовать кастомные уведомления
            console.log('Custom notification:', html);
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

        logout() {
            if (this.socketClient) {
                this.socketClient.disconnect();
            }
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            window.location.href = '/';
        }
    }

    // Экспортируем класс
    window.ChatApp = ChatApp;
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    
    if (!token || !userData) {
        window.location.href = '/';
        return;
    }
    
    try {
        const user = JSON.parse(userData);
        const currentPage = window.location.pathname;
        const correctPage = getCorrectPageForRole(user.role);
        
        if (currentPage !== correctPage) {
            window.location.href = correctPage;
            return;
        }
        
        window.chatApp = new ChatApp();
        
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
