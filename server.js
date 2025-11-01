const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Проверяем environment variables
console.log('🔧 Проверка environment variables...');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Установлен' : '❌ Отсутствует');
console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '✅ Установлен' : '❌ Отсутствует');

// Проверяем наличие обязательных переменных
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Отсутствуют Supabase environment variables');
  console.error('Пожалуйста, установите:');
  console.error('SUPABASE_URL=ваш_supabase_url');
  console.error('SUPABASE_SERVICE_KEY=ваш_service_key');
  process.exit(1);
}

// Инициализация Supabase с проверкой
let supabase;
try {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  console.log('✅ Supabase инициализирован');
} catch (error) {
  console.error('❌ Ошибка инициализации Supabase:', error.message);
  process.exit(1);
}

// Настройка CORS
const io = socketIo(server, {
  cors: {
    origin: ["http://spokoyniyrassvet.webtm.ru", "https://spokoyniyrassvet.webtm.ru"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Middleware
app.use(cors({
  origin: ["http://spokoyniyrassvet.webtm.ru", "https://spokoyniyrassvet.webtm.ru"],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Функция для безопасного создания папок
const createDirectories = () => {
  const folders = [
    './frontend/media/avatars',
    './frontend/media/uploads', 
    './frontend/media/stickers',
    './frontend/images'
  ];
  
  folders.forEach(folder => {
    try {
      if (fs.existsSync(folder)) {
        const stats = fs.statSync(folder);
        if (!stats.isDirectory()) {
          console.warn(`⚠️  ${folder} существует как файл, переименовываем...`);
          const backupPath = `${folder}.backup_${Date.now()}`;
          fs.renameSync(folder, backupPath);
          console.log(`✅ Файл переименован в: ${backupPath}`);
        }
      }
      
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
        console.log(`✅ Создана папка: ${folder}`);
      }
    } catch (error) {
      console.error(`❌ Ошибка создания папки ${folder}:`, error.message);
    }
  });
};

// Создаем папки
createDirectories();

// Статические файлы
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/css', express.static(path.join(__dirname, 'frontend', 'css')));
app.use('/js', express.static(path.join(__dirname, 'frontend', 'js')));
app.use('/images', express.static(path.join(__dirname, 'frontend', 'images')));
app.use('/media', express.static(path.join(__dirname, 'frontend', 'media')));

// Middleware для логирования запросов
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Middleware для аутентификации
const authenticateToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    // Ищем пользователя по токену (в данном случае токен - это user ID)
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', token)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Неверный токен' });
    }

    if (user.is_blocked) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Ошибка аутентификации' });
  }
};

// Middleware для проверки ролей
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Пользователь не аутентифицирован' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    next();
  };
};

