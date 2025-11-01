const { supabase } = require('../db');
const { authenticateToken, requireRole } = require('../middleware');

class ChatController {
  // Создание нового чата
  async createChat(req, res) {
    try {
      const userId = req.user.id;
      const { listenerId } = req.body;

      // Проверяем существующие активные чаты
      const { data: existingChat, error: existingError } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (existingChat) {
        return res.json({ 
          chat: existingChat,
          message: 'У вас уже есть активный чат' 
        });
      }

      // Создаем новый чат
      const { data: chat, error } = await supabase
        .from('chats')
        .insert([
          {
            user_id: userId,
            listener_id: listenerId || null,
            status: 'active'
          }
        ])
        .select(`
          *,
          user:users!chats_user_id_fkey(username, avatar_url),
          listener:users!chats_listener_id_fkey(username, avatar_url)
        `)
        .single();

      if (error) throw error;

      // Логируем действие
      await supabase
        .from('system_logs')
        .insert([
          {
            user_id: userId,
            action: 'create_chat',
            details: { chat_id: chat.id, listener_id: listenerId }
          }
        ]);

      res.status(201).json({ chat });

    } catch (error) {
      console.error('Create chat error:', error);
      res.status(500).json({ error: 'Ошибка создания чата' });
    }
  }

  // Отправка сообщения
  async sendMessage(req, res) {
    try {
      const userId = req.user.id;
      const { chatId, content, messageType = 'text', mediaUrl = null } = req.body;

      // Проверяем существование чата
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .select('*')
        .eq('id', chatId)
        .single();

      if (chatError || !chat) {
        return res.status(404).json({ error: 'Чат не найден' });
      }

      // Проверяем права доступа к чату
      if (chat.user_id !== userId && chat.listener_id !== userId) {
        return res.status(403).json({ error: 'Нет доступа к этому чату' });
      }

      // Проверяем не забанен ли пользователь
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('is_banned, is_muted, mute_until')
        .eq('id', userId)
        .single();

      if (user.is_banned) {
        return res.status(403).json({ error: 'Ваш аккаунт заблокирован' });
      }

      if (user.is_muted && new Date(user.mute_until) > new Date()) {
        return res.status(403).json({ 
          error: 'Вы в муте до ' + new Date(user.mute_until).toLocaleString() 
        });
      }

      // Создаем сообщение
      const { data: message, error } = await supabase
        .from('messages')
        .insert([
          {
            chat_id: chatId,
            sender_id: userId,
            message_type: messageType,
            content: content,
            media_url: mediaUrl
          }
        ])
        .select(`
          *,
          sender:users!messages_sender_id_fkey(username, avatar_url, role)
        `)
        .single();

      if (error) throw error;

      // Обновляем время последней активности чата
      await supabase
        .from('chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', chatId);

      res.status(201).json({ message });

    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ error: 'Ошибка отправки сообщения' });
    }
  }

  // Получение истории сообщений чата
  async getChatMessages(req, res) {
    try {
      const userId = req.user.id;
      const { chatId } = req.params;

      // Проверяем существование чата и доступ
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .select('*')
        .eq('id', chatId)
        .single();

      if (chatError || !chat) {
        return res.status(404).json({ error: 'Чат не найден' });
      }

      if (chat.user_id !== userId && chat.listener_id !== userId) {
        return res.status(403).json({ error: 'Нет доступа к этому чату' });
      }

      // Получаем сообщения
      const { data: messages, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!messages_sender_id_fkey(username, avatar_url, role)
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      res.json({ messages });

    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ error: 'Ошибка получения сообщений' });
    }
  }

  // Оставление отзыва
  async addReview(req, res) {
    try {
      const userId = req.user.id;
      const { chatId, rating, comment } = req.body;

      // Проверяем существование чата
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .select('*')
        .eq('id', chatId)
        .eq('user_id', userId)
        .single();

      if (chatError || !chat) {
        return res.status(404).json({ error: 'Чат не найден или нет прав' });
      }

      if (!chat.listener_id) {
        return res.status(400).json({ error: 'В чате нет слушателя для отзыва' });
      }

      // Проверяем существующий отзыв
      const { data: existingReview, error: reviewError } = await supabase
        .from('reviews')
        .select('*')
        .eq('chat_id', chatId)
        .single();

      if (existingReview) {
        return res.status(400).json({ error: 'Отзыв уже оставлен' });
      }

      // Создаем отзыв
      const { data: review, error } = await supabase
        .from('reviews')
        .insert([
          {
            chat_id: chatId,
            listener_id: chat.listener_id,
            user_id: userId,
            rating: rating,
            comment: comment
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Обновляем рейтинг в чате
      await supabase
        .from('chats')
        .update({ 
          rating: rating,
          review_text: comment,
          status: 'closed',
          closed_at: new Date().toISOString()
        })
        .eq('id', chatId);

      res.status(201).json({ review });

    } catch (error) {
      console.error('Add review error:', error);
      res.status(500).json({ error: 'Ошибка добавления отзыва' });
    }
  }
}

const chatController = new ChatController();

// Маршруты
const router = require('express').Router();

router.post('/create', chatController.createChat);
router.post('/message', chatController.sendMessage);
router.get('/:chatId/messages', chatController.getChatMessages);
router.post('/review', chatController.addReview);

module.exports = router;
