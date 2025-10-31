const express = require('express');
const { supabase } = require('../db');
const router = express.Router();

// Получение всех пользователей с фильтрацией
router.get('/users', async (req, res) => {
    try {
        const { role, is_blocked, search } = req.query;
        
        let query = supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        // Фильтрация по роли
        if (role && role !== 'all') {
            query = query.eq('role', role);
        }

        // Фильтрация по блокировке
        if (is_blocked !== undefined) {
            query = query.eq('is_blocked', is_blocked === 'true');
        }

        // Поиск по username или email
        if (search) {
            query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%`);
        }

        const { data: users, error } = await query;

        if (error) throw error;
        
        // Скрываем пароли
        const usersWithoutPasswords = users.map(user => {
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        });

        res.json(usersWithoutPasswords || []);
    } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).json({ error: 'Ошибка получения пользователей' });
    }
});

// Статистика системы
router.get('/stats', async (req, res) => {
    try {
        // Количество пользователей по ролям
        const { data: roleStats, error: roleError } = await supabase
            .from('users')
            .select('role')
            .eq('is_active', true);

        if (roleError) throw roleError;

        const roleCounts = roleStats.reduce((acc, user) => {
            acc[user.role] = (acc[user.role] || 0) + 1;
            return acc;
        }, {});

        // Количество активных чатов
        const { data: activeChats, error: chatsError } = await supabase
            .from('chats')
            .select('id', { count: 'exact' })
            .eq('status', 'active');

        if (chatsError) throw chatsError;

        // Количество сообщений за последние 24 часа
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        const { data: recentMessages, error: messagesError } = await supabase
            .from('messages')
            .select('id', { count: 'exact' })
            .gte('created_at', twentyFourHoursAgo.toISOString());

        if (messagesError) throw messagesError;

        // Количество отзывов
        const { data: reviews, error: reviewsError } = await supabase
            .from('reviews')
            .select('id', { count: 'exact' });

        if (reviewsError) throw reviewsError;

        res.json({
            users: {
                total: roleStats.length,
                by_role: roleCounts
            },
            chats: {
                active: activeChats.length
            },
            messages: {
                last_24h: recentMessages.length
            },
            reviews: {
                total: reviews.length
            },
            system: {
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            }
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ error: 'Ошибка получения статистики' });
    }
});

// Блокировка/разблокировка пользователя
router.post('/users/:id/block', async (req, res) => {
    try {
        const userId = req.params.id;
        const { is_blocked, reason } = req.body;

        const { data: user, error } = await supabase
            .from('users')
            .update({
                is_blocked: is_blocked,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;

        // Логируем действие
        await supabase
            .from('logs')
            .insert([{
                action: is_blocked ? 'user_blocked' : 'user_unblocked',
                user_id: req.user.id,
                target_id: userId,
                details: {
                    reason: reason,
                    admin: req.user.username
                },
                timestamp: new Date().toISOString()
            }]);

        res.json({
            success: true,
            message: `Пользователь ${is_blocked ? 'заблокирован' : 'разблокирован'}`,
            user: user
        });
    } catch (error) {
        console.error('Block user error:', error);
        res.status(500).json({ error: 'Ошибка блокировки пользователя' });
    }
});

// Выдача мута пользователю
router.post('/users/:id/mute', async (req, res) => {
    try {
        const userId = req.params.id;
        const { reason, duration_hours = 1 } = req.body;

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + duration_hours);

        const muteData = {
            reason: reason,
            issued_by: req.user.id,
            issued_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString()
        };

        // Добавляем мут в массив mutes пользователя
        const { data: user, error } = await supabase
            .from('users')
            .update({
                mutes: supabase.raw('COALESCE(mutes, \'[]\') || ?', JSON.stringify([muteData])),
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;

        // Логируем действие
        await supabase
            .from('logs')
            .insert([{
                action: 'user_muted',
                user_id: req.user.id,
                target_id: userId,
                details: {
                    reason: reason,
                    duration_hours: duration_hours,
                    expires_at: expiresAt.toISOString(),
                    admin: req.user.username
                },
                timestamp: new Date().toISOString()
            }]);

        res.json({
            success: true,
            message: `Мут выдан до ${expiresAt.toLocaleString()}`,
            mute: muteData
        });
    } catch (error) {
        console.error('Mute user error:', error);
        res.status(500).json({ error: 'Ошибка выдачи мута' });
    }
});

// Просмотр всех чатов системы
router.get('/chats', async (req, res) => {
    try {
        const { status } = req.query;
        
        let query = supabase
            .from('chats')
            .select(`
                *,
                participants:users(id, username, avatar, role)
            `)
            .order('updated_at', { ascending: false });

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        const { data: chats, error } = await query;

        if (error) throw error;
        res.json(chats || []);
    } catch (error) {
        console.error('Admin chats error:', error);
        res.status(500).json({ error: 'Ошибка получения чатов' });
    }
});

// Просмотр сообщений чата
router.get('/chats/:id/messages', async (req, res) => {
    try {
        const chatId = req.params.id;

        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        res.json(messages || []);
    } catch (error) {
        console.error('Chat messages error:', error);
        res.status(500).json({ error: 'Ошибка получения сообщений' });
    }
});

// Выдача предупреждения
router.post('/users/:id/warn', async (req, res) => {
    try {
        const userId = req.params.id;
        const { reason } = req.body;

        const warning = {
            reason: reason,
            issued_by: req.user.id,
            issued_at: new Date().toISOString()
        };

        const { data: user, error } = await supabase
            .from('users')
            .update({
                warnings: supabase.raw('COALESCE(warnings, \'[]\') || ?', JSON.stringify([warning])),
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;

        // Логируем действие
        await supabase
            .from('logs')
            .insert([{
                action: 'user_warned',
                user_id: req.user.id,
                target_id: userId,
                details: {
                    reason: reason,
                    admin: req.user.username
                },
                timestamp: new Date().toISOString()
            }]);

        res.json({
            success: true,
            message: 'Предупреждение выдано',
            warning: warning
        });
    } catch (error) {
        console.error('Warn user error:', error);
        res.status(500).json({ error: 'Ошибка выдачи предупреждения' });
    }
});

// Просмотр логов системы
router.get('/logs', async (req, res) => {
    try {
        const { action, limit = 100 } = req.query;
        
        let query = supabase
            .from('logs')
            .select(`
                *,
                user:users(username),
                target_user:users!logs_target_id_fkey(username)
            `)
            .order('timestamp', { ascending: false })
            .limit(parseInt(limit));

        if (action && action !== 'all') {
            query = query.eq('action', action);
        }

        const { data: logs, error } = await query;

        if (error) throw error;
        res.json(logs || []);
    } catch (error) {
        console.error('Admin logs error:', error);
        res.status(500).json({ error: 'Ошибка получения логов' });
    }
});

module.exports = router;
