const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { authenticateToken, requireRole, logAction } = require('../middleware');

const router = express.Router();

// Инициализация Supabase клиента
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Получение профиля слушателя
router.get('/profile', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const listenerId = req.user.id;
    console.log('📥 Получение профиля слушателя:', listenerId);

    const { data: profile, error } = await supabase
      .from('listeners')
      .select('*')
      .eq('user_id', listenerId)
      .single();

    if (error) {
      console.error('❌ Ошибка получения профиля:', error);
      // Если профиля нет, создаем базовый
      if (error.code === 'PGRST116') {
        const { data: newProfile, error: createError } = await supabase
          .from('listeners')
          .insert({
            user_id: listenerId,
            is_available: true,
            rating: 0,
            total_sessions: 0,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) throw createError;
        return res.json({ profile: newProfile });
      }
      throw error;
    }

    console.log('✅ Профиль получен');
    res.json({ profile });
  } catch (error) {
    console.error('❌ Ошибка получения профиля:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      details: error.message 
    });
  }
});

// Обновление профиля слушателя
router.put('/profile', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const listenerId = req.user.id;
    const { bio, specialties, hourly_rate, languages, experience } = req.body;

    console.log('📝 Обновление профиля слушателя:', listenerId);

    const { data, error } = await supabase
      .from('listeners')
      .update({
        bio,
        specialties,
        hourly_rate,
        languages,
        experience,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', listenerId)
      .select()
      .single();

    if (error) throw error;

    await logAction(listenerId, 'UPDATE_PROFILE', { listenerId });

    console.log('✅ Профиль обновлен');
    res.json({ profile: data });
  } catch (error) {
    console.error('❌ Ошибка обновления профиля:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      details: error.message 
    });
  }
});

// Обновление онлайн статуса
router.post('/status', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const listenerId = req.user.id;
    const { online } = req.body;

    console.log('🔄 Обновление статуса слушателя:', listenerId, 'online:', online);

    // Обновляем статус в таблице users
    const { error: userError } = await supabase
      .from('users')
      .update({ 
        is_online: online,
        last_seen: new Date().toISOString()
      })
      .eq('id', listenerId);

    if (userError) {
      console.error('❌ Ошибка обновления статуса пользователя:', userError);
      throw userError;
    }

    // Обновляем статус в таблице listeners
    const { error: listenerError } = await supabase
      .from('listeners')
      .update({ 
        is_available: online,
        last_activity: new Date().toISOString()
      })
      .eq('user_id', listenerId);

    if (listenerError) {
      console.error('❌ Ошибка обновления статуса слушателя:', listenerError);
      throw listenerError;
    }

    await logAction(listenerId, 'UPDATE_STATUS', { online });

    // Отправляем уведомление через WebSocket
    const io = req.app.get('io');
    if (io) {
      io.emit('listener_status_update', {
        listenerId,
        online,
        timestamp: new Date().toISOString()
      });
      console.log('📢 WebSocket уведомление отправлено');
    }

    console.log('✅ Статус обновлен');
    res.json({ success: true, online });
  } catch (error) {
    console.error('❌ Ошибка обновления статуса:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      details: error.message 
    });
  }
});

// Получение отзывов слушателя
router.get('/reviews', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const listenerId = req.user.id;
    console.log('📥 Получение отзывов слушателя:', listenerId);

    const { data: reviews, error } = await supabase
      .from('reviews')
      .select(`
        *,
        user:users!reviews_user_id_fkey(username, avatar_url),
        chat:chats(id)
      `)
      .eq('listener_id', listenerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Ошибка получения отзывов:', error);
      throw error;
    }

    // Рассчитываем средний рейтинг
    const averageRating = reviews && reviews.length > 0 
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
      : 0;

    const formattedReviews = (reviews || []).map(review => ({
      id: review.id,
      user_name: review.user?.username || 'Пользователь',
      user_avatar: review.user?.avatar_url,
      rating: review.rating,
      comment: review.comment,
      created_at: review.created_at,
      chat_id: review.chat?.id
    }));

    console.log(`✅ Получено отзывов: ${formattedReviews.length}`);

    res.json({ 
      reviews: formattedReviews,
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews: formattedReviews.length
    });
  } catch (error) {
    console.error('❌ Ошибка получения отзывов:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      details: error.message 
    });
  }
});

