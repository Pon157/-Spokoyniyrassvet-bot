const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

// Создаем клиент Supabase (если переменные окружения не установлены, используем заглушку)
let supabase;
try {
  supabase = createClient(
    process.env.SUPABASE_URL || 'https://your-project.supabase.co',
    process.env.SUPABASE_ANON_KEY || 'your-anon-key'
  );
} catch (error) {
  console.warn('⚠️ Supabase client creation failed, using fallback');
  supabase = {
    from: () => ({
      select: () => Promise.resolve({ data: null, error: null }),
      insert: () => Promise.resolve({ error: null }),
      update: () => Promise.resolve({ error: null })
    })
  };
}

// Упрощенная аутентификация для тестирования
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // Для тестирования пропускаем аутентификацию
    req.user = { 
      id: 'test-user-id', 
      username: 'testuser',
      email: 'test@test.com',
      role: 'user',
      is_online: true,
      avatar_url: null
    };
    return next();
  }

  try {
    // Простая проверка токена
    if (token.startsWith('test-token-')) {
      req.user = {
        id: 'user-' + Date.now(),
        username: 'testuser',
        email: 'test@test.com', 
        role: 'user',
        is_online: true,
        avatar_url: null
      };
    } else {
      // Пытаемся проверить JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');
      req.user = {
        id: decoded.userId || 'user-' + Date.now(),
        username: decoded.username || 'user',
        email: decoded.email || 'user@test.com',
        role: decoded.role || 'user',
        is_online: true,
        avatar_url: null
      };
    }
    next();
  } catch (error) {
    console.error('Auth error:', error);
    // Все равно пропускаем для тестирования
    req.user = {
      id: 'fallback-user',
      username: 'user',
      email: 'user@test.com',
      role: 'user',
      is_online: true,
      avatar_url: null
    };
    next();
  }
};

// Проверка ролей
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    next();
  };
};

// Логирование действий
const logAction = async (userId, action, details = {}) => {
  try {
    console.log(`📝 Action: ${action} by ${userId}`, details);
    // Пропускаем запись в базу для тестирования
  } catch (error) {
    console.error('Logging error:', error);
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  logAction
};
