const { createClient } = require('@supabase/supabase-js');

console.log('🔧 Initializing Supabase connection...');

// Supabase клиент
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.error('SUPABASE_ANON_KEY:', supabaseKey ? '✅ Set' : '❌ Missing');
  process.exit(1);
}

console.log('📊 Connecting to Supabase...');
const supabase = createClient(supabaseUrl, supabaseKey);

const connectDB = async () => {
  try {
    console.log('🔄 Testing Supabase connection...');
    
    // Тестируем подключение
    const { data, error } = await supabase.from('users').select('*').limit(1);
    
    if (error && error.code !== '42P01') {
      console.error('Supabase error:', error);
      throw error;
    }
    
    console.log('✅ Supabase Connected successfully!');
    console.log('📊 Project:', supabaseUrl.replace('https://', ''));
    
    return supabase;
  } catch (error) {
    console.error('❌ Supabase connection error:', error);
    console.log('💡 Make sure you created tables in Supabase SQL Editor');
    process.exit(1);
  }
};

module.exports = { connectDB, supabase };
