const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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

// Подключение к БД
const { supabase } = require('./backend/db');
console.log('✅ Database module loaded');

// Health check для Render
app.get('/health', (req, res) => {
    res.status(200).set('Content-Type', 'application/json');
    res.json({ 
        status: 'OK', 
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Простой health check
app.get('/health.txt', (req, res) => {
    res.status(200).set('Content-Type', 'text/plain');
    res.send('OK');
});

app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// Корневой путь
app.get('/', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Chat System API is running',
        endpoints: [
            '/health',
            '/ping',
            '/chat',
            '/admin', 
            '/setup-demo',
            '/auth/login',
            '/auth/register'
        ]
    });
});

// ВРЕМЕННЫЕ AUTH ROUTES - пока не починим auth.js
app.post('/auth/register', async (req, res) => {
    try {
        const { username, email, password, role = 'user' } = req.body;
        
        console.log('Registration attempt:', { username, email, role });
        
        const hashedPassword = await bcrypt.hash(password, 12);

        const { data, error } = await supabase
            .from('users')
            .insert([{ 
                username, 
                email, 
                password: hashedPassword, 
                role,
                created_at: new Date().toISOString(),
                is_active: true,
                is_online: false,
                last_seen: new Date().toISOString()
            }])
            .select();

        if (error) {
            console.error('Supabase error:', error);
            if (error.code === '23505') {
                return res.status(400).json({ error: 'User already exists' });
            }
            throw error;
        }

        const token = jwt.sign(
            { userId: data[0].id, role: data[0].role },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '24h' }
        );

        res.json({
            message: 'User registered successfully',
            token,
            user: { id: data[0].id, username, email, role }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
});

app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log('Login attempt for:', email);

        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .limit(1);

        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, username: user.username, email: user.email, role: user.role }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
});

// Маршруты аутентификации (пробуем загрузить, но если ошибка - используем временные выше)
try {
    const authRoutes = require('./backend/auth');
    app.use('/auth', authRoutes);
    console.log('✅ Auth routes loaded');
} catch (error) {
    console.error('❌ Failed to load auth routes, using temporary routes:', error.message);
}

// API маршруты с обработкой ошибок
try {
    const { authenticateToken } = require('./backend/middleware');
    
    const loadController = (path, name) => {
        try {
            const controller = require(path);
            console.log(`✅ ${name} controller loaded`);
            return controller;
        } catch (error) {
            console.error(`❌ Failed to load ${name} controller:`, error.message);
            const router = express.Router();
            router.get('/test', (req, res) => res.json({ message: `${name} controller not loaded` }));
            return router;
        }
    };

    app.use('/api/user', authenticateToken, loadController('./backend/controllers/user', 'User'));
    app.use('/api/listener', authenticateToken, loadController('./backend/controllers/listener', 'Listener'));
    app.use('/api/admin', authenticateToken, loadController('./backend/controllers/admin', 'Admin'));
    app.use('/api/coowner', authenticateToken, loadController('./backend/controllers/coowner', 'CoOwner'));
    app.use('/api/owner', authenticateToken, loadController('./backend/controllers/owner', 'Owner'));
    
    console.log('✅ API routes loaded');
} catch (error) {
    console.error('❌ Failed to load middleware:', error.message);
}

// WebSocket с обработкой ошибок
try {
    require('./backend/sockets')(io);
    console.log('✅ WebSocket loaded');
} catch (error) {
    console.error('❌ Failed to load WebSocket:', error.message);
}

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

        if (error) {
            if (error.code === '23505') {
                return res.json({ 
                    success: true, 
                    message: 'Демо пользователи уже существуют',
                    users: users.map(u => ({ username: u.username, password: 'password123', role: u.role }))
                });
            }
            throw error;
        }

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
    console.log(`🔧 Health check: http://localhost:${PORT}/health`);
});
