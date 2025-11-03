const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Middleware для аутентификации по токену
const authenticateToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Токен доступа отсутствует' });
    }

    // Для простоты используем ID пользователя как токен
    // В реальном приложении здесь должна быть JWT валидация
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', token)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Неверный токен' });
    }

    if (user.is_blocked) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('❌ Ошибка аутентификации:', error);
    res.status(500).json({ error: 'Ошибка аутентификации' });
  }
};

// Middleware для проверки ролей
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Пользователь не аутентифицирован' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Недостаточно прав',
        required: roles,
        current: req.user.role
      });
    }

    next();
  };
};

// Логирование действий
const logAction = async (userId, action, details = {}) => {
  try {
    await supabase
      .from('action_logs')
      .insert({
        user_id: userId,
        action: action,
        details: details,
        ip_address: '127.0.0.1', // В реальном приложении получать из req.ip
        user_agent: 'server' // В реальном приложении получать из req.headers['user-agent']
      });
  } catch (error) {
    console.error('❌ Ошибка логирования действия:', error);
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  logAction
};
