const { createClient } = require('@supabase/supabase-js');

console.log('🔧 Initializing database connection...');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase;

if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client initialized');
} else {
    console.log('⚠️ Supabase credentials missing - running in demo mode');
}

const connectDB = async () => {
    if (!supabase) {
        console.log('💡 Add SUPABASE_URL and SUPABASE_ANON_KEY to connect to database');
        return;
    }
    
    try {
        const { data, error } = await supabase.from('users').select('*').limit(1);
        if (error && error.code !== '42P01') {
            console.error('Database connection error:', error);
        } else {
            console.log('✅ Database connected successfully');
        }
    } catch (error) {
        console.error('Database test failed:', error);
    }
};

module.exports = { connectDB, supabase };