// API Routes
// Аутентификация
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Заполните все поля' });
    }

    // Ищем пользователя по username или telegram_username
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .or(`username.eq.${username},telegram_username.eq.${username}`)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    // Проверяем пароль (в реальном приложении используйте bcrypt)
    if (user.password_hash !== password) {
      return res.status(401).json({ error: 'Неверный пароль' });
    }

    if (user.is_blocked) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }

    // Обновляем статус онлайн
    await supabase
      .from('users')
      .update({ is_online: true, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    // Логируем вход
    await supabase
      .from('system_logs')
      .insert([
        {
          user_id: user.id,
          action: 'user_login',
          details: { method: 'username_password', username: username },
          ip_address: req.ip
        }
      ]);

    res.json({
      success: true,
      token: user.id, // Используем ID как токен
      user: {
        id: user.id,
        username: user.username,
        telegram_username: user.telegram_username,
        role: user.role,
        avatar_url: user.avatar_url,
        theme: user.theme
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

app.post('/auth/register', async (req, res) => {
  try {
    const { username, telegram_username, password, confirmPassword } = req.body;

    // Валидация
    if (!username || username.length < 2) {
      return res.status(400).json({ error: 'Имя пользователя должно содержать минимум 2 символа' });
    }

    if (!telegram_username || !telegram_username.startsWith('@')) {
      return res.status(400).json({ error: 'Telegram username должен начинаться с @' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Пароли не совпадают' });
    }

    // Проверяем существование пользователя
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('username, telegram_username')
      .or(`username.eq.${username},telegram_username.eq.${telegram_username}`);

    if (checkError) {
      throw new Error('Ошибка проверки пользователя');
    }

    if (existingUsers && existingUsers.length > 0) {
      const existing = existingUsers[0];
      if (existing.username === username) {
        return res.status(400).json({ error: 'Имя пользователя уже занято' });
      }
      if (existing.telegram_username === telegram_username) {
        return res.status(400).json({ error: 'Telegram username уже используется' });
      }
    }

    // Создаем пользователя
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([
        {
          username: username,
          telegram_username: telegram_username,
          password_hash: password, // В продакшене: await bcrypt.hash(password, 10)
          role: 'user',
          theme: 'light',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (createError) {
      throw new Error('Ошибка создания пользователя: ' + createError.message);
    }

    // Логируем регистрацию
    await supabase
      .from('system_logs')
      .insert([
        {
          user_id: newUser.id,
          action: 'user_registration',
          details: { username: username, telegram_username: telegram_username },
          ip_address: req.ip
        }
      ]);

    res.json({
      success: true,
      message: 'Регистрация успешна! Вы можете войти.',
      user: {
        id: newUser.id,
        username: newUser.username,
        telegram_username: newUser.telegram_username,
        role: newUser.role
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Ошибка регистрации: ' + error.message });
  }
});

app.post('/auth/forgot-password', async (req, res) => {
  try {
    const { telegram_username } = req.body;

    if (!telegram_username || !telegram_username.startsWith('@')) {
      return res.status(400).json({ error: 'Введите корректный Telegram username' });
    }

    // Ищем пользователя по Telegram
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, telegram_username')
      .eq('telegram_username', telegram_username)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'Пользователь с таким Telegram не найден' });
    }

    // Создаем уведомление
    await supabase
      .from('notifications')
      .insert([
        {
          user_id: user.id,
          title: 'Восстановление пароля',
          message: 'Запрос на восстановление пароля получен. Ожидайте сообщение в Telegram.',
          notification_type: 'info'
        }
      ]);

    res.json({
      success: true,
      message: 'Ожидайте, в течение дня вам напишут в личные сообщения Telegram с вашим паролем'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Ошибка восстановления пароля' });
  }
});

app.get('/auth/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      telegram_username: req.user.telegram_username,
      role: req.user.role,
      avatar_url: req.user.avatar_url,
      theme: req.user.theme
    }
  });
});

// Пользовательские маршруты
app.get('/user/profile', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

app.put('/user/profile', authenticateToken, async (req, res) => {
  try {
    const { username, theme } = req.body;
    
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        username: username,
        theme: theme,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      user: updatedUser
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
});

// Админские маршруты (пример)
app.get('/admin/users', authenticateToken, requireRole(['admin', 'coowner', 'owner']), async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, telegram_username, role, is_online, is_blocked, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      users: users
    });

  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Ошибка загрузки пользователей' });
  }
});

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// HTML страницы с проверкой авторизации
const servePage = (page, ...middlewares) => {
  app.get(`/${page}`, ...middlewares, (req, res) => {
    try {
      res.sendFile(path.join(__dirname, 'frontend', page));
    } catch (error) {
      console.error(`❌ Ошибка загрузки страницы ${page}:`, error);
      res.status(500).send('Ошибка загрузки страницы');
    }
  });
};

// Защищенные страницы
servePage('chat.html', authenticateToken);
servePage('admin.html', authenticateToken, requireRole(['admin', 'coowner', 'owner']));
servePage('owner.html', authenticateToken, requireRole(['owner']));
servePage('coowner.html', authenticateToken, requireRole(['coowner', 'owner']));
servePage('listener.html', authenticateToken, requireRole(['listener', 'admin', 'coowner', 'owner']));
servePage('settings.html', authenticateToken);

// Health check
app.get('/health', async (req, res) => {
  try {
    // Проверяем подключение к Supabase
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      database: error ? 'ERROR' : 'CONNECTED',
      version: '2.0.0'
    });
  } catch (error) {
    res.json({ 
      status: 'ERROR', 
      timestamp: new Date().toISOString(),
      database: 'ERROR',
      error: error.message
    });
  }
});

// WebSocket подключения
io.on('connection', (socket) => {
  console.log('🔌 Новое WebSocket подключение:', socket.id);
  
  socket.on('authenticate', async (token) => {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', token)
        .single();

      if (error || !user) {
        socket.emit('auth_error', { error: 'Неверный токен' });
        return;
      }

      socket.userId = user.id;
      socket.user = user;
      
      // Обновляем статус онлайн
      await supabase
        .from('users')
        .update({ is_online: true })
        .eq('id', user.id);

      socket.emit('authenticated', {
        user: {
          id: user.id,
          username: user.username,
          telegram_username: user.telegram_username,
          role: user.role,
          avatar_url: user.avatar_url
        }
      });

      console.log(`✅ Пользователь ${user.username} аутентифицирован через WebSocket`);

    } catch (error) {
      console.error('WebSocket auth error:', error);
      socket.emit('auth_error', { error: 'Ошибка аутентификации' });
    }
  });
  
  socket.on('send_message', async (data) => {
    try {
      if (!socket.userId) {
        socket.emit('error', { error: 'Не аутентифицирован' });
        return;
      }

      const { data: message, error } = await supabase
        .from('messages')
        .insert([
          {
            chat_id: data.chat_id,
            sender_id: socket.userId,
            content: data.content,
            message_type: data.message_type || 'text',
            media_url: data.media_url,
            sticker_url: data.sticker_url,
            created_at: new Date().toISOString()
          }
        ])
        .select(`
          *,
          sender:users(id, username, telegram_username, avatar_url, role)
        `)
        .single();

      if (error) throw error;

      // Отправляем сообщение всем участникам чата
      socket.to(data.chat_id).emit('new_message', message);
      socket.emit('message_sent', message);

    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { error: 'Ошибка отправки сообщения' });
    }
  });
  
  socket.on('disconnect', async () => {
    console.log('🔌 WebSocket отключение:', socket.id);
    
    if (socket.userId) {
      // Обновляем статус оффлайн
      await supabase
        .from('users')
        .update({ is_online: false })
        .eq('id', socket.userId);
    }
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Working directory: ${__dirname}`);
  console.log(`🌐 DOMAIN: spokoyniyrassvet.webtm.ru`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`📊 Supabase: CONFIGURED`);
  console.log(`✅ SERVER READY - Telegram auth system operational!`);
});
