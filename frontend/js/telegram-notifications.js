/**
 * Telegram Bot клиент для работы с уведомлениями
 */
class TelegramBot {
    constructor() {
        this.isInitialized = false;
        this.init();
    }

    async init() {
        try {
            console.log('🤖 Инициализация Telegram Bot клиента...');
            
            // Проверяем наличие токена
            const token = localStorage.getItem('auth_token');
            if (!token) {
                console.warn('⚠️ Нет токена для Telegram Bot');
                return;
            }

            this.isInitialized = true;
            console.log('✅ Telegram Bot клиент готов');
        } catch (error) {
            console.error('❌ Ошибка инициализации Telegram Bot:', error);
        }
    }

    /**
     * Отправка уведомления через сервер
     */
    async sendNotification(message, type = 'info') {
        if (!this.isInitialized) {
            console.warn('⚠️ Telegram Bot не инициализирован');
            return false;
        }

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/telegram/send-notification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: message,
                    type: type
                })
            });

            const data = await response.json();
            
            if (data.success) {
                console.log('✅ Уведомление отправлено в Telegram');
                return true;
            } else {
                console.error('❌ Ошибка отправки уведомления:', data.error);
                return false;
            }
        } catch (error) {
            console.error('❌ Ошибка отправки уведомления:', error);
            return false;
        }
    }

    /**
     * Проверка подключения пользователя к боту
     */
    async checkConnection() {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/telegram/check-connection', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('❌ Ошибка проверки подключения:', error);
            return { connected: false, error: error.message };
        }
    }

    /**
     * Включение/выключение уведомлений
     */
    async toggleNotifications(enabled) {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/telegram/toggle-notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    enabled: enabled
                })
            });

            const data = await response.json();
            
            if (data.success) {
                console.log(`✅ Уведомления ${enabled ? 'включены' : 'выключены'}`);
                return true;
            } else {
                console.error('❌ Ошибка изменения настроек уведомлений:', data.error);
                return false;
            }
        } catch (error) {
            console.error('❌ Ошибка изменения настроек уведомлений:', error);
            return false;
        }
    }

    /**
     * Отправка тестового уведомления
     */
    async sendTestNotification() {
        const testMessage = '🔔 <b>Тестовое уведомление</b>\n\nЭто тестовое сообщение для проверки работы Telegram уведомлений.';
        
        const success = await this.sendNotification(testMessage, 'info');
        
        if (success) {
            this.showNotification('Тестовое уведомление отправлено!', 'success');
        } else {
            this.showNotification('Ошибка отправки тестового уведомления', 'error');
        }
        
        return success;
    }

    /**
     * Отправка уведомления о новом сообщении
     */
    async sendMessageNotification(senderName, message, chatId) {
        const notificationMessage = `💬 <b>Новое сообщение от ${senderName}</b>\n\n${message}\n\n<a href="${window.location.origin}/chat.html?chat=${chatId}">💬 Перейти к чату</a>`;
        
        return await this.sendNotification(notificationMessage, 'info');
    }

    /**
     * Отправка уведомления о новом чате
     */
    async sendNewChatNotification(userName, listenerName, chatId) {
        const notificationMessage = `🆕 <b>Новый чат создан</b>\n\n👤 Пользователь: ${userName}\n🎧 Слушатель: ${listenerName}\n\n<a href="${window.location.origin}/chat.html?chat=${chatId}">💬 Перейти к чату</a>`;
        
        return await this.sendNotification(notificationMessage, 'info');
    }

    /**
     * Отправка системного уведомления
     */
    async sendSystemNotification(title, message, type = 'info') {
        const emoji = {
            'success': '✅',
            'error': '❌',
            'info': 'ℹ️',
            'warning': '⚠️'
        }[type] || '📢';

        const notificationMessage = `${emoji} <b>${title}</b>\n\n${message}`;
        
        return await this.sendNotification(notificationMessage, type);
    }

    /**
     * Показ уведомления в интерфейсе
     */
    showNotification(message, type = 'info') {
        // Используем существующую систему уведомлений из ChatApp
        if (window.chatApp && typeof window.chatApp.showNotification === 'function') {
            window.chatApp.showNotification(message, type);
        } else {
            // Fallback уведомление
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
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            `;
            notification.textContent = message;
            document.body.appendChild(notification);

            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
        }
    }

    /**
     * Получение статуса подключения
     */
    async getConnectionStatus() {
        return await this.checkConnection();
    }

    /**
     * Настройка Telegram уведомлений
     */
    async setupTelegramNotifications() {
        const connectionStatus = await this.checkConnection();
        
        if (connectionStatus.connected) {
            this.showNotification('✅ Telegram уведомления подключены', 'success');
            return true;
        } else {
            this.showNotification('❌ Telegram не подключен. Убедитесь, что вы начали диалог с ботом.', 'error');
            return false;
        }
    }
}

// Создаем глобальный экземпляр
window.telegramBot = new TelegramBot();
