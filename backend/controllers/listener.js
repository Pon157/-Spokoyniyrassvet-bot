const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { logAction } = require('../middleware');

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Получение отзывов слушателя
router.get('/reviews', async (req, res) => {
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

    const formattedReviews = reviews.map(review => ({
      id: review.id,
      user_name: review.user?.username,
      user_avatar: review.user?.avatar_url,
      rating: review.rating,
      comment: review.comment,
      created_at: review.created_at,
      chat_id: review.chat?.id
    }));

    res.json({ reviews: formattedReviews });
  } catch (error) {
    console.error('Ошибка получения отзывов:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Статистика слушателя
router.get('/stats', async (req, res) => {
  try {
    const listenerId = req.user.id;

    const [
      reviewsData,
      chatsData,
      messagesData,
      ratingData
    ] = await Promise.all([
      // Отзывы
      supabase
        .from('reviews')
        .select('rating')
        .eq('listener_id', listenerId),
      
      // Чаты
      supabase
        .from('chats')
        .select('status, created_at')
        .eq('listener_id', listenerId),
      
      // Сообщения
      supabase
        .from('messages')
        .select('created_at')
        .eq('sender_id', listenerId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      
      // Средний рейтинг
      supabase
        .from('reviews')
        .select('rating')
        .eq('listener_id', listenerId)
    ]);

    const totalChats = chatsData.data?.length || 0;
    const activeChats = chatsData.data?.filter(chat => chat.status === 'active').length || 0;
    const averageRating = ratingData.data?.length > 0 
      ? ratingData.data.reduce((sum, review) => sum + review.rating, 0) / ratingData.data.length 
      : 0;

    // Активность по дням
    const activityByDay = {};
    messagesData.data?.forEach(message => {
      const date = new Date(message.created_at).toLocaleDateString('ru-RU');
      activityByDay[date] = (activityByDay[date] || 0) + 1;
    });

    res.json({
      stats: {
        total_reviews: reviewsData.data?.length || 0,
        total_chats: totalChats,
        active_chats: activeChats,
        average_rating: Math.round(averageRating * 10) / 10,
        weekly_activity: activityByDay,
        response_time: '5 мин' // Можно рассчитать среднее время ответа
      }
    });
  } catch (error) {
    console.error('Ошибка получения статистики слушателя:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Доступные чаты для слушателя
router.get('/available-chats', async (req, res) => {
  try {
    const listenerId = req.user.id;

    const { data: chats, error } = await supabase
      .from('chats')
      .select(`
        *,
        user:users!chats_user_id_fkey(username, avatar_url, is_online),
        messages:messages(count),
        last_message:messages!inner(content, created_at)
      `)
      .eq('listener_id', listenerId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedChats = chats.map(chat => ({
      id: chat.id,
      user_name: chat.user?.username,
      user_avatar: chat.user?.avatar_url,
      user_online: chat.user?.is_online,
      message_count: chat.messages[0]?.count || 0,
      last_message: chat.last_message?.[0]?.content,
      last_message_time: chat.last_message?.[0]?.created_at,
      created_at: chat.created_at
    }));

    res.json({ chats: formattedChats });
  } catch (error) {
    console.error('Ошибка получения чатов:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
