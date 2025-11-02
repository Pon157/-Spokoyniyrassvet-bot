class ChatManager {
    constructor(app) {
        this.app = app;
        this.isTyping = false;
        this.typingTimeout = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.currentRating = 0;
        
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
        
        // Динамическое добавление обработчиков для кнопок отзывов
        document.addEventListener('click', (e) => {
            if (e.target.closest('.review-btn')) {
                this.handleReviewAction(e);
            }
        });
    }

    setupAdminHandlers() {
        console.log('⚡ Настройка обработчиков для администратора');
        
        document.addEventListener('click', (e) => {
            if (e.target.closest('.moderation-btn')) {
                this.handleModerationAction(e);
            }
        });
    }

    setupCoownerHandlers() {
        console.log('👑 Настройка обработчиков для совладельца');
        
        document.addEventListener('click', (e) => {
            if (e.target.closest('.financial-btn')) {
                this.handleFinancialAction(e);
            }
        });
    }

    setupOwnerHandlers() {
        console.log('💎 Настройка обработчиков для владельца');
        
        document.addEventListener('click', (e) => {
            if (e.target.closest('.system-btn')) {
                this.handleSystemAction(e);
            }
        });
    }

    // Основные методы чата
    handleTyping() {
        if (!this.app.currentChat || !this.app.socket) return;

        if (!this.isTyping) {
            this.isTyping = true;
            this.app.socket.emit('typing_start', {
                chat_id: this.app.currentChat.id
            });
        }

        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            this.isTyping = false;
            this.app.socket.emit('typing_stop', {
                chat_id: this.app.currentChat.id
            });
        }, 1000);
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const content = messageInput.value.trim();

        if (!content || !this.app.currentChat || !this.app.socket) {
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
                    chat_id: this.app.currentChat.id
                });
            }

            // Отправка через сокет
            this.app.socket.emit('send_message', {
                chat_id: this.app.currentChat.id,
                content: content,
                message_type: 'text'
            });

            console.log('✅ Сообщение отправлено');

        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
            this.app.showNotification('Ошибка отправки сообщения', 'error');
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
            <div class="message-content">${this.escapeHtml(message.content)}</div>
            <div class="message-time">${this.formatTime(message.timestamp)}</div>
        `;

        messagesContainer.appendChild(messageElement);
        this.scrollToBottom();

        // Анимация появления
        setTimeout(() => {
            messageElement.style.animation = 'messageSlide 0.3s ease-out';
        }, 10);
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

    // Остальные методы остаются аналогичными, но с улучшенной анимацией и обработкой ошибок
    // ... (предыдущие методы sendMediaMessage, startRecording, etc.)

    // Новые методы для улучшенного UX
    createNewChat() {
        this.app.showNotification('Создание нового чата...', 'info');
        // Здесь будет логика создания нового чата
        setTimeout(() => {
            this.app.showNotification('Новый чат создан!', 'success');
        }, 1000);
    }

    closeCurrentChat() {
        const chatContainer = document.getElementById('chatContainer');
        const placeholder = document.getElementById('chatPlaceholder');
        
        chatContainer.classList.remove('active');
        setTimeout(() => {
            placeholder.classList.add('active');
            this.app.currentChat = null;
        }, 300);
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
        this.app.showNotification(
            `Уведомления ${enabled ? 'включены' : 'отключены'}`,
            'success'
        );
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
        document.getElementById('ratingComment').value = '';
    }

    submitRating() {
        if (this.currentRating === 0) {
            this.app.showNotification('Пожалуйста, выберите оценку', 'error');
            return;
        }

        const comment = document.getElementById('ratingComment').value;
        
        this.app.showNotification('Спасибо за ваш отзыв!', 'success');
        this.closeModal('ratingModal');
        
        // Здесь будет отправка отзыва на сервер
        console.log('Отзыв:', { rating: this.currentRating, comment });
    }

    startCall() {
        this.app.showNotification('Инициализация звонка...', 'info');
        // Логика звонка
    }

    startVideoCall() {
        this.app.showNotification('Инициализация видеозвонка...', 'info');
        // Логика видеозвонка
    }

    // Заглушки для загрузки данных
    loadChatsList() {
        console.log('Загрузка списка чатов...');
        // Загрузка чатов с сервера
    }

    loadListenersList() {
        console.log('Загрузка списка слушателей...');
        // Загрузка слушателей с сервера
    }

    loadStickers() {
        console.log('Загрузка стикеров...');
        // Загрузка стикеров с сервера
    }

    // ... остальные методы загрузки данных
}

// Инициализация менеджера чата после загрузки приложения
document.addEventListener('DOMContentLoaded', () => {
    // Восстановление темы
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    
    const checkApp = setInterval(() => {
        if (window.app && window.app.currentUser) {
            clearInterval(checkApp);
            console.log('🎯 Запуск менеджера чата...');
            window.chatManager = new ChatManager(window.app);
        }
    }, 100);
});