// Статистика слушателя
router.get('/statistics', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const listenerId = req.user.id;
    console.log('📊 Получение статистики слушателя:', listenerId);

    const [
      reviewsData,
      chatsData,
      messagesData,
      sessionsData
    ] = await Promise.all([
      // Отзывы
      supabase
        .from('reviews')
        .select('rating')
        .eq('listener_id', listenerId),
      
      // Чаты
      supabase
        .from('chats')
        .select('status, created_at, ended_at')
        .eq('listener_id', listenerId),
      
      // Сообщения за последние 7 дней
      supabase
        .from('messages')
        .select('created_at')
        .eq('sender_id', listenerId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      
      // Сессии для расчета среднего времени
      supabase
        .from('chats')
        .select('created_at, ended_at')
        .eq('listener_id', listenerId)
        .not('ended_at', 'is', null)
    ]);

    // Обработка ошибок
    if (reviewsData.error) console.error('Ошибка получения отзывов:', reviewsData.error);
    if (chatsData.error) console.error('Ошибка получения чатов:', chatsData.error);
    if (messagesData.error) console.error('Ошибка получения сообщений:', messagesData.error);
    if (sessionsData.error) console.error('Ошибка получения сессий:', sessionsData.error);

    const totalChats = chatsData.data?.length || 0;
    const activeChats = chatsData.data?.filter(chat => chat.status === 'active').length || 0;
    const completedChats = chatsData.data?.filter(chat => chat.status === 'completed').length || 0;
    
    // Средний рейтинг
    const averageRating = reviewsData.data?.length > 0 
      ? reviewsData.data.reduce((sum, review) => sum + review.rating, 0) / reviewsData.data.length 
      : 0;

    // Среднее время сессии
    let averageSessionTime = 0;
    if (sessionsData.data && sessionsData.data.length > 0) {
      const totalTime = sessionsData.data.reduce((sum, session) => {
        try {
          const start = new Date(session.created_at);
          const end = new Date(session.ended_at);
          return sum + (end - start);
        } catch (error) {
          console.error('Ошибка расчета времени сессии:', error);
          return sum;
        }
      }, 0);
      averageSessionTime = Math.round(totalTime / sessionsData.data.length / 60000); // в минутах
    }

    // Активность по дням (последние 7 дней)
    const activityByDay = {};
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    last7Days.forEach(date => {
      activityByDay[date] = 0;
    });

    messagesData.data?.forEach(message => {
      try {
        const date = new Date(message.created_at).toISOString().split('T')[0];
        if (activityByDay[date] !== undefined) {
          activityByDay[date]++;
        }
      } catch (error) {
        console.error('Ошибка обработки даты сообщения:', error);
      }
    });

    // Процент полезности (на основе отзывов с рейтингом >= 4)
    const helpfulReviews = reviewsData.data?.filter(review => review.rating >= 4).length || 0;
    const helpfulness = reviewsData.data?.length > 0 
      ? Math.round((helpfulReviews / reviewsData.data.length) * 100) 
      : 0;

    console.log('✅ Статистика получена');

    res.json({
      totalSessions: totalChats,
      activeChats,
      completedChats,
      averageRating: Math.round(averageRating * 10) / 10,
      averageSessionTime,
      helpfulness,
      weeklyActivity: activityByDay,
      totalMessages: messagesData.data?.length || 0
    });
  } catch (error) {
    console.error('❌ Ошибка получения статистики слушателя:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      details: error.message 
    });
  }
});

