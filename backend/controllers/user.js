const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const express = require('express');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Review = require('../models/Review');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'listener', 'admin', 'coowner', 'owner'],
    default: 'user'
  },
  avatar: {
    type: String,
    default: '/images/default-avatar.png'
  },
  theme: {
    type: String,
    default: 'light',
    enum: ['light', 'dark', 'blue', 'green', 'purple', 'orange']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  bio: {
    type: String,
    maxlength: 200,
    default: ''
  },
  rating: {
    type: Number,
    default: 0
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  warnings: [{
    reason: String,
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    issuedAt: {
      type: Date,
      default: Date.now
    }
  }],
  mutes: [{
    reason: String,
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    issuedAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: Date
  }],
  isBlocked: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
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

// Хеширование пароля перед сохранением
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
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

// Метод проверки пароля
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};
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

module.exports = mongoose.model('User', userSchema);
module.exports = router;
