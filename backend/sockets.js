\const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

// Инициализация Supabase клиента
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
        console.warn('❌ WebSocket: Токен отсутствует');
        return next(new Error('Токен отсутствует'));
      }

      // Для простоты используем ID пользователя как токен
      // В реальном приложении здесь должна быть JWT валидация
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', token)
        .single();

      if (error || !user) {
        console.warn('❌ WebSocket: Пользователь не найден');
        return next(new Error('Пользователь не найден'));
      }

      if (user.is_blocked) {
        console.warn(`❌ WebSocket: Аккаунт заблокирован - ${user.username}`);
        return next(new Error('Аккаунт заблокирован'));
      }

      socket.user = user;
      console.log(`✅ WebSocket аутентификация: ${user.username} (${user.role})`);
      next();
    } catch (error) {
      console.error('❌ WebSocket auth error:', error);
      next(new Error('Ошибка аутентификации'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Новое подключение: ${socket.user.username} (${socket.user.role})`);

    // Присоединение к комнатам
    socket.join(`user:${socket.user.id}`);
    socket.join(`role:${socket.user.role}`);
    
    if (socket.user.role === 'listener') {
      socket.join('listeners');
      console.log(`🎧 Слушатель присоединился к комнате: ${socket.user.username}`);
    }

    // Обновление статуса онлайн
    supabase
      .from('users')
      .update({ 
        is_online: true,
        last_seen: new Date().toISOString()
      })
      .eq('id', socket.user.id')
      .then(() => {
        socket.broadcast.emit('user_status_changed', {
          user_id: socket.user.id,
          username: socket.user.username,
          is_online: true,
          role: socket.user.role
        });
        console.log(`🟢 Статус онлайн: ${socket.user.username}`);
      })
      .catch(error => {
        console.error('❌ Ошибка обновления статуса онлайн:', error);
      });

    // Отправка сообщения
    socket.on('send_message', async (data) => {
      try {
        const { chat_id, content, message_type = 'text', media_url, sticker_url } = data;

        console.log(`📨 Новое сообщение от ${socket.user.username}:`, { chat_id, content });

        if (!chat_id || (!content && !media_url && !sticker_url)) {
          console.warn('❌ Неверные данные сообщения');
          return socket.emit('error', { message: 'Неверные данные сообщения' });
        }

        // Проверка мута
        if (socket.user.is_muted) {
          const muteExpires = new Date(socket.user.mute_expires_at);
          if (muteExpires > new Date()) {
            console.warn(`🔇 Пользователь в муте: ${socket.user.username}`);
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

        if (error) {
          console.error('❌ Ошибка создания сообщения:', error);
          throw error;
        }

        // Получаем информацию о чате
        const { data: chat } = await supabase
          .from('chats')
          .select('user_id, listener_id')
          .eq('id', chat_id)
          .single();

        if (!chat) {
          console.error('❌ Чат не найден:', chat_id);
          return socket.emit('error', { message: 'Чат не найден' });
        }

        // Отправка получателям
        const recipients = [chat.user_id, chat.listener_id].filter(id => id && id !== socket.user.id);
        
        recipients.forEach(recipientId => {
          io.to(`user:${recipientId}`).emit('new_message', message);
          console.log(`📤 Сообщение отправлено пользователю: ${recipientId}`);
        });

        // Отправка отправителю для подтверждения
        socket.emit('message_sent', message);

        // Уведомление для администраторов о новом сообщении
        io.to('role:admin').to('role:coowner').to('role:owner').emit('new_chat_activity', {
          chat_id,
          message_count: 1,
          username: socket.user.username
        });

        console.log(`✅ Сообщение доставлено ${recipients.length} получателям`);

      } catch (error) {
        console.error('❌ Ошибка отправки сообщения:', error);
        socket.emit('error', { message: 'Ошибка отправки сообщения' });
      }
    });

    // Присоединение к чату
    socket.on('join_chat', (chatId) => {
      socket.join(`chat:${chatId}`);
      console.log(`💬 Пользователь ${socket.user.username} присоединился к чату ${chatId}`);
    });

    // Покидание чата
    socket.on('leave_chat', (chatId) => {
      socket.leave(`chat:${chatId}`);
      console.log(`👋 Пользователь ${socket.user.username} покинул чат ${chatId}`);
    });

    // Типирование
    socket.on('typing_start', (data) => {
      socket.to(`chat:${data.chat_id}`).emit('user_typing', {
        user_id: socket.user.id,
        username: socket.user.username,
        is_typing: true
      });
      console.log(`⌨️ ${socket.user.username} печатает в чате ${data.chat_id}`);
    });

    socket.on('typing_stop', (data) => {
      socket.to(`chat:${data.chat_id}`).emit('user_typing', {
        user_id: socket.user.id,
        username: socket.user.username,
        is_typing: false
      });
    });

    // Обновление статуса слушателя
    socket.on('listener_status', (data) => {
      console.log(`🔄 Обновление статуса слушателя:`, data);
      socket.broadcast.emit('listener_status_update', {
        ...data,
        timestamp: new Date().toISOString()
      });
    });

    // Отключение
    socket.on('disconnect', async (reason) => {
      console.log(`🔌 Отключение: ${socket.user.username} (${reason})`);

      try {
        await supabase
          .from('users')
          .update({ 
            is_online: false,
            last_seen: new Date().toISOString()
          })
          .eq('id', socket.user.id);

        socket.broadcast.emit('user_status_changed', {
          user_id: socket.user.id,
          username: socket.user.username,
          is_online: false,
          role: socket.user.role
        });

        console.log(`🔴 Статус оффлайн: ${socket.user.username}`);
      } catch (error) {
        console.error('❌ Ошибка обновления статуса при отключении:', error);
      }
    });

    // Обработка ошибок
    socket.on('error', (error) => {
      console.error(`❌ Socket error для ${socket.user.username}:`, error);
    });
  });

  // Глобальные обработчики ошибок
  io.engine.on('connection_error', (err) => {
    console.error('❌ Connection error:', err);
  });
};
