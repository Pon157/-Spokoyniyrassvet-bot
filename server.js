const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'frontend')));

// Health check - дОЛЖЕН БЫТЬ ПЕРВЫМ
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Подключение к БД
const connectDB = require('./backend/db');
connectDB();

// Маршруты аутентификации
app.use('/auth', require('./backend/auth'));

// API маршруты
const { authenticateToken } = require('./backend/middleware');
app.use('/api/user', authenticateToken, require('./backend/controllers/user'));
app.use('/api/listener', authenticateToken, require('./backend/controllers/listener'));
app.use('/api/admin', authenticateToken, require('./backend/controllers/admin'));
app.use('/api/coowner', authenticateToken, require('./backend/controllers/coowner'));
app.use('/api/owner', authenticateToken, require('./backend/controllers/owner'));

// WebSocket
require('./backend/sockets')(io);

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

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
});
