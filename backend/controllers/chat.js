const express = require('express');
const multer = require('multer');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { authenticateToken, logAction } = require('../middleware');

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

// 🔄 НОВЫЕ ENDPOINTS ДЛЯ АКТИВНЫХ СЛУШАТЕЛЕЙ

// Получение активных слушателей с пагинацией
router.get('/active-listeners', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    console.log('🎧 Запрос активных слушателей, страница:', page);

    const { data: listeners, error, count } = await supabase
      .from('users')
      .select(`
        id,
        username,
        avatar_url,
        is_online,
        rating,
        specialties,
        bio,
        total_sessions,
        response_time,
        languages,
        experience_years,
        created_at
      `, { count: 'exact' })
      .eq('role', 'listener')
      .eq('is_online', true)
      .eq('is_blocked', false)
      .order('is_online', { ascending: false })
      .order('rating', { ascending: false })
      .order('total_sessions', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const formattedListeners = listeners.map(listener => ({
      id: listener.id,
      username: listener.username,
      avatar_url: listener.avatar_url || '/images/default-avatar.svg',
      is_online: listener.is_online,
      rating: listener.rating || 4.5,
      specialties: listener.specialties || ['Психология'],
      bio: listener.bio || 'Профессиональный слушатель с опытом работы',
      total_sessions: listener.total_sessions || 0,
      response_time: listener.response_time || '2-5 мин',
      languages: listener.languages || ['Русский'],
      experience_years: listener.experience_years || 1,
      is_available: true,
      member_since: new Date(listener.created_at).getFullYear()
    }));

    res.json({
      success: true,
      listeners: formattedListeners,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('❌ Ошибка получения активных слушателей:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера' 
    });
  }
});

// Поиск слушателей по специализации
router.get('/listeners/search', authenticateToken, async (req, res) => {
  try {
    const { query, specialty, language, min_rating } = req.query;
    
    console.log('🔍 Поиск слушателей:', { query, specialty, language, min_rating });

    let supabaseQuery = supabase
      .from('users')
      .select(`
        id,
        username,
        avatar_url,
        is_online,
        rating,
        specialties,
        bio,
        total_sessions,
        response_time,
        languages,
        experience_years
      `)
      .eq('role', 'listener')
      .eq('is_online', true)
      .eq('is_blocked', false);

    // Поиск по имени
    if (query) {
      supabaseQuery = supabaseQuery.ilike('username', `%${query}%`);
    }

    // Фильтр по специализации
    if (specialty && specialty !== 'all') {
      supabaseQuery = supabaseQuery.contains('specialties', [specialty]);
    }

    // Фильтр по языку
    if (language && language !== 'all') {
      supabaseQuery = supabaseQuery.contains('languages', [language]);
    }

    // Фильтр по минимальному рейтингу
    if (min_rating) {
      supabaseQuery = supabaseQuery.gte('rating', parseFloat(min_rating));
    }

    const { data: listeners, error } = await supabaseQuery
      .order('rating', { ascending: false })
      .order('is_online', { ascending: false })
      .order('total_sessions', { ascending: false });

    if (error) throw error;

    const formattedListeners = listeners.map(listener => ({
      id: listener.id,
      username: listener.username,
      avatar_url: listener.avatar_url || '/images/default-avatar.svg',
      is_online: listener.is_online,
      rating: listener.rating || 4.5,
      specialties: listener.specialties || ['Психология'],
      bio: listener.bio || 'Профессиональный слушатель',
      total_sessions: listener.total_sessions || 0,
      response_time: listener.response_time || '2-5 мин',
      languages: listener.languages || ['Русский'],
      experience_years: listener.experience_years || 1
    }));

    res.json({ 
      success: true,
      listeners: formattedListeners,
      total: formattedListeners.length
    });

  } catch (error) {
    console.error('❌ Ошибка поиска слушателей:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера' 
    });
  }
});

