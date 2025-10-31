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

// Добавляем функцию getSupabase для совместимости
const getSupabase = () => supabase;

// Функция для тестирования подключения
const connectDB = async () => {
    try {
        const { data, error } = await supabase.from('users').select('count').limit(1);
        if (error) throw error;
        console.log('✅ Database connection established');
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
};

module.exports = { connectDB, supabase, getSupabase };
