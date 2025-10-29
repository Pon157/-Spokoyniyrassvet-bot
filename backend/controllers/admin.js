const express = require('express');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Log = require('../models/Log');
const { requireRole } = require('../middleware');

const router = express.Router();

router.use(requireRole(['admin', 'coowner', 'owner']));

router.get('/stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalListeners = await User.countDocuments({ role: 'listener' });
        const totalAdmins = await User.countDocuments({ role: { $in: ['admin', 'coowner', 'owner'] } });
        const totalChats = await Chat.countDocuments();
        const totalMessages = await Message.countDocuments();
        const activeChats = await Chat.countDocuments({ status: 'active' });

        res.json({
            totalUsers,
            totalListeners,
            totalAdmins,
            totalChats,
            totalMessages,
            activeChats
        });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения статистики' });
    }
});

router.get('/users', async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения пользователей' });
    }
});

router.get('/chats', async (req, res) => {
    try {
        const chats = await Chat.find()
            .populate('participants', 'username avatar role')
            .sort({ updatedAt: -1 });
        
        res.json(chats);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения чатов' });
    }
});

router.get('/chats/:chatId/messages', async (req, res) => {
    try {
        const messages = await Message.find({ chatId: req.params.chatId })
            .populate('senderId', 'username avatar role')
            .sort({ timestamp: 1 });
        
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения сообщений' });
    }
});

router.post('/users/:userId/block', async (req, res) => {
    try {
        const { reason } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.userId,
            { 
                isBlocked: true,
                blockedBy: req.user._id
            },
            { new: true }
        ).select('-password');

        const log = new Log({
            action: 'user_blocked',
            userId: req.user._id,
            targetId: req.params.userId,
            details: { reason },
            timestamp: new Date()
        });
        await log.save();

        res.json({ message: 'Пользователь заблокирован', user });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка блокировки пользователя' });
    }
});

router.post('/users/:userId/mute', async (req, res) => {
    try {
        const { reason, duration } = req.body;
        const expiresAt = new Date(Date.now() + duration * 60 * 1000);

        await User.findByIdAndUpdate(req.params.userId, {
            $push: {
                mutes: {
                    reason,
                    issuedBy: req.user._id,
                    expiresAt
                }
            }
        });

        const log = new Log({
            action: 'user_muted',
            userId: req.user._id,
            targetId: req.params.userId,
            details: { reason, duration, expiresAt },
            timestamp: new Date()
        });
        await log.save();

        res.json({ message: 'Пользователь замьючен', expiresAt });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка мута пользователя' });
    }
});

router.post('/users/:userId/warn', async (req, res) => {
    try {
        const { reason } = req.body;

        await User.findByIdAndUpdate(req.params.userId, {
            $push: {
                warnings: {
                    reason,
                    issuedBy: req.user._id
                }
            }
        });

        const log = new Log({
            action: 'user_warned',
            userId: req.user._id,
            targetId: req.params.userId,
            details: { reason },
            timestamp: new Date()
        });
        await log.save();

        res.json({ message: 'Предупреждение отправлено' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка отправки предупреждения' });
    }
});

module.exports = router;
