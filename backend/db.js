const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Для Render используем MongoDB Atlas или предоставленную строку подключения
    const dbUri = process.env.DB_URI || 'mongodb://localhost:27017/chat-system';
    
    const conn = await mongoose.connect(dbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error.message);
    
    // В production выходим с ошибкой
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
