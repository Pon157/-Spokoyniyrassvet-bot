const { supabase } = require('./db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

class SocketManager {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map();
  }

  init(io) {
    this.io = io;

    io.on('connection', (socket) => {
      console.log('🔌 Новое подключение:', socket.id);

      // Аутентификация через JWT
      socket.on('authenticate', async (token) => {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          const userId = decoded.userId;

          // Проверяем пользователя в БД
          const { data: user, error } = await supabase
            .from('users')
            .select('id, username, role, avatar_url')
            .eq('id', userId)
            .single();

          if (error || !user) {
            socket.emit('auth_error', 'Пользователь не найден');
            return;
          }

          // Сохраняем информацию о подключении
          socket.userId = userId;
          socket.userData = user;
          this.connectedUsers.set(userId, socket);

          // Обновляем статус онлайн
          await supabase
            .from('users')
            .update({ is_online: true })
            .eq('id', userId);

          // Присоединяем к комнатам
          socket.join(`user_${userId}`);
          if (user.role === 'listener') {
            socket.join('listeners');
          }
          if (['admin', 'coowner', 'owner'].includes(user.role)) {
            socket.join('admins');
          }

          socket.emit('authenticated', user);
          this.broadcastUserStatus(userId, true);

          console.log(`✅ Пользователь ${user.username} аутентифицирован`);

        } catch (error) {
          console.error('Socket auth error:', error);
          socket.emit('auth_error', 'Ошибка аутентификации');
        }
      });

      // Отправка сообщения
      socket.on('send_message', async (data) => {
        try {
          if (!socket.userId) {
            socket.emit('error', 'Не авторизован');
            return;
          }

          const { chatId, content, messageType = 'text', mediaUrl = null } = data;

          // Сохраняем в БД
          const { data: message, error } = await supabase
            .from('messages')
            .insert([
              {
                chat_id: chatId,
                sender_id: socket.userId,
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

          // Отправляем всем участникам чата
          io.to(`chat_${chatId}`).emit('new_message', message);

          // Обновляем время последней активности чата
          await supabase
            .from('chats')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', chatId);

        } catch (error) {
          console.error('Send message socket error:', error);
          socket.emit('error', 'Ошибка отправки сообщения');
        }
      });

      // Присоединение к чату
      socket.on('join_chat', (chatId) => {
        socket.join(`chat_${chatId}`);
        console.log(`💬 Пользователь ${socket.userId} присоединился к чату ${chatId}`);
      });

      // Покидание чата
      socket.on('leave_chat', (chatId) => {
        socket.leave(`chat_${chatId}`);
        console.log(`🚪 Пользователь ${socket.userId} покинул чат ${chatId}`);
      });

      // Типирование
      socket.on('typing_start', (data) => {
        socket.to(`chat_${data.chatId}`).emit('user_typing', {
          userId: socket.userId,
          username: socket.userData.username,
          chatId: data.chatId
        });
      });

      socket.on('typing_stop', (data) => {
        socket.to(`chat_${data.chatId}`).emit('user_stop_typing', {
          userId: socket.userId,
          chatId: data.chatId
        });
      });

      // Отключение
      socket.on('disconnect', async () => {
        console.log('🔌 Отключение:', socket.id);

        if (socket.userId) {
          this.connectedUsers.delete(socket.userId);

          // Обновляем статус оффлайн
          await supabase
            .from('users')
            .update({ 
              is_online: false,
              last_seen: new Date().toISOString()
            })
            .eq('id', socket.userId);

          this.broadcastUserStatus(socket.userId, false);
        }
      });
    });
  }

  // Рассылка статуса пользователя
  broadcastUserStatus(userId, isOnline) {
    this.io.emit('user_status_change', {
      userId,
      isOnline,
      lastSeen: new Date().toISOString()
    });
  }

  // Отправка уведомления конкретному пользователю
  sendNotification(userId, notification) {
    const userSocket = this.connectedUsers.get(userId);
    if (userSocket) {
      userSocket.emit('new_notification', notification);
    }
  }

  // Рассылка системного сообщения
  broadcastSystemMessage(message) {
    this.io.emit('system_message', message);
  }
}

const socketManager = new SocketManager();

function initSocket(io) {
  socketManager.init(io);
}

module.exports = { initSocket, socketManager };
