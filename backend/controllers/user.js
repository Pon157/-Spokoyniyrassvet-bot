const { supabase } = require('../db');
const { authenticateToken } = require('../middleware');
const bcrypt = require('bcryptjs');

class UsersController {
  // Получение профиля пользователя
  async getProfile(req, res) {
    try {
      const userId = req.user.id;

      const { data: user, error } = await supabase
        .from('users')
        .select('id, username, email, role, avatar_url, is_online, last_seen, created_at')
        .eq('id', userId)
        .single();

      if (error) throw error;

      // Получаем отзывы если пользователь слушатель
      if (user.role === 'listener') {
        const { data: reviews } = await supabase
          .from('reviews')
          .select('rating, comment, created_at, user:users!reviews_user_id_fkey(username)')
          .eq('listener_id', userId)
          .order('created_at', { ascending: false });

        user.reviews = reviews || [];
      }

      res.json({ user });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Ошибка получения профиля' });
    }
  }

  // Обновление профиля
  async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const { username, avatar_url } = req.body;

      const updateData = {};
      if (username) updateData.username = username;
      if (avatar_url) updateData.avatar_url = avatar_url;

      const { data: user, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      res.json({ 
        message: 'Профиль обновлен',
        user 
      });

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Ошибка обновления профиля' });
    }
  }

  // Смена пароля
  async changePassword(req, res) {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      // Получаем текущий хеш пароля
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('password_hash')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      // Проверяем текущий пароль
      const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!validPassword) {
        return res.status(400).json({ error: 'Неверный текущий пароль' });
      }

      // Хешируем новый пароль
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Обновляем пароль
      const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash: hashedPassword })
        .eq('id', userId);

      if (updateError) throw updateError;

      res.json({ message: 'Пароль успешно изменен' });

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Ошибка смены пароля' });
    }
  }

  // Получение уведомлений
  async getNotifications(req, res) {
    try {
      const userId = req.user.id;
      const { unreadOnly = false } = req.query;

      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (unreadOnly) {
        query = query.eq('is_read', false);
      }

      const { data: notifications, error } = await query;

      if (error) throw error;

      res.json({ notifications });

    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({ error: 'Ошибка получения уведомлений' });
    }
  }

  // Отметка уведомлений как прочитанных
  async markNotificationsRead(req, res) {
    try {
      const userId = req.user.id;
      const { notificationIds } = req.body;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .in('id', notificationIds);

      if (error) throw error;

      res.json({ message: 'Уведомления отмечены как прочитанные' });

    } catch (error) {
      console.error('Mark notifications read error:', error);
      res.status(500).json({ error: 'Ошибка обновления уведомлений' });
    }
  }
}

const usersController = new UsersController();

// Маршруты
const router = require('express').Router();

router.get('/profile', usersController.getProfile);
router.put('/profile', usersController.updateProfile);
router.put('/password', usersController.changePassword);
router.get('/notifications', usersController.getNotifications);
router.put('/notifications/read', usersController.markNotificationsRead);

module.exports = router;
