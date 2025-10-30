const { createClient } = require('@supabase/supabase-js');

console.log('🔧 Initializing database connection...');

// ТОЛЬКО из переменных окружения - без дефолтных значений
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    console.log('💡 Please add SUPABASE_URL and SUPABASE_ANON_KEY to environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Функция connectDB
const connectDB = async () => {
    try {
        console.log('🔄 Testing database connection...');
        const { data, error } = await supabase.from('users').select('*').limit(1);
        
        if (error && error.code !== '42P01') {
            console.error('❌ Database connection error:', error.message);
            process.exit(1);
        } else {
            console.log('✅ Database connected successfully');
        }
    } catch (error) {
        console.error('❌ Database test failed:', error.message);
        process.exit(1);
    }
};

// Экспортируем как объект с функциями
module.exports = { 
    connectDB: connectDB, 
    supabase: supabase 
};
