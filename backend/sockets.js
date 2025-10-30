const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Chat = require('./models/Chat');
const Message = require('./models/Message');

const setupSockets = (io) => {
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication error'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId);
            
            if (!user || user.isBlocked) {
                return next(new Error('User not found or blocked'));
            }

            socket.userId = user._id;
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
        socket.join(socket.userId.toString());
        if (socket.userRole === 'admin' || socket.userRole === 'coowner' || socket.userRole === 'owner') {
            socket.join('admin-room');
        }

        // Создание нового чата
        socket.on('create-chat', async (data) => {
            try {
                const chat = new Chat({
                    participants: [socket.userId, data.listenerId],
                    status: 'active'
                });
                
                await chat.save();
                socket.join(chat._id.toString());
                
                socket.emit('chat-created', { chatId: chat._id });
            } catch (error) {
                socket.emit('error', { message: 'Ошибка создания чата' });
            }
        });

        // Отправка сообщения
        socket.on('send-message', async (data) => {
            try {
                const user = await User.findById(socket.userId);
                
                // Проверка мута
                const now = new Date();
                const activeMute = user.mutes.find(mute => mute.expiresAt > now);
                if (activeMute) {
                    socket.emit('error', { 
                        message: `Вы в муте до ${activeMute.expiresAt}. Причина: ${activeMute.reason}` 
                    });
                    return;
                }

                const message = new Message({
                    chatId: data.chatId,
                    senderId: socket.userId,
                    content: data.content,
                    type: data.type || 'text',
                    mediaUrl: data.mediaUrl
                });

                await message.save();
                await message.populate('senderId', 'username avatar');

                // Логирование
                const Log = require('./models/Log');
                const log = new Log({
                    action: 'message_sent',
                    userId: socket.userId,
                    targetId: data.chatId,
                    details: {
                        messageId: message._id,
                        content: data.content,
                        type: data.type
                    },
                    timestamp: new Date()
                });
                await log.save();

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
                const messages = await Message.find({ chatId })
                    .populate('senderId', 'username avatar')
                    .sort({ timestamp: 1 });
                
                socket.emit('messages-history', messages);
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