// Получение подробной информации о слушателе
router.get('/listeners/:id/profile', authenticateToken, async (req, res) => {
  try {
    const listenerId = req.params.id;
    
    console.log('📋 Запрос профиля слушателя:', listenerId);

    const { data: listener, error } = await supabase
      .from('users')
      .select(`
        id,
        username,
        avatar_url,
        is_online,
        rating,
        specialties,
        bio,
        total_sessions,
        response_time,
        languages,
        experience_years,
        created_at,
        reviews:reviews(
          rating,
          comment,
          created_at,
          user:users(username, avatar_url)
        )
      `)
      .eq('id', listenerId)
      .eq('role', 'listener')
      .single();

    if (error) throw error;

    if (!listener) {
      return res.status(404).json({ 
        success: false,
        error: 'Слушатель не найден' 
      });
    }

    // Расчет среднего рейтинга из отзывов
    const reviews = listener.reviews || [];
    const avgRating = reviews.length > 0 
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
      : listener.rating || 4.5;

    // Расчет распределения оценок
    const ratingDistribution = [0, 0, 0, 0, 0]; // 1-5 звезды
    reviews.forEach(review => {
      if (review.rating >= 1 && review.rating <= 5) {
        ratingDistribution[review.rating - 1]++;
      }
    });

    const profile = {
      id: listener.id,
      username: listener.username,
      avatar_url: listener.avatar_url || '/images/default-avatar.svg',
      is_online: listener.is_online,
      rating: Math.round(avgRating * 10) / 10,
      specialties: listener.specialties || ['Психология'],
      bio: listener.bio || 'Профессиональный слушатель',
      total_sessions: listener.total_sessions || 0,
      response_time: listener.response_time || '2-5 мин',
      languages: listener.languages || ['Русский'],
      experience_years: listener.experience_years || 1,
      member_since: new Date(listener.created_at).getFullYear(),
      reviews: reviews.slice(0, 10).map(review => ({
        rating: review.rating,
        comment: review.comment,
        created_at: review.created_at,
        user: {
          username: review.user?.username || 'Аноним',
          avatar_url: review.user?.avatar_url
        }
      })),
      rating_distribution: ratingDistribution,
      total_reviews: reviews.length
    };

    res.json({ 
      success: true,
      profile 
    });

  } catch (error) {
    console.error('❌ Ошибка получения профиля слушателя:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера' 
    });
  }
});

// Создание чата с конкретным слушателем
router.post('/create-with-listener', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { listener_id } = req.body;

    if (!listener_id) {
      return res.status(400).json({ 
        success: false,
        error: 'ID слушателя обязателен' 
      });
    }

    console.log(`💬 Создание чата пользователем ${userId} с слушателем ${listener_id}`);

    // Проверяем существующий активный чат
    const { data: existingChat } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', userId)
      .eq('listener_id', listener_id)
      .eq('status', 'active')
      .single();

    if (existingChat) {
      console.log('♻️ Используем существующий чат:', existingChat.id);
      return res.json({ 
        success: true,
        chat: existingChat,
        is_new: false 
      });
    }

    // Проверяем, что слушатель существует и доступен
    const { data: listener } = await supabase
      .from('users')
      .select('id, username, is_online, avatar_url')
      .eq('id', listener_id)
      .eq('role', 'listener')
      .eq('is_blocked', false)
      .single();

    if (!listener) {
      return res.status(404).json({ 
        success: false,
        error: 'Слушатель не найден' 
      });
    }

    if (!listener.is_online) {
      return res.status(400).json({ 
        success: false,
        error: 'Слушатель сейчас не доступен' 
      });
    }

    // Создаем новый чат
    const chatData = {
      user_id: userId,
      listener_id: listener_id,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: chat, error } = await supabase
      .from('chats')
      .insert(chatData)
      .select(`
        *,
        user:users!chats_user_id_fkey(id, username, avatar_url),
        listener:users!chats_listener_id_fkey(id, username, avatar_url)
      `)
      .single();

    if (error) throw error;

    await logAction(userId, 'CHAT_CREATE_WITH_LISTENER', { 
      listener_id: listener_id,
      chat_id: chat.id 
    });

    console.log('✅ Новый чат создан:', chat.id);

    res.json({ 
      success: true,
      chat: chat,
      is_new: true 
    });

  } catch (error) {
    console.error('❌ Ошибка создания чата с слушателем:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера' 
    });
  }
});

