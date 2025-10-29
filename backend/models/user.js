const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
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
    default: ''
  },
  theme: {
    type: String,
    default: 'light'
  },
  isActive: {
    type: Boolean,
    default: true
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
  blockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  blockReason: String,
  lastSeen: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);
