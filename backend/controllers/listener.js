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
    console.log('Получение профиля слушателя:', listenerId);

    const { data: profile, error } = await supabase
      .from('listeners')
      .select('*')
      .eq('user_id', listenerId)
      .single();

    if (error) {
      console.error('Ошибка получения профиля:', error);
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

    console.log('Профиль получен');
    res.json({ profile });
  } catch (error) {
    console.error('Ошибка получения профиля:', error);
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

    console.log('Обновление профиля слушателя:', listenerId);

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

    console.log('Профиль обновлен');
    res.json({ profile: data });
  } catch (error) {
    console.error('Ошибка обновления профиля:', error);
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

    console.log('Обновление статуса слушателя:', listenerId, 'online:', online);

    // Обновляем статус в таблице users
    const { error: userError } = await supabase
      .from('users')
      .update({ 
        is_online: online,
        last_seen: new Date().toISOString()
      })
      .eq('id', listenerId);

    if (userError) {
      console.error('Ошибка обновления статуса пользователя:', userError);
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
      console.error('Ошибка обновления статуса слушателя:', listenerError);
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
      console.log('WebSocket уведомление отправлено');
    }

    console.log('Статус обновлен');
    res.json({ success: true, online });
  } catch (error) {
    console.error('Ошибка обновления статуса:', error);
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
    console.log('Получение отзывов слушателя:', listenerId);

    // Временные данные для демонстрации
    const reviews = [
      {
        id: 1,
        user_name: 'Анна',
        rating: 5,
        comment: 'Отличный слушатель! Очень помог в трудной ситуации.',
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        user_name: 'Максим',
        rating: 4,
        comment: 'Хороший специалист, внимательный и отзывчивый.',
        created_at: new Date(Date.now() - 86400000).toISOString()
      }
    ];

    const averageRating = 4.5;
    const totalReviews = reviews.length;

    console.log(`Получено отзывов: ${reviews.length}`);

    res.json({ 
      reviews: reviews,
      averageRating: averageRating,
      totalReviews: totalReviews
    });
  } catch (error) {
    console.error('Ошибка получения отзывов:', error);
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
    console.log('Получение статистики слушателя:', listenerId);

    // Временные данные для демонстрации
    const stats = {
      totalSessions: 15,
      activeChats: 3,
      averageSessionTime: 25,
      helpfulness: 87,
      weeklyActivity: {
        '01.01': 5,
        '02.01': 8, 
        '03.01': 12,
        '04.01': 6,
        '05.01': 9,
        '06.01': 11,
        '07.01': 7
      },
      totalMessages: 42
    };

    console.log('Статистика получена');
    res.json(stats);
  } catch (error) {
    console.error('Ошибка получения статистики слушателя:', error);
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
    console.log('Получение чатов слушателя:', listenerId);

    // Временные данные для демонстрации
    const chats = [
      {
        id: 1,
        user_name: 'Пользователь 1',
        user_avatar: '/images/default-avatar.svg',
        user_online: true,
        status: 'active',
        unread_count: 2,
        last_message: 'Привет, мне нужна помощь',
        last_message_time: new Date().toISOString(),
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        user_name: 'Пользователь 2',
        user_avatar: '/images/default-avatar.svg',
        user_online: false,
        status: 'waiting',
        unread_count: 0,
        last_message: 'Спасибо за поддержку!',
        last_message_time: new Date(Date.now() - 3600000).toISOString(),
        created_at: new Date(Date.now() - 7200000).toISOString()
      }
    ];

    console.log(`Найдено чатов: ${chats.length}`);
    res.json({ chats: chats });
  } catch (error) {
    console.error('Ошибка получения чатов:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      details: error.message 
    });
  }
});

// Получить онлайн слушателей
router.get('/online-listeners', authenticateToken, requireRole(['listener']), async (req, res) => {
  try {
    const currentListenerId = req.user.id;
    console.log('Получение онлайн слушателей, исключая:', currentListenerId);

    // Временные данные для демонстрации
    const listeners = [
      {
        id: 2,
        name: 'Анна Слушатель',
        avatar: '/images/default-avatar.svg',
        is_online: true,
        last_seen: new Date().toISOString(),
        bio: 'Психолог с 5-летним опытом',
        specialties: ['Стресс', 'Отношения'],
        rating: 4.8
      },
      {
        id: 3,
        name: 'Максим Помощник',
        avatar: '/images/default-avatar.svg',
        is_online: false,
        last_seen: new Date(Date.now() - 3600000).toISOString(),
        bio: 'Специалист по кризисным ситуациям',
        specialties: ['Кризис', 'Тревожность'],
        rating: 4.9
      }
    ];

    console.log(`Найдено онлайн слушателей: ${listeners.length}`);
    res.json({ listeners: listeners });
  } catch (error) {
    console.error('Ошибка получения онлайн слушателей:', error);
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

    console.log('Принятие чата:', chatId, 'слушателем:', listenerId);

    // В реальной реализации здесь будет обновление в БД
    const chat = {
      id: chatId,
      status: 'active',
      listener_id: listenerId,
      accepted_at: new Date().toISOString()
    };

    await logAction(listenerId, 'ACCEPT_CHAT', { chatId });

    // Отправляем уведомление через WebSocket
    const io = req.app.get('io');
    if (io) {
      io.emit('chat_accepted', {
        chatId,
        listenerId,
        timestamp: new Date().toISOString()
      });
    }

    console.log('Чат принят');
    res.json({ success: true, chat });
  } catch (error) {
    console.error('Ошибка принятия чата:', error);
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

    console.log('Завершение чата:', chatId);

    // В реальной реализации здесь будет обновление в БД
    const chat = {
      id: chatId,
      status: 'completed',
      ended_at: new Date().toISOString()
    };

    await logAction(listenerId, 'COMPLETE_CHAT', { chatId });

    console.log('Чат завершен');
    res.json({ success: true, chat });
  } catch (error) {
    console.error('Ошибка завершения чата:', error);
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
    console.log('Получение уведомлений слушателя:', listenerId);

    // Временные данные для демонстрации
    const notifications = [
      {
        id: 1,
        title: 'Новый чат',
        message: 'Пользователь Анна хочет начать чат',
        type: 'chat',
        is_read: false,
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        title: 'Новый отзыв',
        message: 'Вы получили новый отзыв от Максима',
        type: 'review',
        is_read: true,
        created_at: new Date(Date.now() - 86400000).toISOString()
      }
    ];

    console.log(`Получено уведомлений: ${notifications.length}`);
    res.json({ notifications: notifications });
  } catch (error) {
    console.error('Ошибка получения уведомлений:', error);
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

    console.log('Отметка уведомлений как прочитанных:', notificationIds);

    // В реальной реализации здесь будет обновление в БД
    console.log('Уведомления отмечены как прочитанные');
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка отметки уведомлений:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      details: error.message 
    });
  }
});

module.exports = router;
