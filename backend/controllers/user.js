const express = require('express');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Review = require('../models/Review');

const router = express.Router();

// Получение слушателей
router.get('/listeners', async (req, res) => {
  try {
    const listeners = await User.find({ 
      role: 'listener', 
      isActive: true,
      isBlocked: false 
    }).select('username avatar lastSeen');
    
    res.json(listeners);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения слушателей' });
  }
});

// Создание отзыва
router.post('/review', async (req, res) => {
  try {
    const { listenerId, chatId, rating, comment } = req.body;
    
    const review = new Review({
      listenerId,
      userId: req.user._id,
      chatId,
      rating,
      comment
    });
    
    await review.save();
    res.json({ message: 'Отзыв успешно оставлен' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка создания отзыва' });
  }
});

// Получение чатов пользователя
router.get('/chats', async (req, res) => {
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
