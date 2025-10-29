const express = require('express');
const User = require('../models/User');
const Log = require('../models/Log');
const { requireRole } = require('../middleware');

const router = express.Router();

router.use(requireRole(['coowner', 'owner']));

router.post('/notifications', async (req, res) => {
    try {
        const { title, message, type } = req.body;
        
        const log = new Log({
            action: 'technical_notification_sent',
            userId: req.user._id,
            details: { title, message, type },
            timestamp: new Date()
        });
        await log.save();

        res.json({ message: 'Уведомление отправлено' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка отправки уведомления' });
    }
});

router.post('/users/:userId/assign-role', async (req, res) => {
    try {
        const { role } = req.body;
        const allowedRoles = ['listener', 'admin'];
        
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ error: 'Недопустимая роль' });
        }

        const user = await User.findByIdAndUpdate(
            req.params.userId,
            { role },
            { new: true }
        ).select('-password');

        const log = new Log({
            action: 'role_assigned',
            userId: req.user._id,
            targetId: req.params.userId,
            details: { newRole: role },
            timestamp: new Date()
        });
        await log.save();

        res.json({ message: 'Роль назначена', user });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка назначения роли' });
    }
});

router.get('/logs', async (req, res) => {
    try {
        const { page = 1, limit = 50, action } = req.query;
        const query = action ? { action } : {};
        
        const logs = await Log.find(query)
            .populate('userId', 'username')
            .populate('targetId', 'username')
            .sort({ timestamp: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
        
        const total = await Log.countDocuments(query);
        
        res.json({
            logs,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения логов' });
    }
});

router.post('/users/:userId/dismiss', async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.userId,
            { 
                role: 'user',
                isActive: false 
            },
            { new: true }
        ).select('-password');

        const log = new Log({
            action: 'user_dismissed',
            userId: req.user._id,
            targetId: req.params.userId,
            details: { previousRole: user.role },
            timestamp: new Date()
        });
        await log.save();

        res.json({ message: 'Пользователь уволен', user });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка увольнения пользователя' });
    }
});

module.exports = router;
