// Auth functionality with Supabase
class AuthManager {
    constructor() {
        this.currentForm = 'login';
        this.supabase = null;
        this.init();
    }

    async init() {
        await this.initSupabase();
        this.bindEvents();
        this.checkAuthState();
    }

    async initSupabase() {
        try {
            // Проверяем, что Supabase доступен глобально
            if (window.supabase) {
                this.supabase = window.supabase;
                console.log('✅ Supabase инициализирован');
            } else {
                throw new Error('Supabase не загружен');
            }
        } catch (error) {
            console.error('❌ Ошибка инициализации Supabase:', error);
            this.showNotification('Ошибка подключения к базе данных', 'error');
        }
    }

    bindEvents() {
        // Форма входа
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Форма регистрации
        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // Форма восстановления пароля
        document.getElementById('forgotPasswordForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleForgotPassword();
        });

        // Переключение между формами
        document.getElementById('switchBtn').addEventListener('click', () => {
            this.switchForms();
        });

        // Ссылка "Забыли пароль"
        document.getElementById('forgotPasswordLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.showForm('forgotPassword');
        });

        // Кнопка "Назад к входу"
        document.getElementById('backToLogin').addEventListener('click', () => {
            this.showForm('login');
        });

        // Переключение видимости пароля
        document.getElementById('toggleLoginPassword').addEventListener('click', () => {
            this.togglePassword('loginPassword', 'toggleLoginPassword');
        });

        document.getElementById('toggleRegisterPassword').addEventListener('click', () => {
            this.togglePassword('registerPassword', 'toggleRegisterPassword');
        });

        // Enter key support
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const activeForm = document.querySelector('.auth-form.active');
                if (activeForm) {
                    const submitBtn = activeForm.querySelector('button[type="submit"]');
                    if (submitBtn) submitBtn.click();
                }
            }
        });
    }

    async handleLogin() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('rememberMe').checked;

        // Валидация
        if (!username) {
            this.showNotification('Пожалуйста, введите имя пользователя', 'error');
            return;
        }

        if (!password) {
            this.showNotification('Пожалуйста, введите пароль', 'error');
            return;
        }

        this.setLoading('loginBtn', true);

        try {
            if (!this.supabase) {
                throw new Error('База данных не инициализирована');
            }

            // Ищем пользователя по username
            const { data: user, error: userError } = await this.supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .single();

            if (userError || !user) {
                this.showNotification('Пользователь не найден', 'error');
                return;
            }

            // Проверяем, не заблокирован ли пользователь
            if (user.is_blocked) {
                this.showNotification('Ваш аккаунт заблокирован', 'error');
                return;
            }

            // Проверяем пароль (в реальном приложении используйте хэширование!)
            // ВАЖНО: В продакшене пароли должны храниться в захэшированном виде
            if (user.password_hash !== password) {
                this.showNotification('Неверный пароль', 'error');
                return;
            }

            // Успешный вход
            this.showNotification('Успешный вход! Перенаправление...', 'success');
            
            // Обновляем статус онлайн
            await this.supabase
                .from('users')
                .update({ is_online: true, updated_at: new Date().toISOString() })
                .eq('id', user.id);

            // Сохраняем данные пользователя
            const userData = {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                avatar_url: user.avatar_url,
                theme: user.theme
            };

            localStorage.setItem('auth_token', user.id);
            localStorage.setItem('user_data', JSON.stringify(userData));
            
            if (rememberMe) {
                localStorage.setItem('remember_me', 'true');
            }

            // Логируем вход
            await this.supabase
                .from('system_logs')
                .insert([
                    {
                        user_id: user.id,
                        action: 'user_login',
                        details: { method: 'username_password' },
                        ip_address: await this.getClientIP()
                    }
                ]);

            setTimeout(() => {
                this.redirectUser(userData);
            }, 1500);

        } catch (error) {
            console.error('Login error:', error);
            this.showNotification('Ошибка входа: ' + error.message, 'error');
        } finally {
            this.setLoading('loginBtn', false);
        }
    }

    async handleRegister() {
        const username = document.getElementById('registerUsername').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const acceptTerms = document.getElementById('acceptTerms').checked;

        // Валидация
        if (!username || username.length < 2) {
            this.showNotification('Имя пользователя должно содержать минимум 2 символа', 'error');
            return;
        }

        if (!this.validateEmail(email)) {
            this.showNotification('Пожалуйста, введите корректный email', 'error');
            return;
        }

        if (password.length < 6) {
            this.showNotification('Пароль должен содержать минимум 6 символов', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showNotification('Пароли не совпадают', 'error');
            return;
        }

        if (!acceptTerms) {
            this.showNotification('Необходимо согласие с условиями использования', 'error');
            return;
        }

        this.setLoading('registerBtn', true);

        try {
            if (!this.supabase) {
                throw new Error('База данных не инициализирована');
            }

            // Проверяем, не существует ли уже пользователь с таким username или email
            const { data: existingUsers, error: checkError } = await this.supabase
                .from('users')
                .select('username, email')
                .or(`username.eq.${username},email.eq.${email}`);

            if (checkError) {
                throw new Error('Ошибка проверки пользователя');
            }

            if (existingUsers && existingUsers.length > 0) {
                const existingUser = existingUsers[0];
                if (existingUser.username === username) {
                    this.showNotification('Пользователь с таким именем уже существует', 'error');
                    return;
                }
                if (existingUser.email === email) {
                    this.showNotification('Пользователь с таким email уже существует', 'error');
                    return;
                }
            }

            // ВАЖНО: В реальном приложении пароль должен быть захэширован!
            // Здесь используется plain text для демонстрации
            const password_hash = password; // Замените на bcrypt.hash(password, 10)

            // Создаем нового пользователя
            const { data: newUser, error: createError } = await this.supabase
                .from('users')
                .insert([
                    {
                        username: username,
                        email: email,
                        password_hash: password_hash,
                        role: 'user',
                        theme: 'light',
                        is_online: false,
                        is_blocked: false,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                ])
                .select();

            if (createError) {
                throw new Error('Ошибка создания пользователя: ' + createError.message);
            }

            // Логируем регистрацию
            await this.supabase
                .from('system_logs')
                .insert([
                    {
                        user_id: newUser[0].id,
                        action: 'user_registration',
                        details: { username: username, email: email },
                        ip_address: await this.getClientIP()
                    }
                ]);

            this.showNotification('Регистрация успешна! Вы можете войти.', 'success');
            
            setTimeout(() => {
                this.showForm('login');
                document.getElementById('registerForm').reset();
            }, 2000);

        } catch (error) {
            console.error('Register error:', error);
            this.showNotification('Ошибка регистрации: ' + error.message, 'error');
        } finally {
            this.setLoading('registerBtn', false);
        }
    }

    async handleForgotPassword() {
        const email = document.getElementById('forgotEmail').value;

        if (!this.validateEmail(email)) {
            this.showNotification('Пожалуйста, введите корректный email', 'error');
            return;
        }

        this.setLoading('forgotBtn', true);

        try {
            if (!this.supabase) {
                throw new Error('База данных не инициализирована');
            }

            // Ищем пользователя по email
            const { data: user, error: searchError } = await this.supabase
                .from('users')
                .select('id, username, email')
                .eq('email', email)
                .single();

            if (searchError || !user) {
                this.showNotification('Пользователь с таким email не найден', 'error');
                return;
            }

            // Здесь должна быть логика отправки email с инструкциями
            // Например, отправка письма через ваш email сервис
            
            // Создаем уведомление для пользователя
            await this.supabase
                .from('notifications')
                .insert([
                    {
                        user_id: user.id,
                        title: 'Восстановление пароля',
                        message: 'Запрос на восстановление пароля был получен. Следуйте инструкциям, отправленным на ваш email.',
                        notification_type: 'info'
                    }
                ]);

            this.showNotification('Инструкции по восстановлению пароля отправлены на ваш email', 'success');
            
            setTimeout(() => {
                this.showForm('login');
                document.getElementById('forgotPasswordForm').reset();
            }, 3000);

        } catch (error) {
            console.error('Forgot password error:', error);
            this.showNotification('Ошибка восстановления пароля: ' + error.message, 'error');
        } finally {
            this.setLoading('forgotBtn', false);
        }
    }

    async getClientIP() {
        // Упрощенный метод получения IP (в реальном приложении используйте серверный endpoint)
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'unknown';
        }
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Остальные методы остаются без изменений...
    showForm(formType) {
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });

        const targetForm = document.getElementById(formType + 'Form');
        if (targetForm) {
            targetForm.classList.add('active');
            this.currentForm = formType;
        }

        if (formType === 'login') {
            document.getElementById('switchText').textContent = 'Нет аккаунта?';
            document.getElementById('switchBtn').textContent = 'Создать аккаунт';
        } else if (formType === 'register') {
            document.getElementById('switchText').textContent = 'Уже есть аккаунт?';
            document.getElementById('switchBtn').textContent = 'Войти';
        }

        window.scrollTo(0, 0);
    }

    switchForms() {
        if (this.currentForm === 'login') {
            this.showForm('register');
        } else {
            this.showForm('login');
        }
    }

    togglePassword(inputId, buttonId) {
        const input = document.getElementById(inputId);
        const toggleBtn = document.getElementById(buttonId);
        const icon = toggleBtn.querySelector('i');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
        }
    }

    setLoading(buttonId, isLoading) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        if (isLoading) {
            button.disabled = true;
            button.classList.add('loading');
        } else {
            button.disabled = false;
            button.classList.remove('loading');
        }
    }

    showNotification(message, type = 'success') {
        let container = document.getElementById('notificationsContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notificationsContainer';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            document.body.appendChild(container);
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            padding: 16px 20px;
            border-radius: 12px;
            color: white;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            animation: slideInRight 0.3s ease;
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 300px;
            max-width: 400px;
        `;

        const icon = document.createElement('i');
        icon.className = type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-triangle';
        notification.appendChild(icon);

        const messageEl = document.createElement('span');
        messageEl.textContent = message;
        notification.appendChild(messageEl);

        container.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);

        // Добавляем стили для анимаций, если их еще нет
        if (!document.getElementById('notificationStyles')) {
            const style = document.createElement('style');
            style.id = 'notificationStyles';
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOutRight {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
                .notification.success {
                    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                }
                .notification.error {
                    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                }
            `;
            document.head.appendChild(style);
        }
    }

    redirectUser(user) {
        const role = user?.role || 'user';
        
        const roleNames = {
            'user': 'Пользователь',
            'listener': 'Слушатель', 
            'coowner': 'Совладелец',
            'admin': 'Администратор',
            'owner': 'Владелец'
        };
        
        this.showNotification(`Добро пожаловать, ${user.username}! Ваша роль: ${roleNames[role]}`, 'success');
        
        // В реальном приложении здесь будет перенаправление
        setTimeout(() => {
            // window.location.href = '/chat.html'; // Раскомментируйте для реального использования
        }, 2000);
    }

    checkAuthState() {
        const token = localStorage.getItem('auth_token');
        if (token) {
            this.validateToken(token);
        }
    }

    async validateToken(token) {
        try {
            if (!this.supabase) return;

            const { data: user, error } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', token)
                .single();

            if (!error && user && !user.is_blocked) {
                this.redirectUser(user);
            }
        } catch (error) {
            console.error('Token validation error:', error);
        }
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.authManager = new AuthManager();
});
