const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'listener', 'admin', 'coowner', 'owner'], default: 'user' },
  avatar: { type: String, default: '/images/default-avatar.png' },
  theme: { type: String, default: 'light' },
  createdAt: { type: Date, default: Date.now },
  isBanned: { type: Boolean, default: false },
  banReason: { type: String, default: '' }
});

module.exports = mongoose.model('User', UserSchema);


