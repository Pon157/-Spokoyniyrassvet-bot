const express = require('express');
const { supabase } = require('../db'); // Убираем импорт моделей

const router = express.Router();

// Получение слушателей
router.get('/listeners', async (req, res) => {
    try {
        const { data: listeners, error } = await supabase
            .from('users')
            .select('id, username, avatar, last_seen, is_online, rating, bio')
            .eq('role', 'listener')
            .eq('is_active', true)
            .eq('is_blocked', false);

        if (error) throw error;
        
        res.json(listeners || []);
    } catch (error) {
        console.error('Listeners error:', error);
        res.status(500).json({ error: 'Ошибка получения слушателей' });
    }
});

// Создание отзыва
router.post('/review', async (req, res) => {
    try {
        const { listenerId, chatId, rating, comment } = req.body;
        
        // Создаем отзыв
        const { data: review, error: reviewError } = await supabase
            .from('reviews')
            .insert([{
                listener_id: listenerId,
                user_id: req.user.id, // изменили с _id на id
                chat_id: chatId,
                rating: rating,
                comment: comment,
                created_at: new Date().toISOString()
            }])
            .select();

        if (reviewError) throw reviewError;

        // Обновление рейтинга слушателя
        const { data: listenerReviews, error: reviewsError } = await supabase
            .from('reviews')
            .select('rating')
            .eq('listener_id', listenerId);

        if (reviewsError) throw reviewsError;

        const averageRating = listenerReviews.reduce((acc, review) => acc + review.rating, 0) / listenerReviews.length;
        
        const { error: updateError } = await supabase
            .from('users')
            .update({
                rating: Math.round(averageRating * 10) / 10,
                total_reviews: listenerReviews.length,
                updated_at: new Date().toISOString()
            })
            .eq('id', listenerId);

        if (updateError) throw updateError;

        res.json({ message: 'Отзыв успешно оставлен' });
    } catch (error) {
        console.error('Review error:', error);
        res.status(500).json({ error: 'Ошибка создания отзыва' });
    }
});

// Получение чатов пользователя
router.get('/chats', async (req, res) => {
    try {
        const { data: chats, error } = await supabase
            .from('chats')
            .select(`
                *,
                participants:users(id, username, avatar, role)
            `)
            .contains('participant_ids', [req.user.id]) // изменили с _id на id
            .eq('status', 'active');

        if (error) throw error;
        
        res.json(chats || []);
    } catch (error) {
        console.error('Chats error:', error);
        res.status(500).json({ error: 'Ошибка получения чатов' });
    }
});

// Создание чата со слушателем
router.post('/create-chat', async (req, res) => {
    try {
        const { listenerId } = req.body;

        // Проверяем существующий чат
        const { data: existingChats, error: checkError } = await supabase
            .from('chats')
            .select('id')
            .contains('participant_ids', [req.user.id, listenerId])
            .eq('status', 'active')
            .limit(1);

        if (checkError) throw checkError;

        if (existingChats && existingChats.length > 0) {
            return res.json({ chatId: existingChats[0].id });
        }

        // Создаем новый чат
        const { data: newChat, error: createError } = await supabase
            .from('chats')
            .insert([{
                participant_ids: [req.user.id, listenerId],
                status: 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (createError) throw createError;

        res.status(201).json({ chatId: newChat.id });
    } catch (error) {
        console.error('Create chat error:', error);
        res.status(500).json({ error: 'Ошибка создания чата' });
    }
});

module.exports = router;
