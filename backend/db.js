const { createClient } = require('@supabase/supabase-js');

console.log('🔧 Initializing Supabase connection...');
console.log('🔧 Environment variables:', {
  hasSUPABASE_URL: !!process.env.SUPABASE_URL,
  hasSUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY
});

// Supabase клиент
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.error('SUPABASE_ANON_KEY:', supabaseKey ? '✅ Set' : '❌ Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const connectDB = async () => {
  try {
    console.log('🔄 Testing Supabase connection...');
    
    // Тестируем подключение простым запросом
    const { data, error } = await supabase.from('users').select('*').limit(1);
    
    if (error && error.code !== '42P01') { // Игнорируем ошибку "таблица не существует"
      throw error;
    }
    
    console.log('✅ Supabase Connected successfully!');
    console.log('📊 Project:', supabaseUrl.replace('https://', ''));
    
  } catch (error) {
    console.error('❌ Supabase connection error:', error);
    process.exit(1);
  }
};

module.exports = { connectDB, supabase };