// Доступные чаты для слушателя
router.get('/chats', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const listenerId = req.user.id;
    console.log('📥 Получение чатов слушателя:', listenerId);

    // Сначала получаем базовую информацию о чатах
    const { data: chats, error: chatsError } = await supabase
      .from('chats')
      .select(`
        id,
        status,
        created_at,
        user_id,
        listener_id,
        user:users!chats_user_id_fkey(username, avatar_url, is_online)
      `)
      .eq('listener_id', listenerId)
      .in('status', ['active', 'waiting'])
      .order('created_at', { ascending: false });

    if (chatsError) {
      console.error('❌ Ошибка получения чатов:', chatsError);
      throw chatsError;
    }

    console.log(`📊 Найдено чатов: ${chats?.length || 0}`);

    // Если чатов нет, возвращаем пустой массив
    if (!chats || chats.length === 0) {
      console.log('✅ Нет активных чатов');
      return res.json({ chats: [] });
    }

    const formattedChats = await Promise.all(
      chats.map(async (chat) => {
        try {
          // Получаем количество непрочитанных сообщений
          const { count: unreadCount, error: unreadError } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('chat_id', chat.id)
            .eq('is_read', false)
            .neq('sender_id', listenerId);

          if (unreadError) {
            console.error(`❌ Ошибка подсчета непрочитанных для чата ${chat.id}:`, unreadError);
          }

          // Получаем последнее сообщение
          const { data: lastMessage, error: lastMessageError } = await supabase
            .from('messages')
            .select('content, created_at, sender_id')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (lastMessageError && lastMessageError.code !== 'PGRST116') {
            console.error(`❌ Ошибка получения последнего сообщения для чата ${chat.id}:`, lastMessageError);
          }

          return {
            id: chat.id,
            user_name: chat.user?.username || 'Пользователь',
            user_avatar: chat.user?.avatar_url,
            user_online: chat.user?.is_online || false,
            status: chat.status,
            unread_count: unreadCount || 0,
            last_message: lastMessage?.content || 'Чат начат',
            last_message_time: lastMessage?.created_at || chat.created_at,
            created_at: chat.created_at
          };
        } catch (error) {
          console.error(`❌ Ошибка обработки чата ${chat.id}:`, error);
          // Возвращаем базовую информацию о чате даже при ошибке
          return {
            id: chat.id,
            user_name: chat.user?.username || 'Пользователь',
            user_avatar: chat.user?.avatar_url,
            user_online: chat.user?.is_online || false,
            status: chat.status,
            unread_count: 0,
            last_message: 'Чат начат',
            last_message_time: chat.created_at,
            created_at: chat.created_at
          };
        }
      })
    );

    console.log('✅ Чаты успешно обработаны');
    res.json({ chats: formattedChats });
  } catch (error) {
    console.error('❌ Ошибка получения чатов:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      details: error.message 
    });
  }
});

// Принять чат
router.post('/chats/:chatId/accept', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const { chatId } = req.params;
    const listenerId = req.user.id;

    console.log('✅ Принятие чата:', chatId, 'слушателем:', listenerId);

    const { data: chat, error } = await supabase
      .from('chats')
      .update({
        status: 'active',
        listener_id: listenerId,
        accepted_at: new Date().toISOString()
      })
      .eq('id', chatId)
      .eq('status', 'waiting')
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Чат не найден или уже принят' });
      }
      throw error;
    }

    await logAction(listenerId, 'ACCEPT_CHAT', { chatId });

    // Отправляем уведомление пользователю
    const io = req.app.get('io');
    if (io) {
      io.emit('chat_accepted', {
        chatId,
        listenerId,
        timestamp: new Date().toISOString()
      });
    }

    console.log('✅ Чат принят');
    res.json({ success: true, chat });
  } catch (error) {
    console.error('❌ Ошибка принятия чата:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      details: error.message 
    });
  }
});

// Завершить чат
router.post('/chats/:chatId/complete', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const { chatId } = req.params;
    const listenerId = req.user.id;

    console.log('🏁 Завершение чата:', chatId);

    const { data: chat, error } = await supabase
      .from('chats')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString()
      })
      .eq('id', chatId)
      .eq('listener_id', listenerId)
      .eq('status', 'active')
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Чат не найден' });
      }
      throw error;
    }

    await logAction(listenerId, 'COMPLETE_CHAT', { chatId });

    console.log('✅ Чат завершен');
    res.json({ success: true, chat });
  } catch (error) {
    console.error('❌ Ошибка завершения чата:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      details: error.message 
    });
  }
});

