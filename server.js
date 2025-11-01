const express = require('express');
const http = require('http');
const socketIo = require('socket.io'); // ДОБАВИТЬ ЭТУ СТРОКУ
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Исправленный CORS для Timeweb
app.use(cors({
    origin: "https://pon157-git--f288.twc1.net",
    credentials: true
}));

// WebSocket с правильным CORS
const io = socketIo(server, {
    cors: {
        origin: "https://pon157-git--f288.twc1.net",
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// Health checks
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

app.get('/ping', (req, res) => {
    res.send('pong');
});

// WebSocket подключение
io.on('connection', (socket) => {
    console.log('✅ User connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('❌ User disconnected:', socket.id);
    });

    // Простые WebSocket события для теста
    socket.on('create-chat', (data) => {
        console.log('Create chat:', data);
        socket.emit('chat-created', { chatId: 'chat-' + Date.now() });
    });

    socket.on('send-message', (data) => {
        console.log('Send message:', data);
        const message = {
            id: 'msg-' + Date.now(),
            ...data,
            timestamp: new Date().toISOString()
        };
        socket.emit('new-message', message);
    });

    socket.on('join-chat', (chatId) => {
        console.log('Join chat:', chatId);
        socket.join(chatId);
    });

    socket.on('get-messages', (chatId) => {
        console.log('Get messages:', chatId);
        const messages = [
            {
                id: 'msg-1',
                content: 'Тестовое сообщение',
                chatId: chatId,
                timestamp: new Date().toISOString()
            }
        ];
        socket.emit('messages-history', messages);
    });
});

// ПРОСТАЯ РЕГИСТРАЦИЯ
app.post('/auth/register', async (req, res) => {
    try {
        const { username, email, password, role = 'user' } = req.body;
        
        console.log('🔧 Registration attempt:', { username, email });
        
        // Простая валидация
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Создаем простого пользователя
        const userId = 'user-' + Date.now();
        const token = jwt.sign(
            { userId, role },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '24h' }
        );

        res.json({
            message: 'User registered successfully (DEMO MODE)',
            token,
            user: { id: userId, username, email, role }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ПРОСТОЙ ЛОГИН
app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log('🔧 Login attempt:', email);

        // Демо пользователи
        const demoUsers = {
            'owner@test.com': { password: 'password123', username: 'owner', role: 'owner' },
            'admin@test.com': { password: 'password123', username: 'admin', role: 'admin' },
            'listener@test.com': { password: 'password123', username: 'listener', role: 'listener' },
            'user@test.com': { password: 'password123', username: 'user', role: 'user' }
        };

        const user = demoUsers[email];
        
        if (!user || user.password !== password) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: 'demo-' + email, role: user.role },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful (DEMO MODE)',
            token,
            user: { id: 'demo-' + email, username: user.username, email, role: user.role }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Демо данные для тестирования
app.get('/api/user/listeners', (req, res) => {
    res.json([
        { id: 'listener-1', username: 'Listener1', rating: 4.5, bio: 'Готов помочь' },
        { id: 'listener-2', username: 'Listener2', rating: 4.8, bio: 'Выслушаю и поддержу' }
    ]);
});

// Статические страницы
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/chat.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/admin.html'));
});

app.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/settings.html'));
});

app.get('/coowner', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/coowner.html'));
});

app.get('/owner', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/owner.html'));
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ SERVER RUNNING ON PORT ${PORT}`);
    console.log(`🌐 DEMO MODE - Basic auth working`);
    console.log(`🔗 URL: https://pon157-git--f288.twc1.net`);
});
