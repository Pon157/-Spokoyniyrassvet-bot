const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Настройка CORS
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Подключение к БД
const connectDB = require('./backend/db');
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Статические файлы
app.use(express.static(path.join(__dirname, 'frontend')));

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

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// ВРЕМЕННО - создание тестовых пользователей
app.post('/setup-demo', async (req, res) => {
    try {
        const bcrypt = require('bcryptjs');
        const User = require('./backend/models/User');
        
        const users = [
            {
                username: 'user',
                email: 'user@test.com',
                password: await bcrypt.hash('password123', 12),
                role: 'user'
            },
            {
                username: 'listener',
                email: 'listener@test.com', 
                password: await bcrypt.hash('password123', 12),
                role: 'listener'
            },
            {
                username: 'admin',
                email: 'admin@test.com',
                password: await bcrypt.hash('password123', 12),
                role: 'admin'
            },
            {
                username: 'owner',
                email: 'owner@test.com',
                password: await bcrypt.hash('password123', 12),
                role: 'owner'
            }
        ];

        await User.deleteMany({});
        await User.insertMany(users);

        res.json({ 
            success: true, 
            message: 'Демо пользователи созданы',
            users: users.map(u => ({ email: u.email, password: 'password123', role: u.role }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Обработка 404
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Маршрут не найден' });
});

// Обработка ошибок
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
});
