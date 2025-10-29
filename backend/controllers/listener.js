const express = require('express');
const Chat = require('../models/Chat');
const Review = require('../models/Review');
const { requireRole } = require('../middleware');

const router = express.Router();

router.use(requireRole(['listener', 'admin', 'coowner', 'owner']));

// Получение отзывов слушателя
router.get('/reviews', async (req, res) => {
  try {
    const reviews = await Review.find({ listenerId: req.user._id })
      .populate('userId', 'username avatar')
      .populate('chatId')
      .sort({ createdAt: -1 });
    
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения отзывов' });
  }
});

// Получение активных чатов слушателя
router.get('/active-chats', async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.user._id,
      status: 'active'
    }).populate('participants', 'username avatar role');
    
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения чатов' });
  }
});

module.exports = router;
