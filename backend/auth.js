const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { supabase } = require('./db');

// Регистрация через Supabase Auth
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, role = 'user' } = req.body;

        // 1. Создаем пользователя в Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username,
                    role: role
                }
            }
        });

        if (authError) {
            if (authError.message.includes('already registered')) {
                return res.status(400).json({ error: 'User already exists' });
            }
            return res.status(400).json({ error: authError.message });
        }

        // 2. Создаем запись в таблице users
        const { data: userData, error: userError } = await supabase
            .from('users')
            .insert([{
                id: authData.user.id,
                username: username,
                email: email,
                role: role,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (userError) {
            // Если ошибка при создании пользователя, удаляем из auth
            await supabase.auth.admin.deleteUser(authData.user.id);
            return res.status(400).json({ error: 'Failed to create user profile' });
        }

        // 3. Генерируем JWT токен
        const token = jwt.sign(
            { 
                userId: authData.user.id, 
                role: role,
                email: email
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'User registered successfully',
            token,
            user: userData
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Логин через Supabase Auth
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Аутентификация через Supabase
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // 2. Получаем данные пользователя
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authData.user.id)
            .single();

        if (userError) {
            return res.status(500).json({ error: 'User profile not found' });
        }

        // 3. Генерируем JWT токен
        const token = jwt.sign(
            { 
                userId: authData.user.id, 
                role: userData.role,
                email: userData.email
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: userData
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Выход
router.post('/logout', async (req, res) => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Logout failed' });
    }
});

module.exports = router;
