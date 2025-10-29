const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const connectDB = require('./db');
const authRoutes = require('./auth');
const userController = require('./controllers/user');
const listenerController = require('./controllers/listener');
const adminController = require('./controllers/admin');
const coownerController = require('./controllers/coowner');
const ownerController = require('./controllers/owner');
const setupSockets = require('./sockets');
const { authenticateToken } = require('./middleware');

const app = express();
const server = http.createServer(app);
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
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Маршруты аутентификации
app.use('/auth', authRoutes);

// API маршруты
app.use('/api/user', authenticateToken, userController);
app.use('/api/listener', authenticateToken, listenerController);
app.use('/api/admin', authenticateToken, adminController);
app.use('/api/coowner', authenticateToken, coownerController);
app.use('/api/owner', authenticateToken, ownerController);

// Статические файлы
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/chat.html'));
});

app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/settings.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

app.get('/coowner', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/coowner.html'));
});

app.get('/owner', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/owner.html'));
});

// Настройка WebSocket
setupSockets(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
