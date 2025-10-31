const express = require('express');
const { supabase } = require('../db');
const router = express.Router();

// Все функции админа + дополнительные

// Назначение ролей (слушатель, администратор)
router.post('/users/:id/assign-role', async (req, res) => {
    try {
        const userId = req.params.id;
        const { role } = req.body;

        const allowedRoles = ['listener', 'admin'];
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ error: 'Недопустимая роль' });
        }

        const { data: user, error } = await supabase
            .from('users')
            .update({
                role: role,
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
                action: 'role_assigned',
                user_id: req.user.id,
                target_id: userId,
                details: {
                    new_role: role,
                    assigned_by: req.user.username
                },
                timestamp: new Date().toISOString()
            }]);

        res.json({
            success: true,
            message: `Роль "${role}" назначена пользователю`,
            user: user
        });
    } catch (error) {
        console.error('Assign role error:', error);
        res.status(500).json({ error: 'Ошибка назначения роли' });
    }
});

// Увольнение слушателя/администратора
router.post('/users/:id/dismiss', async (req, res) => {
    try {
        const userId = req.params.id;
        const { reason } = req.body;

        // Получаем текущую роль пользователя
        const { data: currentUser, error: fetchError } = await supabase
            .from('users')
            .select('role, username')
            .eq('id', userId)
            .single();

        if (fetchError) throw fetchError;

        if (!['listener', 'admin'].includes(currentUser.role)) {
            return res.status(400).json({ error: 'Можно уволить только слушателя или администратора' });
        }

        // Понижаем до user и деактивируем
        const { data: user, error } = await supabase
            .from('users')
            .update({
                role: 'user',
                is_active: false,
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
                action: 'user_dismissed',
                user_id: req.user.id,
                target_id: userId,
                details: {
                    previous_role: currentUser.role,
                    reason: reason,
                    dismissed_by: req.user.username
                },
                timestamp: new Date().toISOString()
            }]);

        res.json({
            success: true,
            message: `Пользователь ${currentUser.username} уволен`,
            user: user
        });
    } catch (error) {
        console.error('Dismiss user error:', error);
        res.status(500).json({ error: 'Ошибка увольнения пользователя' });
    }
});

// Отправка технического уведомления
router.post('/notifications/send', async (req, res) => {
    try {
        const { title, message, target_roles, target_users } = req.body;

        const notification = {
            title: title,
            message: message,
            sent_by: req.user.id,
            target_roles: target_roles || [],
            target_users: target_users || [],
            created_at: new Date().toISOString(),
            is_read: false
        };

        const { data: savedNotification, error } = await supabase
            .from('notifications')
            .insert([notification])
            .select()
            .single();

        if (error) throw error;

        // Логируем действие
        await supabase
            .from('logs')
            .insert([{
                action: 'notification_sent',
                user_id: req.user.id,
                details: {
                    title: title,
                    target_roles: target_roles,
                    target_users: target_users
                },
                timestamp: new Date().toISOString()
            }]);

        // Отправляем уведомление через WebSocket
        // (реализуется в sockets.js)

        res.json({
            success: true,
            message: 'Уведомление отправлено',
            notification: savedNotification
        });
    } catch (error) {
        console.error('Send notification error:', error);
        res.status(500).json({ error: 'Ошибка отправки уведомления' });
    }
});

// Массовая рассылка
router.post('/broadcast', async (req, res) => {
    try {
        const { message, target_roles } = req.body;

        // Создаем broadcast запись
        const broadcast = {
            message: message,
            sent_by: req.user.id,
            target_roles: target_roles || ['user', 'listener', 'admin'],
            created_at: new Date().toISOString()
        };

        const { data: savedBroadcast, error } = await supabase
            .from('broadcasts')
            .insert([broadcast])
            .select()
            .single();

        if (error) throw error;

        // Логируем действие
        await supabase
            .from('logs')
            .insert([{
                action: 'broadcast_sent',
                user_id: req.user.id,
                details: {
                    message: message,
                    target_roles: target_roles
                },
                timestamp: new Date().toISOString()
            }]);

        res.json({
            success: true,
            message: 'Рассылка отправлена',
            broadcast: savedBroadcast
        });
    } catch (error) {
        console.error('Broadcast error:', error);
        res.status(500).json({ error: 'Ошибка отправки рассылки' });
    }
});

// Получение детальной статистики системы
router.get('/detailed-stats', async (req, res) => {
    try {
        const { period = '7d' } = req.query; // 7d, 30d, 90d
        
        let days;
        switch (period) {
            case '7d': days = 7; break;
            case '30d': days = 30; break;
            case '90d': days = 90; break;
            default: days = 7;
        }

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Статистика регистраций
        const { data: registrations, error: regError } = await supabase
            .from('users')
            .select('created_at')
            .gte('created_at', startDate.toISOString());

        if (regError) throw regError;

        // Статистика сообщений
        const { data: messages, error: msgError } = await supabase
            .from('messages')
            .select('created_at')
            .gte('created_at', startDate.toISOString());

        if (msgError) throw msgError;

        // Статистика чатов
        const { data: chats, error: chatError } = await supabase
            .from('chats')
            .select('created_at, status')
            .gte('created_at', startDate.toISOString());

        if (chatError) throw chatError;

        res.json({
            period: period,
            registrations: registrations.length,
            messages: messages.length,
            chats: {
                total: chats.length,
                active: chats.filter(c => c.status === 'active').length,
                completed: chats.filter(c => c.status === 'completed').length
            },
            timeframe: {
                start: startDate.toISOString(),
                end: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Detailed stats error:', error);
        res.status(500).json({ error: 'Ошибка получения статистики' });
    }
});

// Получение всех логов с расширенной фильтрацией
router.get('/all-logs', async (req, res) => {
    try {
        const { action, user_id, start_date, end_date, limit = 200 } = req.query;
        
        let query = supabase
            .from('logs')
            .select(`
                *,
                user:users(username, role),
                target_user:users!logs_target_id_fkey(username, role)
            `)
            .order('timestamp', { ascending: false })
            .limit(parseInt(limit));

        if (action && action !== 'all') {
            query = query.eq('action', action);
        }

        if (user_id) {
            query = query.eq('user_id', user_id);
        }

        if (start_date) {
            query = query.gte('timestamp', start_date);
        }

        if (end_date) {
            query = query.lte('timestamp', end_date);
        }

        const { data: logs, error } = await query;

        if (error) throw error;
        res.json(logs || []);
    } catch (error) {
        console.error('All logs error:', error);
        res.status(500).json({ error: 'Ошибка получения логов' });
    }
});

module.exports = router;
