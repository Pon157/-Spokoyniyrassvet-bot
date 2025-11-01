const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { logAction } = require('../middleware');

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Получение статистики
router.get('/stats', async (req, res) => {
  try {
    // Общее количество пользователей
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Количество слушателей
    const { count: totalListeners } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'listener')
      .eq('is_blocked', false);

    // Общее количество чатов
    const { count: totalChats } = await supabase
      .from('chats')
      .select('*', { count: 'exact', head: true });

    // Общее количество сообщений
    const { count: totalMessages } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true });

    // Активные чаты
    const { count: activeChats } = await supabase
      .from('chats')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    res.json({
      stats: {
        totalUsers,
        totalListeners,
        totalChats,
        totalMessages,
        activeChats
      }
    });
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение списка пользователей
router.get('/users', async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ users });
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение списка чатов
router.get('/chats', async (req, res) => {
  try {
    const { data: chats, error } = await supabase
      .from('chats')
      .select(`
        *,
        user:users!chats_user_id_fkey(username),
        listener:users!chats_listener_id_fkey(username),
        messages:messages(count)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedChats = chats.map(chat => ({
      id: chat.id,
      user_name: chat.user?.username || 'Неизвестный',
      listener_name: chat.listener?.username,
      status: chat.status,
      message_count: chat.messages[0]?.count || 0,
      created_at: chat.created_at
    }));

    res.json({ chats: formattedChats });
  } catch (error) {
    console.error('Ошибка получения чатов:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Просмотр конкретного чата
router.get('/chat/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;

    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select(`
        *,
        user:users!chats_user_id_fkey(*),
        listener:users!chats_listener_id_fkey(*)
      `)
      .eq('id', chatId)
      .single();

    if (chatError) throw chatError;

    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        *,
        sender:users(id, username, avatar_url)
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (messagesError) throw messagesError;

    res.json({
      chat: {
        ...chat,
        messages
      }
    });
  } catch (error) {
    console.error('Ошибка получения чата:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Блокировка пользователя
router.post('/block-user', async (req, res) => {
  try {
    const adminId = req.user.id;
    const { user_id, reason } = req.body;

    if (!user_id || !reason) {
      return res.status(400).json({ error: 'ID пользователя и причина обязательны' });
    }

    // Блокируем пользователя
    const { error: blockError } = await supabase
      .from('users')
      .update({ 
        is_blocked: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id);

    if (blockError) throw blockError;

    // Записываем действие модерации
    const { error: actionError } = await supabase
      .from('moderation_actions')
      .insert({
        moderator_id: adminId,
        target_user_id: user_id,
        action_type: 'block',
        reason: reason
      });

    if (actionError) throw actionError;

    await logAction(adminId, 'USER_BLOCK', { target_user_id: user_id, reason });

    res.json({ message: 'Пользователь заблокирован' });
  } catch (error) {
    console.error('Ошибка блокировки пользователя:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Мут пользователя
router.post('/mute-user', async (req, res) => {
  try {
    const adminId = req.user.id;
    const { user_id, duration, reason } = req.body;

    if (!user_id || !duration || !reason) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    const muteExpires = new Date(Date.now() + duration * 60000);

    // Мутим пользователя
    const { error: muteError } = await supabase
      .from('users')
      .update({ 
        is_muted: true,
        mute_reason: reason,
        mute_expires_at: muteExpires.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id);

    if (muteError) throw muteError;

    // Записываем действие модерации
    const { error: actionError } = await supabase
      .from('moderation_actions')
      .insert({
        moderator_id: adminId,
        target_user_id: user_id,
        action_type: 'mute',
        reason: reason,
        duration_minutes: duration,
        expires_at: muteExpires.toISOString()
      });

    if (actionError) throw actionError;

    await logAction(adminId, 'USER_MUTE', { 
      target_user_id: user_id, 
      duration, 
      reason 
    });

    res.json({ message: 'Пользователь замучен' });
  } catch (error) {
    console.error('Ошибка мута пользователя:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Выдача предупреждения
router.post('/warn-user', async (req, res) => {
  try {
    const adminId = req.user.id;
    const { user_id, reason } = req.body;

    if (!user_id || !reason) {
      return res.status(400).json({ error: 'ID пользователя и причина обязательны' });
    }

    // Увеличиваем счетчик предупреждений
    const { data: user } = await supabase
      .from('users')
      .select('warnings')
      .eq('id', user_id)
      .single();

    const newWarnings = (user?.warnings || 0) + 1;

    const { error: warnError } = await supabase
      .from('users')
      .update({ 
        warnings: newWarnings,
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id);

    if (warnError) throw warnError;

    // Записываем действие модерации
    const { error: actionError } = await supabase
      .from('moderation_actions')
      .insert({
        moderator_id: adminId,
        target_user_id: user_id,
        action_type: 'warn',
        reason: reason
      });

    if (actionError) throw actionError;

    // Создаем уведомление для пользователя
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: user_id,
        title: 'Предупреждение',
        message: `Вам выдано предупреждение. Причина: ${reason}. Всего предупреждений: ${newWarnings}`,
        notification_type: 'warning'
      });

    if (notificationError) throw notificationError;

    await logAction(adminId, 'USER_WARN', { 
      target_user_id: user_id, 
      reason,
      warnings_count: newWarnings
    });

    res.json({ 
      message: 'Предупреждение выдано',
      warnings: newWarnings 
    });
  } catch (error) {
    console.error('Ошибка выдачи предупреждения:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Разблокировка пользователя
router.post('/unblock-user', async (req, res) => {
  try {
    const adminId = req.user.id;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'ID пользователя обязателен' });
    }

    const { error: unblockError } = await supabase
      .from('users')
      .update({ 
        is_blocked: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id);

    if (unblockError) throw unblockError;

    // Записываем действие модерации
    const { error: actionError } = await supabase
      .from('moderation_actions')
      .insert({
        moderator_id: adminId,
        target_user_id: user_id,
        action_type: 'unblock'
      });

    if (actionError) throw actionError;

    await logAction(adminId, 'USER_UNBLOCK', { target_user_id: user_id });

    res.json({ message: 'Пользователь разблокирован' });
  } catch (error) {
    console.error('Ошибка разблокировки пользователя:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Снятие мута
router.post('/unmute-user', async (req, res) => {
  try {
    const adminId = req.user.id;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'ID пользователя обязателен' });
    }

    const { error: unmuteError } = await supabase
      .from('users')
      .update({ 
        is_muted: false,
        mute_reason: null,
        mute_expires_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id);

    if (unmuteError) throw unmuteError;

    // Записываем действие модерации
    const { error: actionError } = await supabase
      .from('moderation_actions')
      .insert({
        moderator_id: adminId,
        target_user_id: user_id,
        action_type: 'unmute'
      });

    if (actionError) throw actionError;

    await logAction(adminId, 'USER_UNMUTE', { target_user_id: user_id });

    res.json({ message: 'Мут снят' });
  } catch (error) {
    console.error('Ошибка снятия мута:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение логов системы
router.get('/logs', async (req, res) => {
  try {
    const { type, date } = req.query;

    let query = supabase
      .from('system_logs')
      .select(`
        *,
        user:users(username)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (type) {
      query = query.eq('action', type);
    }

    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      
      query = query.gte('created_at', startDate.toISOString())
                  .lt('created_at', endDate.toISOString());
    }

    const { data: logs, error } = await query;

    if (error) throw error;

    const formattedLogs = logs.map(log => ({
      ...log,
      user_name: log.user?.username
    }));

    res.json({ logs: formattedLogs });
  } catch (error) {
    console.error('Ошибка получения логов:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Вход в чат как администратор
router.post('/join-chat', async (req, res) => {
  try {
    const adminId = req.user.id;
    const { chat_id } = req.body;

    if (!chat_id) {
      return res.status(400).json({ error: 'ID чата обязателен' });
    }

    // Проверяем существование чата
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chat_id)
      .single();

    if (chatError || !chat) {
      return res.status(404).json({ error: 'Чат не найден' });
    }

    // Отправляем системное сообщение о входе администратора
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        chat_id: chat_id,
        sender_id: adminId,
        content: 'Администратор присоединился к чату для оказания помощи',
        message_type: 'system'
      });

    if (messageError) throw messageError;

    await logAction(adminId, 'ADMIN_JOIN_CHAT', { chat_id });

    res.json({ 
      message: 'Вы присоединились к чату',
      chat_id: chat_id
    });
  } catch (error) {
    console.error('Ошибка входа в чат:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
