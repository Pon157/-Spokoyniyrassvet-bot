const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  createdAt: { type: Date, default: Date.now }
});

// Индексы для оптимизации запросов
ChatSchema.index({ users: 1 });

module.exports = mongoose.model('Chat', ChatSchema);

