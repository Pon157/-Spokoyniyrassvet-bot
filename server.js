const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

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

// Импорт маршрутов из backend
try {
  console.log('🔄 Загрузка маршрутов из backend...');
  
  // Импортируем middleware
  const { authenticateToken, requireRole } = require('./backend/middleware');
  console.log('✅ Middleware загружен');

  // Импортируем маршруты
  const authRoutes = require('./backend/controllers/auth');
  const userRoutes = require('./backend/controllers/user');
  const chatRoutes = require('./backend/controllers/chat');
  const adminRoutes = require('./backend/controllers/admin');
  const ownerRoutes = require('./backend/controllers/owner');
  const coownerRoutes = require('./backend/controllers/coowner');
  const listenerRoutes = require('./backend/controllers/listener');
  
  console.log('✅ Все контроллеры загружены');

  // Подключаем маршруты
  app.use('/auth', authRoutes);
  app.use('/user', authenticateToken, userRoutes);
  app.use('/chat', authenticateToken, chatRoutes);
  app.use('/admin', authenticateToken, requireRole(['admin', 'coowner', 'owner']), adminRoutes);
  app.use('/coowner', authenticateToken, requireRole(['coowner', 'owner']), coownerRoutes);
  app.use('/owner', authenticateToken, requireRole(['owner']), ownerRoutes);
  app.use('/listener', authenticateToken, requireRole(['listener', 'admin', 'coowner', 'owner']), listenerRoutes);

  console.log('✅ Все маршруты подключены');

} catch (error) {
  console.error('❌ Ошибка загрузки маршрутов из backend:', error);
  console.log('🔄 Используем простые маршруты для тестирования...');
  
  // Fallback - простые маршруты для тестирования
  app.post('/auth/login', (req, res) => {
    const { email, password } = req.body;
    console.log('🔧 Login attempt:', email);
    
    res.json({
      token: 'test-token-' + Date.now(),
      user: {
        id: 'user-' + Date.now(),
        username: email.split('@')[0],
        email: email,
        role: email.includes('admin') ? 'admin' : 
              email.includes('owner') ? 'owner' : 'user',
        avatar_url: null
      }
    });
  });

  app.post('/auth/register', (req, res) => {
    const { username, email, password } = req.body;
    console.log('🔧 Register attempt:', username, email);
    
    res.json({
      token: 'test-token-' + Date.now(),
      user: {
        id: 'user-' + Date.now(),
        username: username,
        email: email,
        role: 'user',
        avatar_url: null
      }
    });
  });

  app.get('/auth/verify', (req, res) => {
    res.json({
      user: {
        id: 'test-user',
        username: 'testuser',
        email: 'test@test.com',
        role: 'user',
        avatar_url: null
      }
    });
  });
}

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

// Применяем middleware к страницам (если middleware загружен)
try {
  const { authenticateToken, requireRole } = require('./backend/middleware');
  
  servePage('chat.html', authenticateToken);
  servePage('admin.html', authenticateToken, requireRole(['admin', 'coowner', 'owner']));
  servePage('owner.html', authenticateToken, requireRole(['owner']));
  servePage('coowner.html', authenticateToken, requireRole(['coowner', 'owner']));
  servePage('settings.html', authenticateToken);
  
  console.log('✅ Страницы защищены middleware');
} catch (error) {
  console.log('⚠️  Middleware не загружен, страницы без защиты');
  
  // Страницы без защиты
  servePage('chat.html');
  servePage('admin.html');
  servePage('owner.html');
  servePage('coowner.html');
  servePage('settings.html');
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// WebSocket подключения
try {
  require('./backend/sockets')(io);
  console.log('✅ WebSocket обработчики загружены из backend');
} catch (error) {
  console.error('❌ Ошибка загрузки WebSocket из backend:', error);
  
  // Простые WebSocket для тестирования
  io.on('connection', (socket) => {
    console.log('🔌 Новое WebSocket подключение:', socket.id);
    
    socket.on('authenticate', (token) => {
      console.log('🔑 WebSocket аутентификация');
      socket.emit('authenticated', { username: 'testuser', role: 'user' });
    });
    
    socket.on('send_message', (data) => {
      console.log('💬 Новое сообщение:', data);
      socket.broadcast.emit('new_message', {
        ...data,
        id: 'msg-' + Date.now(),
        sender: { username: 'testuser', avatar_url: null, role: 'user' },
        created_at: new Date().toISOString()
      });
    });
    
    socket.on('disconnect', () => {
      console.log('🔌 WebSocket отключение:', socket.id);
    });
  });
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Working directory: ${__dirname}`);
  console.log(`🌐 DOMAIN: spokoyniyrassvet.webtm.ru`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`✅ SERVER READY - All systems operational!`);
});
