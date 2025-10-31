const express = require('express');
const { supabase } = require('../db');
const router = express.Router();

// Простые заглушки для админа
router.get('/users', async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('*');
        
        if (error) throw error;
        res.json(users || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/stats', async (req, res) => {
    res.json({ message: 'Admin stats endpoint' });
});

module.exports = router;
