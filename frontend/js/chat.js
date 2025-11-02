class ChatManager {
    constructor(app) {
        this.app = app;
        this.isTyping = false;
        this.typingTimeout = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        
        if (!this.app.currentUser) {
            console.error('❌ Пользователь не аутентифицирован');
            return;
        }
        
        this.init();
    }

    init() {
        console.log('🎯 Инициализация менеджера чата для:', this.app.currentUser.username);
        this.setupMessageInput();
        this.setupMediaHandlers();
        this.setupStickerHandlers();
        this.setupVoiceMessage();
        this.setupRoleSpecificHandlers();
    }

    setupMessageInput() {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');

        if (!messageInput || !sendBtn) {
            console.error('❌ Элементы чата не найдены');
            return;
        }

        messageInput.addEventListener('input', () => {
            this.handleTyping();
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

    setupMediaHandlers() {
        const mediaBtn = document.getElementById('mediaBtn');
        const mediaModal = document.getElementById('mediaModal');
        const mediaFile = document.getElementById('mediaFile');
        const sendMedia = document.getElementById('sendMedia');
        const cancelMedia = document.getElementById('cancelMedia');

        if (!mediaBtn || !mediaModal) {
            console.log('❌ Элементы медиа не найдены');
            return;
        }

        mediaBtn.addEventListener('click', () => {
            if (this.app.hasPermission('media.send')) {
                mediaModal.style.display = 'block';
            } else {
                this.app.showNotification('Нет прав для отправки медиа', 'error');
            }
        });

        if (mediaFile) {
            mediaFile.addEventListener('change', (e) => {
                this.previewMedia(e.target.files[0]);
            });
        }

        if (sendMedia) {
            sendMedia.addEventListener('click', () => {
                this.sendMediaMessage();
            });
        }

        if (cancelMedia) {
            cancelMedia.addEventListener('click', () => {
                this.closeMediaModal();
            });
        }

        mediaModal.addEventListener('click', (e) => {
            if (e.target === mediaModal) {
                this.closeMediaModal();
            }
        });

        const closeModal = document.querySelector('#mediaModal .close-modal');
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                this.closeMediaModal();
            });
        }

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
                stickerModal.style.display = 'block';
            } else {
                this.app.showNotification('Нет прав для использования стикеров', 'error');
            }
        });

        stickerModal.addEventListener('click', (e) => {
            if (e.target === stickerModal) {
                this.app.closeStickerModal();
            }
        });

        const closeModal = document.querySelector('#stickerModal .close-modal');
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                this.app.closeStickerModal();
            });
        }

        console.log('✅ Стикер хендлеры настроены');
    }

    setupVoiceMessage() {
        const voiceBtn = document.getElementById('voiceBtn');
        
        if (!voiceBtn) {
            console.log('❌ Кнопка голосового сообщения не найдена');
            return;
        }

        voiceBtn.addEventListener('mousedown', () => {
            if (this.app.hasPermission('media.send')) {
                this.startRecording();
            } else {
                this.app.showNotification('Нет прав для отправки голосовых сообщений', 'error');
            }
        });

        voiceBtn.addEventListener('mouseup', () => {
            this.stopRecording();
        });

        voiceBtn.addEventListener('mouseleave', () => {
            this.stopRecording();
        });

        voiceBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.app.hasPermission('media.send')) {
                this.startRecording();
            }
        });

        voiceBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopRecording();
        });

        console.log('✅ Голосовые сообщения настроены');
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
        
        const reviewButtons = document.querySelectorAll('.review-btn');
        reviewButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleReviewAction(e);
            });
        });
    }

    setupAdminHandlers() {
        console.log('⚡ Настройка обработчиков для администратора');
        
        const moderationButtons = document.querySelectorAll('.moderation-btn');
        moderationButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleModerationAction(e);
            });
        });
    }

    setupCoownerHandlers() {
        console.log('👑 Настройка обработчиков для совладельца');
        
        const financialButtons = document.querySelectorAll('.financial-btn');
        financialButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleFinancialAction(e);
            });
        });
    }

    setupOwnerHandlers() {
        console.log('💎 Настройка обработчиков для владельца');
        
        const systemButtons = document.querySelectorAll('.system-btn');
        systemButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleSystemAction(e);
            });
        });
    }

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
            this.app.socket.emit('send_message', {
                chat_id: this.app.currentChat.id,
                content: content,
                message_type: 'text'
            });

            messageInput.value = '';
            
            if (this.isTyping) {
                this.isTyping = false;
                this.app.socket.emit('typing_stop', {
                    chat_id: this.app.currentChat.id
                });
            }

            console.log('✅ Сообщение отправлено');

        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
            this.app.showNotification('Ошибка отправки сообщения', 'error');
        }
    }

    previewMedia(file) {
        const preview = document.getElementById('mediaPreview');
        if (!preview) return;

        preview.innerHTML = '';

        if (!file) return;

        const reader = new FileReader();
        
        reader.onload = (e) => {
            if (file.type.startsWith('image/')) {
                preview.innerHTML = `<img src="${e.target.result}" class="media-preview-image">`;
            } else if (file.type.startsWith('video/')) {
                preview.innerHTML = `<video src="${e.target.result}" controls class="media-preview-video"></video>`;
            } else if (file.type.startsWith('audio/')) {
                preview.innerHTML = `<audio src="${e.target.result}" controls class="media-preview-audio"></audio>`;
            } else {
                preview.innerHTML = `<div class="file-preview">Файл: ${file.name}</div>`;
            }
        };

        reader.readAsDataURL(file);
    }

    async sendMediaMessage() {
        const fileInput = document.getElementById('mediaFile');
        const file = fileInput?.files[0];

        if (!file || !this.app.currentChat) {
            this.app.showNotification('Выберите файл для отправки', 'error');
            return;
        }

        if (!this.app.hasPermission('media.send')) {
            this.app.showNotification('Нет прав для отправки медиа', 'error');
            return;
        }

        try {
            const token = localStorage.getItem('auth_token');
            const formData = new FormData();
            formData.append('chat_id', this.app.currentChat.id);
            formData.append('media', file);

            const response = await fetch('/chat/upload-media', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                
                if (this.app.socket) {
                    this.app.socket.emit('send_message', {
                        chat_id: this.app.currentChat.id,
                        media_url: data.media_url,
                        message_type: this.getMediaType(file.type)
                    });
                }

                this.closeMediaModal();
                this.app.showNotification('Медиа отправлено', 'success');
            } else {
                throw new Error('Ошибка загрузки медиа');
            }

        } catch (error) {
            console.error('Ошибка отправки медиа:', error);
            this.app.showNotification('Ошибка отправки медиа', 'error');
        }
    }

    getMediaType(mimeType) {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
        return 'file';
    }

    async startRecording() {
        if (!navigator.mediaDevices) {
            this.app.showNotification('Запись аудио не поддерживается', 'error');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioChunks = [];
            this.mediaRecorder = new MediaRecorder(stream);
            
            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                await this.sendVoiceMessage(audioBlob);
                
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start();
            this.app.showNotification('Запись начата...', 'info');

        } catch (error) {
            console.error('Ошибка записи аудио:', error);
            this.app.showNotification('Ошибка доступа к микрофону', 'error');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            this.app.showNotification('Запись завершена', 'info');
        }
    }

    async sendVoiceMessage(audioBlob) {
        if (!this.app.currentChat) return;

        try {
            const token = localStorage.getItem('auth_token');
            const formData = new FormData();
            formData.append('chat_id', this.app.currentChat.id);
            formData.append('audio', audioBlob, 'voice-message.wav');

            const response = await fetch('/chat/upload-voice', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                
                if (this.app.socket) {
                    this.app.socket.emit('send_message', {
                        chat_id: this.app.currentChat.id,
                        media_url: data.media_url,
                        message_type: 'audio'
                    });
                }

                this.app.showNotification('Голосовое сообщение отправлено', 'success');
            } else {
                throw new Error('Ошибка загрузки аудио');
            }

        } catch (error) {
            console.error('Ошибка отправки голосового сообщения:', error);
            this.app.showNotification('Ошибка отправки голосового сообщения', 'error');
        }
    }

    closeMediaModal() {
        const modal = document.getElementById('mediaModal');
        const fileInput = document.getElementById('mediaFile');
        const preview = document.getElementById('mediaPreview');
        
        if (modal) modal.style.display = 'none';
        if (fileInput) fileInput.value = '';
        if (preview) preview.innerHTML = '';
    }

    openMedia(url) {
        window.open(url, '_blank');
    }

    // Методы для расширенной функциональности
    handleReviewAction(e) {
        const action = e.target.dataset.action;
        const chatId = e.target.dataset.chatId;
        
        switch(action) {
            case 'rate':
                this.openRatingModal(chatId);
                break;
            case 'view_reviews':
                this.viewUserReviews(chatId);
                break;
        }
    }

    handleModerationAction(e) {
        const action = e.target.dataset.action;
        const userId = e.target.dataset.userId;
        
        if (!this.app.hasPermission('users.manage')) {
            this.app.showNotification('Нет прав для модерации', 'error');
            return;
        }
        
        switch(action) {
            case 'block_user':
                this.blockUser(userId);
                break;
            case 'mute_user':
                this.muteUser(userId);
                break;
            case 'view_reports':
                this.viewReports();
                break;
        }
    }

    handleFinancialAction(e) {
        const action = e.target.dataset.action;
        
        if (!this.app.hasPermission('financial.view')) {
            this.app.showNotification('Нет прав для просмотра финансов', 'error');
            return;
        }
        
        switch(action) {
            case 'view_earnings':
                this.viewEarnings();
                break;
            case 'view_payouts':
                this.viewPayouts();
                break;
        }
    }

    handleSystemAction(e) {
        const action = e.target.dataset.action;
        
        switch(action) {
            case 'system_stats':
                this.viewSystemStats();
                break;
            case 'backup_system':
                this.backupSystem();
                break;
        }
    }

    // Заглушки для методов расширенной функциональности
    openRatingModal(chatId) {
        console.log('Открытие модального окна рейтинга для чата:', chatId);
        this.app.showNotification('Функция рейтинга в разработке', 'info');
    }

    viewUserReviews(chatId) {
        console.log('Просмотр отзывов пользователя для чата:', chatId);
        this.app.showNotification('Функция просмотра отзывов в разработке', 'info');
    }

    blockUser(userId) {
        console.log('Блокировка пользователя:', userId);
        this.app.showNotification('Функция блокировки пользователя в разработке', 'info');
    }

    muteUser(userId) {
        console.log('Мут пользователя:', userId);
        this.app.showNotification('Функция мута пользователя в разработке', 'info');
    }

    viewReports() {
        console.log('Просмотр отчетов модерации');
        this.app.showNotification('Функция просмотра отчетов в разработке', 'info');
    }

    viewEarnings() {
        console.log('Просмотр заработка');
        this.app.showNotification('Функция просмотра заработка в разработке', 'info');
    }

    viewPayouts() {
        console.log('Просмотр выплат');
        this.app.showNotification('Функция просмотра выплат в разработке', 'info');
    }

    viewSystemStats() {
        console.log('Просмотр статистики системы');
        this.app.showNotification('Функция просмотра статистики в разработке', 'info');
    }

    backupSystem() {
        console.log('Создание резервной копии системы');
        this.app.showNotification('Функция резервного копирования в разработке', 'info');
    }
}

// Инициализация менеджера чата после загрузки приложения
document.addEventListener('DOMContentLoaded', () => {
    const checkApp = setInterval(() => {
        if (window.app && window.app.currentUser) {
            clearInterval(checkApp);
            console.log('🎯 Запуск менеджера чата...');
            window.chatManager = new ChatManager(window.app);
        }
    }, 100);
});
