const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function createTables() {
  const sql = `
    -- Таблица пользователей
    CREATE TABLE IF NOT EXISTS users (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'user',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Таблица сообщений
    CREATE TABLE IF NOT EXISTS messages (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID,
      username VARCHAR(50),
      content TEXT NOT NULL,
      room VARCHAR(50) DEFAULT 'general',
      message_type VARCHAR(20) DEFAULT 'text',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Таблица чатов
    CREATE TABLE IF NOT EXISTS chats (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID,
      listener_id UUID,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Индексы для производительности
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
  `;

  console.log('📋 Creating database tables...');
  console.log('⚠️ Please run this SQL in Supabase SQL Editor:');
  console.log('\n' + sql + '\n');
}

module.exports = { createTables };
