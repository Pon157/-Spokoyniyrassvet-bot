class ChatManager {
    constructor(app) {
        this.app = app;
        this.isTyping = false;
        this.typingTimeout = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.init();
    }

    init() {
        this.setupMessageInput();
        this.setupMediaHandlers();
        this.setupStickerHandlers();
        this.setupVoiceMessage();
    }

    setupMessageInput() {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');

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
    }

    setupMediaHandlers() {
        const mediaBtn = document.getElementById('mediaBtn');
        const mediaModal = document.getElementById('mediaModal');
        const mediaFile = document.getElementById('mediaFile');
        const mediaPreview = document.getElementById('mediaPreview');
        const sendMedia = document.getElementById('sendMedia');
        const cancelMedia = document.getElementById('cancelMedia');

        mediaBtn.addEventListener('click', () => {
            mediaModal.style.display = 'block';
        });

        mediaFile.addEventListener('change', (e) => {
            this.previewMedia(e.target.files[0]);
        });

        sendMedia.addEventListener('click', () => {
            this.sendMediaMessage();
        });

        cancelMedia.addEventListener('click', () => {
            this.closeMediaModal();
        });

        // Закрытие модального окна
        mediaModal.addEventListener('click', (e) => {
            if (e.target === mediaModal) {
                this.closeMediaModal();
            }
        });

        document.querySelector('#mediaModal .close-modal').addEventListener('click', () => {
            this.closeMediaModal();
        });
    }

    setupStickerHandlers() {
        const stickerBtn = document.getElementById('stickerBtn');
        const stickerModal = document.getElementById('stickerModal');

        stickerBtn.addEventListener('click', () => {
            stickerModal.style.display = 'block';
        });

        stickerModal.addEventListener('click', (e) => {
            if (e.target === stickerModal) {
                this.closeStickerModal();
            }
        });

        document.querySelector('#stickerModal .close-modal').addEventListener('click', () => {
            this.closeStickerModal();
        });
    }

    setupVoiceMessage() {
        const voiceBtn = document.getElementById('voiceBtn');
        
        voiceBtn.addEventListener('mousedown', () => {
            this.startRecording();
        });

        voiceBtn.addEventListener('mouseup', () => {
            this.stopRecording();
        });

        voiceBtn.addEventListener('mouseleave', () => {
            this.stopRecording();
        });

        voiceBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startRecording();
        });

        voiceBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopRecording();
        });
    }

    handleTyping() {
        if (!this.app.currentChat) return;

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

        if (!content || !this.app.currentChat) return;

        try {
            this.app.socket.emit('send_message', {
                chat_id: this.app.currentChat.id,
                content: content,
                message_type: 'text'
            });

            messageInput.value = '';
            
            // Останавливаем индикатор набора
            if (this.isTyping) {
                this.isTyping = false;
                this.app.socket.emit('typing_stop', {
                    chat_id: this.app.currentChat.id
                });
            }

        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
            this.app.showNotification('Ошибка отправки сообщения', 'error');
        }
    }

    async sendSticker(stickerUrl) {
        if (!this.app.currentChat) return;

        try {
            this.app.socket.emit('send_message', {
                chat_id: this.app.currentChat.id,
                sticker_url: stickerUrl,
                message_type: 'sticker'
            });
        } catch (error) {
            console.error('Ошибка отправки стикера:', error);
            this.app.showNotification('Ошибка отправки стикера', 'error');
        }
    }

    previewMedia(file) {
        const preview = document.getElementById('mediaPreview');
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
            }
        };

        reader.readAsDataURL(file);
    }

    async sendMediaMessage() {
        const fileInput = document.getElementById('mediaFile');
        const file = fileInput.files[0];

        if (!file || !this.app.currentChat) return;

        try {
            const formData = new FormData();
            formData.append('chat_id', this.app.currentChat.id);
            formData.append('media', file);

            const response = await fetch('/chat/upload-media', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                
                this.app.socket.emit('send_message', {
                    chat_id: this.app.currentChat.id,
                    media_url: data.media_url,
                    message_type: this.getMediaType(file.type)
                });

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
            const formData = new FormData();
            formData.append('chat_id', this.app.currentChat.id);
            formData.append('audio', audioBlob, 'voice-message.wav');

            const response = await fetch('/chat/upload-voice', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('chat_token')}`
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                
                this.app.socket.emit('send_message', {
                    chat_id: this.app.currentChat.id,
                    media_url: data.media_url,
                    message_type: 'audio'
                });

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
        
        modal.style.display = 'none';
        fileInput.value = '';
        preview.innerHTML = '';
    }

    closeStickerModal() {
        const modal = document.getElementById('stickerModal');
        modal.style.display = 'none';
    }

    openMedia(url) {
        window.open(url, '_blank');
    }
}

// Инициализация менеджера чата после загрузки приложения
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.app) {
            window.chatManager = new ChatManager(window.app);
        }
    }, 1000);
});