// Получение статистики слушателя для пользователя
router.get('/listeners/:id/stats', authenticateToken, async (req, res) => {
  try {
    const listenerId = req.params.id;

    // Получаем базовую статистику из users
    const { data: listener, error } = await supabase
      .from('users')
      .select(`
        total_sessions,
        rating,
        response_time,
        experience_years
      `)
      .eq('id', listenerId)
      .single();

    if (error) throw error;

    // Получаем количество активных чатов
    const { data: activeChats, error: chatsError } = await supabase
      .from('chats')
      .select('id', { count: 'exact' })
      .eq('listener_id', listenerId)
      .eq('status', 'active');

    if (chatsError) throw chatsError;

    // Получаем отзывы
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('rating')
      .eq('listener_id', listenerId);

    if (reviewsError) throw reviewsError;

    const stats = {
      total_sessions: listener.total_sessions || 0,
      active_chats: activeChats?.length || 0,
      average_rating: listener.rating || 4.5,
      total_reviews: reviews?.length || 0,
      response_time: listener.response_time || '2-5 мин',
      experience_years: listener.experience_years || 1,
      completion_rate: 95, // В реальном приложении рассчитывается из истории чатов
      satisfaction_rate: 92, // В реальном приложении рассчитывается из отзывов
      response_rate: 98 // В реальном приложении рассчитывается из истории ответов
    };

    res.json({ 
      success: true,
      stats 
    });

  } catch (error) {
    console.error('❌ Ошибка получения статистики слушателя:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера' 
    });
  }
});

// Получение доступных специализаций
router.get('/specialties', authenticateToken, async (req, res) => {
  try {
    const { data: listeners, error } = await supabase
      .from('users')
      .select('specialties')
      .eq('role', 'listener')
      .eq('is_online', true)
      .eq('is_blocked', false);

    if (error) throw error;

    // Собираем все уникальные специализации
    const specialties = new Set();
    listeners.forEach(listener => {
      if (listener.specialties && Array.isArray(listener.specialties)) {
        listener.specialties.forEach(spec => specialties.add(spec));
      }
    });

    // Преобразуем в массив и сортируем
    const specialtiesArray = Array.from(specialties).sort();

    res.json({ 
      success: true,
      specialties: specialtiesArray 
    });

  } catch (error) {
    console.error('❌ Ошибка получения специализаций:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера' 
    });
  }
});

// Получение доступных языков
router.get('/languages', authenticateToken, async (req, res) => {
  try {
    const { data: listeners, error } = await supabase
      .from('users')
      .select('languages')
      .eq('role', 'listener')
      .eq('is_online', true)
      .eq('is_blocked', false);

    if (error) throw error;

    // Собираем все уникальные языки
    const languages = new Set();
    listeners.forEach(listener => {
      if (listener.languages && Array.isArray(listener.languages)) {
        listener.languages.forEach(lang => languages.add(lang));
      }
    });

    // Преобразуем в массив и сортируем
    const languagesArray = Array.from(languages).sort();

    res.json({ 
      success: true,
      languages: languagesArray 
    });

  } catch (error) {
    console.error('❌ Ошибка получения языков:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера' 
    });
  }
});

// СУЩЕСТВУЮЩИЕ ENDPOINTS

// Получение списка чатов пользователя
router.get('/chats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    console.log('💬 Загрузка чатов для пользователя:', userId);

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
    const formattedChats = chats ? chats.map(chat => {
      const isUser = chat.user_id === userId;
      const partner = isUser ? chat.listener : chat.user;
      
      return {
        id: chat.id,
        partner_id: partner?.id,
        partner_name: partner?.username || 'Неизвестный',
        partner_avatar: partner?.avatar_url,
        partner_online: partner?.is_online || false,
        status: chat.status,
        last_message: chat.last_message || 'Чат создан',
        last_message_time: chat.updated_at,
        unread_count: chat.unread_count || 0
      };
    }) : [];

    console.log(`✅ Загружено ${formattedChats.length} чатов`);

    res.json({ 
      success: true,
      chats: formattedChats 
    });
  } catch (error) {
    console.error('Ошибка получения чатов:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера' 
    });
  }
});

// Получение сообщений чата
router.get('/messages/:chatId', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.userId;

    // Проверяем доступ к чату
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .or(`user_id.eq.${userId},listener_id.eq.${userId}`)
      .single();

    if (chatError || !chat) {
      return res.status(404).json({ 
        success: false,
        error: 'Чат не найден' 
      });
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

    res.json({ 
      success: true,
      messages: messages || []
    });
  } catch (error) {
    console.error('Ошибка получения сообщений:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера' 
    });
  }
});

