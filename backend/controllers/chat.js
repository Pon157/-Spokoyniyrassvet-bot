const express = require('express');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const { authenticateToken, requireRole } = require('../middleware');

const router = express.Router();

// Получить все чаты пользователя (с пагинацией)
router.get('/my-chats', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const chats = await Chat.find({
      participants: req.user._id,
      status: 'active'
    })
    .populate('participants', 'username avatar role rating isOnline lastSeen')
    .sort({ updatedAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    // Получить последние сообщения для каждого чата
    const chatsWithLastMessage = await Promise.all(
      chats.map(async (chat) => {
        const lastMessage = await Message.findOne({ chatId: chat._id })
          .sort({ timestamp: -1 })
          .populate('senderId', 'username');
        
        return {
          ...chat.toObject(),
          lastMessage: lastMessage || null
        };
      })
    );

    const total = await Chat.countDocuments({ participants: req.user._id });

    res.json({
      chats: chatsWithLastMessage,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения чатов' });
  }
});

// Получить всех слушателей с фильтрацией
router.get('/listeners', authenticateToken, async (req, res) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    
    const query = { 
      role: 'listener', 
      isActive: true,
      isBlocked: false 
    };

    if (search) {
      query.username = { $regex: search, $options: 'i' };
    }

    const listeners = await User.find(query)
      .select('username avatar rating totalReviews bio isOnline lastSeen')
      .sort({ rating: -1, isOnline: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      listeners,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения слушателей' });
  }
});

// Создать новый чат со слушателем
router.post('/create-with-listener', authenticateToken, async (req, res) => {
  try {
    const { listenerId } = req.body;

    // Проверяем, существует ли уже чат
    const existingChat = await Chat.findOne({
      participants: { $all: [req.user._id, listenerId] },
      status: 'active'
    });

    if (existingChat) {
      return res.json({ 
        chatId: existingChat._id,
        message: 'Чат уже существует'
      });
    }

    // Создаем новый чат
    const chat = new Chat({
      participants: [req.user._id, listenerId],
      status: 'active'
    });

    await chat.save();
    
    // Создаем приветственное сообщение
    const welcomeMessage = new Message({
      chatId: chat._id,
      senderId: req.user._id,
      content: 'Привет! Я хочу начать общение.',
      type: 'text'
    });

    await welcomeMessage.save();

    res.status(201).json({
      chatId: chat._id,
      message: 'Чат успешно создан'
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка создания чата' });
  }
});

module.exports = router;
