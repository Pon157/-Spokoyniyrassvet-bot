const express = require('express');
const { supabase } = require('../db');
const router = express.Router();

// Получение всех активных слушателей
router.get('/listeners', async (req, res) => {
    try {
        const { data: listeners, error } = await supabase
            .from('users')
            .select('id, username, avatar, last_seen, is_online, rating, bio, total_reviews')
            .eq('role', 'listener')
            .eq('is_active', true)
            .eq('is_blocked', false)
            .order('rating', { ascending: false });

        if (error) throw error;
        res.json(listeners || []);
    } catch (error) {
        console.error('Listeners error:', error);
        res.status(500).json({ error: 'Ошибка получения слушателей' });
    }
});

// Создание отзыва на слушателя
router.post('/review', async (req, res) => {
    try {
        const { listenerId, chatId, rating, comment } = req.body;

        // Проверяем существование слушателя
        const { data: listener, error: listenerError } = await supabase
            .from('users')
            .select('id, role')
            .eq('id', listenerId)
            .eq('role', 'listener')
            .single();

        if (listenerError || !listener) {
            return res.status(400).json({ error: 'Слушатель не найден' });
        }

        // Проверяем существование чата
        const { data: chat, error: chatError } = await supabase
            .from('chats')
            .select('id, participant_ids')
            .eq('id', chatId)
            .contains('participant_ids', [req.user.id, listenerId])
            .single();

        if (chatError || !chat) {
            return res.status(400).json({ error: 'Чат не найден или у вас нет доступа' });
        }

        // Создаем отзыв
        const { data: review, error: reviewError } = await supabase
            .from('reviews')
            .insert([{
                listener_id: listenerId,
                user_id: req.user.id,
                chat_id: chatId,
                rating: rating,
                comment: comment,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (reviewError) throw reviewError;

        // Обновляем рейтинг слушателя
        const { data: reviews, error: reviewsError } = await supabase
            .from('reviews')
            .select('rating')
            .eq('listener_id', listenerId);

        if (reviewsError) throw reviewsError;

        const averageRating = reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length;
        
        const { error: updateError } = await supabase
            .from('users')
            .update({
                rating: Math.round(averageRating * 10) / 10,
                total_reviews: reviews.length,
                updated_at: new Date().toISOString()
            })
            .eq('id', listenerId);

        if (updateError) throw updateError;

        res.json({ 
            success: true,
            message: 'Отзыв успешно оставлен',
            review: review
        });
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
            .contains('participant_ids', [req.user.id])
            .eq('status', 'active')
            .order('updated_at', { ascending: false });

        if (error) throw error;

        // Фильтруем участников чтобы показать только собеседника
        const formattedChats = chats.map(chat => {
            const otherParticipant = chat.participants.find(p => p.id !== req.user.id);
            return {
                id: chat.id,
                participant: otherParticipant,
                status: chat.status,
                created_at: chat.created_at,
                updated_at: chat.updated_at
            };
        });

        res.json(formattedChats);
    } catch (error) {
        console.error('Chats error:', error);
        res.status(500).json({ error: 'Ошибка получения чатов' });
    }
});

// Создание чата со слушателем
router.post('/create-chat', async (req, res) => {
    try {
        const { listenerId } = req.body;

        // Проверяем существование слушателя
        const { data: listener, error: listenerError } = await supabase
            .from('users')
            .select('id, role, is_active, is_blocked')
            .eq('id', listenerId)
            .eq('role', 'listener')
            .single();

        if (listenerError || !listener) {
            return res.status(400).json({ error: 'Слушатель не найден' });
        }

        if (!listener.is_active || listener.is_blocked) {
            return res.status(400).json({ error: 'Слушатель недоступен' });
        }

        // Проверяем существующий активный чат
        const { data: existingChats, error: checkError } = await supabase
            .from('chats')
            .select('id')
            .contains('participant_ids', [req.user.id, listenerId])
            .eq('status', 'active')
            .limit(1);

        if (checkError) throw checkError;

        if (existingChats && existingChats.length > 0) {
            return res.json({ 
                chatId: existingChats[0].id,
                message: 'Чат уже существует'
            });
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

        res.status(201).json({ 
            success: true,
            chatId: newChat.id,
            message: 'Чат успешно создан'
        });
    } catch (error) {
        console.error('Create chat error:', error);
        res.status(500).json({ error: 'Ошибка создания чата' });
    }
});

// Получение моих отзывов
router.get('/my-reviews', async (req, res) => {
    try {
        const { data: reviews, error } = await supabase
            .from('reviews')
            .select(`
                *,
                listener:users(id, username, avatar)
            `)
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(reviews || []);
    } catch (error) {
        console.error('My reviews error:', error);
        res.status(500).json({ error: 'Ошибка получения отзывов' });
    }
});

module.exports = router;
