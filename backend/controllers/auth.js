const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const { logAction } = require('../middleware');

const router = express.Router();

// Упрощенный клиент Supabase
let supabase;
try {
  supabase = createClient(
    process.env.SUPABASE_URL || 'https://your-project.supabase.co',
    process.env.SUPABASE_ANON_KEY || 'your-anon-key'
  );
} catch (error) {
  console.warn('⚠️ Supabase client failed, using mock data');
  supabase = {
    from: () => ({
      select: () => Promise.resolve({ data: null, error: null }),
      insert: () => Promise.resolve({ data: [{ id: 'mock-user' }], error: null }),
      update: () => Promise.resolve({ error: null })
    })
  };
}

// Генерация JWT токена
const generateToken = (userId, userData) => {
  return jwt.sign({ 
    userId,
    username: userData.username,
    email: userData.email,
    role: userData.role
  }, process.env.JWT_SECRET || 'fallback-secret-key', {
    expiresIn: '30d'
  });
};

// Регистрация
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role = 'user' } = req.body;

    // Валидация
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Имя пользователя должно содержать минимум 3 символа' });
    }

    // Создаем пользователя
    const userId = 'user-' + Date.now();
    
    const user = {
      id: userId,
      username,
      email,
      role: role, // Сохраняем выбранную роль
      avatar_url: null,
      theme: 'light',
      is_online: true,
      created_at: new Date().toISOString()
    };

    const token = generateToken(userId, user);

    await logAction(userId, 'REGISTER', { username, email, role });

    res.json({
      token,
      user,
      redirectTo: getRedirectPath(role)
    });
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Вход
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    // Определяем роль по email для тестирования
    let role = 'user';
    if (email.includes('admin')) role = 'admin';
    else if (email.includes('owner')) role = 'owner';
    else if (email.includes('coowner')) role = 'coowner';
    else if (email.includes('listener')) role = 'listener';

    const userId = 'user-' + Date.now();
    
    const user = {
      id: userId,
      username: email.split('@')[0],
      email: email,
      role: role,
      avatar_url: null,
      theme: 'light',
      is_online: true,
      created_at: new Date().toISOString()
    };

    const token = generateToken(userId, user);

    await logAction(userId, 'LOGIN', { email, role });

    res.json({
      token,
      user,
      redirectTo: getRedirectPath(role)
    });
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Проверка токена
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Токен отсутствует' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');
      
      const user = {
        id: decoded.userId || 'user-1',
        username: decoded.username || 'user',
        email: decoded.email || 'user@test.com',
        role: decoded.role || 'user',
        avatar_url: null,
        theme: 'light',
        is_online: true,
        is_blocked: false,
        is_muted: false
      };

      res.json({ 
        user,
        redirectTo: getRedirectPath(user.role)
      });
    } catch (jwtError) {
      // Если токен невалиден, возвращаем тестового пользователя
      const user = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@test.com',
        role: 'user',
        avatar_url: null,
        theme: 'light',
        is_online: true,
        is_blocked: false,
        is_muted: false
      };
      
      res.json({ user, redirectTo: getRedirectPath('user') });
    }
  } catch (error) {
    console.error('Ошибка проверки токена:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Функция определения пути редиректа
function getRedirectPath(role) {
  const routes = {
    'user': '/chat.html',
    'listener': '/chat.html',
    'admin': '/admin.html',
    'coowner': '/coowner.html',
    'owner': '/owner.html'
  };
  return routes[role] || '/chat.html';
}

// Выход
router.post('/logout', async (req, res) => {
  try {
    const userId = req.user?.id || 'unknown';
    await logAction(userId, 'LOGOUT');
    res.json({ message: 'Успешный выход' });
  } catch (error) {
    console.error('Ошибка выхода:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
