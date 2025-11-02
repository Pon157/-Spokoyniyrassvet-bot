const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 10001;

// Middleware
app.use(express.json());
app.use(express.static('frontend'));

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Сервер работает!',
        timestamp: new Date().toISOString()
    });
});

// Аутентификация
app.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        console.log('🔐 Попытка входа:', username);
        
        if (!username || !password) {
            return res.json({ success: false, error: 'Заполните все поля' });
        }

        // Тестовые пользователи
        const testUsers = [
            { username: 'test', password: 'test', role: 'user' },
            { username: 'admin', password: 'admin', role: 'admin' },
            { username: 'listener', password: 'listener', role: 'listener' },
            { username: 'vitechek', password: '123', role: 'user' }
        ];

        const user = testUsers.find(u => u.username === username && u.password === password);
        
        if (user) {
            return res.json({
                success: true,
                token: `${username}-token`,
                user: {
                    id: username === 'vitechek' ? '1' : '2',
                    username: username,
                    role: user.role,
                    avatar_url: '/images/default-avatar.svg',
                    bio: 'Добро пожаловать в чат!'
                }
            });
        }

        res.json({ success: false, error: 'Неверные данные' });

    } catch (error) {
        res.json({ success: false, error: 'Ошибка входа' });
    }
});

app.get('/auth/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) return res.json({ success: false, error: 'Нет токена' });

        // Простая проверка токена
        if (token.includes('-token')) {
            const username = token.replace('-token', '');
            
            return res.json({
                success: true,
                user: {
                    id: '1',
                    username: username,
                    role: username === 'admin' ? 'admin' : 'user',
                    avatar_url: '/images/default-avatar.svg',
                    bio: 'Добро пожаловать в чат!'
                }
            });
        }

        res.json({ success: false, error: 'Неверный токен' });

    } catch (error) {
        res.json({ success: false, error: 'Ошибка проверки' });
    }
});

// Chat endpoints
app.get('/chat/chats', async (req, res) => {
    try {
        const mockChats = [
            {
                id: '1',
                partner_name: 'Анна Слушатель',
                partner_avatar: '/images/default-avatar.svg',
                partner_online: true,
                last_message: 'Привет! Как твои дела?',
                last_message_time: new Date().toISOString(),
                unread_count: 2
            },
            {
                id: '2', 
                partner_name: 'Максим Помощник',
                partner_avatar: '/images/default-avatar.svg',
                partner_online: false,
                last_message: 'Спасибо за обращение!',
                last_message_time: new Date(Date.now() - 3600000).toISOString(),
                unread_count: 0
            }
        ];

        res.json({ success: true, chats: mockChats });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/chat/listeners', async (req, res) => {
    try {
        const mockListeners = [
            {
                id: '1',
                username: 'Анна Слушатель',
                avatar_url: '/images/default-avatar.svg',
                is_online: true,
                avg_rating: 4.8,
                reviews_count: 24
            },
            {
                id: '2',
                username: 'Максим Помощник', 
                avatar_url: '/images/default-avatar.svg',
                is_online: false,
                avg_rating: 4.9,
                reviews_count: 31
            }
        ];

        res.json({ success: true, listeners: mockListeners });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/chat/stickers', async (req, res) => {
    const stickers = [
        { id: 1, name: 'Like', url: '/images/default-avatar.svg', category: 'reactions' },
        { id: 2, name: 'Heart', url: '/images/default-avatar.svg', category: 'reactions' },
        { id: 3, name: 'Laugh', url: '/images/default-avatar.svg', category: 'reactions' }
    ];
    res.json({ success: true, stickers });
});

app.post('/chat/create', async (req, res) => {
    try {
        const newChat = {
            id: Date.now().toString(),
            partner_name: 'Новый слушатель',
            partner_avatar: '/images/default-avatar.svg',
            partner_online: true,
            last_message: 'Чат начат',
            last_message_time: new Date().toISOString(),
            unread_count: 0
        };

        res.json({ success: true, chat: newChat });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Ошибка создания чата' });
    }
});

// WebSocket с простой аутентификацией
io.on('connection', (socket) => {
    console.log('🔌 Новое WebSocket подключение:', socket.id);

    socket.on('authenticate', (data) => {
        console.log('🔐 Аутентификация WebSocket:', data);
        socket.emit('authenticated', { success: true });
    });

    socket.on('send_message', (data) => {
        console.log('💬 Новое сообщение:', data);
        
        const mockMessage = {
            id: Date.now().toString(),
            chat_id: data.chat_id,
            sender_id: 'current-user',
            content: data.content,
            message_type: data.message_type || 'text',
            created_at: new Date().toISOString(),
            sender: {
                username: 'Вы',
                avatar_url: '/images/default-avatar.svg'
            }
        };

        // Эмитируем обратно тому же пользователю (имитация отправки)
        socket.emit('new_message', mockMessage);
        socket.emit('message_sent', { success: true });
    });

    socket.on('join_chat', (chatId) => {
        console.log('📨 Присоединение к чату:', chatId);
        socket.join(`chat:${chatId}`);
    });

    socket.on('disconnect', () => {
        console.log('🔌 Отключение:', socket.id);
    });
});

// Статические файлы
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/chat.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'chat.html'));
});

app.get('/settings.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'settings.html'));
});

// Запуск сервера
server.listen(PORT, '0.0.0.0', () => {
    console.log('🎉 СЕРВЕР ЗАПУЩЕН!');
    console.log(`📍 Порт: ${PORT}`);
    console.log('🔑 Тестовые пользователи:');
    console.log('   👤 vitechek / 123');
    console.log('   👤 test / test');
    console.log('   👑 admin / admin');
    console.log('   🎧 listener / listener');
});
