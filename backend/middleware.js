const { createClient } = require('@supabase/supabase-js');

// Инициализация Supabase клиента
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

    // Получаем пользователя из базы по ID (токен = user.id в вашей системе)
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', token)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Неверный токен' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Ошибка аутентификации:', error);
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
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    next();
  };
};

// Функция для логирования действий
const logAction = async (userId, action, details = {}) => {
  try {
    const { error } = await supabase
      .from('user_actions')
      .insert({
        user_id: userId,
        action: action,
        details: details,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Ошибка логирования:', error);
    }
    
    console.log(`📝 Action: ${action} by ${userId}`);
  } catch (error) {
    console.error('Ошибка логирования:', error);
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  logAction
};