// Получить онлайн слушателей (для чата между слушателями)
router.get('/online-listeners', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const currentListenerId = req.user.id;
    console.log('👥 Получение онлайн слушателей, исключая:', currentListenerId);

    const { data: listeners, error } = await supabase
      .from('users')
      .select(`
        id,
        username,
        avatar_url,
        is_online,
        last_seen,
        listener:listeners!inner(bio, specialties, rating)
      `)
      .eq('role', 'listener')
      .eq('is_online', true)
      .neq('id', currentListenerId)
      .order('username');

    if (error) {
      console.error('❌ Ошибка получения слушателей:', error);
      throw error;
    }

    const formattedListeners = (listeners || []).map(listener => ({
      id: listener.id,
      name: listener.username,
      avatar: listener.avatar_url,
      is_online: listener.is_online,
      last_seen: listener.last_seen,
      bio: listener.listener?.bio,
      specialties: listener.listener?.specialties,
      rating: listener.listener?.rating
    }));

    console.log(`✅ Найдено онлайн слушателей: ${formattedListeners.length}`);
    res.json({ listeners: formattedListeners });
  } catch (error) {
    console.error('❌ Ошибка получения онлайн слушателей:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      details: error.message 
    });
  }
});

// Получить уведомления слушателя
router.get('/notifications', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const listenerId = req.user.id;
    console.log('🔔 Получение уведомлений слушателя:', listenerId);

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', listenerId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('❌ Ошибка получения уведомлений:', error);
      throw error;
    }

    console.log(`✅ Получено уведомлений: ${notifications?.length || 0}`);
    res.json({ notifications: notifications || [] });
  } catch (error) {
    console.error('❌ Ошибка получения уведомлений:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      details: error.message 
    });
  }
});

// Пометить уведомления как прочитанные
router.post('/notifications/read', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const listenerId = req.user.id;
    const { notificationIds } = req.body;

    console.log('📝 Отметка уведомлений как прочитанных:', notificationIds);

    let query = supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', listenerId)
      .eq('is_read', false);

    // Если указаны конкретные ID, обновляем только их
    if (notificationIds && notificationIds.length > 0) {
      query = query.in('id', notificationIds);
    }

    const { error } = await query;

    if (error) throw error;

    console.log('✅ Уведомления отмечены как прочитанные');
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Ошибка отметки уведомлений:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      details: error.message 
    });
  }
});

// Отправить сообщение другому слушателю
router.post('/messages', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiver_id, content } = req.body;

    console.log('💬 Отправка сообщения слушателю:', { senderId, receiver_id });

    if (!receiver_id || !content) {
      return res.status(400).json({ error: 'Получатель и содержание сообщения обязательны' });
    }

    // Проверяем, что получатель - слушатель
    const { data: receiver, error: receiverError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', receiver_id)
      .eq('role', 'listener')
      .single();

    if (receiverError || !receiver) {
      return res.status(400).json({ error: 'Получатель не найден или не является слушателем' });
    }

    // Создаем сообщение
    const { data: message, error } = await supabase
      .from('listener_messages')
      .insert({
        sender_id: senderId,
        receiver_id: receiver_id,
        content: content
      })
      .select()
      .single();

    if (error) throw error;

    // Отправляем уведомление через WebSocket
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${receiver_id}`).emit('new_listener_message', message);
    }

    console.log('✅ Сообщение отправлено');
    res.json({ success: true, message });
  } catch (error) {
    console.error('❌ Ошибка отправки сообщения:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      details: error.message 
    });
  }
});

// Получить историю сообщений с другим слушателем
router.get('/chats/:listenerId/messages', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const currentListenerId = req.user.id;
    const { listenerId } = req.params;

    console.log('📨 Получение истории сообщений с слушателем:', listenerId);

    const { data: messages, error } = await supabase
      .from('listener_messages')
      .select('*')
      .or(`and(sender_id.eq.${currentListenerId},receiver_id.eq.${listenerId}),and(sender_id.eq.${listenerId},receiver_id.eq.${currentListenerId})`)
      .order('created_at', { ascending: true });

    if (error) throw error;

    console.log(`✅ Получено сообщений: ${messages?.length || 0}`);
    res.json({ messages: messages || [] });
  } catch (error) {
    console.error('❌ Ошибка получения истории сообщений:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      details: error.message 
    });
  }
});

module.exports = router;
