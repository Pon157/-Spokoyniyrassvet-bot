const express = require('express');
const { supabase } = require('../db');
const router = express.Router();

// Все функции coowner + дополнительные

// Назначение совладельца
router.post('/users/:id/assign-coowner', async (req, res) => {
    try {
        const userId = req.params.id;

        // Проверяем что пользователь существует
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('id, username, role')
            .eq('id', userId)
            .single();

        if (fetchError) throw fetchError;

        // Назначаем роль coowner
        const { data: updatedUser, error } = await supabase
            .from('users')
            .update({
                role: 'coowner',
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
                action: 'coowner_assigned',
                user_id: req.user.id,
                target_id: userId,
                details: {
                    assigned_by: req.user.username,
                    previous_role: user.role
                },
                timestamp: new Date().toISOString()
            }]);

        res.json({
            success: true,
            message: `Пользователь ${user.username} назначен совладельцем`,
            user: updatedUser
        });
    } catch (error) {
        console.error('Assign coowner error:', error);
        res.status(500).json({ error: 'Ошибка назначения совладельца' });
    }
});

// Снятие роли совладельца
router.post('/users/:id/remove-coowner', async (req, res) => {
    try {
        const userId = req.params.id;
        const { new_role = 'admin' } = req.body;

        // Проверяем что пользователь является coowner
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('id, username, role')
            .eq('id', userId)
            .eq('role', 'coowner')
            .single();

        if (fetchError || !user) {
            return res.status(400).json({ error: 'Пользователь не является совладельцем' });
        }

        // Понижаем роль
        const { data: updatedUser, error } = await supabase
            .from('users')
            .update({
                role: new_role,
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
                action: 'coowner_removed',
                user_id: req.user.id,
                target_id: userId,
                details: {
                    removed_by: req.user.username,
                    new_role: new_role
                },
                timestamp: new Date().toISOString()
            }]);

        res.json({
            success: true,
            message: `Совладелец ${user.username} снят с должности`,
            user: updatedUser
        });
    } catch (error) {
        console.error('Remove coowner error:', error);
        res.status(500).json({ error: 'Ошибка снятия совладельца' });
    }
});

// Системные настройки
router.get('/system-settings', async (req, res) => {
    try {
        const { data: settings, error } = await supabase
            .from('system_settings')
            .select('*')
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 - no rows

        const defaultSettings = {
            max_chats_per_listener: 5,
            message_rate_limit: 10,
            auto_mute_duration: 1,
            registration_enabled: true,
            maintenance_mode: false,
            theme: 'light'
        };

        res.json(settings || defaultSettings);
    } catch (error) {
        console.error('System settings error:', error);
        res.status(500).json({ error: 'Ошибка получения настроек' });
    }
});

// Обновление системных настроек
router.put('/system-settings', async (req, res) => {
    try {
        const settings = req.body;

        // Удаляем старые настройки и вставляем новые
        const { error: deleteError } = await supabase
            .from('system_settings')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Удаляем все

        if (deleteError) throw deleteError;

        const { data: savedSettings, error } = await supabase
            .from('system_settings')
            .insert([{
                ...settings,
                updated_by: req.user.id,
                updated_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        // Логируем действие
        await supabase
            .from('logs')
            .insert([{
                action: 'system_settings_updated',
                user_id: req.user.id,
                details: {
                    settings: settings,
                    updated_by: req.user.username
                },
                timestamp: new Date().toISOString()
            }]);

        res.json({
            success: true,
            message: 'Системные настройки обновлены',
            settings: savedSettings
        });
    } catch (error) {
        console.error('Update system settings error:', error);
        res.status(500).json({ error: 'Ошибка обновления настроек' });
    }
});

// Полная статистика системы
router.get('/full-system-stats', async (req, res) => {
    try {
        // Получаем базовую статистику
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('role, created_at, is_online');

        if (usersError) throw usersError;

        const { data: messages, error: messagesError } = await supabase
            .from('messages')
            .select('created_at, message_type');

        if (messagesError) throw messagesError;

        const { data: chats, error: chatsError } = await supabase
            .from('chats')
            .select('created_at, status');

        if (chatsError) throw chatsError;

        const { data: reviews, error: reviewsError } = await supabase
            .from('reviews')
            .select('rating, created_at');

        if (reviewsError) throw reviewsError;

        // Аналитика по дням (последние 30 дней)
        const dailyStats = {};
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            dailyStats[dateStr] = {
                registrations: 0,
                messages: 0,
                chats: 0
            };
        }

        // Заполняем daily stats
        users.forEach(user => {
            const date = user.created_at.split('T')[0];
            if (dailyStats[date]) {
                dailyStats[date].registrations++;
            }
        });

        messages.forEach(message => {
            const date = message.created_at.split('T')[0];
            if (dailyStats[date]) {
                dailyStats[date].messages++;
            }
        });

        chats.forEach(chat => {
            const date = chat.created_at.split('T')[0];
            if (dailyStats[date]) {
                dailyStats[date].chats++;
            }
        });

        res.json({
            overview: {
                total_users: users.length,
                online_users: users.filter(u => u.is_online).length,
                total_messages: messages.length,
                total_chats: chats.length,
                total_reviews: reviews.length,
                average_rating: reviews.length > 0 ? 
                    reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length : 0
            },
            by_role: users.reduce((acc, user) => {
                acc[user.role] = (acc[user.role] || 0) + 1;
                return acc;
            }, {}),
            message_types: messages.reduce((acc, msg) => {
                acc[msg.message_type] = (acc[msg.message_type] || 0) + 1;
                return acc;
            }, {}),
            chat_status: chats.reduce((acc, chat) => {
                acc[chat.status] = (acc[chat.status] || 0) + 1;
                return acc;
            }, {}),
            daily_stats: dailyStats,
            generated_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('Full system stats error:', error);
        res.status(500).json({ error: 'Ошибка получения полной статистики' });
    }
});

// Экспорт данных системы
router.get('/export-data', async (req, res) => {
    try {
        const { data_type } = req.query;

        switch (data_type) {
            case 'users':
                const { data: users, error: usersError } = await supabase
                    .from('users')
                    .select('*');
                if (usersError) throw usersError;
                res.json(users || []);
                break;

            case 'chats':
                const { data: chats, error: chatsError } = await supabase
                    .from('chats')
                    .select('*');
                if (chatsError) throw chatsError;
                res.json(chats || []);
                break;

            case 'messages':
                const { data: messages, error: messagesError } = await supabase
                    .from('messages')
                    .select('*');
                if (messagesError) throw messagesError;
                res.json(messages || []);
                break;

            case 'logs':
                const { data: logs, error: logsError } = await supabase
                    .from('logs')
                    .select('*');
                if (logsError) throw logsError;
                res.json(logs || []);
                break;

            default:
                res.status(400).json({ error: 'Неверный тип данных для экспорта' });
        }
    } catch (error) {
        console.error('Export data error:', error);
        res.status(500).json({ error: 'Ошибка экспорта данных' });
    }
});

module.exports = router;
