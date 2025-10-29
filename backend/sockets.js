const jwt = require('jsonwebtoken');
const Message = require('./models/Message');

module.exports = (io) => {
  const connectedUsers = new Map(); // userId → socketId
  const userSockets = new Map(); // socketId → userId

  io.on('connection', (socket) => {
    console.log('Новый клиент подключён:', socket.id);

    // Авторизация через JWT
    socket.on('authorize', (token) => {
      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          socket.emit('authError', 'Недействительный токен');
          socket.disconnect();
          return;
        }

        connectedUsers.set(decoded.id, socket.id);
        userSockets.set(socket.id, decoded.id);
        socket.join(decoded.id.toString());
        console.log(`Пользователь авторизован: ${decoded.id}`);
      });
    });

    // Отправка сообщения
    socket.on('sendMessage', async (data) => {
      try {
        const { to, content, type, fileName } = data;
        const from = userSockets.get(socket.id);

        if (!from) {
          console.error('Отправитель не авторизован');
          return;
        }

        const message = new Message({
          from,
          to,
          content,
          type,
          fileName,
          sentAt: new Date()
        });
        await message.save();

        // Отправляем сообщение получателю
        const recipientSocketId = connectedUsers.get(to);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('newMessage', message);
        }

        // Отправляем отправителю (для синхронизации)
        io.to(socket.id).emit('newMessage', message);
      } catch (err) {
        console.error('Ошибка отправки сообщения:', err);
      }
    });

    // Индикация набора текста
    socket.on('startTyping', ({ chatId }) => {
      const userId = userSockets.get(socket.id);
      if (userId) {
        io.to(chatId.toString()).emit('userTyping', { userId, chatId });
      }
    });

    socket.on('stopTyping', ({ chatId }) => {
      const userId = userSockets.get(socket.id);
      if (userId) {
        io.to(chatId.toString()).emit('userStoppedTyping', { userId, chatId });
      }
    });

    // Вход в чат (подписка на комнату)
    socket.on('joinChat', (userId) => {
      socket.join(userId.toString());
      console.log(`Пользователь ${userId} присоединился к комнате`);
    });

    // Выход из чата
    socket.on('leaveChat', (userId) => {
      socket.leave(userId.toString());
      console.log(`Пользователь ${userId} покинул комнату`);
    });

    // Обработка отключения клиента
    socket.on('disconnect', () => {
      console.log('Клиент отключился:', socket.id);
      const userId = userSockets.get(socket.id);
      if (userId) {
        connectedUsers.delete(userId);
        userSockets.delete(socket.id);
        console.log(`Пользователь ${userId} больше не в сети`);
      }
    });

    // Проверка подключения (для отладки)
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });

  // Метод для отправки уведомлений всем подключённым клиентам (опционально)
  io.broadcastNotification = (event, data) => {
    io.emit(event, data);
  };
};
