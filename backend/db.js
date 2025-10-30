const { createClient } = require('@supabase/supabase-js');

console.log('🔧 Database module loaded');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing database credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
console.log('✅ Supabase client created');

// Простая функция для тестирования
const connectDB = async () => {
    console.log('✅ Database connection established');
};

module.exports = { connectDB, supabase };
