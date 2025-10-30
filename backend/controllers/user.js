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
        }).select('username avatar lastSeen isOnline rating bio');
        
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

        // Обновление рейтинга слушателя
        const listenerReviews = await Review.find({ listenerId });
        const averageRating = listenerReviews.reduce((acc, review) => acc + review.rating, 0) / listenerReviews.length;
        
        await User.findByIdAndUpdate(listenerId, {
            rating: Math.round(averageRating * 10) / 10,
            totalReviews: listenerReviews.length
        });

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

// Создание чата со слушателем
router.post('/create-chat', async (req, res) => {
    try {
        const { listenerId } = req.body;

        // Проверяем существующий чат
        const existingChat = await Chat.findOne({
            participants: { $all: [req.user._id, listenerId] },
            status: 'active'
        });

        if (existingChat) {
            return res.json({ chatId: existingChat._id });
        }

        // Создаем новый чат
        const chat = new Chat({
            participants: [req.user._id, listenerId],
            status: 'active'
        });

        await chat.save();

        res.status(201).json({ chatId: chat._id });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка создания чата' });
    }
});

module.exports = router;
