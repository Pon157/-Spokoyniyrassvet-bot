const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Импорты маршрутов
const authRoutes = require('./backend/controllers/auth');
const chatRoutes = require('./backend/controllers/chat');
const adminRoutes = require('./backend/controllers/admin');
const userRoutes = require('./backend/controllers/users');
const { authenticateToken } = require('./backend/middleware');
const { initSocket } = require('./backend/sockets');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Статические файлы
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/css', express.static(path.join(__dirname, 'frontend/css')));
app.use('/js', express.static(path.join(__dirname, 'frontend/js')));
app.use('/images', express.static(path.join(__dirname, 'frontend/images')));
app.use('/media', express.static(path.join(__dirname, 'frontend/media')));

// Маршруты
app.use('/auth', authRoutes);
app.use('/chat', authenticateToken, chatRoutes);
app.use('/admin', authenticateToken, adminRoutes);
app.use('/users', authenticateToken, userRoutes);

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// HTML страницы
app.get('/chat.html', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'chat.html'));
});

app.get('/admin.html', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'admin.html'));
});

app.get('/owner.html', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'owner.html'));
});

app.get('/coowner.html', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'coowner.html'));
});

app.get('/settings.html', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'settings.html'));
});

// Инициализация WebSocket
initSocket(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 Using Supabase: ${process.env.SUPABASE_URL ? 'Yes' : 'No'}`);
});
