const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Настройка CORS для TimeWeb
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
      // Проверяем, существует ли путь и является ли он папкой
      if (fs.existsSync(folder)) {
        const stats = fs.statSync(folder);
        if (!stats.isDirectory()) {
          console.warn(`⚠️  ${folder} существует как файл, а не папка. Переименовываем...`);
          const backupPath = `${folder}.backup_${Date.now()}`;
          fs.renameSync(folder, backupPath);
          console.log(`✅ Файл переименован в: ${backupPath}`);
        }
      }
      
      // Создаем папку если её нет
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
        console.log(`✅ Создана папка: ${folder}`);
      }
    } catch (error) {
      console.error(`❌ Ошибка создания папки ${folder}:`, error.message);
    }
  });
};

// Создаем папки при запуске
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

// Импорт маршрутов
try {
  const authRoutes = require('./controllers/auth');
  const userRoutes = require('./controllers/user');
  const chatRoutes = require('./controllers/chat');
  const adminRoutes = require('./controllers/admin');
  const ownerRoutes = require('./controllers/owner');
  const coownerRoutes = require('./controllers/coowner');
  const listenerRoutes = require('./controllers/listener');

  // Подключение middleware
  const { authenticateToken, requireRole } = require('./middleware');

  // Маршруты
  app.use('/auth', authRoutes);
  app.use('/user', authenticateToken, userRoutes);
  app.use('/chat', authenticateToken, chatRoutes);
  app.use('/admin', authenticateToken, requireRole(['admin', 'coowner', 'owner']), adminRoutes);
  app.use('/coowner', authenticateToken, requireRole(['coowner', 'owner']), coownerRoutes);
  app.use('/owner', authenticateToken, requireRole(['owner']), ownerRoutes);
  app.use('/listener', authenticateToken, requireRole(['listener', 'admin', 'coowner', 'owner']), listenerRoutes);

  console.log('✅ Все маршруты успешно загружены');
} catch (error) {
  console.error('❌ Ошибка загрузки маршрутов:', error);
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

// Применяем middleware к страницам
servePage('chat.html', authenticateToken);
servePage('admin.html', authenticateToken, requireRole(['admin', 'coowner', 'owner']));
servePage('owner.html', authenticateToken, requireRole(['owner']));
servePage('coowner.html', authenticateToken, requireRole(['coowner', 'owner']));
servePage('settings.html', authenticateToken);

// Health check с подробной информацией
app.get('/health', (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV,
    node_version: process.version,
    platform: process.platform
  };
  
  res.json(health);
});

// Проверка доступности маршрутов
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API работает корректно',
    timestamp: new Date().toISOString()
  });
});

// WebSocket подключения
try {
  require('./sockets')(io);
  console.log('✅ WebSocket обработчики загружены');
} catch (error) {
  console.error('❌ Ошибка загрузки WebSocket:', error);
}

// Обработка 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Маршрут не найден',
    path: req.originalUrl,
    method: req.method
  });
});

// Глобальный обработчик ошибок
app.use((error, req, res, next) => {
  console.error('🔥 Глобальная ошибка:', error);
  res.status(500).json({ 
    error: 'Внутренняя ошибка сервера',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Working directory: ${__dirname}`);
  console.log(`🌐 DOMAIN: ${process.env.DOMAIN || 'localhost'}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`✅ SERVER READY - All systems operational!`);
  
  // Проверяем доступность основных endpoint'ов
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 API Test: http://localhost:${PORT}/api/test`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
