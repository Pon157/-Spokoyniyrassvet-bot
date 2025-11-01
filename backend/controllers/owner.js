const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { logAction } = require('../middleware');

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Все функции совладельца + управление совладельцами

// Добавление совладельца
router.post('/add-coowner', async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'ID пользователя обязателен' });
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

    // Нельзя назначить себя
    if (user_id === ownerId) {
      return res.status(400).json({ error: 'Нельзя назначить себя' });
    }

    // Назначаем роль совладельца
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        role: 'coowner',
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id);

    if (updateError) throw updateError;

    // Создаем уведомление для пользователя
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: user_id,
        title: 'Повышение прав',
        message: 'Вам назначена роль Совладельца системы',
        notification_type: 'info'
      });

    if (notificationError) throw notificationError;

    await logAction(ownerId, 'ADD_COOWNER', { target_user_id: user_id });

    res.json({ 
      message: 'Совладелец добавлен',
      user: {
        id: user_id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Ошибка добавления совладельца:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Удаление совладельца
router.post('/remove-coowner', async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'ID пользователя обязателен' });
    }

    // Проверяем, что пользователь является совладельцем
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user_id)
      .eq('role', 'coowner')
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'Совладелец не найден' });
    }

    // Понижаем до администратора
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        role: 'admin',
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id);

    if (updateError) throw updateError;

    // Создаем уведомление для пользователя
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: user_id,
        title: 'Изменение прав',
        message: 'Ваша роль изменена на Администратора',
        notification_type: 'warning'
      });

    if (notificationError) throw notificationError;

    await logAction(ownerId, 'REMOVE_COOWNER', { target_user_id: user_id });

    res.json({ 
      message: 'Совладелец удален',
      user: {
        id: user_id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Ошибка удаления совладельца:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение списка всех сотрудников
router.get('/staff', async (req, res) => {
  try {
    const { data: staff, error } = await supabase
      .from('users')
      .select('*')
      .in('role', ['listener', 'admin', 'coowner', 'owner'])
      .order('role', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Форматируем данные
    const formattedStaff = staff.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      role_display: getRoleDisplayName(user.role),
      is_online: user.is_online,
      is_blocked: user.is_blocked,
      created_at: user.created_at,
      last_activity: user.updated_at
    }));

    res.json({ staff: formattedStaff });
  } catch (error) {
    console.error('Ошибка получения списка сотрудников:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Системные настройки
router.get('/system-settings', async (req, res) => {
  try {
    // Здесь можно получать настройки системы из отдельной таблицы
    // Пока возвращаем статические настройки
    const systemSettings = {
      chat: {
        max_message_length: 1000,
        max_media_size: 10 * 1024 * 1024, // 10MB
        allow_voice_messages: true,
        allow_stickers: true,
        auto_close_chat_hours: 24
      },
      moderation: {
        max_warnings_before_ban: 3,
        auto_mute_duration: 60, // minutes
        enable_profanity_filter: true
      },
      notifications: {
        email_notifications: true,
        push_notifications: true,
        broadcast_enabled: true
      }
    };

    res.json({ settings: systemSettings });
  } catch (error) {
    console.error('Ошибка получения системных настроек:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Обновление системных настроек
router.post('/system-settings', async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { settings } = req.body;

    if (!settings) {
      return res.status(400).json({ error: 'Настройки обязательны' });
    }

    // В реальной системе здесь бы сохранялись настройки в базу данных
    // Пока просто логируем изменение

    await logAction(ownerId, 'UPDATE_SYSTEM_SETTINGS', { settings });

    res.json({ 
      message: 'Системные настройки обновлены',
      settings 
    });
  } catch (error) {
    console.error('Ошибка обновления системных настроек:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Резервное копирование данных
router.get('/backup', async (req, res) => {
  try {
    const ownerId = req.user.id;
    
    // Получаем основные данные системы
    const [
      usersData,
      chatsData,
      messagesData,
      reviewsData,
      logsData
    ] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('chats').select('*'),
      supabase.from('messages').select('*'),
      supabase.from('reviews').select('*'),
      supabase.from('system_logs').select('*')
    ]);

    const backupData = {
      timestamp: new Date().toISOString(),
      generated_by: ownerId,
      data: {
        users: usersData.data,
        chats: chatsData.data,
        messages: messagesData.data,
        reviews: reviewsData.data,
        logs: logsData.data
      }
    };

    await logAction(ownerId, 'SYSTEM_BACKUP', { 
      users_count: usersData.data?.length || 0,
      chats_count: chatsData.data?.length || 0,
      messages_count: messagesData.data?.length || 0
    });

    // В реальной системе здесь бы создавался файл и сохранялся
    // Пока возвращаем JSON

    res.json({ 
      message: 'Резервная копия создана',
      backup: backupData 
    });
  } catch (error) {
    console.error('Ошибка создания резервной копии:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Очистка старых данных
router.post('/cleanup', async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { days_old = 30 } = req.body;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days_old);

    // Очищаем старые логи
    const { count: deletedLogs } = await supabase
      .from('system_logs')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    // Архивируем старые закрытые чаты
    const { count: archivedChats } = await supabase
      .from('chats')
      .update({ status: 'archived' })
      .eq('status', 'closed')
      .lt('closed_at', cutoffDate.toISOString());

    await logAction(ownerId, 'SYSTEM_CLEANUP', { 
      days_old,
      deleted_logs: deletedLogs,
      archived_chats: archivedChats
    });

    res.json({ 
      message: 'Очистка данных выполнена',
      cleanup: {
        deleted_logs: deletedLogs,
        archived_chats: archivedChats,
        cutoff_date: cutoffDate.toISOString()
      }
    });
  } catch (error) {
    console.error('Ошибка очистки данных:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Полная статистика системы
router.get('/complete-stats', async (req, res) => {
  try {
    const { period = 'all' } = req.query;

    // Базовая статистика
    const [
      usersStats,
      chatsStats,
      messagesStats,
      reviewsStats,
      moderationStats
    ] = await Promise.all([
      // Статистика пользователей
      supabase
        .from('users')
        .select('role, is_online, is_blocked', { count: 'exact' }),
      
      // Статистика чатов
      supabase
        .from('chats')
        .select('status', { count: 'exact' }),
      
      // Статистика сообщений
      supabase
        .from('messages')
        .select('message_type', { count: 'exact' }),
      
      // Статистика отзывов
      supabase
        .from('reviews')
        .select('rating', { count: 'exact' }),
      
      // Статистика модерации
      supabase
        .from('moderation_actions')
        .select('action_type', { count: 'exact' })
    ]);

    // Анализ активности
    const { data: recentActivity } = await supabase
      .from('system_logs')
      .select('action, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);

    const activityByDay = {};
    recentActivity.forEach(log => {
      const date = new Date(log.created_at).toLocaleDateString('ru-RU');
      activityByDay[date] = (activityByDay[date] || 0) + 1;
    });

    res.json({
      period,
      generated_at: new Date().toISOString(),
      statistics: {
        users: {
          total: usersStats.count,
          by_role: groupCount(usersStats.data, 'role'),
          online: usersStats.data?.filter(u => u.is_online).length || 0,
          blocked: usersStats.data?.filter(u => u.is_blocked).length || 0
        },
        chats: {
          total: chatsStats.count,
          by_status: groupCount(chatsStats.data, 'status')
        },
        messages: {
          total: messagesStats.count,
          by_type: groupCount(messagesStats.data, 'message_type')
        },
        reviews: {
          total: reviewsStats.count,
          average_rating: calculateAverageRating(reviewsStats.data),
          by_rating: groupCount(reviewsStats.data, 'rating')
        },
        moderation: {
          total_actions: moderationStats.count,
          by_type: groupCount(moderationStats.data, 'action_type')
        },
        activity: {
          daily_activity: activityByDay,
          recent_actions: recentActivity.slice(0, 10)
        }
      }
    });
  } catch (error) {
    console.error('Ошибка получения полной статистики:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Вспомогательные функции
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

function groupCount(data, field) {
  if (!data) return {};
  return data.reduce((acc, item) => {
    const value = item[field];
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function calculateAverageRating(reviews) {
  if (!reviews || reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

module.exports = router;
