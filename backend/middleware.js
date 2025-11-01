const jwt = require('jsonwebtoken');
const { supabase } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Проверка JWT токена
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Токен доступа отсутствует' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Проверяем что пользователь все еще существует
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, email, role, is_banned')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    if (user.is_banned) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Неверный токен' });
  }
};

// Проверка ролей
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Недостаточно прав',
        required: allowedRoles,
        current: req.user.role 
      });
    }

    next();
  };
};

// Специфичные проверки ролей
const requireAdmin = requireRole(['admin', 'coowner', 'owner']);
const requireCoOwner = requireRole(['coowner', 'owner']);
const requireOwner = requireRole(['owner']);
const requireListener = requireRole(['listener', 'admin', 'coowner', 'owner']);

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireCoOwner,
  requireOwner,
  requireListener
};
