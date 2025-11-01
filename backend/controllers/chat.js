const express = require('express');
const multer = require('multer');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { logAction } = require('../middleware');

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../frontend/media/uploads');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /image\/|video\/|audio\//;
    const isValid = allowedTypes.test(file.mimetype);
    
    if (isValid) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимый тип файла'));
    }
  }
});

// Получение списка чатов пользователя
router.get('/chats', async (req, res) => {
  try {
    const userId = req.user.id;

    let query = supabase
      .from('chats')
      .select(`
        *,
        user:users!chats_user_id_fkey(id, username, avatar_url, is_online),
        listener:users!chats_listener_id_fkey(id, username, avatar_url, is_online)
      `)
      .or(`user_id.eq.${userId},listener_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    const { data: chats, error } = await query;

    if (error) throw error;

    // Форматируем данные чатов
    const formattedChats = chats.map(chat => {
      const isUser = chat.user_id === userId;
      const partner = isUser ? chat.listener : chat.user;
      
      return {
        id: chat.id,
        partner_id: partner?.id,
        partner_name: partner?.username || 'Неизвестный',
        partner_avatar: partner?.avatar_url,
        partner_online: partner?.is_online || false,
        status: chat.status,
        last_message: chat.last_message,
        last_message_time: chat.updated_at,
        unread_count: chat.unread_count || 0
      };
    });

    res.json({ chats: formattedChats });
  } catch (error) {
    console.error('Ошибка получения чатов:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение сообщений чата
router.get('/messages/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    // Проверяем доступ к чату
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .or(`user_id.eq.${userId},listener_id.eq.${userId}`)
      .single();

    if (chatError || !chat) {
      return res.status(404).json({ error: 'Чат не найден' });
    }

    // Получаем сообщения
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:users(id, username, avatar_url, role)
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Помечаем сообщения как прочитанные
    await supabase
      .from('messages')
      .update({ read_by_recipient: true })
      .eq('chat_id', chatId)
      .neq('sender_id', userId)
      .is('read_by_recipient', false);

    res.json({ messages });
  } catch (error) {
    console.error('Ошибка получения сообщений:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Создание нового чата
router.post('/create', async (req, res) => {
  try {
    const userId = req.user.id;
    const { listener_id } = req.body;

    // Для пользователей - находим свободного слушателя
    let listenerId = listener_id;
    if (req.user.role === 'user' && !listenerId) {
      const { data: availableListener } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'listener')
        .eq('is_online', true)
        .eq('is_blocked', false)
        .limit(1)
        .single();

      if (!availableListener) {
        return res.status(404).json({ error: 'Нет доступных слушателей' });
      }

      listenerId = availableListener.id;
    }

    // Для слушателей - пользователь должен быть указан
    if (req.user.role === 'listener' && !listenerId) {
      return res.status(400).json({ error: 'Не указан пользователь для чата' });
    }

    const chatData = {
      user_id: req.user.role === 'user' ? userId : listenerId,
      listener_id: req.user.role === 'listener' ? userId : listenerId,
      status: 'active'
    };

    const { data: chat, error } = await supabase
      .from('chats')
      .insert(chatData)
      .select(`
        *,
        user:users!chats_user_id_fkey(id, username, avatar_url, is_online),
        listener:users!chats_listener_id_fkey(id, username, avatar_url, is_online)
      `)
      .single();

    if (error) throw error;

    await logAction(userId, 'CHAT_CREATE', { chat_id: chat.id });

    res.json({ chat });
  } catch (error) {
    console.error('Ошибка создания чата:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Загрузка медиа
router.post('/upload-media', upload.single('media'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    const { chat_id } = req.body;
    const userId = req.user.id;

    // Проверяем доступ к чату
    const { data: chat } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chat_id)
      .or(`user_id.eq.${userId},listener_id.eq.${userId}`)
      .single();

    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден' });
    }

    const mediaUrl = `/media/uploads/${req.file.filename}`;

    await logAction(userId, 'MEDIA_UPLOAD', { 
      chat_id: chat_id,
      filename: req.file.filename,
      type: req.file.mimetype
    });

    res.json({ media_url: mediaUrl });
  } catch (error) {
    console.error('Ошибка загрузки медиа:', error);
    res.status(500).json({ error: 'Ошибка загрузки файла' });
  }
});

// Загрузка голосового сообщения
router.post('/upload-voice', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Аудио файл не загружен' });
    }

    const { chat_id } = req.body;
    const userId = req.user.id;

    // Проверяем доступ к чату
    const { data: chat } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chat_id)
      .or(`user_id.eq.${userId},listener_id.eq.${userId}`)
      .single();

    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден' });
    }

    const mediaUrl = `/media/uploads/${req.file.filename}`;

    await logAction(userId, 'VOICE_UPLOAD', { 
      chat_id: chat_id,
      filename: req.file.filename
    });

    res.json({ media_url: mediaUrl });
  } catch (error) {
    console.error('Ошибка загрузки аудио:', error);
    res.status(500).json({ error: 'Ошибка загрузки аудио' });
  }
});

// Получение списка слушателей
router.get('/listeners', async (req, res) => {
  try {
    const { data: listeners, error } = await supabase
      .from('users')
      .select(`
        *,
        reviews:reviews!reviews_listener_id_fkey(rating)
      `)
      .eq('role', 'listener')
      .eq('is_blocked', false)
      .order('is_online', { ascending: false });

    if (error) throw error;

    // Рассчитываем средний рейтинг
    const listenersWithRating = listeners.map(listener => {
      const ratings = listener.reviews.map(r => r.rating);
      const avgRating = ratings.length > 0 
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
        : 0;

      return {
        ...listener,
        avg_rating: Math.round(avgRating * 10) / 10,
        reviews_count: ratings.length
      };
    });

    res.json({ listeners: listenersWithRating });
  } catch (error) {
    console.error('Ошибка получения слушателей:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение стикеров
router.get('/stickers', async (req, res) => {
  try {
    const { data: stickers, error } = await supabase
      .from('stickers')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .order('created_at');

    if (error) throw error;

    res.json({ stickers });
  } catch (error) {
    console.error('Ошибка получения стикеров:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Добавление отзыва
router.post('/review', async (req, res) => {
  try {
    const userId = req.user.id;
    const { chat_id, rating, comment } = req.body;

    if (!chat_id || !rating) {
      return res.status(400).json({ error: 'Чат и оценка обязательны' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Оценка должна быть от 1 до 5' });
    }

    // Проверяем чат
    const { data: chat } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chat_id)
      .eq('user_id', userId)
      .single();

    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден' });
    }

    // Проверяем, не оставлял ли уже отзыв
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('chat_id', chat_id)
      .single();

    if (existingReview) {
      return res.status(400).json({ error: 'Отзыв уже оставлен' });
    }

    const { data: review, error } = await supabase
      .from('reviews')
      .insert({
        listener_id: chat.listener_id,
        user_id: userId,
        chat_id: chat_id,
        rating: rating,
        comment: comment
      })
      .select()
      .single();

    if (error) throw error;

    await logAction(userId, 'REVIEW_CREATE', { 
      listener_id: chat.listener_id,
      rating: rating
    });

    res.json({ review });
  } catch (error) {
    console.error('Ошибка создания отзыва:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
