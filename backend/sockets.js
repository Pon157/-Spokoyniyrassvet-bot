const jwt = require('jsonwebtoken');
const { supabase } = require('./db');

const setupSockets = (io) => {
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication error'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Получаем пользователя из Supabase
            const { data: user, error } = await supabase
                .from('users')
                .select('id, username, role, is_blocked, mutes')
                .eq('id', decoded.userId)
                .single();

            if (error || !user || user.is_blocked) {
                return next(new Error('User not found or blocked'));
            }

            socket.userId = user.id;
            socket.userRole = user.role;
            socket.username = user.username;
            next();
        } catch (error) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`User ${socket.username} connected`);

        // Присоединение к комнатам  
        socket.join(socket.userId);
        if (['admin', 'coowner', 'owner'].includes(socket.userRole)) {
            socket.join('admin-room');
        }

        // Создание нового чата
        socket.on('create-chat', async (data) => {
            try {
                const { data: chat, error } = await supabase
                    .from('chats')
                    .insert([{
                        participant_ids: [socket.userId, data.listenerId],
                        status: 'active',
                        created_at: new Date().toISOString()
                    }])
                    .select()
                    .single();

                if (error) throw error;
                
                socket.join(chat.id);
                socket.emit('chat-created', { chatId: chat.id });
            } catch (error) {
                socket.emit('error', { message: 'Ошибка создания чата' });
            }
        });

        // Отправка сообщения
        socket.on('send-message', async (data) => {
            try {
                // Проверка мута  
                const now = new Date();
                const { data: user } = await supabase
                    .from('users')
                    .select('mutes')
                    .eq('id', socket.userId)
                    .single();

                if (user.mutes && user.mutes.some(mute => new Date(mute.expires_at) > now)) {
                    const activeMute = user.mutes.find(mute => new Date(mute.expires_at) > now);
                    socket.emit('error', { 
                        message: `Вы в муте до ${activeMute.expires_at}. Причина: ${activeMute.reason}` 
                    });
                    return;
                }

                // Сохраняем сообщение
                const { data: message, error } = await supabase
                    .from('messages')
                    .insert([{
                        chat_id: data.chatId,
                        user_id: socket.userId,
                        username: socket.username,
                        content: data.content,
                        message_type: data.type || 'text',
                        media_url: data.mediaUrl,
                        created_at: new Date().toISOString()
                    }])
                    .select()
                    .single();

                if (error) throw error;

                // Логирование
                await supabase
                    .from('logs')
                    .insert([{
                        action: 'message_sent',
                        user_id: socket.userId,
                        target_id: data.chatId,
                        details: {
                            message_id: message.id,
                            content: data.content,
                            type: data.type
                        },
                        timestamp: new Date().toISOString()
                    }]);

                // Отправляем сообщение всем в чате
                io.to(data.chatId).emit('new-message', message);
            } catch (error) {
                socket.emit('error', { message: 'Ошибка отправки сообщения' });
            }
        });

        // Присоединение к чату
        socket.on('join-chat', (chatId) => {
            socket.join(chatId);
        });

        // Покидание чата
        socket.on('leave-chat', (chatId) => {
            socket.leave(chatId);
        });

        // Запрос истории сообщений
        socket.on('get-messages', async (chatId) => {
            try {
                const { data: messages, error } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('chat_id', chatId)
                    .order('created_at', { ascending: true });

                if (error) throw error;
                
                socket.emit('messages-history', messages || []);
            } catch (error) {
                socket.emit('error', { message: 'Ошибка загрузки сообщений' });
            }
        });

        // Отключение
        socket.on('disconnect', () => {
            console.log(`User ${socket.username} disconnected`);
        });
    });
};

module.exports = setupSockets;
