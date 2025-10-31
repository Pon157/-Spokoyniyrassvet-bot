const express = require('express');
const { supabase } = require('../db');

const router = express.Router();

// Простой эндпоинт для теста
router.get('/listeners', async (req, res) => {
    try {
        const { data: listeners, error } = await supabase
            .from('users')
            .select('id, username, avatar, last_seen, is_online, rating, bio')
            .eq('role', 'listener')
            .eq('is_active', true);

        if (error) throw error;
        res.json(listeners || []);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения слушателей' });
    }
});

module.exports = router;