// Создание нового чата
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
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
        return res.status(404).json({ 
          success: false,
          error: 'Нет доступных слушателей' 
        });
      }

      listenerId = availableListener.id;
    }

    // Для слушателей - пользователь должен быть указан
    if (req.user.role === 'listener' && !listenerId) {
      return res.status(400).json({ 
        success: false,
        error: 'Не указан пользователь для чата' 
      });
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

    res.json({ 
      success: true,
      chat 
    });
  } catch (error) {
    console.error('Ошибка создания чата:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера' 
    });
  }
});

// Загрузка медиа
router.post('/upload-media', upload.single('media'), authenticateToken, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'Файл не загружен' 
      });
    }

    const { chat_id } = req.body;
    const userId = req.user.userId;

    // Проверяем доступ к чату
    const { data: chat } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chat_id)
      .or(`user_id.eq.${userId},listener_id.eq.${userId}`)
      .single();

    if (!chat) {
      return res.status(404).json({ 
        success: false,
        error: 'Чат не найден' 
      });
    }

    const mediaUrl = `/media/uploads/${req.file.filename}`;

    await logAction(userId, 'MEDIA_UPLOAD', { 
      chat_id: chat_id,
      filename: req.file.filename,
      type: req.file.mimetype
    });

    res.json({ 
      success: true,
      media_url: mediaUrl 
    });
  } catch (error) {
    console.error('Ошибка загрузки медиа:', error);
    res.status(500).json({ 
      success: false,
      error: 'Ошибка загрузки файла' 
    });
  }
});

// Загрузка голосового сообщения
router.post('/upload-voice', upload.single('audio'), authenticateToken, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'Аудио файл не загружен' 
      });
    }

    const { chat_id } = req.body;
    const userId = req.user.userId;

    // Проверяем доступ к чату
    const { data: chat } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chat_id)
      .or(`user_id.eq.${userId},listener_id.eq.${userId}`)
      .single();

    if (!chat) {
      return res.status(404).json({ 
        success: false,
        error: 'Чат не найден' 
      });
    }

    const mediaUrl = `/media/uploads/${req.file.filename}`;

    await logAction(userId, 'VOICE_UPLOAD', { 
      chat_id: chat_id,
      filename: req.file.filename
    });

    res.json({ 
      success: true,
      media_url: mediaUrl 
    });
  } catch (error) {
    console.error('Ошибка загрузки аудио:', error);
    res.status(500).json({ 
      success: false,
      error: 'Ошибка загрузки аудио' 
    });
  }
});

// Получение списка слушателей
router.get('/listeners', authenticateToken, async (req, res) => {
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

    res.json({ 
      success: true,
      listeners: listenersWithRating 
    });
  } catch (error) {
    console.error('Ошибка получения слушателей:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера' 
    });
  }
});

// Получение стикеров
router.get('/stickers', authenticateToken, async (req, res) => {
  try {
    const { data: stickers, error } = await supabase
      .from('stickers')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .order('created_at');

    if (error) throw error;

    res.json({ 
      success: true,
      stickers 
    });
  } catch (error) {
    console.error('Ошибка получения стикеров:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера' 
    });
  }
});

// Добавление отзыва
router.post('/review', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { chat_id, rating, comment } = req.body;

    if (!chat_id || !rating) {
      return res.status(400).json({ 
        success: false,
        error: 'Чат и оценка обязательны' 
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ 
        success: false,
        error: 'Оценка должна быть от 1 до 5' 
      });
    }

    // Проверяем чат
    const { data: chat } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chat_id)
      .eq('user_id', userId)
      .single();

    if (!chat) {
      return res.status(404).json({ 
        success: false,
        error: 'Чат не найден' 
      });
    }

    // Проверяем, не оставлял ли уже отзыв
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('chat_id', chat_id)
      .single();

    if (existingReview) {
      return res.status(400).json({ 
        success: false,
        error: 'Отзыв уже оставлен' 
      });
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

    res.json({ 
      success: true,
      review 
    });
  } catch (error) {
    console.error('Ошибка создания отзыва:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера' 
    });
  }
});

module.exports = router;
