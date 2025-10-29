const express = require('express');
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

module.exports = router;
