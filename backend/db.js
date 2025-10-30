const { createClient } = require('@supabase/supabase-js');

let supabase;

const connectDB = async () => {
    try {
        console.log('🔧 Checking environment variables...');
        
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            console.error('❌ Missing Supabase environment variables');
            console.log('💡 Please add SUPABASE_URL and SUPABASE_ANON_KEY to environment variables');
            // Не выходим из процесса, продолжаем работу
            return;
        }

        console.log('📊 Connecting to Supabase...');
        supabase = createClient(supabaseUrl, supabaseKey);

        // Тестируем подключение
        const { data, error } = await supabase.from('users').select('*').limit(1);
        
        if (error && error.code !== '42P01') {
            console.error('Supabase connection error:', error);
            return;
        }

        console.log('✅ Supabase Connected successfully!');
        return supabase;
        
    } catch (error) {
        console.error('❌ Database connection error:', error);
        console.log('💡 Make sure you created tables in Supabase SQL Editor');
    }
};

// Геттер для supabase
const getSupabase = () => {
    return supabase;
};

module.exports = { connectDB, getSupabase };
