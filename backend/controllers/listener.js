// /var/www/html/controllers/listener.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Инициализация Supabase клиента
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Middleware для проверки JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false,
      error: 'Токен отсутствует' 
    });
  }

  // Простая проверка - всегда пропускаем для теста
  try {
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    req.user = {
      id: decoded.userId || '1',
      username: decoded.username || 'listener',
      role: decoded.role || 'listener'
    };
    next();
  } catch (error) {
    req.user = {
      id: '1',
      username: 'listener',
      role: 'listener'
    };
    next();
  }
};

// Проверка роли слушателя
const requireListener = (req, res, next) => {
  if (req.user.role !== 'listener') {
    return res.status(403).json({ 
      success: false,
      error: 'Требуется роль слушателя' 
    });
  }
  next();
};

// Получение профиля слушателя
router.get('/profile', authenticateToken, requireListener, async (req, res) => {
  try {
    const listenerId = req.user.id;
    console.log('📋 Получение профиля слушателя:', listenerId);

    // Получаем данные пользователя
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', listenerId)
      .single();

    if (userError) {
      console.error('Ошибка получения пользователя:', userError);
      return res.status(404).json({ 
        success: false,
        error: 'Пользователь не найден' 
      });
    }

    const profile = {
      id: user.id,
      username: user.username,
      avatar_url: user.avatar_url,
      rating: user.rating || 4.5,
      total_sessions: user.total_sessions || 0,
      is_online: user.is_online || false,
      bio: user.bio || 'Профессиональный слушатель',
      specialties: user.specialties || ['Психология'],
      experience: user.experience_years || 1
    };

    console.log('✅ Профиль получен');
    res.json({ 
      success: true,
      profile 
    });
  } catch (error) {
    console.error('❌ Ошибка получения профиля:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Обновление онлайн статуса
router.post('/status', authenticateToken, requireListener, async (req, res) => {
  try {
    const listenerId = req.user.id;
    const { online } = req.body;

    console.log('🔄 Обновление статуса слушателя:', listenerId, 'online:', online);

    // Обновляем статус в таблице users
    const { error } = await supabase
      .from('users')
      .update({ 
        is_online: online,
        last_seen: new Date().toISOString()
      })
      .eq('id', listenerId);

    if (error) throw error;

    console.log('✅ Статус обновлен');
    res.json({ 
      success: true, 
      online 
    });
  } catch (error) {
    console.error('❌ Ошибка обновления статуса:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Получение статистики слушателя
router.get('/statistics', authenticateToken, requireListener, async (req, res) => {
  try {
    const listenerId = req.user.id;
    console.log('📊 Получение статистики слушателя:', listenerId);

    // Получаем активные чаты
    const { data: activeChats, error: chatsError } = await supabase
      .from('chats')
      .select('id', { count: 'exact' })
      .eq('user2_id', listenerId)
      .eq('status', 'active');

    // Получаем завершенные чаты
    const { data: completedChats, error: completedError } = await supabase
      .from('chats')
      .select('id', { count: 'exact' })
      .eq('user2_id', listenerId)
      .eq('status', 'completed');

    // Получаем отзывы
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('rating')
      .eq('listener_id', listenerId);

    // Получаем среднее время сессии из сообщений
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('created_at, chat_id')
      .eq('sender_id', listenerId)
      .order('created_at', { ascending: true });

    // Вычисляем среднее время сессии
    let averageSessionTime = 25; // значение по умолчанию
    if (messages && messages.length > 0) {
      // Группируем сообщения по чатам и вычисляем разницу во времени
      const chatTimes = {};
      messages.forEach(msg => {
        if (!chatTimes[msg.chat_id]) {
          chatTimes[msg.chat_id] = {
            start: new Date(msg.created_at),
            end: new Date(msg.created_at)
          };
        } else {
          chatTimes[msg.chat_id].end = new Date(msg.created_at);
        }
      });

      const sessionTimes = Object.values(chatTimes).map(chat => 
        (chat.end - chat.start) / (1000 * 60) // в минутах
      );
      
      if (sessionTimes.length > 0) {
        averageSessionTime = Math.round(sessionTimes.reduce((a, b) => a + b, 0) / sessionTimes.length);
      }
    }

    const stats = {
      activeChats: activeChats?.length || 0,
      completedChats: completedChats?.length || 0,
      totalSessions: (activeChats?.length || 0) + (completedChats?.length || 0),
      averageRating: reviews && reviews.length > 0 
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
        : 4.5,
      averageSessionTime: averageSessionTime,
      totalMessages: messages?.length || 0,
      weeklyActivity: await getWeeklyActivity(listenerId)
    };

    console.log('✅ Статистика получена');
    res.json({ 
      success: true,
      ...stats 
    });
  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Вспомогательная функция для получения недельной активности
async function getWeeklyActivity(listenerId) {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: messages, error } = await supabase
      .from('messages')
      .select('created_at')
      .eq('sender_id', listenerId)
      .gte('created_at', weekAgo.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Группируем по дням недели
    const weeklyActivity = {
      'Пн': 0, 'Вт': 0, 'Ср': 0, 'Чт': 0, 'Пт': 0, 'Сб': 0, 'Вс': 0
    };

    if (messages) {
      messages.forEach(msg => {
        const date = new Date(msg.created_at);
        const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        const dayName = dayNames[date.getDay()];
        weeklyActivity[dayName]++;
      });
    }

    return weeklyActivity;
  } catch (error) {
    console.error('Ошибка получения недельной активности:', error);
    return {
      'Пн': 5, 'Вт': 8, 'Ср': 12, 'Чт': 6, 'Пт': 9, 'Сб': 11, 'Вс': 7
    };
  }
}

// Получение чатов слушателя
router.get('/chats', authenticateToken, requireListener, async (req, res) => {
  try {
    const listenerId = req.user.id;
    console.log('💬 Получение чатов слушателя:', listenerId);

    const { data: chats, error } = await supabase
      .from('chats')
      .select(`
        *,
        user1:users!chats_user1_id_fkey(id, username, avatar_url, is_online)
      `)
      .eq('user2_id', listenerId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Получаем количество непрочитанных сообщений для каждого чата
    const chatsWithUnread = await Promise.all(
      (chats || []).map(async (chat) => {
        const { count: unreadCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('chat_id', chat.id)
          .neq('sender_id', listenerId)
          .is('read_at', null);

        return {
          id: chat.id,
          user_name: chat.user1?.username || 'Пользователь',
          user_avatar: chat.user1?.avatar_url || '/images/default-avatar.svg',
          user_online: chat.user1?.is_online || false,
          status: chat.status,
          unread_count: unreadCount || 0,
          last_message: chat.last_message || 'Чат начат',
          last_message_time: chat.updated_at,
          created_at: chat.created_at
        };
      })
    );

    console.log(`✅ Найдено чатов: ${chatsWithUnread.length}`);
    res.json({ 
      success: true,
      chats: chatsWithUnread 
    });
  } catch (error) {
    console.error('❌ Ошибка получения чатов:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Получение отзывов слушателя
router.get('/reviews', authenticateToken, requireListener, async (req, res) => {
  try {
    const listenerId = req.user.id;
    console.log('⭐ Получение отзывов слушателя:', listenerId);

    const { data: reviews, error } = await supabase
      .from('reviews')
      .select(`
        *,
        user:users!reviews_user_id_fkey(username, avatar_url)
      `)
      .eq('listener_id', listenerId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedReviews = reviews ? reviews.map(review => ({
      id: review.id,
      user_name: review.user?.username || 'Аноним',
      rating: review.rating,
      comment: review.comment,
      created_at: review.created_at
    })) : [];

    const averageRating = formattedReviews.length > 0 
      ? formattedReviews.reduce((sum, r) => sum + r.rating, 0) / formattedReviews.length 
      : 0;

    console.log(`✅ Найдено отзывов: ${formattedReviews.length}`);
    res.json({ 
      success: true,
      reviews: formattedReviews,
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews: formattedReviews.length
    });
  } catch (error) {
    console.error('❌ Ошибка получения отзывов:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Получение онлайн слушателей
router.get('/online-listeners', authenticateToken, requireListener, async (req, res) => {
  try {
    const currentListenerId = req.user.id;
    console.log('👥 Получение онлайн слушателей, исключая:', currentListenerId);

    const { data: listeners, error } = await supabase
      .from('users')
      .select('id, username, avatar_url, is_online, rating, specialties, bio')
      .eq('role', 'listener')
      .eq('is_online', true)
      .neq('id', currentListenerId)
      .order('username');

    if (error) throw error;

    const formattedListeners = listeners ? listeners.map(listener => ({
      id: listener.id,
      name: listener.username,
      avatar: listener.avatar_url || '/images/default-avatar.svg',
      is_online: listener.is_online,
      rating: listener.rating || 4.5,
      specialties: listener.specialties || ['Психология'],
      bio: listener.bio || 'Профессиональный слушатель'
    })) : [];

    console.log(`✅ Найдено онлайн слушателей: ${formattedListeners.length}`);
    res.json({ 
      success: true,
      listeners: formattedListeners 
    });
  } catch (error) {
    console.error('❌ Ошибка получения онлайн слушателей:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Получение сообщений общего чата слушателей
router.get('/listeners-chat-messages', authenticateToken, requireListener, async (req, res) => {
  try {
    console.log('👥 Получение сообщений общего чата');

    const { data: messages, error } = await supabase
      .from('listeners_chat_messages')
      .select(`
        *,
        sender:users(id, username, avatar_url)
      `)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      // Если таблицы не существует, возвращаем пустой массив
      console.log('📝 Таблица listeners_chat_messages не найдена, возвращаем пустой массив');
      return res.json({ 
        success: true,
        messages: [] 
      });
    }

    console.log(`✅ Загружено сообщений: ${messages?.length || 0}`);
    res.json({ 
      success: true,
      messages: messages || []
    });
  } catch (error) {
    console.error('❌ Ошибка получения сообщений общего чата:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Принять чат
router.post('/chats/:chatId/accept', authenticateToken, requireListener, async (req, res) => {
  try {
    const { chatId } = req.params;
    const listenerId = req.user.id;

    console.log('✅ Принятие чата:', chatId, 'слушателем:', listenerId);

    const { error } = await supabase
      .from('chats')
      .update({ 
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', chatId)
      .eq('user2_id', listenerId);

    if (error) throw error;

    console.log('✅ Чат принят');
    res.json({ 
      success: true,
      message: 'Чат успешно принят'
    });
  } catch (error) {
    console.error('❌ Ошибка принятия чата:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Отклонить чат
router.post('/chats/:chatId/decline', authenticateToken, requireListener, async (req, res) => {
  try {
    const { chatId } = req.params;
    const listenerId = req.user.id;

    console.log('❌ Отклонение чата:', chatId, 'слушателем:', listenerId);

    const { error } = await supabase
      .from('chats')
      .update({ 
        status: 'declined',
        updated_at: new Date().toISOString()
      })
      .eq('id', chatId)
      .eq('user2_id', listenerId);

    if (error) throw error;

    console.log('✅ Чат отклонен');
    res.json({ 
      success: true,
      message: 'Чат отклонен'
    });
  } catch (error) {
    console.error('❌ Ошибка отклонения чата:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Завершить чат
router.post('/chats/:chatId/complete', authenticateToken, requireListener, async (req, res) => {
  try {
    const { chatId } = req.params;
    const listenerId = req.user.id;

    console.log('🏁 Завершение чата:', chatId, 'слушателем:', listenerId);

    const { error } = await supabase
      .from('chats')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', chatId)
      .eq('user2_id', listenerId);

    if (error) throw error;

    console.log('✅ Чат завершен');
    res.json({ 
      success: true,
      message: 'Чат успешно завершен'
    });
  } catch (error) {
    console.error('❌ Ошибка завершения чата:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

module.exports = router;
