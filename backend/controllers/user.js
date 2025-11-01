const express = require('express');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const { logAction } = require('../middleware');

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Настройка multer для загрузки аватаров
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../frontend/media/avatars');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `avatar-${req.user.id}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Только изображения разрешены'));
    }
  }
});

// Получение профиля пользователя
router.get('/profile', async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;

    // Скрываем хеш пароля
    const { password_hash, ...userData } = user;

    res.json({ user: userData });
  } catch (error) {
    console.error('Ошибка получения профиля:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Обновление профиля
router.post('/update-profile', async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, email, bio } = req.body;

    if (!username || !email) {
      return res.status(400).json({ error: 'Имя пользователя и email обязательны' });
    }

    // Проверяем, не занят ли email другим пользователем
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .neq('id', userId)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Email уже используется другим пользователем' });
    }

    // Проверяем, не занято ли имя пользователя
    const { data: existingUsername } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .neq('id', userId)
      .single();

    if (existingUsername) {
      return res.status(400).json({ error: 'Имя пользователя уже занято' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .update({
        username,
        email,
        bio,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    await logAction(userId, 'PROFILE_UPDATE', { 
      username: username,
      email: email 
    });

    const { password_hash, ...userData } = user;

    res.json({ 
      message: 'Профиль успешно обновлен',
      user: userData
    });
  } catch (error) {
    console.error('Ошибка обновления профиля:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Загрузка аватара
router.post('/upload-avatar', uploadAvatar.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    const userId = req.user.id;
    const avatarUrl = `/media/avatars/${req.file.filename}`;

    // Обновляем аватар пользователя
    const { error } = await supabase
      .from('users')
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) throw error;

    await logAction(userId, 'AVATAR_UPLOAD', { 
      filename: req.file.filename 
    });

    res.json({ 
      message: 'Аватар успешно загружен',
      avatar_url: avatarUrl
    });
  } catch (error) {
    console.error('Ошибка загрузки аватара:', error);
    res.status(500).json({ error: 'Ошибка загрузки аватара' });
  }
});

// Удаление аватара
router.post('/remove-avatar', async (req, res) => {
  try {
    const userId = req.user.id;

    const { error } = await supabase
      .from('users')
      .update({
        avatar_url: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) throw error;

    await logAction(userId, 'AVATAR_REMOVE');

    res.json({ 
      message: 'Аватар удален'
    });
  } catch (error) {
    console.error('Ошибка удаления аватара:', error);
    res.status(500).json({ error: 'Ошибка удаления аватара' });
  }
});

// Смена пароля
router.post('/change-password', async (req, res) => {
  try {
    const userId = req.user.id;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Текущий и новый пароль обязательны' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'Новый пароль должен содержать минимум 6 символов' });
    }

    // Получаем текущий хеш пароля
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    // Проверяем текущий пароль
    const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: 'Текущий пароль неверен' });
    }

    // Хешируем новый пароль
    const hashedPassword = await bcrypt.hash(new_password, 12);

    // Обновляем пароль
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: hashedPassword,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    await logAction(userId, 'PASSWORD_CHANGE');

    res.json({ 
      message: 'Пароль успешно изменен'
    });
  } catch (error) {
    console.error('Ошибка смены пароля:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение настроек пользователя
router.get('/settings', async (req, res) => {
  try {
    const userId = req.user.id;

    // В реальной системе настройки могут храниться в отдельной таблице
    // Пока возвращаем базовые настройки из поля theme
    const { data: user, error } = await supabase
      .from('users')
      .select('theme, settings')
      .eq('id', userId)
      .single();

    if (error) throw error;

    const settings = user.settings || {
      theme: user.theme || 'light',
      autoTheme: false,
      showTimestamps: true,
      soundNotifications: true,
      desktopNotifications: true
    };

    res.json({ settings });
  } catch (error) {
    console.error('Ошибка получения настроек:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Сохранение настроек пользователя
router.post('/settings', async (req, res) => {
  try {
    const userId = req.user.id;
    const { settings } = req.body;

    if (!settings) {
      return res.status(400).json({ error: 'Настройки обязательны' });
    }

    // Сохраняем настройки в поле settings
    const { error } = await supabase
      .from('users')
      .update({
        settings: settings,
        theme: settings.theme, // Сохраняем тему отдельно для обратной совместимости
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) throw error;

    await logAction(userId, 'SETTINGS_UPDATE', { 
      theme: settings.theme 
    });

    res.json({ 
      message: 'Настройки сохранены'
    });
  } catch (error) {
    console.error('Ошибка сохранения настроек:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Настройки уведомлений
router.post('/notification-settings', async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationSettings = req.body;

    // Сохраняем настройки уведомлений
    const { data: user } = await supabase
      .from('users')
      .select('settings')
      .eq('id', userId)
      .single();

    const currentSettings = user?.settings || {};
    const updatedSettings = {
      ...currentSettings,
      notifications: notificationSettings
    };

    const { error } = await supabase
      .from('users')
      .update({
        settings: updatedSettings,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) throw error;

    await logAction(userId, 'NOTIFICATION_SETTINGS_UPDATE');

    res.json({ 
      message: 'Настройки уведомлений сохранены'
    });
  } catch (error) {
    console.error('Ошибка сохранения настроек уведомлений:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение уведомлений пользователя
router.get('/notifications', async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({ notifications });
  } catch (error) {
    console.error('Ошибка получения уведомлений:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Отметка уведомления как прочитанного
router.post('/mark-notification-read', async (req, res) => {
  try {
    const userId = req.user.id;
    const { notification_id } = req.body;

    if (!notification_id) {
      return res.status(400).json({ error: 'ID уведомления обязательно' });
    }

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notification_id)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ 
      message: 'Уведомление отмечено как прочитанное'
    });
  } catch (error) {
    console.error('Ошибка отметки уведомления:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Удаление уведомления
router.post('/delete-notification', async (req, res) => {
  try {
    const userId = req.user.id;
    const { notification_id } = req.body;

    if (!notification_id) {
      return res.status(400).json({ error: 'ID уведомления обязательно' });
    }

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notification_id)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ 
      message: 'Уведомление удалено'
    });
  } catch (error) {
    console.error('Ошибка удаления уведомления:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение активных сессий (заглушка)
router.get('/sessions', async (req, res) => {
  try {
    // В реальной системе здесь бы получались активные сессии из базы
    // Пока возвращаем заглушку
    const sessions = [
      {
        id: 'current',
        device_type: 'desktop',
        device_name: 'Windows Chrome',
        location: 'Москва, Россия',
        last_activity: new Date().toISOString(),
        is_current: true
      },
      {
        id: 'session-2',
        device_type: 'mobile',
        device_name: 'Android Chrome',
        location: 'Санкт-Петербург, Россия',
        last_activity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        is_current: false
      }
    ];

    res.json({ sessions });
  } catch (error) {
    console.error('Ошибка получения сессий:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Завершение сессии (заглушка)
router.post('/logout-session', async (req, res) => {
  try {
    const { session_id } = req.body;

    // В реальной системе здесь бы завершалась конкретная сессия
    // Пока просто возвращаем успех

    await logAction(req.user.id, 'SESSION_LOGOUT', { session_id });

    res.json({ 
      message: 'Сессия завершена'
    });
  } catch (error) {
    console.error('Ошибка завершения сессии:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Выход со всех устройств
router.post('/logout-all-sessions', async (req, res) => {
  try {
    const userId = req.user.id;

    // В реальной системе здесь бы инвалидировались все токены пользователя
    // Пока просто разлогиниваем текущего пользователя

    await supabase
      .from('users')
      .update({ is_online: false })
      .eq('id', userId);

    await logAction(userId, 'LOGOUT_ALL_SESSIONS');

    res.json({ 
      message: 'Все сессии завершены'
    });
  } catch (error) {
    console.error('Ошибка выхода со всех устройств:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
