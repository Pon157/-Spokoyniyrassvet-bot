class ChatApp {
    constructor() {
        console.log('🚀 Инициализация ChatApp');
        this.socket = null;
        this.currentUser = null;
        this.currentChat = null;
        this.chats = [];
        
        this.init();
    }

    async init() {
        try {
            await this.loadUserData();
            this.setupSocketConnection();
            this.bindEvents();
            this.loadChats();
            
            console.log('✅ ChatApp инициализирован');
        } catch (error) {
            console.error('❌ Ошибка инициализации ChatApp:', error);
            this.showNotification('Ошибка загрузки данных. Пожалуйста, войдите снова.', 'error');
            // Перенаправляем на страницу входа только при критической ошибке
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 3000);
        }
    }

    async loadUserData() {
        const token = localStorage.getItem('auth_token');
        const userData = localStorage.getItem('user_data');
        
        if (!token || !userData) {
            throw new Error('Пользователь не аутентифицирован');
        }

        try {
            const response = await fetch('/api/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Ошибка верификации токена');
            }

            const data = await response.json();
            this.currentUser = JSON.parse(userData);
            this.updateUserInterface();
            console.log('👤 Пользователь:', this.currentUser.username);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки пользователя:', error);
            this.clearAuth();
            throw error;
        }
    }

    updateUserInterface() {
        const usernameElement = document.getElementById('username');
        const userRoleElement = document.getElementById('userRole');
        const userAvatarElement = document.getElementById('userAvatar');

        if (usernameElement) {
            usernameElement.textContent = this.currentUser.username;
        }
        
        if (userRoleElement) {
            userRoleElement.textContent = this.getRoleDisplayName(this.currentUser.role);
        }
        
        if (userAvatarElement) {
            userAvatarElement.src = this.currentUser.avatar_url || '/images/default-avatar.svg';
        }

        // Показываем соответствующие вкладки для роли
        this.showRoleSpecificTabs();
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

    showRoleSpecificTabs() {
        const role = this.currentUser.role;
        
        // Показываем вкладки в зависимости от роли
        const listenersTab = document.getElementById('listenersTab');
        const reviewsTab = document.getElementById('reviewsTab');
        const adminTab = document.getElementById('adminTab');
        const coownerTab = document.getElementById('coownerTab');
        const ownerTab = document.getElementById('ownerTab');

        if (listenersTab) listenersTab.style.display = role === 'user' ? 'flex' : 'none';
        if (reviewsTab) reviewsTab.style.display = 'flex'; // Все могут видеть отзывы
        
        // Админские вкладки
        if (adminTab) adminTab.style.display = ['admin', 'coowner', 'owner'].includes(role) ? 'flex' : 'none';
        if (coownerTab) coownerTab.style.display = ['coowner', 'owner'].includes(role) ? 'flex' : 'none';
        if (ownerTab) ownerTab.style.display = role === 'owner' ? 'flex' : 'none';
    }

    setupSocketConnection() {
        try {
            const token = localStorage.getItem('auth_token');
            
            this.socket = io({
                auth: {
                    token: token
                },
                transports: ['websocket', 'polling']
            });

            this.socket.on('connect', () => {
                console.log('✅ WebSocket подключен');
                this.showNotification('Подключено к чату', 'success');
            });

            this.socket.on('authenticated', (data) => {
                console.log('🔐 WebSocket аутентифицирован:', data.user.username);
            });

            this.socket.on('new_message', (message) => {
                console.log('📨 Новое сообщение:', message);
                this.handleNewMessage(message);
            });

            this.socket.on('chat_created', (data) => {
                console.log('✅ Чат создан:', data.chat.id);
                this.showNotification('Чат создан успешно!', 'success');
                this.loadChats(); // Обновляем список чатов
            });

            this.socket.on('error', (error) => {
                console.error('❌ WebSocket ошибка:', error);
                this.showNotification(error.message || 'Ошибка соединения', 'error');
            });

            this.socket.on('disconnect', () => {
                console.log('🔌 WebSocket отключен');
                this.showNotification('Соединение прервано', 'warning');
            });

        } catch (error) {
            console.error('❌ Ошибка подключения WebSocket:', error);
        }
    }

    bindEvents() {
        console.log('🔧 Привязка событий...');

        // Навигация по вкладкам
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = e.currentTarget.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Кнопки чата
        document.getElementById('startChatBtn')?.addEventListener('click', () => {
            this.createNewChat();
        });

        document.getElementById('newChatBtn')?.addEventListener('click', () => {
            this.createNewChat();
        });

        document.getElementById('sendBtn')?.addEventListener('click', () => {
            this.sendMessage();
        });

        document.getElementById('messageInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Настройки
        document.getElementById('settingsBtn')?.addEventListener('click', () => {
            this.openSettings();
        });

        console.log('✅ Все события привязаны');
    }

    switchTab(tabName) {
        // Скрыть все вкладки
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // Показать выбранную вкладку
        const targetTab = document.getElementById(`${tabName}Tab`);
        const targetButton = document.querySelector(`[data-tab="${tabName}"]`);
        
        if (targetTab && targetButton) {
            targetTab.classList.add('active');
            targetButton.classList.add('active');
            
            // Загружаем данные для вкладки
            this.loadTabData(tabName);
        }
    }

    loadTabData(tabName) {
        switch(tabName) {
            case 'chats':
                this.loadChats();
                break;
            case 'listeners':
                // Загрузка слушателей будет через ListenersUI
                break;
            case 'reviews':
                this.loadReviews();
                break;
            // Остальные вкладки...
        }
    }

    async loadChats() {
        try {
            console.log('💬 Загрузка чатов...');
            const token = localStorage.getItem('auth_token');
            
            const response = await fetch('/api/chat/chats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Ошибка загрузки чатов');
            }

            const data = await response.json();
            this.chats = data.chats || [];
            this.renderChatsList();
            
        } catch (error) {
            console.error('❌ Ошибка загрузки чатов:', error);
            this.showNotification('Ошибка загрузки чатов', 'error');
            this.renderChatsError();
        }
    }

    renderChatsList() {
        const chatsList = document.getElementById('chatsList');
        if (!chatsList) return;

        if (this.chats.length === 0) {
            chatsList.innerHTML = `
                <div class="no-chats">
                    <i class="fas fa-comments"></i>
                    <h3>Нет активных чатов</h3>
                    <p>Начните новый чат со слушателем</p>
                </div>
            `;
            return;
        }

        chatsList.innerHTML = this.chats.map(chat => `
            <div class="chat-item ${chat.id === this.currentChat?.id ? 'active' : ''}" 
                 data-chat-id="${chat.id}">
                <div class="chat-avatar">
                    <img src="${chat.partner_avatar}" alt="${chat.partner_name}" 
                         onerror="this.src='/images/default-avatar.svg'">
                    <div class="status-indicator ${chat.partner_online ? 'online' : 'offline'}"></div>
                </div>
                <div class="chat-info">
                    <div class="chat-partner">${chat.partner_name}</div>
                    <div class="chat-preview">${chat.last_message}</div>
                </div>
                <div class="chat-meta">
                    <div class="chat-time">${this.formatTime(chat.last_message_time)}</div>
                    ${chat.unread_count > 0 ? 
                        `<div class="unread-badge">${chat.unread_count}</div>` : ''}
                </div>
            </div>
        `).join('');

        // Добавляем обработчики клика
        chatsList.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', () => {
                const chatId = item.dataset.chatId;
                this.openChat(chatId);
            });
        });
    }

    renderChatsError() {
        const chatsList = document.getElementById('chatsList');
        if (chatsList) {
            chatsList.innerHTML = `
                <div class="no-chats error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Ошибка загрузки</h3>
                    <p>Не удалось загрузить чаты</p>
                    <button class="btn btn-sm btn-primary" onclick="window.app.loadChats()">
                        Попробовать снова
                    </button>
                </div>
            `;
        }
    }

    async openChat(chatId) {
        try {
            console.log('💬 Открытие чата:', chatId);
            
            const chat = this.chats.find(c => c.id === chatId);
            if (!chat) {
                throw new Error('Чат не найден');
            }

            this.currentChat = chat;

            // Обновляем UI
            document.getElementById('chatPlaceholder').classList.remove('active');
            document.getElementById('chatContainer').classList.add('active');

            // Обновляем информацию о партнере
            document.getElementById('partnerName').textContent = chat.partner_name;
            document.getElementById('partnerAvatar').src = chat.partner_avatar;
            document.getElementById('partnerStatus').innerHTML = `
                <i class="fas fa-circle"></i>
                <span>${chat.partner_online ? 'online' : 'offline'}</span>
            `;

            // Загружаем сообщения
            await this.loadMessages(chatId);

            // Присоединяемся к комнате чата
            if (this.socket) {
                this.socket.emit('join_chat', chatId);
            }

        } catch (error) {
            console.error('❌ Ошибка открытия чата:', error);
            this.showNotification('Ошибка открытия чата', 'error');
        }
    }

    async loadMessages(chatId) {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/chat/messages/${chatId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Ошибка загрузки сообщений');
            }

            const data = await response.json();
            this.renderMessages(data.messages || []);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки сообщений:', error);
            this.showNotification('Ошибка загрузки сообщений', 'error');
        }
    }

    renderMessages(messages) {
        const messagesContainer = document.getElementById('messages');
        if (!messagesContainer) return;

        messagesContainer.innerHTML = messages.map(message => `
            <div class="message ${message.sender_id === this.currentUser.id ? 'sent' : 'received'}">
                <div class="message-content">${this.escapeHtml(message.content)}</div>
                <div class="message-time">${this.formatTime(message.created_at)}</div>
            </div>
        `).join('');

        this.scrollToBottom();
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const content = messageInput?.value.trim();

        if (!content || !this.currentChat || !this.socket) {
            return;
        }

        try {
            // Отправляем через сокет
            this.socket.emit('send_message', {
                chat_id: this.currentChat.id,
                content: content,
                message_type: 'text'
            });

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
            this.addMessageToChat(message);
        }
        
        // Обновляем список чатов
        this.loadChats();
    }

    addMessageToChat(message) {
        const messagesContainer = document.getElementById('messages');
        if (!messagesContainer) return;

        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.sender_id === this.currentUser.id ? 'sent' : 'received'}`;
        messageElement.innerHTML = `
            <div class="message-content">${this.escapeHtml(message.content)}</div>
            <div class="message-time">${this.formatTime(message.created_at)}</div>
        `;

        messagesContainer.appendChild(messageElement);
        this.scrollToBottom();
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    createNewChat() {
        // Переключаемся на вкладку слушателей
        this.switchTab('listeners');
        this.showNotification('Выберите слушателя для начала чата', 'info');
    }

    openSettings() {
        this.showNotification('Настройки временно недоступны', 'info');
    }

    loadReviews() {
        // Заглушка для загрузки отзывов
        console.log('📝 Загрузка отзывов...');
    }

    // Вспомогательные методы
    formatTime(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } catch (error) {
            return 'только что';
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

    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationsContainer');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        container.appendChild(notification);

        // Закрытие по кнопке
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });

        // Автоматическое закрытие
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    hasPermission(permission) {
        // Упрощенная проверка прав
        const permissions = {
            'user': ['chat.basic', 'media.send', 'stickers.use'],
            'listener': ['chat.basic', 'media.send', 'stickers.use', 'chat.moderate'],
            'admin': ['chat.basic', 'media.send', 'stickers.use', 'chat.moderate', 'users.manage'],
            'coowner': ['chat.basic', 'media.send', 'stickers.use', 'chat.moderate', 'users.manage', 'financial.view'],
            'owner': ['chat.basic', 'media.send', 'stickers.use', 'chat.moderate', 'users.manage', 'financial.view', 'system.manage']
        };

        return permissions[this.currentUser.role]?.includes(permission) || false;
    }

    clearAuth() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Запуск приложения...');
    window.app = new ChatApp();
});
