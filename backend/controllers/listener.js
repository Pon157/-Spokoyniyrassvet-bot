const express = require('express');
const { supabase } = require('../db');
const router = express.Router();

// Получение чатов слушателя
router.get('/chats', async (req, res) => {
    try {
        const { data: chats, error } = await supabase
            .from('chats')
            .select(`
                *,
                participants:users(id, username, avatar, role)
            `)
            .contains('participant_ids', [req.user.id])
            .eq('status', 'active')
            .order('updated_at', { ascending: false });

        if (error) throw error;

        // Фильтруем участников чтобы показать только пользователей
        const formattedChats = chats.map(chat => {
            const userParticipant = chat.participants.find(p => p.role === 'user');
            return {
                id: chat.id,
                user: userParticipant,
                status: chat.status,
                created_at: chat.created_at,
                updated_at: chat.updated_at,
                unread_count: chat.unread_count || 0
            };
        });

        res.json(formattedChats);
    } catch (error) {
        console.error('Listener chats error:', error);
        res.status(500).json({ error: 'Ошибка получения чатов' });
    }
});

// Получение моих отзывов
router.get('/reviews', async (req, res) => {
    try {
        const { data: reviews, error } = await supabase
            .from('reviews')
            .select(`
                *,
                user:users(id, username, avatar),
                chat:chats(id)
            `)
            .eq('listener_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Рассчитываем средний рейтинг
        const averageRating = reviews.length > 0 
            ? reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length 
            : 0;

        res.json({
            reviews: reviews || [],
            stats: {
                total_reviews: reviews.length,
                average_rating: Math.round(averageRating * 10) / 10
            }
        });
    } catch (error) {
        console.error('Listener reviews error:', error);
        res.status(500).json({ error: 'Ошибка получения отзывов' });
    }
});

// Статистика слушателя
router.get('/stats', async (req, res) => {
    try {
        // Количество активных чатов
        const { data: activeChats, error: chatsError } = await supabase
            .from('chats')
            .select('id', { count: 'exact' })
            .contains('participant_ids', [req.user.id])
            .eq('status', 'active');

        if (chatsError) throw chatsError;

        // Количество отзывов за последние 30 дней
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: recentReviews, error: reviewsError } = await supabase
            .from('reviews')
            .select('id', { count: 'exact' })
            .eq('listener_id', req.user.id)
            .gte('created_at', thirtyDaysAgo.toISOString());

        if (reviewsError) throw reviewsError;

        // Общее количество сообщений
        const { data: messages, error: messagesError } = await supabase
            .from('messages')
            .select('id', { count: 'exact' })
            .eq('user_id', req.user.id);

        if (messagesError) throw messagesError;

        res.json({
            active_chats: activeChats.length,
            recent_reviews: recentReviews.length,
            total_messages: messages.length,
            online_since: new Date().toISOString()
        });
    } catch (error) {
        console.error('Listener stats error:', error);
        res.status(500).json({ error: 'Ошибка получения статистики' });
    }
});

// Обновление профиля слушателя
router.put('/profile', async (req, res) => {
    try {
        const { bio, is_online } = req.body;
        
        const updateData = {
            updated_at: new Date().toISOString()
        };

        if (bio !== undefined) updateData.bio = bio;
        if (is_online !== undefined) updateData.is_online = is_online;

        const { data: user, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', req.user.id)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Профиль успешно обновлен',
            user: user
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Ошибка обновления профиля' });
    }
});

// Получение доступных пользователей для чата
router.get('/available-users', async (req, res) => {
    try {
        // Находим пользователей, у которых нет активного чата с этим слушателем
        const { data: existingChats, error: chatsError } = await supabase
            .from('chats')
            .select('participant_ids')
            .contains('participant_ids', [req.user.id])
            .eq('status', 'active');

        if (chatsError) throw chatsError;

        const existingUserIds = new Set();
        existingChats.forEach(chat => {
            chat.participant_ids.forEach(id => {
                if (id !== req.user.id) existingUserIds.add(id);
            });
        });

        // Получаем пользователей, исключая тех, с кем уже есть чат
        let query = supabase
            .from('users')
            .select('id, username, avatar, last_seen, is_online')
            .eq('role', 'user')
            .eq('is_active', true)
            .eq('is_blocked', false);

        if (existingUserIds.size > 0) {
            query = query.not('id', 'in', `(${Array.from(existingUserIds).join(',')})`);
        }

        const { data: users, error } = await query;

        if (error) throw error;

        res.json(users || []);
    } catch (error) {
        console.error('Available users error:', error);
        res.status(500).json({ error: 'Ошибка получения пользователей' });
    }
});

module.exports = router;
