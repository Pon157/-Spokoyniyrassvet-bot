const express = require('express');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const authMiddleware = require('../middleware');

const router = express.Router();

// Получить список диалогов пользователя
router.get('/chats', authMiddleware(['user', 'listener', 'admin', 'coowner', 'owner']), async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Найти все чаты, где пользователь — участник
    const chats = await Chat.aggregate([
      { $match: { users: userId } },
      {
        $lookup: {
          from: 'users',
          localField: 'users',
          foreignField: '_id',
          as: 'participants'
        }
      },
      {
        $addFields: {
          participant: {
            $arrayElemAt: [
              { $filter: { input: '$participants', as: 'p', cond: { $ne: ['$$p._id', userId] } } },
              0
            ]
          }
        }
      },
      {
        $lookup: {
          from: 'messages',
          let: { chatUsers: '$users' },
          pipeline: [
            { $match: { $expr: { $and: [
              { $in: ['$from', '$$chatUsers'] },
              { $in: ['$to', '$$chatUsers'] }
            ] } } },
            { $sort: { sentAt: -1 } },
            { $limit: 1 }
          ],
          as: 'lastMessage'
        }
      },
      {
        $addFields: {
          lastMessage: { $arrayElemAt: ['$lastMessage', 0] }
        }
      }
    ]);

    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Получить сообщения чата
router.get('/chats/:userId/messages', authMiddleware(['user', 'listener', 'admin', 'coowner', 'owner']), async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = req.params.userId;

    const messages = await Message.find({
      $or: [
        { from: currentUserId, to: targetUserId },
        { from: targetUserId, to: currentUserId }
      ]
    }).sort({ sentAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

