// backend/controllers/telegram.js
const axios = require('axios');

class TelegramController {
    constructor() {
        // Берем токен из переменных окружения
        this.botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!this.botToken) {
            console.error('❌ TELEGRAM_BOT_TOKEN не установлен в .env файле');
            return;
        }
        
        this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
        this.userChatIds = new Map();
        this.init();
    }

    async init() {
        try {
            // Проверяем что бот доступен
            const botInfo = await this.getBotInfo();
            if (botInfo.success) {
                console.log(`✅ Telegram Bot подключен: @${botInfo.bot.username}`);
                
                // Устанавливаем webhook
                const webhookUrl = `${process.env.DOMAIN}/api/telegram/webhook`;
                await this.setWebhook(webhookUrl);
            } else {
                console.error('❌ Не удалось подключиться к Telegram Bot');
            }
        } catch (error) {
            console.error('❌ Ошибка инициализации Telegram Bot:', error);
        }
    }

    // Остальные методы остаются такими же...
    async handleWebhook(req, res) {
        try {
            const update = req.body;
            console.log('📨 Telegram webhook получен');

            if (update.message) {
                await this.handleMessage(update.message);
            }

            res.status(200).send('OK');
        } catch (error) {
            console.error('❌ Ошибка обработки webhook:', error);
            res.status(500).send('Error');
        }
    }

    async handleMessage(message) {
        const chatId = message.chat.id;
        const text = message.text;
        const username = message.from.username;

        console.log(`💬 Сообщение от @${username}: ${text}`);

        // Сохраняем chat_id в базе данных (вместо памяти)
        if (username) {
            await this.saveUserChatId(username, chatId);
        }

        if (text === '/start') {
            await this.sendMessage(chatId, 
                `👋 Привет, ${message.from.first_name || 'друг'}!\n\n` +
                `Я бот для уведомлений от "Спокойный рассвет".\n` +
                `Теперь ты будешь получать уведомления о новых сообщениях и событиях.\n\n` +
                `Твой Telegram: @${username}\n` +
                `Для отключения уведомлений используй /stop`
            );
        }

        if (text === '/stop') {
            if (username) {
                await this.removeUserChatId(username);
            }
            await this.sendMessage(chatId, 
                '🔕 Уведомления отключены. Чтобы снова включить, отправь /start'
            );
        }
    }

    // Сохранение chat_id в базе данных
    async saveUserChatId(username, chatId) {
        try {
            // Здесь интеграция с твоей базой данных Supabase
            const { data, error } = await supabase
                .from('users')
                .update({ telegram_chat_id: chatId })
                .eq('telegram_username', username.toLowerCase());

            if (error) throw error;
            
            console.log(`✅ Chat_id сохранен для @${username}: ${chatId}`);
            return true;
        } catch (error) {
            console.error('❌ Ошибка сохранения chat_id:', error);
            return false;
        }
    }

    async removeUserChatId(username) {
        try {
            const { data, error } = await supabase
                .from('users')
                .update({ telegram_chat_id: null })
                .eq('telegram_username', username.toLowerCase());

            if (error) throw error;
            
            console.log(`✅ Chat_id удален для @${username}`);
            return true;
        } catch (error) {
            console.error('❌ Ошибка удаления chat_id:', error);
            return false;
        }
    }

    // Получение chat_id из базы данных
    async getUserChatId(username) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('telegram_chat_id')
                .eq('telegram_username', username.toLowerCase())
                .single();

            if (error) throw error;
            
            return data?.telegram_chat_id || null;
        } catch (error) {
            console.error('❌ Ошибка получения chat_id:', error);
            return null;
        }
    }

    async sendMessage(chatId, text, options = {}) {
        try {
            const response = await axios.post(`${this.apiUrl}/sendMessage`, {
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML',
                ...options
            });

            return { success: true, messageId: response.data.result.message_id };
        } catch (error) {
            console.error('❌ Ошибка отправки сообщения в Telegram:', error.response?.data);
            return { success: false, error: error.message };
        }
    }

    async sendNotificationByUsername(username, message, options = {}) {
        try {
            const chatId = await this.getUserChatId(username);
            
            if (!chatId) {
                return { 
                    success: false, 
                    error: 'Пользователь не запустил бота или username не найден' 
                };
            }

            return await this.sendMessage(chatId, message, options);
        } catch (error) {
            console.error('❌ Ошибка отправки уведомления:', error);
            return { success: false, error: error.message };
        }
    }

    async getBotInfo() {
        try {
            const response = await axios.get(`${this.apiUrl}/getMe`);
            return { success: true, bot: response.data.result };
        } catch (error) {
            console.error('❌ Ошибка получения информации о боте:', error);
            return { success: false, error: error.message };
        }
    }

    async setWebhook(url) {
        try {
            const response = await axios.post(`${this.apiUrl}/setWebhook`, {
                url: url
            });

            console.log(`✅ Webhook установлен: ${url}`);
            return { success: true, data: response.data };
        } catch (error) {
            console.error('❌ Ошибка установки webhook:', error);
            return { success: false, error: error.message };
        }
    }

    // Проверка статуса подключения пользователя
    async checkUserConnection(username) {
        const chatId = await this.getUserChatId(username);
        return { connected: !!chatId, chatId };
    }
}

module.exports = new TelegramController();
