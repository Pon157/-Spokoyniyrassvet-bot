const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const router = express.Router();

// Регистрация
router.post('/register', async (req, res) => {
  try {
    const { username, password, role = 'user', bio = '' } = req.body;
    
    // Валидация
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Имя пользователя и пароль обязательны' 
      });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ 
        error: 'Имя пользователя должно быть от 3 до 20 символов' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Пароль должен быть не менее 6 символов' 
      });
    }

    // Проверка существующего пользователя
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    
    if (existingUser) {
      return res.status(400).json({ 
        error: 'Пользователь с таким именем уже существует' 
      });
    }

    // Создание пользователя
    const user = new User({
      username: username.toLowerCase(),
      password: password,
      role: ['user', 'listener'].includes(role) ? role : 'user',
      bio: bio,
      isOnline: true,
      lastSeen: new Date()
    });

    await user.save();

    // Создание JWT токена
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
        role: user.role,
        avatar: user.avatar,
        theme: user.theme,
        bio: user.bio,
        rating: user.rating,
        isOnline: user.isOnline
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
});

// Вход по имени пользователя
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
    }

    // Поиск пользователя
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(400).json({ error: 'Неверное имя пользователя или пароль' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }

    // Проверка пароля
    const isPasswordValid = await user.correctPassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Неверное имя пользователя или пароль' });
    }

    // Обновление статуса
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    // Создание JWT токена
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
        role: user.role,
        avatar: user.avatar,
        theme: user.theme,
        bio: user.bio,
        rating: user.rating,
        isOnline: user.isOnline
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
});

module.exports = router;
