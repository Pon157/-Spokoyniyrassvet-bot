// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();

// Инициализация Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('🔐 Login attempt:', { username });

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Имя пользователя и пароль обязательны'
      });
    }

    // Ищем пользователя по username или telegram_username
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .or(`username.eq.${username},telegram_username.eq.${username}`)
      .single();

    if (error || !user) {
      console.log('❌ User not found:', username);
      return res.status(401).json({
        success: false,
        error: 'Неверное имя пользователя или пароль'
      });
    }

    // Проверяем пароль
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.log('❌ Invalid password for user:', username);
      return res.status(401).json({
        success: false,
        error: 'Неверное имя пользователя или пароль'
      });
    }

    // Создаем JWT токен
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    // Обновляем last_login
    await supabase
      .from('users')
      .update({
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    // Убираем пароль из ответа
    const { password: _, ...userWithoutPassword } = user;

    console.log('✅ Login successful:', user.username);
    
    res.json({
      success: true,
      token,
      user: userWithoutPassword,
      redirectTo: '/chat.html'
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, telegram_username, password, confirmPassword } = req.body;
    console.log('📝 Registration attempt:', { username, telegram_username });

    // Валидация
    if (!username || !telegram_username || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны для заполнения'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Пароли не совпадают'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Пароль должен содержать минимум 6 символов'
      });
    }

    if (!telegram_username.startsWith('@')) {
      return res.status(400).json({
        success: false,
        error: 'Telegram username должен начинаться с @'
      });
    }

    // Проверяем, существует ли пользователь
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .or(`username.eq.${username},telegram_username.eq.${telegram_username}`)
      .single();

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Пользователь с таким именем или Telegram уже существует'
      });
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 12);

    // Создаем пользователя
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        username,
        telegram_username,
        password: hashedPassword,
        role: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Registration error:', error);
      return res.status(500).json({
        success: false,
        error: 'Ошибка при создании пользователя'
      });
    }

    console.log('✅ Registration successful:', username);
    
    res.json({
      success: true,
      message: 'Регистрация успешна'
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

app.get('/api/auth/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Токен не предоставлен'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, role, telegram_username, created_at, last_login')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Пользователь не найден'
      });
    }

    res.json({
      success: true,
      user: user
    });

  } catch (error) {
    console.error('❌ Verify error:', error);
    res.status(401).json({
      success: false,
      error: 'Неверный токен'
    });
  }
});

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/chat.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

app.get('/listener.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'listener.html'));
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📍 Доступно по адресу: http://localhost:${PORT}`);
  console.log(`🔐 Auth endpoints:`);
  console.log(`   POST /api/auth/login`);
  console.log(`   POST /api/auth/register`);
  console.log(`   GET  /api/auth/verify`);
});
