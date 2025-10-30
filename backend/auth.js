const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { getSupabase } = require('./db');

// Регистрация
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, role = 'user' } = req.body;
        const supabase = getSupabase();

        if (!supabase) {
            return res.status(500).json({ error: 'Database not connected' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const { data, error } = await supabase
            .from('users')
            .insert([{ username, email, password: hashedPassword, role }])
            .select();

        if (error) {
            if (error.code === '23505') {
                return res.status(400).json({ error: 'User already exists' });
            }
            throw error;
        }

        const token = jwt.sign(
            { userId: data[0].id, role: data[0].role },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '24h' }
        );

        res.json({
            message: 'User registered successfully',
            token,
            user: { id: data[0].id, username, email, role }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Логин
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const supabase = getSupabase();

        if (!supabase) {
            return res.status(500).json({ error: 'Database not connected' });
        }

        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .limit(1);

        if (error) throw error;

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, username: user.username, email: user.email, role: user.role }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
