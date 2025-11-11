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
        console.warn('❌ WebSocket: Токен отсутствует');
        return next(new Error('Токен отсутствует'));
      }

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
    
    // Специальные комнаты для слушателей
    if (socket.user.role === 'listener') {
      socket.join('listeners:active');
      socket.join('listeners:online');
      console.log(`🎧 Слушатель присоединился к комнатам: ${socket.user.username}`);
      
      // Уведомляем всех о новом онлайн слушателе
      socket.broadcast.emit('listener_online', {
        listener_id: socket.user.id,
        username: socket.user.username,
        avatar_url: socket.user.avatar_url,
        rating: socket.user.rating || 4.5,
        specialties: socket.user.specialties || ['Психология'],
        is_online: true
      });
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
      });

    // 🔄 НОВЫЕ СОБЫТИЯ ДЛЯ СЛУШАТЕЛЕЙ

    // Получение активных слушателей
    socket.on('get_active_listeners', async () => {
      try {
        console.log(`📋 Запрос активных слушателей от: ${socket.user.username}`);
        
        const { data: listeners, error } = await supabase
          .from('users')
          .select(`
            id,
            username,
            avatar_url,
            is_online,
            rating,
            specialties,
            bio,
            total_sessions,
            created_at
          `)
          .eq('role', 'listener')
          .eq('is_online', true)
          .eq('is_blocked', false)
          .order('is_online', { ascending: false })
          .order('rating', { ascending: false });

        if (error) throw error;

        const activeListeners = listeners.map(listener => ({
          id: listener.id,
          username: listener.username,
          avatar_url: listener.avatar_url,
          is_online: listener.is_online,
          rating: listener.rating || 4.5,
          specialties: listener.specialties || ['Психология'],
          bio: listener.bio || 'Профессиональный слушатель',
          total_sessions: listener.total_sessions || 0,
          response_time: '2-5 мин'
        }));

        socket.emit('active_listeners_list', activeListeners);
        console.log(`✅ Отправлено ${activeListeners.length} активных слушателей`);
        
      } catch (error) {
        console.error('❌ Ошибка получения слушателей:', error);
        socket.emit('error', { message: 'Ошибка получения списка слушателей' });
      }
    });

    // Начать чат с конкретным слушателем
    socket.on('start_chat_with_listener', async (data) => {
      try {
        const { listener_id } = data;
        
        console.log(`💬 Пользователь ${socket.user.username} начинает чат с слушателем ${listener_id}`);

        if (!listener_id) {
          return socket.emit('error', { message: 'ID слушателя не указан' });
        }

        // Проверяем существующий активный чат
        const { data: existingChat, error: chatError } = await supabase
          .from('chats')
          .select('*')
          .eq('user_id', socket.user.id)
          .eq('listener_id', listener_id)
          .eq('status', 'active')
          .single();

        if (existingChat) {
          console.log('♻️ Используем существующий чат:', existingChat.id);
          socket.emit('chat_created', { 
            chat: existingChat,
            is_new: false 
          });
          return;
        }

        // Создаем новый чат
        const chatData = {
          user_id: socket.user.id,
          listener_id: listener_id,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data: newChat, error } = await supabase
          .from('chats')
          .insert(chatData)
          .select(`
            *,
            user:users!chats_user_id_fkey(id, username, avatar_url),
            listener:users!chats_listener_id_fkey(id, username, avatar_url)
          `)
          .single();

        if (error) throw error;

        console.log('✅ Новый чат создан:', newChat.id);

        // Уведомляем слушателя о новом чате
        io.to(`user:${listener_id}`).emit('new_chat_request', {
          chat_id: newChat.id,
          user_id: socket.user.id,
          username: socket.user.username,
          user_avatar: socket.user.avatar_url
        });

        // Отправляем подтверждение пользователю
        socket.emit('chat_created', { 
          chat: newChat,
          is_new: true 
        });

        // Уведомляем администраторов
        io.to('role:admin').to('role:owner').to('role:coowner').emit('new_chat_created', {
          chat_id: newChat.id,
          user_id: socket.user.id,
          listener_id: listener_id,
          username: socket.user.username
        });

      } catch (error) {
        console.error('❌ Ошибка создания чата:', error);
        socket.emit('error', { message: 'Ошибка создания чата' });
      }
    });

    // Слушатель принимает чат
    socket.on('listener_accept_chat', async (data) => {
      try {
        const { chat_id } = data;
        
        console.log(`🎧 Слушатель ${socket.user.username} принимает чат ${chat_id}`);

        // Обновляем статус чата
        const { data: updatedChat, error } = await supabase
          .from('chats')
          .update({ 
            status: 'active',
            accepted_at: new Date().toISOString()
          })
          .eq('id', chat_id)
          .eq('listener_id', socket.user.id)
          .select(`
            *,
            user:users!chats_user_id_fkey(id, username, avatar_url)
          `)
          .single();

        if (error) throw error;

        // Уведомляем пользователя
        io.to(`user:${updatedChat.user_id}`).emit('chat_accepted', {
          chat_id: chat_id,
          listener_id: socket.user.id,
          listener_name: socket.user.username,
          listener_avatar: socket.user.avatar_url
        });

        console.log(`✅ Чат ${chat_id} принят слушателем`);

      } catch (error) {
        console.error('❌ Ошибка принятия чата:', error);
        socket.emit('error', { message: 'Ошибка принятия чата' });
      }
    });

    // Слушатель обновляет статус доступности
    socket.on('update_listener_availability', async (data) => {
      try {
        const { is_available } = data;
        
        console.log(`🔄 Слушатель ${socket.user.username} обновляет статус: ${is_available ? 'доступен' : 'не доступен'}`);

        // Обновляем статус в базе
        const { error } = await supabase
          .from('users')
          .update({ 
            is_online: is_available,
            last_seen: new Date().toISOString()
          })
          .eq('id', socket.user.id);

        if (error) throw error;

        // Выходим/присоединяемся к комнатам в зависимости от статуса
        if (is_available) {
          socket.join('listeners:active');
          socket.join('listeners:online');
        } else {
          socket.leave('listeners:active');
          socket.leave('listeners:online');
        }

        // Уведомляем всех пользователей об изменении статуса
        io.emit('listener_availability_changed', {
          listener_id: socket.user.id,
          username: socket.user.username,
          is_available: is_available,
          timestamp: new Date().toISOString()
        });

        socket.emit('availability_updated', { success: true });

      } catch (error) {
        console.error('❌ Ошибка обновления статуса:', error);
        socket.emit('error', { message: 'Ошибка обновления статуса' });
      }
    });

    // 📨 СУЩЕСТВУЮЩИЕ СОБЫТИЯ ЧАТА (оставляем как есть)
    socket.on('send_message', async (data) => {
      // ... существующий код отправки сообщений ...
    });

    socket.on('join_chat', (chatId) => {
      socket.join(`chat:${chatId}`);
      console.log(`💬 Пользователь ${socket.user.username} присоединился к чату ${chatId}`);
    });

    socket.on('leave_chat', (chatId) => {
      socket.leave(`chat:${chatId}`);
      console.log(`👋 Пользователь ${socket.user.username} покинул чат ${chatId}`);
    });

    // Отключение
    socket.on('disconnect', async (reason) => {
      console.log(`🔌 Отключение: ${socket.user.username} (${reason})`);

      try {
        // Обновляем статус оффлайн
        await supabase
          .from('users')
          .update({ 
            is_online: false,
            last_seen: new Date().toISOString()
          })
          .eq('id', socket.user.id);

        // Уведомляем о выходе слушателя
        if (socket.user.role === 'listener') {
          socket.broadcast.emit('listener_offline', {
            listener_id: socket.user.id,
            username: socket.user.username,
            timestamp: new Date().toISOString()
          });
        }

        socket.broadcast.emit('user_status_changed', {
          user_id: socket.user.id,
          username: socket.user.username,
          is_online: false,
          role: socket.user.role
        });

      } catch (error) {
        console.error('❌ Ошибка обновления статуса при отключении:', error);
      }
    });
  });
};
