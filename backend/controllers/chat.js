const express = require('express');
const multer = require('multer');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Временные функции вместо импорта
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false,
      error: 'Токен отсутствует' 
    });
  }
  
  // Простая проверка - всегда пропускаем
  req.user = { userId: 'temp-user-id', role: 'user' };
  next();
};

const logAction = async (userId, action, details) => {
  console.log(`📝 Action: ${action} by ${userId}`, details);
};

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
        user1:users!chats_user1_id_fkey(id, username, avatar_url, is_online),
        user2:users!chats_user2_id_fkey(id, username, avatar_url, is_online)
      `)
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    const { data: chats, error } = await query;

    if (error) throw error;

    // Форматируем данные чатов
    const formattedChats = chats ? chats.map(chat => {
      const isUser1 = chat.user1_id === userId;
      const partner = isUser1 ? chat.user2 : chat.user1;
      
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
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
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
      user1_id: req.user.role === 'user' ? userId : listenerId,
      user2_id: req.user.role === 'listener' ? userId : listenerId,
      status: 'active'
    };

    const { data: chat, error } = await supabase
      .from('chats')
      .insert(chatData)
      .select(`
        *,
        user1:users!chats_user1_id_fkey(id, username, avatar_url, is_online),
        user2:users!chats_user2_id_fkey(id, username, avatar_url, is_online)
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
      .eq('user1_id', userId)
      .eq('user2_id', listener_id)
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
      user1_id: userId,
      user2_id: listener_id,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: chat, error } = await supabase
      .from('chats')
      .insert(chatData)
      .select(`
        *,
        user1:users!chats_user1_id_fkey(id, username, avatar_url),
        user2:users!chats_user2_id_fkey(id, username, avatar_url)
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
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
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

// Получение списка слушателей
router.get('/listeners', authenticateToken, async (req, res) => {
  try {
    const { data: listeners, error } = await supabase
      .from('users')
      .select(`
        id,
        username,
        avatar_url,
        rating,
        specialties,
        bio,
        is_online
      `)
      .eq('role', 'listener')
      .eq('is_blocked', false)
      .order('is_online', { ascending: false });

    if (error) throw error;

    const formattedListeners = listeners ? listeners.map(listener => ({
      id: listener.id,
      username: listener.username,
      avatar_url: listener.avatar_url || '/images/default-avatar.svg',
      is_online: listener.is_online,
      rating: listener.rating || 4.5,
      specialties: listener.specialties || ['Психология'],
      bio: listener.bio || 'Профессиональный слушатель'
    })) : [];

    res.json({ 
      success: true,
      listeners: formattedListeners 
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
      stickers: stickers || []
    });
  } catch (error) {
    console.error('Ошибка получения стикеров:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера' 
    });
  }
});

module.exports = router;
