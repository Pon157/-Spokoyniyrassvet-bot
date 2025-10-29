const jwt = require('jsonwebtoken');
const User = require('./models/User');

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Токен доступа отсутствует' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');
        const user = await User.findById(decoded.userId);
        
        if (!user || user.isBlocked) {
            return res.status(403).json({ error: 'Пользователь не найден или заблокирован' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Недействительный токен' });
    }
};

const requireRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }
        next();
    };
};

module.exports = {
    authenticateToken,
    requireRole
};
