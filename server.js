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
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// Простые маршруты для тестирования
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

// Health check endpoint (ОБЯЗАТЕЛЬНО для Render)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Простой WebSocket для тестирования
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
  
  socket.on('chat-message', (data) => {
    io.emit('chat-message', data);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// ВРЕМЕННЫЙ МАРШРУТ - УДАЛИТЬ ПОСЛЕ СОЗДАНИЯ ПОЛЬЗОВАТЕЛЕЙ
app.post('/setup-test-users', async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const User = require('./backend/models/User');
    
    // Очистка старых тестовых пользователей
    await User.deleteMany({ 
      username: { $in: ['user1', 'listener1', 'admin1', 'coowner1', 'owner1'] } 
    });
    
    const testUsers = [
      {
        username: 'user1',
        password: await bcrypt.hash('password123', 12),
        role: 'user',
        bio: 'Обычный пользователь системы'
      },
      {
        username: 'listener1', 
        password: await bcrypt.hash('password123', 12),
        role: 'listener',
        bio: 'Профессиональный слушатель с опытом'
      },
      {
        username: 'listener2',
        password: await bcrypt.hash('password123', 12), 
        role: 'listener',
        bio: 'Готов выслушать и помочь'
      },
      {
        username: 'admin1',
        password: await bcrypt.hash('password123', 12),
        role: 'admin',
        bio: 'Администратор системы'
      },
      {
        username: 'coowner1',
        password: await bcrypt.hash('password123', 12),
        role: 'coowner', 
        bio: 'Совладелец платформы'
      },
      {
        username: 'owner1',
        password: await bcrypt.hash('password123', 12),
        role: 'owner',
        bio: 'Владелец системы'
      }
    ];
    
    await User.insertMany(testUsers);
    
    res.json({ 
      success: true, 
      message: 'Тестовые пользователи созданы',
      users: testUsers.map(u => ({ username: u.username, password: 'password123', role: u.role }))
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
