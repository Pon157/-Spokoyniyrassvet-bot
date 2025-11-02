const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { authenticateToken, requireRole, logAction } = require('../middleware');

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Получение профиля слушателя
router.get('/profile', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const listenerId = req.user.id;

    const { data: profile, error } = await supabase
      .from('listeners')
      .select('*')
      .eq('user_id', listenerId)
      .single();

    if (error) throw error;

    res.json({ profile });
  } catch (error) {
    console.error('Ошибка получения профиля:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Обновление профиля слушателя
router.put('/profile', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const listenerId = req.user.id;
    const { bio, specialties, hourly_rate, languages, experience } = req.body;

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

    res.json({ profile: data });
  } catch (error) {
    console.error('Ошибка обновления профиля:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Обновление онлайн статуса
router.post('/status', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const listenerId = req.user.id;
    const { online } = req.body;

    // Обновляем статус в таблице users
    const { error: userError } = await supabase
      .from('users')
      .update({ 
        is_online: online,
        last_seen: new Date().toISOString()
      })
      .eq('id', listenerId);

    if (userError) throw userError;

    // Обновляем статус в таблице listeners
    const { error: listenerError } = await supabase
      .from('listeners')
      .update({ 
        is_available: online,
        last_activity: new Date().toISOString()
      })
      .eq('user_id', listenerId);

    if (listenerError) throw listenerError;

    await logAction(listenerId, 'UPDATE_STATUS', { online });

    // Отправляем уведомление через WebSocket
    req.app.get('io').emit('listener_status_update', {
      listenerId,
      online,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, online });
  } catch (error) {
    console.error('Ошибка обновления статуса:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение отзывов слушателя
router.get('/reviews', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const listenerId = req.user.id;

    const { data: reviews, error } = await supabase
      .from('reviews')
      .select(`
        *,
        user:users!reviews_user_id_fkey(username, avatar_url),
        chat:chats(id)
      `)
      .eq('listener_id', listenerId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Рассчитываем средний рейтинг
    const averageRating = reviews.length > 0 
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
      : 0;

    const formattedReviews = reviews.map(review => ({
      id: review.id,
      user_name: review.user?.username,
      user_avatar: review.user?.avatar_url,
      rating: review.rating,
      comment: review.comment,
      created_at: review.created_at,
      chat_id: review.chat?.id
    }));

    res.json({ 
      reviews: formattedReviews,
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews: reviews.length
    });
  } catch (error) {
    console.error('Ошибка получения отзывов:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Статистика слушателя
router.get('/statistics', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const listenerId = req.user.id;

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
        const start = new Date(session.created_at);
        const end = new Date(session.ended_at);
        return sum + (end - start);
      }, 0);
      averageSessionTime = Math.round(totalTime / sessionsData.data.length / 60000); // в минутах
    }

    // Активность по дням (последние 7 дней)
    const activityByDay = {};
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toLocaleDateString('ru-RU');
    }).reverse();

    last7Days.forEach(date => {
      activityByDay[date] = 0;
    });

    messagesData.data?.forEach(message => {
      const date = new Date(message.created_at).toLocaleDateString('ru-RU');
      if (activityByDay[date] !== undefined) {
        activityByDay[date]++;
      }
    });

    // Процент полезности (на основе отзывов с рейтингом >= 4)
    const helpfulReviews = reviewsData.data?.filter(review => review.rating >= 4).length || 0;
    const helpfulness = reviewsData.data?.length > 0 
      ? Math.round((helpfulReviews / reviewsData.data.length) * 100) 
      : 0;

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
    console.error('Ошибка получения статистики слушателя:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Доступные чаты для слушателя
router.get('/chats', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const listenerId = req.user.id;

    const { data: chats, error } = await supabase
      .from('chats')
      .select(`
        *,
        user:users!chats_user_id_fkey(username, avatar_url, is_online),
        messages:messages!inner(
          content, 
          created_at,
          is_read,
          sender_id
        )
      `)
      .eq('listener_id', listenerId)
      .in('status', ['active', 'waiting'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedChats = await Promise.all(
      chats.map(async (chat) => {
        // Получаем количество непрочитанных сообщений
        const { count: unreadCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('chat_id', chat.id)
          .eq('is_read', false)
          .neq('sender_id', listenerId);

        // Получаем последнее сообщение
        const { data: lastMessage } = await supabase
          .from('messages')
          .select('content, created_at, sender_id')
          .eq('chat_id', chat.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        return {
          id: chat.id,
          user_name: chat.user?.username,
          user_avatar: chat.user?.avatar_url,
          user_online: chat.user?.is_online,
          status: chat.status,
          unread_count: unreadCount || 0,
          last_message: lastMessage?.content,
          last_message_time: lastMessage?.created_at,
          created_at: chat.created_at
        };
      })
    );

    res.json({ chats: formattedChats });
  } catch (error) {
    console.error('Ошибка получения чатов:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Принять чат
router.post('/chats/:chatId/accept', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const { chatId } = req.params;
    const listenerId = req.user.id;

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

    if (error) throw error;

    await logAction(listenerId, 'ACCEPT_CHAT', { chatId });

    // Отправляем уведомление пользователю
    req.app.get('io').emit('chat_accepted', {
      chatId,
      listenerId,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, chat });
  } catch (error) {
    console.error('Ошибка принятия чата:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Завершить чат
router.post('/chats/:chatId/complete', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const { chatId } = req.params;
    const listenerId = req.user.id;

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

    if (error) throw error;

    await logAction(listenerId, 'COMPLETE_CHAT', { chatId });

    res.json({ success: true, chat });
  } catch (error) {
    console.error('Ошибка завершения чата:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получить онлайн слушателей (для чата между слушателями)
router.get('/online-listeners', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const currentListenerId = req.user.id;

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

    if (error) throw error;

    const formattedListeners = listeners.map(listener => ({
      id: listener.id,
      name: listener.username,
      avatar: listener.avatar_url,
      is_online: listener.is_online,
      last_seen: listener.last_seen,
      bio: listener.listener?.bio,
      specialties: listener.listener?.specialties,
      rating: listener.listener?.rating
    }));

    res.json({ listeners: formattedListeners });
  } catch (error) {
    console.error('Ошибка получения онлайн слушателей:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получить уведомления слушателя
router.get('/notifications', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const listenerId = req.user.id;

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', listenerId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({ notifications });
  } catch (error) {
    console.error('Ошибка получения уведомлений:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Пометить уведомления как прочитанные
router.post('/notifications/read', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const listenerId = req.user.id;
    const { notificationIds } = req.body;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', listenerId)
      .in('id', notificationIds || []);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка отметки уведомлений:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
