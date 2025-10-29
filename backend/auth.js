const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const router = express.Router();

// Регистрация - только пользователь
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    console.log('Registration attempt:', { username, email });

    // Валидация
    if (!username || !email || !password) {
      return res.status(400).json({ 
        error: 'Все поля обязательны для заполнения' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Пароль должен  быть не менее 6 символов' 
      });
    }

    // Проверка существующего пользователя
    const existingUser = await User.findOne({ 
      $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        error: 'Пользователь с таким email или именем уже существует' 
      });
    }

    // Хеширование пароля
    const hashedPassword = await bcrypt.hash(password, 12);

    // Создание пользователя - ТОЛЬКО с ролью user
    const user = new User({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'user', // Все новые пользователи только как user
      avatar: '/images/default-avatar.png',
      theme: 'light',
      isActive: true,
      isOnline: true,
      lastSeen: new Date()
    });

    await user.save();

    // JWT токен
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'fallback-secret-key',
      { expiresIn: '30d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        theme: user.theme,
        isOnline: user.isOnline
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Ошибка при создании аккаунта' });
  }
});

// Вход
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('Login attempt:', email);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    // Поиск пользователя
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ error: 'Неверный email или пароль' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }

    // Проверка пароля
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Неверный email или пароль' });
    }

    // Обновление статуса
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    // JWT токен
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'fallback-secret-key',
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        theme: user.theme,
        isOnline: user.isOnline
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Ошибка при входе в систему' });
  }
});

module.exports = router;
