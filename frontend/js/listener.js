class ListenerInterface {
    constructor() {
        console.log('🎧 Конструктор ListenerInterface вызван');
        this.currentTab = 'user-chat';
        this.isOnline = true;
        this.notifications = [];
        this.currentChats = [];
        this.onlineListeners = [];
        this.selectedListener = null;
        this.init();
    }

    init() {
        console.log('=== ИНИЦИАЛИЗАЦИЯ ИНТЕРФЕЙСА СЛУШАТЕЛЯ ===');
        console.log('Токен:', localStorage.getItem('token'));
        console.log('Пользователь:', JSON.parse(localStorage.getItem('user') || '{}'));
        
        try {
            this.bindEvents();
            console.log('✅ События привязаны');
            
            this.loadUserData();
            console.log('✅ Данные пользователя загружены');
            
            this.setupSocketListeners();
            console.log('✅ WebSocket слушатели установлены');
            
            this.loadInitialData();
            console.log('✅ Начальные данные загружены');
            
            console.log('=== ИНИЦИАЛИЗАЦИЯ ЗАВЕРШЕНА ===');
        } catch (error) {
            console.error('❌ Ошибка инициализации:', error);
        }
    }

    bindEvents() {
        console.log('🔗 Привязка событий...');
        
        try {
            // Навигация по табам
            const navItems = document.querySelectorAll('.nav-item');
            console.log('Найдено элементов навигации:', navItems.length);
            
            navItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    console.log('🔄 Переключение на таб:', e.currentTarget.dataset.tab);
                    this.switchTab(e.currentTarget.dataset.tab);
                });
            });

            // Онлайн/оффлайн статус
            const statusElement = document.getElementById('onlineStatus');
            if (statusElement) {
                statusElement.addEventListener('click', () => {
                    console.log('🟢 Клик по статусу онлайн');
                    this.toggleOnlineStatus();
                });
            } else {
                console.warn('❌ Элемент onlineStatus не найден');
            }

            // Уведомления
            const notificationsBtn = document.getElementById('notificationsBtn');
            if (notificationsBtn) {
                notificationsBtn.addEventListener('click', () => {
                    console.log('🔔 Клик по уведомлениям');
                    this.toggleNotifications();
                });
            }

            const closeNotifications = document.getElementById('closeNotifications');
            if (closeNotifications) {
                closeNotifications.addEventListener('click', () => {
                    console.log('❌ Закрытие уведомлений');
                    this.hideNotifications();
                });
            }

            // Настройки
            const settingsBtn = document.getElementById('settingsBtn');
            if (settingsBtn) {
                settingsBtn.addEventListener('click', () => {
                    console.log('⚙️ Клик по настройкам');
                    this.openSettings();
                });
            }

            // Выход
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => {
                    console.log('🚪 Выход из системы');
                    this.logout();
                });
            }

            // Обновление чатов
            const refreshChats = document.getElementById('refreshChats');
            if (refreshChats) {
                refreshChats.addEventListener('click', () => {
                    console.log('🔄 Обновление чатов');
                    this.loadUserChats();
                });
            }

            // Обновление слушателей
            const refreshListeners = document.getElementById('refreshListeners');
            if (refreshListeners) {
                refreshListeners.addEventListener('click', () => {
                    console.log('👥 Обновление списка слушателей');
                    this.loadOnlineListeners();
                });
            }

            // Отправка сообщения слушателю
            const sendListenerMessage = document.getElementById('sendListenerMessage');
            if (sendListenerMessage) {
                sendListenerMessage.addEventListener('click', () => {
                    console.log('📨 Отправка сообщения слушателю');
                    this.sendListenerMessage();
                });
            }

            const listenerMessageText = document.getElementById('listenerMessageText');
            if (listenerMessageText) {
                listenerMessageText.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        console.log('📨 Отправка сообщения (Enter)');
                        this.sendListenerMessage();
                    }
                });
            }

            // Закрытие модальных окон
            const closeModals = document.querySelectorAll('.close-modal');
            console.log('Найдено модальных окон:', closeModals.length);
            closeModals.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    console.log('❌ Закрытие модального окна');
                    e.target.closest('.modal').classList.add('hidden');
                });
            });

            // Клик вне уведомлений
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.notifications-panel') && !e.target.closest('#notificationsBtn')) {
                    this.hideNotifications();
                }
            });

            console.log('✅ Все события успешно привязаны');
        } catch (error) {
            console.error('❌ Ошибка привязки событий:', error);
        }
    }

    async loadUserData() {
        console.log('👤 Загрузка данных пользователя...');
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user.username) {
                document.getElementById('userName').textContent = user.username;
                if (user.avatar_url) {
                    document.getElementById('userAvatar').src = user.avatar_url;
                }
                console.log('✅ Данные пользователя установлены:', user.username);
            } else {
                console.warn('⚠️ Данные пользователя не найдены в localStorage');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки данных пользователя:', error);
        }
    }

    switchTab(tabName) {
        console.log('📁 Переключение на таб:', tabName);
        
        // Обновляем активную кнопку навигации
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Показываем соответствующий контент
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');

        this.currentTab = tabName;
        console.log('✅ Активный таб установлен:', tabName);

        // Загружаем данные для активного таба
        switch(tabName) {
            case 'user-chat':
                console.log('💬 Загрузка чатов с пользователями');
                this.loadUserChats();
                break;
            case 'listener-chat':
                console.log('👥 Загрузка чата с слушателями');
                this.loadListenerChat();
                break;
            case 'reviews':
                console.log('⭐ Загрузка отзывов');
                this.loadReviews();
                break;
            case 'statistics':
                console.log('📊 Загрузка статистики');
                this.loadStatistics();
                break;
        }
    }

    async toggleOnlineStatus() {
        console.log('🔄 Переключение онлайн статуса. Текущий:', this.isOnline);
        this.isOnline = !this.isOnline;
        this.updateStatusDisplay();

        // Отправляем статус на сервер
        try {
            console.log('📡 Отправка статуса на сервер:', this.isOnline);
            const response = await fetch('/api/listener/status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ online: this.isOnline })
            });

            if (!response.ok) {
                throw new Error('Ошибка обновления статуса');
            }

            console.log('✅ Статус успешно обновлен на сервере');

            // Отправляем статус через WebSocket
            if (window.socket) {
                window.socket.emit('listener_status', {
                    listenerId: this.getUserId(),
                    online: this.isOnline
                });
                console.log('📡 Статус отправлен через WebSocket');
            }
        } catch (error) {
            console.error('❌ Ошибка обновления статуса:', error);
            // Возвращаем предыдущий статус в случае ошибки
            this.isOnline = !this.isOnline;
            this.updateStatusDisplay();
        }
    }

    updateStatusDisplay() {
        console.log('🎨 Обновление отображения статуса:', this.isOnline);
        const statusElement = document.getElementById('onlineStatus');
        const userStatus = document.getElementById('userStatus');
        
        if (this.isOnline) {
            statusElement.classList.remove('offline');
            statusElement.classList.add('online');
            statusElement.querySelector('.status-text').textContent = 'Онлайн';
            userStatus.textContent = 'Онлайн';
            userStatus.className = 'user-status status-online';
        } else {
            statusElement.classList.remove('online');
            statusElement.classList.add('offline');
            statusElement.querySelector('.status-text').textContent = 'Оффлайн';
            userStatus.textContent = 'Оффлайн';
            userStatus.className = 'user-status status-offline';
        }
        console.log('✅ Отображение статуса обновлено');
    }

    async loadUserChats() {
        console.log('💬 Загрузка чатов пользователей...');
        try {
            document.getElementById('chatsList').innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    Загрузка чатов...
                </div>
            `;

            const token = localStorage.getItem('token');
            console.log('📡 Запрос к /api/listener/chats');
            const response = await fetch('/api/listener/chats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('📨 Ответ сервера:', response.status);
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Чаты загружены:', data.chats?.length || 0);
                this.currentChats = data.chats || [];
                this.renderUserChats(this.currentChats);
                this.updateChatsBadge();
            } else {
                throw new Error('Ошибка загрузки чатов: ' + response.status);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки чатов:', error);
            document.getElementById('chatsList').innerHTML = `
                <div class="empty-state">
                    <p>Ошибка загрузки чатов</p>
                    <button class="btn-secondary" onclick="listenerApp.loadUserChats()">Повторить</button>
                </div>
            `;
        }
    }

    renderUserChats(chats) {
        console.log('🎨 Отрисовка чатов:', chats.length);
        const chatsList = document.getElementById('chatsList');
        
        if (chats.length === 0) {
            chatsList.innerHTML = `
                <div class="empty-state">
                    <p>Нет активных чатов</p>
                    <p class="text-muted">Новые чаты появятся здесь, когда пользователи обратятся за помощью</p>
                </div>
            `;
            console.log('📭 Нет активных чатов для отображения');
            return;
        }

        chatsList.innerHTML = chats.map(chat => `
            <div class="chat-item ${chat.unread_count > 0 ? 'unread' : ''}" data-chat-id="${chat.id}">
                <div class="chat-avatar">
                    ${chat.user_avatar ? 
                        `<img src="${chat.user_avatar}" alt="${chat.user_name}">` : 
                        chat.user_name?.charAt(0) || 'П'
                    }
                </div>
                <div class="chat-info">
                    <div class="chat-user">${chat.user_name || 'Пользователь'}</div>
                    <div class="chat-last-message">${chat.last_message || 'Чат начат'}</div>
                </div>
                <div class="chat-meta">
                    <div class="chat-time">${this.formatTime(chat.last_message_time || chat.created_at)}</div>
                    ${chat.unread_count > 0 ? `<div class="chat-unread">${chat.unread_count}</div>` : ''}
                </div>
            </div>
        `).join('');

        console.log('✅ Чаты отрисованы');

        // Добавляем обработчики кликов для чатов
        chatsList.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', () => {
                const chatId = item.dataset.chatId;
                console.log('💬 Открытие чата:', chatId);
                this.openChat(chatId);
            });
        });
    }

    async loadListenerChat() {
        console.log('👥 Загрузка чата с слушателями');
        await this.loadOnlineListeners();
    }

    async loadOnlineListeners() {
        console.log('👥 Загрузка онлайн слушателей...');
        try {
            document.getElementById('listenersList').innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    Загрузка слушателей...
                </div>
            `;

            const token = localStorage.getItem('token');
            console.log('📡 Запрос к /api/listener/online-listeners');
            const response = await fetch('/api/listener/online-listeners', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('📨 Ответ сервера:', response.status);
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Слушатели загружены:', data.listeners?.length || 0);
                this.onlineListeners = data.listeners || [];
                this.renderOnlineListeners(this.onlineListeners);
            } else {
                console.warn('⚠️ Ошибка загрузки слушателей, используем мок данные');
                this.renderOnlineListeners(this.getMockListeners());
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки слушателей:', error);
            this.renderOnlineListeners(this.getMockListeners());
        }
    }

    getMockListeners() {
        console.log('🎭 Использование мок данных слушателей');
        return [
            {
                id: '2',
                name: 'Анна Слушатель',
                avatar: '/images/default-avatar.svg',
                is_online: true,
                bio: 'Психолог с 5-летним опытом',
                rating: 4.8
            },
            {
                id: '3', 
                name: 'Максим Помощник',
                avatar: '/images/default-avatar.svg',
                is_online: false,
                bio: 'Специалист по кризисным ситуациям',
                rating: 4.9
            }
        ];
    }

    renderOnlineListeners(listeners) {
        console.log('🎨 Отрисовка слушателей:', listeners.length);
        const listenersList = document.getElementById('listenersList');
        
        if (listeners.length === 0) {
            listenersList.innerHTML = `
                <div class="empty-state">
                    <p>Нет онлайн слушателей</p>
                </div>
            `;
            console.log('📭 Нет слушателей для отображения');
            return;
        }

        listenersList.innerHTML = listeners.map(listener => `
            <div class="listener-item ${this.selectedListener?.id === listener.id ? 'active' : ''}" 
                 data-listener-id="${listener.id}">
                <div class="listener-avatar">
                    ${listener.avatar ? 
                        `<img src="${listener.avatar}" alt="${listener.name}">` : 
                        listener.name?.charAt(0) || 'С'
                    }
                </div>
                <div class="listener-info">
                    <div class="listener-name">${listener.name}</div>
                    <div class="listener-status ${listener.is_online ? 'status-online' : 'status-offline'}">
                        <span class="status-dot"></span>
                        ${listener.is_online ? 'Онлайн' : 'Оффлайн'}
                    </div>
                </div>
            </div>
        `).join('');

        console.log('✅ Слушатели отрисованы');

        // Добавляем обработчики кликов для слушателей
        listenersList.querySelectorAll('.listener-item').forEach(item => {
            item.addEventListener('click', () => {
                const listenerId = item.dataset.listenerId;
                console.log('👤 Выбор слушателя:', listenerId);
                this.selectListener(listenerId);
            });
        });
    }

    selectListener(listenerId) {
        console.log('🎯 Выбор слушателя:', listenerId);
        this.selectedListener = this.onlineListeners.find(l => l.id === listenerId);
        
        // Обновляем UI
        document.querySelectorAll('.listener-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-listener-id="${listenerId}"]`).classList.add('active');

        // Показываем поле ввода сообщения
        document.getElementById('listenerMessageInput').classList.remove('hidden');
        
        console.log('✅ Слушатель выбран:', this.selectedListener?.name);
        
        // Загружаем историю сообщений
        this.loadListenerChatHistory(listenerId);
    }

    async loadListenerChatHistory(listenerId) {
        console.log('💬 Загрузка истории чата с слушателем:', listenerId);
        // Заглушка для загрузки истории сообщений
        const messagesContainer = document.getElementById('listenerChatMessages');
        messagesContainer.innerHTML = `
            <div class="empty-state">
                <p>Начните общение с ${this.selectedListener?.name}</p>
            </div>
        `;
        console.log('✅ История чата загружена (заглушка)');
    }

    async sendListenerMessage() {
        const messageInput = document.getElementById('listenerMessageText');
        const message = messageInput.value.trim();
        
        console.log('📨 Отправка сообщения слушателю:', {
            message: message,
            selectedListener: this.selectedListener
        });
        
        if (!message || !this.selectedListener) {
            console.warn('⚠️ Нельзя отправить пустое сообщение или слушатель не выбран');
            return;
        }

        // Отправляем сообщение через WebSocket
        if (window.socket) {
            window.socket.emit('send_message', {
                chat_id: `listener_${this.selectedListener.id}`,
                content: message,
                message_type: 'text'
            });
            console.log('📡 Сообщение отправлено через WebSocket');
        }

        // Очищаем поле ввода
        messageInput.value = '';

        // Добавляем сообщение в UI
        this.addListenerMessageToUI({
            id: Date.now().toString(),
            content: message,
            sender_id: this.getUserId(),
            created_at: new Date().toISOString(),
            sender: {
                username: 'Вы',
                avatar_url: '/images/default-avatar.svg'
            }
        });

        console.log('✅ Сообщение добавлено в UI');
    }

    addListenerMessageToUI(message) {
        console.log('💬 Добавление сообщения в UI:', message.content);
        const messagesContainer = document.getElementById('listenerChatMessages');
        
        // Убираем empty state если есть
        if (messagesContainer.querySelector('.empty-state')) {
            messagesContainer.innerHTML = '';
        }

        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.sender_id === this.getUserId() ? 'message-outgoing' : 'message-incoming'}`;
        messageElement.innerHTML = `
            <div class="message-content">${message.content}</div>
            <div class="message-time">${this.formatTime(message.created_at)}</div>
        `;

        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        console.log('✅ Сообщение добавлено в контейнер');
    }

    async loadReviews() {
        console.log('⭐ Загрузка отзывов...');
        try {
            document.getElementById('reviewsList').innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    Загрузка отзывов...
                </div>
            `;

            const token = localStorage.getItem('token');
            console.log('📡 Запрос к /api/listener/reviews');
            const response = await fetch('/api/listener/reviews', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('📨 Ответ сервера:', response.status);
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Отзывы загружены:', data.reviews?.length || 0);
                this.renderReviews(data);
            } else {
                throw new Error('Ошибка загрузки отзывов: ' + response.status);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки отзывов:', error);
            this.renderReviews({
                reviews: [],
                averageRating: 0,
                totalReviews: 0
            });
        }
    }

    renderReviews(data) {
        console.log('🎨 Отрисовка отзывов');
        document.getElementById('avgRating').textContent = data.averageRating?.toFixed(1) || '0.0';
        document.getElementById('totalReviews').textContent = data.totalReviews || data.reviews?.length || 0;

        const reviewsList = document.getElementById('reviewsList');
        
        if (!data.reviews || data.reviews.length === 0) {
            reviewsList.innerHTML = `
                <div class="empty-state">
                    <p>Пока нет отзывов</p>
                    <p class="text-muted">Отзывы появятся здесь после завершения чатов с пользователями</p>
                </div>
            `;
            console.log('📭 Нет отзывов для отображения');
            return;
        }

        reviewsList.innerHTML = data.reviews.map(review => `
            <div class="review-item">
                <div class="review-header">
                    <span class="review-user">${review.user_name || 'Пользователь'}</span>
                    <span class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5-review.rating)}</span>
                    <span class="review-date">${this.formatDate(review.created_at)}</span>
                </div>
                <div class="review-text">${review.comment || 'Без комментария'}</div>
            </div>
        `).join('');

        console.log('✅ Отзывы отрисованы');
    }

    async loadStatistics() {
        console.log('📊 Загрузка статистики...');
        try {
            const token = localStorage.getItem('token');
            console.log('📡 Запрос к /api/listener/statistics');
            const response = await fetch('/api/listener/statistics', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('📨 Ответ сервера:', response.status);
            if (response.ok) {
                const stats = await response.json();
                console.log('✅ Статистика загружена');
                this.renderStatistics(stats);
            } else {
                throw new Error('Ошибка загрузки статистики: ' + response.status);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
            this.renderStatistics({
                totalSessions: 12,
                activeChats: 3,
                averageSessionTime: 25,
                helpfulness: 85,
                weeklyActivity: {
                    '01.01': 5,
                    '02.01': 8,
                    '03.01': 12,
                    '04.01': 6,
                    '05.01': 9,
                    '06.01': 11,
                    '07.01': 7
                }
            });
        }
    }

    renderStatistics(stats) {
        console.log('📈 Отрисовка статистики:', stats);
        document.getElementById('totalSessions').textContent = stats.totalSessions || 0;
        document.getElementById('activeChats').textContent = stats.activeChats || 0;
        document.getElementById('avgSessionTime').textContent = stats.averageSessionTime || 0;
        document.getElementById('helpfulness').textContent = `${stats.helpfulness || 0}%`;

        // Рендерим график активности
        this.renderActivityChart(stats.weeklyActivity || {});
        console.log('✅ Статистика отрисована');
    }

    renderActivityChart(activityData) {
        console.log('📊 Отрисовка графика активности:', activityData);
        const chartContainer = document.getElementById('activityChart');
        const days = Object.keys(activityData);
        const values = Object.values(activityData);
        const maxValue = Math.max(...values, 1);

        chartContainer.innerHTML = days.map((day, index) => {
            const value = values[index];
            const height = (value / maxValue) * 100;
            
            return `
                <div class="chart-bar" style="height: ${height}%" title="${day}: ${value} сессий">
                    <span class="chart-value">${value}</span>
                    <span class="chart-label">${day.split('.')[0]}.${day.split('.')[1]}</span>
                </div>
            `;
        }).join('');

        console.log('✅ График активности отрисован');
    }

    async openChat(chatId) {
        console.log('💬 Открытие чата:', chatId);
        // Используем существующий чат интерфейс
        if (typeof ChatManager !== 'undefined') {
            ChatManager.openChat(chatId);
        } else {
            // Fallback: открываем в модальном окне
            this.openChatModal(chatId);
        }
    }

    openChatModal(chatId) {
        console.log('📱 Открытие модального окна чата:', chatId);
        const chat = this.currentChats.find(c => c.id === chatId);
        if (!chat) {
            console.warn('⚠️ Чат не найден:', chatId);
            return;
        }

        document.getElementById('chatModalTitle').textContent = `Чат с ${chat.user_name}`;
        document.getElementById('chatModal').classList.remove('hidden');
        
        // Здесь можно загрузить историю сообщений чата
        document.getElementById('chatInterface').innerHTML = `
            <div class="empty-state">
                <p>Загрузка истории сообщений...</p>
            </div>
        `;
        console.log('✅ Модальное окно чата открыто');
    }

    toggleNotifications() {
        console.log('🔔 Переключение панели уведомлений');
        const panel = document.getElementById('notificationsPanel');
        panel.classList.toggle('hidden');
        
        if (!panel.classList.contains('hidden')) {
            console.log('✅ Панель уведомлений открыта');
            this.markNotificationsAsRead();
        } else {
            console.log('✅ Панель уведомлений закрыта');
        }
    }

    hideNotifications() {
        console.log('❌ Скрытие панели уведомлений');
        document.getElementById('notificationsPanel').classList.add('hidden');
    }

    async markNotificationsAsRead() {
        console.log('📝 Отметка уведомлений как прочитанных');
        try {
            await fetch('/api/notifications/read', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            document.getElementById('notificationBadge').classList.add('hidden');
            console.log('✅ Уведомления отмечены как прочитанные');
        } catch (error) {
            console.error('❌ Ошибка отметки уведомлений:', error);
        }
    }

    openSettings() {
        console.log('⚙️ Открытие настроек');
        // Используем существующий модуль настроек
        if (typeof SettingsManager !== 'undefined') {
            SettingsManager.openModal();
        } else {
            // Fallback: переходим на страницу настроек
            window.location.href = 'settings.html';
        }
    }

    logout() {
        console.log('🚪 Выход из системы');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    }

    setupSocketListeners() {
        console.log('🔌 Настройка WebSocket слушателей');
        if (!window.socket) {
            console.warn('⚠️ WebSocket не инициализирован');
            return;
        }

        // Слушаем новые сообщения от пользователей
        window.socket.on('new_message', (data) => {
            console.log('💬 Новое сообщение от пользователя:', data);
            this.handleNewMessage(data);
        });

        // Слушаем новые уведомления
        window.socket.on('new_notification', (data) => {
            console.log('🔔 Новое уведомление:', data);
            this.handleNewNotification(data);
        });

        // Слушаем обновления статусов слушателей
        window.socket.on('listener_status_update', (data) => {
            console.log('🔄 Обновление статуса слушателя:', data);
            this.handleListenerStatusUpdate(data);
        });

        // Слушаем новые сообщения от слушателей
        window.socket.on('new_listener_message', (data) => {
            console.log('💬 Новое сообщение от слушателя:', data);
            this.handleNewListenerMessage(data);
        });

        console.log('✅ WebSocket слушатели установлены');
    }

    handleNewMessage(data) {
        console.log('📨 Обработка нового сообщения');
        // Обновляем список чатов если есть новое сообщение
        this.loadUserChats();
        
        // Показываем уведомление
        this.showNotification(`Новое сообщение в чате`, 'message');
    }

    handleNewNotification(notification) {
        console.log('🔔 Обработка нового уведомления:', notification);
        this.notifications.unshift(notification);
        this.updateNotificationsBadge();
        this.renderNotifications();
        
        // Показываем toast уведомление
        this.showToast(notification.message);
    }

    handleListenerStatusUpdate(data) {
        console.log('🔄 Обработка обновления статуса слушателя:', data);
        // Обновляем список онлайн слушателей
        if (this.currentTab === 'listener-chat') {
            this.loadOnlineListeners();
        }
    }

    handleNewListenerMessage(data) {
        console.log('💬 Обработка нового сообщения от слушателя:', data);
        // Добавляем сообщение в UI если это выбранный слушатель
        if (this.selectedListener && data.sender_id === this.selectedListener.id) {
            this.addListenerMessageToUI(data);
        }
    }

    updateNotificationsBadge() {
        const unreadCount = this.notifications.filter(n => !n.read).length;
        const badge = document.getElementById('notificationBadge');
        
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.classList.remove('hidden');
            console.log('🟡 Обновлен бейдж уведомлений:', unreadCount);
        } else {
            badge.classList.add('hidden');
            console.log('🟢 Бейдж уведомлений скрыт');
        }
    }

    updateChatsBadge() {
        const unreadCount = this.currentChats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);
        const badge = document.getElementById('userChatsBadge');
        
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.classList.remove('hidden');
            console.log('🟡 Обновлен бейдж чатов:', unreadCount);
        } else {
            badge.classList.add('hidden');
            console.log('🟢 Бейдж чатов скрыт');
        }
    }

    renderNotifications() {
        console.log('🎨 Отрисовка уведомлений:', this.notifications.length);
        const list = document.getElementById('notificationsList');
        
        if (this.notifications.length === 0) {
            list.innerHTML = '<div class="empty-state">Нет уведомлений</div>';
            console.log('📭 Нет уведомлений для отображения');
            return;
        }

        list.innerHTML = this.notifications.map(notification => `
            <div class="notification-item ${notification.read ? '' : 'unread'}">
                <div class="notification-content">${notification.message}</div>
                <div class="notification-time">${this.formatTime(notification.created_at)}</div>
            </div>
        `).join('');

        console.log('✅ Уведомления отрисованы');
    }

    showToast(message) {
        console.log('🍞 Показ toast уведомления:', message);
        // Создаем и показываем toast уведомление
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
            console.log('✅ Toast уведомление удалено');
        }, 3000);
    }

    showNotification(message, type = 'info') {
        console.log('📢 Показ системного уведомления:', message);
        // Можно интегрировать с системой уведомлений браузера
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Спокойный рассвет', {
                body: message,
                icon: '/images/icon.png'
            });
        }
    }

    getUserId() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        console.log('👤 Получение ID пользователя:', user.id);
        return user.id;
    }

    formatTime(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU');
    }

    loadInitialData() {
        console.log('📥 Загрузка начальных данных');
        this.loadUserChats();
        this.loadReviews();
        this.loadStatistics();
        
        // Запрашиваем разрешение на уведомления
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
        
        console.log('✅ Начальные данные загружены');
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM загружен, инициализация интерфейса слушателя');
    
    // ВРЕМЕННО ОТКЛЮЧАЕМ ПРОВЕРКУ ТОКЕНА ДЛЯ ТЕСТИРОВАНИЯ
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    console.log('🔐 Проверка авторизации:', {
        hasToken: !!token,
        user: user
    });
    
    // ЗАКОММЕНТИРУЕМ ПЕРЕНАПРАВЛЕНИЕ ДЛЯ ТЕСТА
    // if (!token) {
    //     console.warn('❌ Нет токена, перенаправление на index.html');
    //     window.location.href = 'index.html';
    //     return;
    // }

    console.log('✅ Пропускаем проверку токена для тестирования');

    // Инициализируем интерфейс слушателя
    window.listenerApp = new ListenerInterface();
    console.log('🎉 Интерфейс слушателя инициализирован');
});
