const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Инициализация таблиц (выполнить один раз)
async function initDatabase() {
  try {
    console.log('🔄 Проверка и инициализация таблиц Supabase...');
    
    // Таблица пользователей
    const { error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(1);
      
    if (usersError && usersError.message.includes('does not exist')) {
      console.log('📋 Создание таблиц... Запустите SQL из supabase-tables.js');
    } else {
      console.log('✅ Таблицы уже существуют');
    }
    
  } catch (error) {
    console.error('❌ Ошибка инициализации БД:', error);
  }
}

module.exports = { supabase, initDatabase };
