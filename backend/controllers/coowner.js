const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { logAction } = require('../middleware');

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Все функции администратора + дополнительные возможности

// Отправка технических уведомлений
router.post('/send-notification', async (req, res) => {
  try {
    const coownerId = req.user.id;
    const { user_id, title, message, notification_type = 'info' } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Заголовок и сообщение обязательны' });
    }

    const notificationData = {
      title,
      message,
      notification_type,
      created_at: new Date().toISOString()
    };

    // Если указан конкретный пользователь
    if (user_id) {
      notificationData.user_id = user_id;
      
      const { error } = await supabase
        .from('notifications')
        .insert(notificationData);

      if (error) throw error;

      await logAction(coownerId, 'SEND_USER_NOTIFICATION', { 
        target_user_id: user_id, 
        title,
        notification_type 
      });

    } else {
      // Рассылка всем пользователям
      const { data: users } = await supabase
        .from('users')
        .select('id')
        .eq('is_blocked', false);

      const notifications = users.map(user => ({
        ...notificationData,
        user_id: user.id
      }));

      const { error } = await supabase
        .from('notifications')
        .insert(notifications);

      if (error) throw error;

      await logAction(coownerId, 'SEND_BROADCAST_NOTIFICATION', { 
        title,
        notification_type,
        recipients_count: users.length 
      });
    }

    res.json({ message: 'Уведомление отправлено' });
  } catch (error) {
    console.error('Ошибка отправки уведомления:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Назначение слушателей
router.post('/assign-listener', async (req, res) => {
  try {
    const coownerId = req.user.id;
    const { user_id, new_role } = req.body;

    if (!user_id || !new_role) {
      return res.status(400).json({ error: 'ID пользователя и новая роль обязательны' });
    }

    // Проверяем допустимые роли для назначения
    const allowedRoles = ['listener', 'admin'];
    if (!allowedRoles.includes(new_role)) {
      return res.status(400).json({ error: 'Недопустимая роль для назначения' });
    }

    // Проверяем существование пользователя
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Обновляем роль пользователя
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        role: new_role,
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id);

    if (updateError) throw updateError;

    // Создаем уведомление для пользователя
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: user_id,
        title: 'Изменение роли',
        message: `Ваша роль изменена на: ${getRoleDisplayName(new_role)}`,
        notification_type: 'info'
      });

    if (notificationError) throw notificationError;

    await logAction(coownerId, 'ASSIGN_ROLE', { 
      target_user_id: user_id, 
      old_role: user.role,
      new_role: new_role 
    });

    res.json({ 
      message: 'Роль пользователя изменена',
      user: {
        id: user_id,
        username: user.username,
        new_role: new_role
      }
    });
  } catch (error) {
    console.error('Ошибка назначения роли:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Просмотр всех логов системы
router.get('/all-logs', async (req, res) => {
  try {
    const { page = 1, limit = 50, action_type, user_id } = req.query;

    let query = supabase
      .from('system_logs')
      .select(`
        *,
        user:users(username, email)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Фильтрация
    if (action_type) {
      query = query.eq('action', action_type);
    }

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    // Пагинация
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: logs, error, count } = await query.range(from, to);

    if (error) throw error;

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Ошибка получения логов:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Увольнение слушателя или администратора
router.post('/dismiss-staff', async (req, res) => {
  try {
    const coownerId = req.user.id;
    const { user_id, reason } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'ID пользователя обязателен' });
    }

    // Проверяем существование пользователя и его роль
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user_id)
      .in('role', ['listener', 'admin'])
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'Пользователь не найден или не является сотрудником' });
    }

    // Нельзя уволить себя
    if (user_id === coownerId) {
      return res.status(400).json({ error: 'Нельзя уволить себя' });
    }

    // Понижаем до пользователя
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        role: 'user',
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id);

    if (updateError) throw updateError;

    // Создаем уведомление для пользователя
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: user_id,
        title: 'Изменение статуса',
        message: `Вы больше не являетесь ${getRoleDisplayName(user.role)}. ${reason ? `Причина: ${reason}` : ''}`,
        notification_type: 'warning'
      });

    if (notificationError) throw notificationError;

    await logAction(coownerId, 'DISMISS_STAFF', { 
      target_user_id: user_id, 
      old_role: user.role,
      reason: reason 
    });

    res.json({ 
      message: 'Сотрудник уволен',
      user: {
        id: user_id,
        username: user.username,
        old_role: user.role
      }
    });
  } catch (error) {
    console.error('Ошибка увольнения сотрудника:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение детальной статистики
router.get('/detailed-stats', async (req, res) => {
  try {
    const { period = 'day' } = req.query; // day, week, month

    // Определяем временной диапазон
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case 'day':
        startDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 1);
    }

    // Статистика регистраций
    const { count: newRegistrations } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString());

    // Статистика сообщений
    const { count: newMessages } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString());

    // Статистика чатов
    const { count: newChats } = await supabase
      .from('chats')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString());

    // Активность по часам
    const { data: hourlyActivity } = await supabase
      .from('messages')
      .select('created_at')
      .gte('created_at', startDate.toISOString());

    const activityByHour = {};
    hourlyActivity.forEach(msg => {
      const hour = new Date(msg.created_at).getHours();
      activityByHour[hour] = (activityByHour[hour] || 0) + 1;
    });

    // Топ слушателей по отзывам
    const { data: topListeners } = await supabase
      .from('reviews')
      .select(`
        rating,
        listener:users!reviews_listener_id_fkey(username, avatar_url)
      `)
      .gte('created_at', startDate.toISOString());

    const listenerStats = {};
    topListeners.forEach(review => {
      const listener = review.listener;
      if (!listenerStats[listener.username]) {
        listenerStats[listener.username] = {
          username: listener.username,
          avatar_url: listener.avatar_url,
          total_rating: 0,
          review_count: 0
        };
      }
      listenerStats[listener.username].total_rating += review.rating;
      listenerStats[listener.username].review_count += 1;
    });

    const topListenersFormatted = Object.values(listenerStats)
      .map(listener => ({
        ...listener,
        avg_rating: listener.total_rating / listener.review_count
      }))
      .sort((a, b) => b.avg_rating - a.avg_rating)
      .slice(0, 10);

    res.json({
      period,
      start_date: startDate.toISOString(),
      end_date: now.toISOString(),
      stats: {
        new_registrations: newRegistrations,
        new_messages: newMessages,
        new_chats: newChats,
        hourly_activity: activityByHour,
        top_listeners: topListenersFormatted
      }
    });
  } catch (error) {
    console.error('Ошибка получения детальной статистики:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Управление стикерами
router.post('/stickers', async (req, res) => {
  try {
    const coownerId = req.user.id;
    const { name, url, category } = req.body;

    if (!name || !url) {
      return res.status(400).json({ error: 'Название и URL стикера обязательны' });
    }

    const { data: sticker, error } = await supabase
      .from('stickers')
      .insert({
        name,
        url,
        category: category || 'general',
        created_by: coownerId
      })
      .select()
      .single();

    if (error) throw error;

    await logAction(coownerId, 'STICKER_CREATE', { 
      sticker_id: sticker.id,
      name: name
    });

    res.json({ 
      message: 'Стикер добавлен',
      sticker 
    });
  } catch (error) {
    console.error('Ошибка добавления стикера:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Удаление стикера
router.delete('/stickers/:stickerId', async (req, res) => {
  try {
    const coownerId = req.user.id;
    const { stickerId } = req.params;

    const { error } = await supabase
      .from('stickers')
      .update({ is_active: false })
      .eq('id', stickerId);

    if (error) throw error;

    await logAction(coownerId, 'STICKER_DELETE', { sticker_id: stickerId });

    res.json({ message: 'Стикер удален' });
  } catch (error) {
    console.error('Ошибка удаления стикера:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Вспомогательная функция для получения отображаемого имени роли
function getRoleDisplayName(role) {
  const roles = {
    'user': 'Пользователь',
    'listener': 'Слушатель',
    'admin': 'Администратор',
    'coowner': 'Совладелец',
    'owner': 'Владелец'
  };
  return roles[role] || role;
}

module.exports = router;
