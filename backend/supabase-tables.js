-- Удаляем старую таблицу users и создаем новую с telegram
DROP TABLE IF EXISTS users CASCADE;

-- Пользователи системы с Telegram
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    telegram_username VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user', -- user, listener, admin, coowner, owner
    avatar_url TEXT,
    theme VARCHAR(20) DEFAULT 'light',
    is_online BOOLEAN DEFAULT false,
    is_blocked BOOLEAN DEFAULT false,
    is_muted BOOLEAN DEFAULT false,
    mute_reason TEXT,
    mute_expires_at TIMESTAMP,
    warnings INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Обновляем остальные таблицы (убираем email зависимости)
CREATE TABLE IF NOT EXISTS chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    listener_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'active', -- active, closed, archived
    user_rating INTEGER,
    user_feedback TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    closed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id UUID REFERENCES chats(id),
    sender_id UUID REFERENCES users(id),
    content TEXT,
    message_type VARCHAR(20) DEFAULT 'text', -- text, image, video, audio, sticker
    media_url TEXT,
    sticker_url TEXT,
    read_by_recipient BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    listener_id UUID REFERENCES users(id),
    user_id UUID REFERENCES users(id),
    chat_id UUID REFERENCES chats(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS moderation_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    moderator_id UUID REFERENCES users(id),
    target_user_id UUID REFERENCES users(id),
    action_type VARCHAR(20) NOT NULL, -- block, unblock, mute, unmute, warn
    reason TEXT,
    duration_minutes INTEGER,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(20) DEFAULT 'info', -- info, warning, alert, broadcast
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    action VARCHAR(255) NOT NULL,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stickers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    category VARCHAR(50),
    created_by UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_online ON users(is_online);
CREATE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_username);
CREATE INDEX IF NOT EXISTS idx_chats_status ON chats(status);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_listener_id ON reviews(listener_id);
