const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Аутентификация по JWT токену
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');
    
    // Получаем данные пользователя из базы
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(403).json({ error: 'Неверный токен' });
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
    const { error } = await supabase
      .from('action_logs')
      .insert({
        user_id: userId,
        action,
        details,
        ip_address: details.ipAddress,
        user_agent: details.userAgent,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Logging error:', error);
    }
    
    console.log(`📝 Action: ${action} by ${userId}`, details);
  } catch (error) {
    console.error('Logging error:', error);
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  logAction
};
