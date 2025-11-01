const { supabase } = require('../db');
const { authenticateToken, requireAdmin, requireCoOwner, requireOwner } = require('../middleware');

class AdminController {
  // Получение статистики системы
  async getStats(req, res) {
    try {
      const [
        usersCount,
        listenersCount,
        chatsCount,
        messagesCount,
        activeChats
      ] = await Promise.all([
        // Общее количество пользователей
        supabase.from('users').select('id', { count: 'exact' }),
        // Количество слушателей
        supabase.from('users').select('id', { count: 'exact' }).eq('role', 'listener'),
        // Общее количество чатов
        supabase.from('chats').select('id', { count: 'exact' }),
        // Общее количество сообщений
        supabase.from('messages').select('id', { count: 'exact' }),
        // Активные чаты
        supabase.from('chats').select('id', { count: 'exact' }).eq('status', 'active')
      ]);

      // Статистика по дням (последние 7 дней)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: dailyStats } = await supabase
        .from('messages')
        .select('created_at')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      res.json({
        stats: {
          totalUsers: usersCount.count,
          totalListeners: listenersCount.count,
          totalChats: chatsCount.count,
          totalMessages: messagesCount.count,
          activeChats: activeChats.count
        },
        dailyStats: dailyStats
      });

    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ error: 'Ошибка получения статистики' });
    }
  }

  // Получение всех пользователей
  async getUsers(req, res) {
    try {
      const { role, page = 1, limit = 50 } = req.query;
      
      let query = supabase
        .from('users')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (role) {
        query = query.eq('role', role);
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data: users, error, count } = await query.range(from, to);

      if (error) throw error;

      res.json({
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count
        }
      });

    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: 'Ошибка получения пользователей' });
    }
  }

  // Модерационные действия
  async moderateUser(req, res) {
    try {
      const moderatorId = req.user.id;
      const { userId, action, reason, durationMinutes } = req.body;

      const validActions = ['warning', 'mute', 'ban', 'unban'];
      if (!validActions.includes(action)) {
        return res.status(400).json({ error: 'Неверное действие' });
      }

      // Получаем информацию о пользователе
      const { data: targetUser, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError || !targetUser) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      let updateData = {};
      let moderationData = {
        moderator_id: moderatorId,
        target_user_id: userId,
        action_type: action,
        reason: reason,
        duration_minutes: durationMinutes
      };

      switch (action) {
        case 'warning':
          updateData.warnings = (targetUser.warnings || 0) + 1;
          break;

        case 'mute':
          const muteUntil = new Date();
          muteUntil.setMinutes(muteUntil.getMinutes() + (durationMinutes || 60));
          updateData.is_muted = true;
          updateData.mute_until = muteUntil.toISOString();
          break;

        case 'ban':
          const banUntil = durationMinutes ? new Date(Date.now() + durationMinutes * 60000) : null;
          updateData.is_banned = true;
          updateData.ban_until = banUntil ? banUntil.toISOString() : null;
          updateData.ban_reason = reason;
          break;

        case 'unban':
          updateData.is_banned = false;
          updateData.ban_until = null;
          updateData.ban_reason = null;
          break;
      }

      // Обновляем пользователя
      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId);

      if (updateError) throw updateError;

      // Логируем действие модерации
      await supabase
        .from('moderations')
        .insert([moderationData]);

      // Создаем уведомление для пользователя
      if (action !== 'unban') {
        await supabase
          .from('notifications')
          .insert([
            {
              user_id: userId,
              title: 'Модерационное действие',
              message: `Применено действие: ${action}. Причина: ${reason}`,
              type: 'warning'
            }
          ]);
      }

      res.json({ 
        message: `Действие "${action}" применено успешно`,
        user: targetUser.username
      });

    } catch (error) {
      console.error('Moderate user error:', error);
      res.status(500).json({ error: 'Ошибка модерации' });
    }
  }

  // Назначение ролей (только для coowner и owner)
  async assignRole(req, res) {
    try {
      const { userId, newRole } = req.body;

      const validRoles = ['user', 'listener', 'admin'];
      if (!validRoles.includes(newRole)) {
        return res.status(400).json({ error: 'Неверная роль' });
      }

      // Проверяем что текущий пользователь может назначать роли
      const currentUserRole = req.user.role;
      if (currentUserRole === 'coowner' && newRole === 'admin') {
        return res.status(403).json({ error: 'Недостаточно прав для назначения администратора' });
      }

      // Обновляем роль
      const { data: user, error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      // Логируем действие
      await supabase
        .from('moderations')
        .insert([
          {
            moderator_id: req.user.id,
            target_user_id: userId,
            action_type: 'promote',
            reason: `Назначение роли: ${newRole}`
          }
        ]);

      res.json({ 
        message: `Роль пользователя ${user.username} изменена на ${newRole}`,
        user 
      });

    } catch (error) {
      console.error('Assign role error:', error);
      res.status(500).json({ error: 'Ошибка назначения роли' });
    }
  }

  // Получение всех чатов системы
  async getAllChats(req, res) {
    try {
      const { page = 1, limit = 50, status } = req.query;
      
      let query = supabase
        .from('chats')
        .select(`
          *,
          user:users!chats_user_id_fkey(username, avatar_url),
          listener:users!chats_listener_id_fkey(username, avatar_url)
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data: chats, error, count } = await query.range(from, to);

      if (error) throw error;

      res.json({
        chats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count
        }
      });

    } catch (error) {
      console.error('Get chats error:', error);
      res.status(500).json({ error: 'Ошибка получения чатов' });
    }
  }

  // Отправка системного уведомления
  async sendNotification(req, res) {
    try {
      const { title, message, type = 'info', userIds = [] } = req.body;

      let notifications = [];

      if (userIds.length > 0) {
        // Отправка конкретным пользователям
        notifications = userIds.map(userId => ({
          user_id: userId,
          title,
          message,
          type
        }));
      } else {
        // Массовая рассылка всем пользователям
        const { data: allUsers } = await supabase
          .from('users')
          .select('id');

        notifications = allUsers.map(user => ({
          user_id: user.id,
          title,
          message,
          type
        }));
      }

      const { error } = await supabase
        .from('notifications')
        .insert(notifications);

      if (error) throw error;

      res.json({ 
        message: `Уведомление отправлено ${notifications.length} пользователям` 
      });

    } catch (error) {
      console.error('Send notification error:', error);
      res.status(500).json({ error: 'Ошибка отправки уведомления' });
    }
  }
}

const adminController = new AdminController();

// Маршруты
const router = require('express').Router();

router.get('/stats', adminController.getStats);
router.get('/users', requireAdmin, adminController.getUsers);
router.get('/chats', requireAdmin, adminController.getAllChats);
router.post('/moderate', requireAdmin, adminController.moderateUser);
router.post('/assign-role', requireCoOwner, adminController.assignRole);
router.post('/notification', requireCoOwner, adminController.sendNotification);

module.exports = router;
