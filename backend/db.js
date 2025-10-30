console.log('🔧 Environment variables:', {
  hasMONGODB_URI: !!process.env.MONGODB_URI,
  hasDB_URI: !!process.env.DB_URI
});

const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || process.env.DB_URI || 'mongodb://localhost:27017/chat-system', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('❌Database connection error:', error);
        process.exit(1);
    }
};

module.exports = connectDB;
