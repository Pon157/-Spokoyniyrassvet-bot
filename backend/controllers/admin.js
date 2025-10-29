const express = require('express');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const { requireRole } = require('../middleware');

const router = express.Router();

router.use(requireRole(['admin', 'coowner', 'owner']));

// Статистика системы
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalListeners = await User.countDocuments({ role: 'listener' });
    const totalChats = await Chat.countDocuments();
    const totalMessages = await Message.countDocuments();

    res.json({
      totalUsers,
      totalListeners,
      totalChats,
      totalMessages
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});

// Все пользователи
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
});

module.exports = router;
