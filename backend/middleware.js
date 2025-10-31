const jwt = require('jsonwebtoken');
const { supabase } = require('./db');

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
        
        // Проверяем что пользователь все еще существует и активен
        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, role, is_active, is_blocked')
            .eq('id', decoded.userId)
            .single();

        if (error || !user) {
            return res.status(403).json({ error: 'User not found' });
        }

        if (user.is_blocked) {
            return res.status(403).json({ error: 'Account is blocked' });
        }

        if (!user.is_active) {
            return res.status(403).json({ error: 'Account is deactivated' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// Middleware для проверки ролей
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                error: 'Insufficient permissions',
                required: allowedRoles,
                current: req.user.role
            });
        }

        next();
    };
};

// Специфичные middleware для ролей
const requireUser = requireRole(['user']);
const requireListener = requireRole(['listener']);
const requireAdmin = requireRole(['admin', 'coowner', 'owner']);
const requireCoOwner = requireRole(['coowner', 'owner']);
const requireOwner = requireRole(['owner']);

module.exports = {
    authenticateToken,
    requireRole,
    requireUser,
    requireListener,
    requireAdmin,
    requireCoOwner,
    requireOwner
};
