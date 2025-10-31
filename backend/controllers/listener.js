const express = require('express');
const { supabase } = require('../db');
const router = express.Router();

router.get('/chats', async (req, res) => {
    try {
        const { data: chats, error } = await supabase
            .from('chats')
            .select('*')
            .contains('participant_ids', [req.user.id]);
        
        if (error) throw error;
        res.json(chats || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
