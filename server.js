=const express = require('express');
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

// Статические файлы
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/css', express.static(path.join(__dirname, 'frontend', 'css')));
app.use('/js', express.static(path.join(__dirname, 'frontend', 'js')));
app.use('/images', express.static(path.join(__dirname, 'frontend', 'images')));
app.use('/media', express.static(path.join(__dirname, 'frontend', 'media')));

// Создаем папки если их нет
const folders = ['./frontend/media/avatars', './frontend/media/uploads', './frontend/media/stickers'];
folders.forEach(folder => {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
});

// Импорт маршрутов
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

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// HTML страницы с проверкой авторизации
app.get('/chat.html', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'chat.html'));
});

app.get('/admin.html', authenticateToken, requireRole(['admin', 'coowner', 'owner']), (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'admin.html'));
});

app.get('/owner.html', authenticateToken, requireRole(['owner']), (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'owner.html'));
});

app.get('/coowner.html', authenticateToken, requireRole(['coowner', 'owner']), (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'coowner.html'));
});

app.get('/settings.html', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'settings.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV
  });
});

// WebSocket подключения
require('./sockets')(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 DOMAIN: ${process.env.DOMAIN}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV}`);
  console.log(`✅ SERVER READY - All systems operational!`);
});
