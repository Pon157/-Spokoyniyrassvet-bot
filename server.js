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

// Подключение к БД - БЕЗ ВЫЗОВА connectDB()
const { supabase } = require('./backend/db');
console.log('✅ Database module loaded');

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Корневой путь
app.get('/', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Chat System API is running',
        endpoints: [
            '/health',
            '/chat',
            '/admin', 
            '/setup-demo',
            '/auth/login',
            '/auth/register'
        ]
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

// Создание тестовых пользователей
app.post('/setup-demo', async (req, res) => {
    try {
        const bcrypt = require('bcryptjs');
        const { supabase } = require('./backend/db');
        
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

        // Добавляем пользователей
        const { data, error } = await supabase.from('users').insert(users);

        if (error) throw error;

        res.json({ 
            success: true, 
            message: 'Демо пользователи созданы',
            users: users.map(u => ({ username: u.username, password: 'password123', role: u.role }))
        });
    } catch (error) {
        console.error('Setup demo error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Обработка 404
app.use('*', (req, res) => {
    res.status(404).json({
        status: 'ERROR',
        message: 'Route not found',
        path: req.originalUrl
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});
