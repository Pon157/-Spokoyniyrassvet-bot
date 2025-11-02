// telegram-notifications.js - Управление Telegram уведомлениями
class TelegramNotifications {
    constructor() {
        this.botUsername = '@SpokoyniyRassvetBot'; // Замени на username твоего бота
        this.botToken = 'ТВОЙ_ТОКЕН_БОТА'; // Замени на реальный токен
        this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkTelegramConnection();
    }

    setupEventListeners() {
        // Кнопка подключения Telegram
        const connectBtn = document.getElementById('connectTelegram');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.connectTelegram());
        }

        // Кнопка тестового уведомления
        const testBtn = document.getElementById('testTelegramNotification');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.sendTestNotification());
        }
    }

    async connectTelegram() {
        // Сохраняем Telegram username из профиля
        const telegramInput = document.getElementById('telegram');
        const telegramUsername = telegramInput?.value.trim();

        if (!telegramUsername || !telegramUsername.startsWith('@')) {
            this.showNotification('Укажите ваш Telegram username в профиле (начинается с @)', 'error');
            return;
        }

        // Инструкция для пользователя
        this.showTelegramInstructions(telegramUsername);
    }

    showTelegramInstructions(username) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="
                background: white;
                padding: 2rem;
                border-radius: 12px;
                max-width: 500px;
                width: 90%;
                text-align: center;
            ">
                <h3 style="color: #0088cc; margin-bottom: 1rem;">
                    <i class="fab fa-telegram"></i> Подключение Telegram
                </h3>
                
                <p style="margin-bottom: 1.5rem; color: #374151;">
                    Чтобы получать уведомления в Telegram:
                </p>
                
                <div style="text-align: left; margin-bottom: 2rem; background: #f0f9ff; padding: 1rem; border-radius: 8px;">
                    <ol style="margin: 0; padding-left: 1.5rem;">
                        <li>Перейдите в Telegram</li>
                        <li>Найдите бота: <strong>${this.botUsername}</strong></li>
                        <li>Нажмите <strong>START</strong> или отправьте <code>/start</code></li>
                        <li>Бот автоматически свяжется с вашим аккаунтом</li>
                    </ol>
                </div>

                <div style="margin-bottom: 1.5rem; padding: 1rem; background: #fef3c7; border-radius: 8px;">
                    <p style="margin: 0; color: #92400e;">
                        <strong>Ваш Telegram:</strong> ${username}<br>
                        Убедитесь, что это правильный username!
                    </p>
                </div>
                
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button onclick="window.open('https://t.me/${this.botUsername.replace('@', '')}', '_blank')" style="
                        background: #0088cc;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                    ">
                        <i class="fab fa-telegram"></i> Открыть Telegram
                    </button>
                    
                    <button onclick="this.closest('div[style]').parentElement.remove()" style="
                        background: #6b7280;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                    ">
                        Закрыть
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    async sendTestNotification() {
        const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
        const telegramUsername = userData.telegram_username;

        if (!telegramUsername) {
            this.showNotification('Сначала укажите Telegram username в профиле', 'error');
            return;
        }

        try {
            const response = await fetch('/api/telegram/send-test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({
                    telegram_username: telegramUsername,
                    message: '🔔 Тестовое уведомление от Спокойного рассвета!\n\nЭто тестовое сообщение подтверждает, что уведомления работают правильно.'
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('Тестовое уведомление отправлено в Telegram!', 'success');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('❌ Ошибка отправки тестового уведомления:', error);
            this.showNotification('Ошибка отправки уведомления в Telegram', 'error');
        }
    }

    async checkTelegramConnection() {
        // Проверяем статус подключения Telegram
        try {
            const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
            if (userData.telegram_username) {
                const response = await fetch('/api/telegram/status', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    }
                });

                if (response.ok) {
                    const result = await response.json();
                    this.updateTelegramStatus(result.connected);
                }
            }
        } catch (error) {
            console.error('❌ Ошибка проверки статуса Telegram:', error);
        }
    }

    updateTelegramStatus(connected) {
        const statusElement = document.getElementById('telegramStatus');
        if (statusElement) {
            if (connected) {
                statusElement.innerHTML = '<span style="color: #10b981;">✅ Подключено</span>';
            } else {
                statusElement.innerHTML = '<span style="color: #ef4444;">❌ Не подключено</span>';
            }
        }
    }

    showNotification(message, type = 'info') {
        // Используем существующую систему уведомлений
        if (window.settings && window.settings.showNotification) {
            window.settings.showNotification(message, type);
        } else {
            // Fallback уведомление
            alert(`${type.toUpperCase()}: ${message}`);
        }
    }
}

// Глобальный экземпляр
window.telegramNotifications = new TelegramNotifications();
