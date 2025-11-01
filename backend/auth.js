const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

class AuthController {
  // Регистрация пользователя
  async register(req, res) {
    try {
      const { username, email, password } = req.body;

      // Валидация
      if (!username || !email || !password) {
        return res.status(400).json({ error: 'Все поля обязательны' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
      }

      // Проверка существующего пользователя
      const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select('*')
        .or(`email.eq.${email},username.eq.${username}`)
        .single();

      if (existingUser) {
        return res.status(400).json({ 
          error: existingUser.email === email ? 
            'Email уже используется' : 
            'Имя пользователя уже занято' 
        });
      }

      // Хеширование пароля
      const hashedPassword = await bcrypt.hash(password, 10);

      // Создание пользователя
      const { data: user, error: createError } = await supabase
        .from('users')
        .insert([
          {
            username,
            email,
            password_hash: hashedPassword,
            role: 'user',
            avatar_url: null,
            is_online: false,
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (createError) throw createError;

      // Генерация токена
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email, 
          role: user.role 
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          avatar_url: user.avatar_url
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Ошибка сервера при регистрации' });
    }
  }

  // Вход пользователя
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email и пароль обязательны' });
      }

      // Поиск пользователя
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (userError || !user) {
        return res.status(401).json({ error: 'Неверный email или пароль' });
      }

      // Проверка пароля
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Неверный email или пароль' });
      }

      // Обновление статуса онлайн
      await supabase
        .from('users')
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq('id', user.id);

      // Генерация токена
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email, 
          role: user.role 
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          avatar_url: user.avatar_url
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Ошибка сервера при входе' });
    }
  }

  // Выход пользователя
  async logout(req, res) {
    try {
      const userId = req.user.userId;

      await supabase
        .from('users')
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq('id', userId);

      res.json({ message: 'Успешный выход' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Ошибка при выходе' });
    }
  }

  // Проверка токена
  async verify(req, res) {
    try {
      const userId = req.user.userId;

      const { data: user, error } = await supabase
        .from('users')
        .select('id, username, email, role, avatar_url, is_online')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return res.status(401).json({ error: 'Пользователь не найден' });
      }

      res.json({ user });
    } catch (error) {
      console.error('Verify error:', error);
      res.status(500).json({ error: 'Ошибка проверки токена' });
    }
  }
}

const authController = new AuthController();

// Маршруты
const router = require('express').Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/verify', authController.verify);

module.exports = router;
