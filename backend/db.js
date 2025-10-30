const { createClient } = require('@supabase/supabase-js');

console.log('🔧 Initializing Supabase connection...');

// Supabase клиент
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const connectDB = async () => {
  try {
    console.log('🔄 Testing Supabase connection...');
    
    // Тестируем подключение простым запросом
    const { data, error } = await supabase.from('users').select('count').limit(1);
    
    if (error && error.code !== '42P01') { // Игнорируем ошибку "таблица не существует"
      throw error;
    }
    
    console.log('✅ Supabase Connected successfully!');
    console.log('📊 Project:', supabaseUrl);
    
  } catch (error) {
    console.error('❌ Supabase connection error:', error);
    process.exit(1);
  }
};

module.exports = { connectDB, supabase };
