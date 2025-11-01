class ChatManager {
    constructor() {
        this.currentUser = null;
        this.currentChat = null;
        this.socket = null;
        this.API_BASE = 'http://spokoyniyrassvet.webtm.ru';
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.setupEventListeners();
        this.loadTheme();
        this.loadUserData();
        
        if (this.currentUser.role === 'user') {
            this.showListenersSection();
            this.loadAvailableListeners();
        } else if (this.currentUser.role === 'listener') {
            this.showActiveChats();
        }
        
        this.loadActiveUsers();
    }

    async checkAuth() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');

        if (!token || !user) {
            window.location.href = '/';
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE}/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Not authenticated');
            }

            const data = await response.json();
            this.currentUser = data.user;
            
        } catch (error) {
            console.error('Auth check failed:', error);
            this.logout();
        }
    }

    setupEventListeners() {
        // Форма отправки сообщения
        document.getElementById('messageForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });

        // Кнопка начала чата
        document.getElementById('startChatBtn').addEventListener('click', () => {
            this.startNewChat();
        });

        // Кнопка завершения чата
        document.getElementById('endChatBtn').addEventListener('click', () => {
            this.endChat();
        });

        // Кнопка отзыва
        document.getElementById('rateChatBtn').addEventListener('click', () => {
            this.openRateModal();
        });

        // Ввод сообщения
        document.getElementById('messageInput').addEventListener('input', (e) => {
            this.handleTyping(e.target.value);
        });

        // Тема
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

    loadUserData() {
        document.getElementById('userWelcome').textContent = `Привет, ${this.currentUser.username}!`;
        
        if (this.currentUser.role === 'listener') {
            document.getElementById('welcomeText').textContent = 'Ожидайте подключения пользователей...';
        }
    }

    async loadAvailableListeners() {
        try {
            const response = await fetch(`${this.API_BASE}/admin/users?role=listener&is_online=true`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderListenersList(data.users);
            }
        } catch (error) {
            console.error('Error loading listeners:', error);
        }
    }

    renderListenersList(listeners) {
        const container = document.getElementById('listenersList');
        container.innerHTML = '';

        listeners.forEach(listener => {
            const listenerElement = document.createElement('div');
            listenerElement.className = 'user-item';
            listenerElement.innerHTML = `
                <img src="${listener.avatar_url || 'images/default-avatar.png'}" 
                     alt="${listener.username}" class="user-avatar">
                <div class="user-info">
                    <strong>${listener.username}</strong>
                    <span class="status-online">● онлайн</span>
                </div>
                <button class="btn btn-primary btn-sm" onclick="chatManager.startChatWithListener('${listener.id}')">
                    Начать чат
                </button>
            `;
            container.appendChild(listenerElement);
        });
    }

    async startChatWithListener(listenerId) {
        try {
            const response = await fetch(`${this.API_BASE}/chat/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ listenerId })
            });

            if (response.ok) {
                const data = await response.json();
                this.openChat(data.chat);
            } else {
                this.showMessage('Ошибка создания чата', 'error');
            }
        } catch (error) {
            console.error('Error starting chat:', error);
            this.showMessage('Ошибка соединения', 'error');
        }
    }

    async openChat(chat) {
        this.currentChat = chat;
        
        // Показываем интерфейс чата
        document.getElementById('noChatSelected').style.display = 'none';
        document.getElementById('chatHeader').style.display = 'flex';
        document.getElementById('messageInputContainer').style.display = 'block';
        
        // Обновляем заголовок
        const otherUser = chat.user_id === this.currentUser.id ? chat.listener : chat.user;
        document.getElementById('chatWithUser').textContent = otherUser.username;
        
        // Показываем кнопки действий
        if (this.currentUser.role === 'user') {
            document.getElementById('endChatBtn').style.display = 'block';
            document.getElementById('rateChatBtn').style.display = 'block';
        }

        // Загружаем сообщения
        await this.loadChatMessages(chat.id);
        
        // Подключаемся к сокету чата
        if (this.socket) {
            this.socket.emit('join_chat', chat.id);
        }
    }

    async loadChatMessages(chatId) {
        try {
            const response = await fetch(`${this.API_BASE}/chat/${chatId}/messages`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderMessages(data.messages);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }

    renderMessages(messages) {
        const container = document.getElementById('messagesContainer');
        container.innerHTML = '';

        messages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            container.appendChild(messageElement);
        });

        this.scrollToBottom();
    }

    createMessageElement(message) {
        const isOwn = message.sender_id === this.currentUser.id;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-item ${isOwn ? 'own' : 'other'} fade-in`;

        let contentHtml = '';
        
        switch (message.message_type) {
            case 'image':
                contentHtml = `<div class="media-message">
                    <img src="${message.media_url}" alt="Изображение" onclick="openMediaViewer('${message.media_url}')">
                </div>`;
                break;
            case 'video':
                contentHtml = `<div class="media-message">
                    <video controls src="${message.media_url}"></video>
                </div>`;
                break;
            case 'audio':
                contentHtml = `<div class="audio-message">
                    <audio controls src="${message.media_url}"></audio>
                </div>`;
                break;
            case 'sticker':
                contentHtml = `<div class="sticker-message">${message.content}</div>`;
                break;
            default:
                contentHtml = `<div class="message-text">${this.escapeHtml(message.content)}</div>`;
        }

        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${message.sender.username}</span>
                <span class="message-time">${this.formatTime(message.created_at)}</span>
            </div>
            ${contentHtml}
        `;

        return messageDiv;
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const content = input.value.trim();

        if (!content || !this.currentChat) return;

        try {
            const response = await fetch(`${this.API_BASE}/chat/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    chatId: this.currentChat.id,
                    content: content,
                    messageType: 'text'
                })
            });

            if (response.ok) {
                input.value = '';
                this.autoResize(input);
            } else {
                this.showMessage('Ошибка отправки сообщения', 'error');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.showMessage('Ошибка соединения', 'error');
        }
    }

    handleTyping(text) {
        if (!this.currentChat || !this.socket) return;

        if (text.length > 0) {
            this.socket.emit('typing_start', { chatId: this.currentChat.id });
            this.typingTimeout = setTimeout(() => {
                this.socket.emit('typing_stop', { chatId: this.currentChat.id });
            }, 1000);
        } else {
            this.socket.emit('typing_stop', { chatId: this.currentChat.id });
            if (this.typingTimeout) {
                clearTimeout(this.typingTimeout);
            }
        }
    }

    showListenersSection() {
        document.getElementById('listenersSection').style.display = 'block';
        document.getElementById('startChatBtn').style.display = 'block';
    }

    changeTheme(theme) {
        const themeStyle = document.getElementById('theme-style');
        themeStyle.href = `css/${theme}-theme.css`;
        localStorage.setItem('theme', theme);
        document.getElementById('themeDropdown').style.display = 'none';
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.changeTheme(savedTheme);
    }

    showMessage(text, type) {
        const messageEl = document.getElementById('message');
        messageEl.textContent = text;
        messageEl.className = `message ${type}`;
        
        setTimeout(() => {
            messageEl.textContent = '';
            messageEl.className = 'message';
        }, 5000);
    }

    autoResize(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    scrollToBottom() {
        const container = document.getElementById('messagesContainer');
        container.scrollTop = container.scrollHeight;
    }

    formatTime(dateString) {
        return new Date(dateString).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    }
}

// Глобальные функции
function openSettings() {
    window.location.href = '/settings.html';
}

function logout() {
    chatManager.logout();
}

function openMediaPicker() {
    document.getElementById('mediaModal').style.display = 'block';
}

function closeMediaPicker() {
    document.getElementById('mediaModal').style.display = 'none';
}

function openStickerPicker() {
    document.getElementById('stickerModal').style.display = 'block';
}

function closeStickerPicker() {
    document.getElementById('stickerModal').style.display = 'none';
}

function startVoiceRecording() {
    // Реализация записи голоса
    alert('Функция записи голоса в разработке');
}

// Инициализация
const chatManager = new ChatManager();
