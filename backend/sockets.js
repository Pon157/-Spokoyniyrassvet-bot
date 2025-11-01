const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

module.exports = (io) => {
  // Middleware для аутентификации WebSocket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Токен отсутствует'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', decoded.userId)
        .single();

      if (error || !user) {
        return next(new Error('Пользователь не найден'));
      }

      if (user.is_blocked) {
        return next(new Error('Аккаунт заблокирован'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Неверный токен'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Новое подключение: ${socket.user.username} (${socket.user.role})`);

    // Присоединение к комнатам
    socket.join(`user:${socket.user.id}`);
    socket.join(`role:${socket.user.role}`);
    
    if (socket.user.role === 'listener') {
      socket.join('listeners');
    }

    // Обновление статуса онлайн
    supabase
      .from('users')
      .update({ is_online: true })
      .eq('id', socket.user.id')
      .then(() => {
        socket.broadcast.emit('user_status_changed', {
          user_id: socket.user.id,
          is_online: true
        });
      });

    // Отправка сообщения
    socket.on('send_message', async (data) => {
      try {
        const { chat_id, content, message_type = 'text', media_url, sticker_url } = data;

        if (!chat_id || (!content && !media_url && !sticker_url)) {
          return socket.emit('error', { message: 'Неверные данные сообщения' });
        }

        // Проверка мута
        if (socket.user.is_muted) {
          const muteExpires = new Date(socket.user.mute_expires_at);
          if (muteExpires > new Date()) {
            return socket.emit('error', { 
              message: `Вы в муте до ${muteExpires.toLocaleString()}` 
            });
          }
        }

        // Создание сообщения
        const { data: message, error } = await supabase
          .from('messages')
          .insert({
            chat_id,
            sender_id: socket.user.id,
            content,
            message_type,
            media_url,
            sticker_url
          })
          .select(`
            *,
            sender:users(id, username, avatar_url, role)
          `)
          .single();

        if (error) throw error;

        // Получаем информацию о чате
        const { data: chat } = await supabase
          .from('chats')
          .select('user_id, listener_id')
          .eq('id', chat_id)
          .single();

        // Отправка получателям
        const recipients = [chat.user_id, chat.listener_id].filter(id => id !== socket.user.id);
        
        recipients.forEach(recipientId => {
          io.to(`user:${recipientId}`).emit('new_message', message);
        });

        // Отправка отправителю для подтверждения
        socket.emit('message_sent', message);

        // Уведомление для администраторов о новом сообщении
        io.to('role:admin').to('role:coowner').to('role:owner').emit('new_chat_activity', {
          chat_id,
          message_count: 1
        });

      } catch (error) {
        console.error('Ошибка отправки сообщения:', error);
        socket.emit('error', { message: 'Ошибка отправки сообщения' });
      }
    });

    // Присоединение к чату
    socket.on('join_chat', (chatId) => {
      socket.join(`chat:${chatId}`);
      console.log(`Пользователь ${socket.user.username} присоединился к чату ${chatId}`);
    });

    // Покидание чата
    socket.on('leave_chat', (chatId) => {
      socket.leave(`chat:${chatId}`);
    });

    // Типирование
    socket.on('typing_start', (data) => {
      socket.to(`chat:${data.chat_id}`).emit('user_typing', {
        user_id: socket.user.id,
        username: socket.user.username,
        is_typing: true
      });
    });

    socket.on('typing_stop', (data) => {
      socket.to(`chat:${data.chat_id}`).emit('user_typing', {
        user_id: socket.user.id,
        username: socket.user.username,
        is_typing: false
      });
    });

    // Отключение
    socket.on('disconnect', async () => {
      console.log(`🔌 Отключение: ${socket.user.username}`);

      try {
        await supabase
          .from('users')
          .update({ is_online: false })
          .eq('id', socket.user.id);

        socket.broadcast.emit('user_status_changed', {
          user_id: socket.user.id,
          is_online: false
        });
      } catch (error) {
        console.error('Ошибка обновления статуса:', error);
      }
    });
  });
};
