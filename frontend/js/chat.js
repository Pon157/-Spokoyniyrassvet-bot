// chat.js
class ChatManager {
    constructor(app) {
        this.app = app;
        this.isTyping = false;
        this.typingTimeout = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.currentRating = 0;
        this.currentChat = null;
        this.chats = [];
        this.listeners = [];
        
        if (!this.app.currentUser) {
            console.error('❌ Пользователь не аутентифицирован');
            return;
        }
        
        this.init();
    }

    init() {
        console.log('🎯 Инициализация менеджера чата для:', this.app.currentUser.username);
        this.bindEvents();
        this.setupMessageInput();
        this.setupMediaHandlers();
        this.setupStickerHandlers();
        this.setupVoiceMessage();
        this.setupRoleSpecificHandlers();
        this.setupModalHandlers();
        this.setupSettingsHandlers();
        this.loadInitialData();
    }

    bindEvents() {
        // Навигация по вкладкам
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.currentTarget.dataset.tab);
            });
        });

        // Кнопки действий
        document.getElementById('newChatBtn')?.addEventListener('click', () => this.createNewChat());
        document.getElementById('startChatBtn')?.addEventListener('click', () => this.createNewChat());
        document.getElementById('closeChatBtn')?.addEventListener('click', () => this.closeCurrentChat());
        document.getElementById('settingsBtn')?.addEventListener('click', () => this.openSettings());
        
        // Звонки
        document.getElementById('callBtn')?.addEventListener('click', () => this.startCall());
        document.getElementById('videoBtn')?.addEventListener('click', () => this.startVideoCall());

        // Поиск
        document.getElementById('searchInput')?.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        console.log('✅ Все события привязаны');
    }

    async loadInitialData() {
        try {
            // Загрузка чатов пользователя
            await this.loadUserChats();
            
            // Загрузка доступных слушателей
            await this.loadAvailableListeners();
            
            // Установка начальной вкладки
            this.switchTab('chats');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки начальных данных:', error);
        }
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
            
            // Загрузить данные для вкладки
            this.loadTabData(tabName);
        }
    }

    loadTabData(tabName) {
        switch(tabName) {
            case 'chats':
                this.loadChatsList();
                break;
            case 'listeners':
                this.loadListenersList();
                break;
            case 'reviews':
                this.loadReviews();
                break;
            case 'admin':
                this.loadAdminPanel();
                break;
            case 'coowner':
                this.loadCoownerPanel();
                break;
            case 'owner':
                this.loadOwnerPanel();
                break;
        }
    }

    setupMessageInput() {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');

        if (!messageInput || !sendBtn) {
            console.error('❌ Элементы чата не найдены');
            return;
        }

        // Автоматическое увеличение высоты textarea
        messageInput.addEventListener('input', () => {
            this.handleTyping();
            this.autoResizeTextarea(messageInput);
        });

        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        sendBtn.addEventListener('click', () => {
            this.sendMessage();
        });

        console.log('✅ Поле ввода сообщения настроено');
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    setupMediaHandlers() {
        const mediaBtn = document.getElementById('mediaBtn');
        const mediaModal = document.getElementById('mediaModal');
        const mediaFile = document.getElementById('mediaFile');
        const selectFileBtn = document.getElementById('selectFileBtn');
        const uploadArea = document.getElementById('uploadArea');
        const sendMedia = document.getElementById('sendMedia');
        const cancelMedia = document.getElementById('cancelMedia');

        if (!mediaBtn || !mediaModal) {
            console.log('❌ Элементы медиа не найдены');
            return;
        }

        mediaBtn.addEventListener('click', () => {
            if (this.app.hasPermission('media.send')) {
                this.openModal('mediaModal');
            } else {
                this.app.showNotification('Нет прав для отправки медиа', 'error');
            }
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--primary-color)';
            uploadArea.style.background = 'rgba(102, 126, 234, 0.05)';
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = 'rgba(102, 126, 234, 0.3)';
            uploadArea.style.background = 'transparent';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'rgba(102, 126, 234, 0.3)';
            uploadArea.style.background = 'transparent';
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                mediaFile.files = files;
                this.previewMedia(files[0]);
            }
        });

        selectFileBtn.addEventListener('click', () => {
            mediaFile.click();
        });

        mediaFile.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.previewMedia(e.target.files[0]);
            }
        });

        sendMedia.addEventListener('click', () => {
            this.sendMediaMessage();
        });

        cancelMedia.addEventListener('click', () => {
            this.closeModal('mediaModal');
        });

        console.log('✅ Медиа хендлеры настроены');
    }

    setupStickerHandlers() {
        const stickerBtn = document.getElementById('stickerBtn');
        const stickerModal = document.getElementById('stickerModal');

        if (!stickerBtn || !stickerModal) {
            console.log('❌ Элементы стикеров не найдены');
            return;
        }

        stickerBtn.addEventListener('click', () => {
            if (this.app.hasPermission('stickers.use')) {
                this.loadStickers();
                this.openModal('stickerModal');
            } else {
                this.app.showNotification('Нет прав для использования стикеров', 'error');
            }
        });

        // Категории стикеров
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.filterStickers(e.currentTarget.dataset.category);
            });
        });

        console.log('✅ Стикер хендлеры настроены');
    }

    setupVoiceMessage() {
        const voiceBtn = document.getElementById('voiceBtn');
        
        if (!voiceBtn) {
            console.log('❌ Кнопка голосового сообщения не найдена');
            return;
        }

        let isRecording = false;

        voiceBtn.addEventListener('click', () => {
            if (this.app.hasPermission('media.send')) {
                if (!isRecording) {
                    this.startRecording();
                    isRecording = true;
                    voiceBtn.innerHTML = '<i class="fas fa-stop"></i>';
                    voiceBtn.style.color = 'var(--error-color)';
                } else {
                    this.stopRecording();
                    isRecording = false;
                    voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                    voiceBtn.style.color = '';
                }
            } else {
                this.app.showNotification('Нет прав для отправки голосовых сообщений', 'error');
            }
        });

        console.log('✅ Голосовые сообщения настроены');
    }

    setupModalHandlers() {
        // Рейтинг
        document.querySelectorAll('.rating-stars i').forEach(star => {
            star.addEventListener('click', () => {
                this.setRating(parseInt(star.dataset.rating));
            });
        });

        document.getElementById('submitRating')?.addEventListener('click', () => {
            this.submitRating();
        });

        document.getElementById('cancelRating')?.addEventListener('click', () => {
            this.closeModal('ratingModal');
        });

        // Закрытие модальных окон
        document.querySelectorAll('.btn-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    }

    setupSettingsHandlers() {
        const settingsModal = document.getElementById('settingsModal');
        
        if (!settingsModal) return;

        // Переключение темы
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.switchTheme(e.currentTarget.dataset.theme);
            });
        });

        // Уведомления
        const notificationsToggle = document.getElementById('notificationsToggle');
        if (notificationsToggle) {
            notificationsToggle.addEventListener('change', (e) => {
                this.toggleNotifications(e.target.checked);
            });
        }

        // Сохранение настроек
        document.getElementById('saveSettings')?.addEventListener('click', () => {
            this.saveSettings();
        });
    }

    setupRoleSpecificHandlers() {
        const role = this.app.currentUser.role;
        
        switch(role) {
            case 'listener':
                this.setupListenerHandlers();
                break;
            case 'admin':
                this.setupAdminHandlers();
                break;
            case 'coowner':
                this.setupCoownerHandlers();
                break;
            case 'owner':
                this.setupOwnerHandlers();
                break;
        }
    }

    setupListenerHandlers() {
        console.log('🎧 Настройка обработчиков для слушателя');
        
        document.addEventListener('click', (e) => {
            if (e.target.closest('.review-btn')) {
                this.handleReviewAction(e);
            }
            if (e.target.closest('.accept-chat-btn')) {
                this.handleAcceptChat(e);
            }
        });
    }

    setupAdminHandlers() {
        console.log('⚡ Настройка обработчиков для администратора');
        
        document.addEventListener('click', (e) => {
            if (e.target.closest('.moderation-btn')) {
                this.handleModerationAction(e);
            }
            if (e.target.closest('.user-management-btn')) {
                this.handleUserManagement(e);
            }
        });
    }

    setupCoownerHandlers() {
        console.log('👑 Настройка обработчиков для совладельца');
        
        document.addEventListener('click', (e) => {
            if (e.target.closest('.financial-btn')) {
                this.handleFinancialAction(e);
            }
            if (e.target.closest('.analytics-btn')) {
                this.handleAnalyticsAction(e);
            }
        });
    }

    setupOwnerHandlers() {
        console.log('💎 Настройка обработчиков для владельца');
        
        document.addEventListener('click', (e) => {
            if (e.target.closest('.system-btn')) {
                this.handleSystemAction(e);
            }
            if (e.target.closest('.settings-btn')) {
                this.handleSystemSettings(e);
            }
        });
    }

    // Основные методы чата
    handleTyping() {
        if (!this.currentChat || !this.app.socket) return;

        if (!this.isTyping) {
            this.isTyping = true;
            this.app.socket.emit('typing_start', {
                chat_id: this.currentChat.id
            });
        }

        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            this.isTyping = false;
            this.app.socket.emit('typing_stop', {
                chat_id: this.currentChat.id
            });
        }, 1000);
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const content = messageInput.value.trim();

        if (!content || !this.currentChat || !this.app.socket) {
            console.log('❌ Нельзя отправить пустое сообщение или нет активного чата');
            return;
        }

        if (!this.app.hasPermission('chat.basic')) {
            this.app.showNotification('Нет прав для отправки сообщений', 'error');
            return;
        }

        try {
            // Временно добавляем сообщение в интерфейс
            this.addMessage({
                id: 'temp-' + Date.now(),
                content: content,
                sender: this.app.currentUser,
                timestamp: new Date(),
                type: 'text',
                isTemp: true
            });

            messageInput.value = '';
            this.autoResizeTextarea(messageInput);
            
            if (this.isTyping) {
                this.isTyping = false;
                this.app.socket.emit('typing_stop', {
                    chat_id: this.currentChat.id
                });
            }

            // Отправка через сокет
            this.app.socket.emit('send_message', {
                chat_id: this.currentChat.id,
                content: content,
                message_type: 'text'
            });

            console.log('✅ Сообщение отправлено');

        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
            this.app.showNotification('Ошибка отправки сообщения', 'error');
        }
    }

    async sendMediaMessage() {
        const mediaFile = document.getElementById('mediaFile');
        const file = mediaFile.files[0];

        if (!file) {
            this.app.showNotification('Выберите файл для отправки', 'error');
            return;
        }

        if (!this.currentChat) {
            this.app.showNotification('Нет активного чата', 'error');
            return;
        }

        try {
            // Здесь будет логика загрузки файла на сервер
            const formData = new FormData();
            formData.append('file', file);
            formData.append('chat_id', this.currentChat.id);
            formData.append('message_type', this.getFileType(file.type));

            // Временно добавляем медиа в интерфейс
            this.addMediaMessage(file, true);

            this.closeModal('mediaModal');
            this.app.showNotification('Медиа отправлено', 'success');

        } catch (error) {
            console.error('Ошибка отправки медиа:', error);
            this.app.showNotification('Ошибка отправки медиа', 'error');
        }
    }

    getFileType(mimeType) {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
        return 'file';
    }

    previewMedia(file) {
        const preview = document.getElementById('mediaPreview');
        const fileName = document.getElementById('fileName');
        
        if (!preview || !fileName) return;

        fileName.textContent = file.name;

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(file);
        } else if (file.type.startsWith('video/')) {
            preview.innerHTML = `
                <video controls>
                    <source src="${URL.createObjectURL(file)}" type="${file.type}">
                    Ваш браузер не поддерживает видео.
                </video>
            `;
        } else {
            preview.innerHTML = `
                <div class="file-preview">
                    <i class="fas fa-file fa-3x"></i>
                    <p>${file.name}</p>
                </div>
            `;
        }
    }

    closeMediaModal() {
        const mediaFile = document.getElementById('mediaFile');
        const preview = document.getElementById('mediaPreview');
        const fileName = document.getElementById('fileName');
        
        if (mediaFile) mediaFile.value = '';
        if (preview) preview.innerHTML = '';
        if (fileName) fileName.textContent = '';
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                this.sendVoiceMessage(audioBlob);
                
                // Останавливаем все треки
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start();
            this.app.showNotification('Запись началась...', 'info');

        } catch (error) {
            console.error('Ошибка записи:', error);
            this.app.showNotification('Ошибка доступа к микрофону', 'error');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            this.app.showNotification('Запись завершена', 'success');
        }
    }

    async sendVoiceMessage(audioBlob) {
        if (!this.currentChat) return;

        try {
            // Здесь будет логика отправки голосового сообщения на сервер
            const formData = new FormData();
            formData.append('audio', audioBlob);
            formData.append('chat_id', this.currentChat.id);
            formData.append('message_type', 'voice');

            // Временно добавляем голосовое сообщение
            this.addVoiceMessage(audioBlob, true);

        } catch (error) {
            console.error('Ошибка отправки голосового сообщения:', error);
            this.app.showNotification('Ошибка отправки голосового сообщения', 'error');
        }
    }

    addMessage(message) {
        const messagesContainer = document.getElementById('messages');
        if (!messagesContainer) return;

        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.sender.id === this.app.currentUser.id ? 'sent' : 'received'}`;
        
        if (message.isTemp) {
            messageElement.classList.add('temp');
        }

        messageElement.innerHTML = `
            <div class="message-avatar">
                <img src="${message.sender.avatar_url || '/images/default-avatar.svg'}" alt="${message.sender.username}">
            </div>
            <div class="message-content-wrapper">
                <div class="message-sender">${message.sender.username}</div>
                <div class="message-content">${this.escapeHtml(message.content)}</div>
                <div class="message-time">${this.formatTime(message.timestamp)}</div>
            </div>
        `;

        messagesContainer.appendChild(messageElement);
        this.scrollToBottom();

        // Анимация появления
        setTimeout(() => {
            messageElement.style.animation = 'messageSlide 0.3s ease-out';
        }, 10);
    }

    addMediaMessage(file, isSent = false) {
        const messagesContainer = document.getElementById('messages');
        if (!messagesContainer) return;

        const messageElement = document.createElement('div');
        messageElement.className = `message ${isSent ? 'sent' : 'received'}`;

        let mediaContent = '';
        if (file.type.startsWith('image/')) {
            mediaContent = `<img src="${URL.createObjectURL(file)}" alt="Image" class="media-content">`;
        } else if (file.type.startsWith('video/')) {
            mediaContent = `
                <video controls class="media-content">
                    <source src="${URL.createObjectURL(file)}" type="${file.type}">
                </video>
            `;
        } else {
            mediaContent = `
                <div class="file-message">
                    <i class="fas fa-file-download"></i>
                    <div class="file-info">
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${this.formatFileSize(file.size)}</div>
                    </div>
                </div>
            `;
        }

        messageElement.innerHTML = `
            <div class="message-avatar">
                <img src="${this.app.currentUser.avatar_url || '/images/default-avatar.svg'}" alt="${this.app.currentUser.username}">
            </div>
            <div class="message-content-wrapper">
                <div class="message-sender">${this.app.currentUser.username}</div>
                <div class="message-content media-message">
                    ${mediaContent}
                </div>
                <div class="message-time">${this.formatTime(new Date())}</div>
            </div>
        `;

        messagesContainer.appendChild(messageElement);
        this.scrollToBottom();
    }

    addVoiceMessage(audioBlob, isSent = false) {
        const messagesContainer = document.getElementById('messages');
        if (!messagesContainer) return;

        const messageElement = document.createElement('div');
        messageElement.className = `message ${isSent ? 'sent' : 'received'}`;

        messageElement.innerHTML = `
            <div class="message-avatar">
                <img src="${this.app.currentUser.avatar_url || '/images/default-avatar.svg'}" alt="${this.app.currentUser.username}">
            </div>
            <div class="message-content-wrapper">
                <div class="message-sender">${this.app.currentUser.username}</div>
                <div class="message-content voice-message">
                    <audio controls>
                        <source src="${URL.createObjectURL(audioBlob)}" type="audio/wav">
                    </audio>
                    <div class="voice-duration">0:05</div>
                </div>
                <div class="message-time">${this.formatTime(new Date())}</div>
            </div>
        `;

        messagesContainer.appendChild(messageElement);
        this.scrollToBottom();
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    // Методы модальных окон
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            
            // Сброс состояния
            if (modalId === 'mediaModal') {
                this.closeMediaModal();
            } else if (modalId === 'ratingModal') {
                this.resetRating();
            }
        }
    }

    // Методы управления чатами
    async createNewChat() {
        try {
            this.app.showNotification('Создание нового чата...', 'info');
            
            // Здесь будет API вызов для создания чата
            const newChat = {
                id: 'chat-' + Date.now(),
                title: 'Новый чат',
                participants: [this.app.currentUser],
                created_at: new Date(),
                unread_count: 0,
                last_message: null
            };

            this.chats.unshift(newChat);
            this.loadChatsList();
            
            setTimeout(() => {
                this.app.showNotification('Новый чат создан!', 'success');
            }, 1000);

        } catch (error) {
            console.error('Ошибка создания чата:', error);
            this.app.showNotification('Ошибка создания чата', 'error');
        }
    }

    async selectChat(chat) {
        this.currentChat = chat;
        
        const chatContainer = document.getElementById('chatContainer');
        const placeholder = document.getElementById('chatPlaceholder');
        const chatTitle = document.getElementById('chatTitle');
        
        if (chatContainer && placeholder && chatTitle) {
            placeholder.classList.remove('active');
            chatContainer.classList.add('active');
            chatTitle.textContent = chat.title || `Чат с ${chat.participants?.[0]?.username || 'пользователем'}`;
        }

        // Загрузка сообщений чата
        await this.loadChatMessages(chat.id);
        
        // Отметка как прочитанного
        await this.markAsRead(chat.id);
    }

    closeCurrentChat() {
        const chatContainer = document.getElementById('chatContainer');
        const placeholder = document.getElementById('chatPlaceholder');
        
        if (chatContainer && placeholder) {
            chatContainer.classList.remove('active');
            setTimeout(() => {
                placeholder.classList.add('active');
                this.currentChat = null;
            }, 300);
        }
    }

    openSettings() {
        this.openModal('settingsModal');
    }

    switchTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        this.app.showNotification(`Тема изменена на ${theme === 'dark' ? 'тёмную' : 'светлую'}`, 'success');
    }

    toggleNotifications(enabled) {
        localStorage.setItem('notifications', enabled.toString());
        this.app.showNotification(
            `Уведомления ${enabled ? 'включены' : 'отключены'}`,
            'success'
        );
    }

    saveSettings() {
        const theme = document.querySelector('.theme-btn.active')?.dataset.theme;
        const notifications = document.getElementById('notificationsToggle')?.checked;

        if (theme) {
            this.switchTheme(theme);
        }
        if (notifications !== undefined) {
            this.toggleNotifications(notifications);
        }

        this.closeModal('settingsModal');
        this.app.showNotification('Настройки сохранены', 'success');
    }

    setRating(rating) {
        this.currentRating = rating;
        const stars = document.querySelectorAll('.rating-stars i');
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
    }

    resetRating() {
        this.currentRating = 0;
        document.querySelectorAll('.rating-stars i').forEach(star => {
            star.classList.remove('active');
        });
        const commentInput = document.getElementById('ratingComment');
        if (commentInput) commentInput.value = '';
    }

    submitRating() {
        if (this.currentRating === 0) {
            this.app.showNotification('Пожалуйста, выберите оценку', 'error');
            return;
        }

        const comment = document.getElementById('ratingComment')?.value || '';
        
        // Здесь будет отправка отзыва на сервер
        console.log('Отзыв отправлен:', { 
            rating: this.currentRating, 
            comment: comment,
            chat_id: this.currentChat?.id 
        });

        this.app.showNotification('Спасибо за ваш отзыв!', 'success');
        this.closeModal('ratingModal');
    }

    startCall() {
        if (!this.currentChat) {
            this.app.showNotification('Выберите чат для звонка', 'error');
            return;
        }
        this.app.showNotification('Инициализация звонка...', 'info');
        // Логика звонка будет здесь
    }

    startVideoCall() {
        if (!this.currentChat) {
            this.app.showNotification('Выберите чат для видеозвонка', 'error');
            return;
        }
        this.app.showNotification('Инициализация видеозвонка...', 'info');
        // Логика видеозвонка будет здесь
    }

    // Методы загрузки данных
    async loadUserChats() {
        try {
            // Здесь будет API вызов для загрузки чатов
            this.chats = [
                {
                    id: '1',
                    title: 'Техническая поддержка',
                    participants: [
                        { id: '2', username: 'Поддержка', avatar_url: null }
                    ],
                    last_message: {
                        content: 'Чем могу помочь?',
                        timestamp: new Date(Date.now() - 300000)
                    },
                    unread_count: 0,
                    created_at: new Date()
                }
            ];
            
            console.log('✅ Чаты загружены:', this.chats.length);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки чатов:', error);
            this.app.showNotification('Ошибка загрузки чатов', 'error');
        }
    }

    async loadAvailableListeners() {
        try {
            // Здесь будет API вызов для загрузки слушателей
            this.listeners = [
                {
                    id: '2',
                    username: 'Анна',
                    role: 'listener',
                    rating: 4.8,
                    is_online: true,
                    avatar_url: null,
                    specialties: ['отношения', 'работа']
                },
                {
                    id: '3',
                    username: 'Максим',
                    role: 'listener',
                    rating: 4.9,
                    is_online: false,
                    avatar_url: null,
                    specialties: ['психология', 'развитие']
                }
            ];
            
            console.log('✅ Слушатели загружены:', this.listeners.length);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки слушателей:', error);
        }
    }

    loadChatsList() {
        const chatsList = document.getElementById('chatsList');
        if (!chatsList) return;

        chatsList.innerHTML = '';

        this.chats.forEach(chat => {
            const chatElement = document.createElement('div');
            chatElement.className = 'chat-item';
            chatElement.innerHTML = `
                <div class="chat-avatar">
                    <img src="${chat.participants?.[0]?.avatar_url || '/images/default-avatar.svg'}" alt="${chat.participants?.[0]?.username}">
                </div>
                <div class="chat-info">
                    <div class="chat-title">${chat.title || chat.participants?.[0]?.username}</div>
                    <div class="chat-last-message">${chat.last_message?.content || 'Нет сообщений'}</div>
                </div>
                <div class="chat-meta">
                    <div class="chat-time">${this.formatTime(chat.last_message?.timestamp)}</div>
                    ${chat.unread_count > 0 ? `<div class="chat-unread">${chat.unread_count}</div>` : ''}
                </div>
            `;

            chatElement.addEventListener('click', () => this.selectChat(chat));
            chatsList.appendChild(chatElement);
        });
    }

    loadListenersList() {
        const listenersList = document.getElementById('listenersList');
        if (!listenersList) return;

        listenersList.innerHTML = '';

        this.listeners.forEach(listener => {
            const listenerElement = document.createElement('div');
            listenerElement.className = 'listener-item';
            listenerElement.innerHTML = `
                <div class="listener-avatar">
                    <img src="${listener.avatar_url || '/images/default-avatar.svg'}" alt="${listener.username}">
                    <div class="status-indicator ${listener.is_online ? 'online' : 'offline'}"></div>
                </div>
                <div class="listener-info">
                    <div class="listener-name">${listener.username}</div>
                    <div class="listener-rating">
                        <i class="fas fa-star"></i>
                        ${listener.rating}
                    </div>
                    <div class="listener-specialties">
                        ${listener.specialties?.map(spec => `<span class="specialty-tag">${spec}</span>`).join('')}
                    </div>
                </div>
                <button class="btn btn-primary start-chat-btn" data-listener-id="${listener.id}">
                    Начать чат
                </button>
            `;

            listenersList.appendChild(listenerElement);
        });

        // Обработчики для кнопок начала чата
        document.querySelectorAll('.start-chat-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const listenerId = e.target.dataset.listenerId;
                this.startChatWithListener(listenerId);
            });
        });
    }

    async startChatWithListener(listenerId) {
        try {
            const listener = this.listeners.find(l => l.id === listenerId);
            if (!listener) return;

            this.app.showNotification(`Начинаем чат с ${listener.username}...`, 'info');

            // Здесь будет API вызов для создания чата с слушателем
            const newChat = {
                id: 'chat-' + Date.now(),
                title: `Чат с ${listener.username}`,
                participants: [this.app.currentUser, listener],
                created_at: new Date(),
                unread_count: 0,
                last_message: null
            };

            this.chats.unshift(newChat);
            this.loadChatsList();
            await this.selectChat(newChat);

            this.app.showNotification(`Чат с ${listener.username} создан!`, 'success');

        } catch (error) {
            console.error('Ошибка создания чата со слушателем:', error);
            this.app.showNotification('Ошибка создания чата', 'error');
        }
    }

    async loadChatMessages(chatId) {
        try {
            const messagesContainer = document.getElementById('messages');
            if (!messagesContainer) return;

            messagesContainer.innerHTML = '<div class="loading-messages">Загрузка сообщений...</div>';

            // Здесь будет API вызов для загрузки сообщений
            const messages = [
                {
                    id: '1',
                    content: 'Здравствуйте! Чем могу вам помочь?',
                    sender: { id: '2', username: 'Поддержка', avatar_url: null },
                    timestamp: new Date(Date.now() - 300000),
                    type: 'text'
                },
                {
                    id: '2',
                    content: 'Привет! У меня есть вопрос по использованию платформы.',
                    sender: this.app.currentUser,
                    timestamp: new Date(Date.now() - 240000),
                    type: 'text'
                },
                {
                    id: '3',
                    content: 'Конечно, задавайте ваш вопрос. Я постараюсь помочь!',
                    sender: { id: '2', username: 'Поддержка', avatar_url: null },
                    timestamp: new Date(Date.now() - 180000),
                    type: 'text'
                }
            ];

            // Имитация задержки загрузки
            setTimeout(() => {
                messagesContainer.innerHTML = '';
                messages.forEach(message => this.addMessage(message));
            }, 500);

        } catch (error) {
            console.error('Ошибка загрузки сообщений:', error);
            this.app.showNotification('Ошибка загрузки сообщений', 'error');
        }
    }

    async markAsRead(chatId) {
        try {
            // Здесь будет API вызов для отметки сообщений как прочитанных
            const chat = this.chats.find(c => c.id === chatId);
            if (chat) {
                chat.unread_count = 0;
                this.loadChatsList();
            }
        } catch (error) {
            console.error('Ошибка отметки как прочитанного:', error);
        }
    }

    handleSearch(query) {
        if (!query.trim()) {
            this.loadChatsList();
            return;
        }

        const filteredChats = this.chats.filter(chat => 
            chat.title.toLowerCase().includes(query.toLowerCase()) ||
            chat.participants.some(p => p.username.toLowerCase().includes(query.toLowerCase())) ||
            chat.last_message?.content.toLowerCase().includes(query.toLowerCase())
        );

        this.renderFilteredChats(filteredChats);
    }

    renderFilteredChats(chats) {
        const chatsList = document.getElementById('chatsList');
        if (!chatsList) return;

        chatsList.innerHTML = '';

        if (chats.length === 0) {
            chatsList.innerHTML = '<div class="no-results">Ничего не найдено</div>';
            return;
        }

        chats.forEach(chat => {
            const chatElement = document.createElement('div');
            chatElement.className = 'chat-item';
            chatElement.innerHTML = `
                <div class="chat-avatar">
                    <img src="${chat.participants?.[0]?.avatar_url || '/images/default-avatar.svg'}" alt="${chat.participants?.[0]?.username}">
                </div>
                <div class="chat-info">
                    <div class="chat-title">${chat.title || chat.participants?.[0]?.username}</div>
                    <div class="chat-last-message">${chat.last_message?.content || 'Нет сообщений'}</div>
                </div>
                <div class="chat-meta">
                    <div class="chat-time">${this.formatTime(chat.last_message?.timestamp)}</div>
                    ${chat.unread_count > 0 ? `<div class="chat-unread">${chat.unread_count}</div>` : ''}
                </div>
            `;

            chatElement.addEventListener('click', () => this.selectChat(chat));
            chatsList.appendChild(chatElement);
        });
    }

    // Заглушки для остальных методов
    loadReviews() {
        console.log('Загрузка отзывов...');
        // Загрузка отзывов с сервера
    }

    loadStickers() {
        console.log('Загрузка стикеров...');
        // Загрузка стикеров с сервера
    }

    filterStickers(category) {
        console.log('Фильтрация стикеров по категории:', category);
        // Фильтрация стикеров
    }

    loadAdminPanel() {
        console.log('Загрузка админ панели...');
        // Загрузка админ панели
    }

    loadCoownerPanel() {
        console.log('Загрузка панели совладельца...');
        // Загрузка панели совладельца
    }

    loadOwnerPanel() {
        console.log('Загрузка панели владельца...');
        // Загрузка панели владельца
    }

    // Обработчики действий по ролям
    handleReviewAction(e) {
        console.log('Действие с отзывом:', e.target);
    }

    handleAcceptChat(e) {
        console.log('Принятие чата:', e.target);
    }

    handleModerationAction(e) {
        console.log('Действие модерации:', e.target);
    }

    handleUserManagement(e) {
        console.log('Управление пользователями:', e.target);
    }

    handleFinancialAction(e) {
        console.log('Финансовое действие:', e.target);
    }

    handleAnalyticsAction(e) {
        console.log('Аналитическое действие:', e.target);
    }

    handleSystemAction(e) {
        console.log('Системное действие:', e.target);
    }

    handleSystemSettings(e) {
        console.log('Системные настройки:', e.target);
    }
}

// Инициализация менеджера чата после загрузки приложения
document.addEventListener('DOMContentLoaded', () => {
    // Восстановление темы
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    
    // Восстановление настроек уведомлений
    const notificationsEnabled = localStorage.getItem('notifications') !== 'false';
    const notificationsToggle = document.getElementById('notificationsToggle');
    if (notificationsToggle) {
        notificationsToggle.checked = notificationsEnabled;
    }
    
    const checkApp = setInterval(() => {
        if (window.app && window.app.currentUser) {
            clearInterval(checkApp);
            console.log('🎯 Запуск менеджера чата...');
            window.chatManager = new ChatManager(window.app);
        }
    }, 100);
});

// CSS анимации
const style = document.createElement('style');
style.textContent = `
    @keyframes messageSlide {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .message {
        animation: messageSlide 0.3s ease-out;
    }

    .message.temp {
        opacity: 0.7;
    }

    .loading-messages {
        text-align: center;
        padding: 20px;
        color: var(--text-secondary);
    }

    .no-results {
        text-align: center;
        padding: 20px;
        color: var(--text-secondary);
    }

    .media-content {
        max-width: 300px;
        max-height: 300px;
        border-radius: 10px;
    }

    .file-message {
        display: flex;
        align-items: center;
        padding: 10px;
        background: var(--bg-secondary);
        border-radius: 10px;
        gap: 10px;
    }

    .voice-message {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .voice-message audio {
        max-width: 200px;
    }

    .status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        position: absolute;
        bottom: 2px;
        right: 2px;
        border: 2px solid var(--bg-primary);
    }

    .status-indicator.online {
        background: var(--success-color);
    }

    .status-indicator.offline {
        background: var(--text-secondary);
    }

    .specialty-tag {
        background: var(--primary-color);
        color: white;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.8em;
        margin-right: 5px;
    }
`;
document.head.appendChild(style);
