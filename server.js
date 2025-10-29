const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Импорт модулей
const connectDB = require('./backend/db');
const authRoutes = require('./backend/auth');
const userController = require('./backend/controllers/user');
const listenerController = require('./backend/controllers/listener');
const adminController = require('./backend/controllers/admin');
const coownerController = require('./backend/controllers/coowner');
const ownerController = require('./backend/controllers/owner');
const setupSockets = require('./backend/sockets');
const { authenticateToken } = require('./backend/middleware');

const app = express();
const server = http.createServer(app);

// Настройка CORS для Render
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Подключение к БД
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Статические файлы
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/css', express.static(path.join(__dirname, 'frontend/css')));
app.use('/js', express.static(path.join(__dirname, 'frontend/js')));
app.use('/images', express.static(path.join(__dirname, 'frontend/images')));

// Маршруты аутентификации
app.use('/auth', authRoutes);

// API маршруты
app.use('/api/user', authenticateToken, userController);
app.use('/api/listener', authenticateToken, listenerController);
app.use('/api/admin', authenticateToken, adminController);
app.use('/api/coowner', authenticateToken, coownerController);
app.use('/api/owner', authenticateToken, ownerController);

// Статические маршруты
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/chat.html'));
});

app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/settings.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/admin.html'));
});

app.get('/coowner', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/coowner.html'));
});

app.get('/owner', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/owner.html'));
});

// Health check для Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Настройка WebSocket
setupSockets(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
