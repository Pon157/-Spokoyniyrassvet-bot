class ListenerApp {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.isOnline = true;
        this.currentTab = 'dashboard';
        this.activeChatId = null;
        this.isInitialized = false;
        
        this.init();
    }

    init() {
        console.log('🎧 Инициализация приложения слушателя');
        this.checkAuthAndLoad();
    }

    async checkAuthAndLoad() {
        try {
            console.log('🔐 Проверка аутентификации...');
            
            // Проверяем токен
            const token = localStorage.getItem('auth_token');
            if (!token) {
                console.log('❌ Токен не найден, перенаправление на вход');
                this.redirectToLogin();
                return;
            }

            // Проверяем валидность токена
            const userData = localStorage.getItem('user_data');
            if (!userData) {
                console.log('❌ Данные пользователя не найдены');
                this.redirectToLogin();
                return;
            }

            // Парсим данные пользователя
            this.currentUser = JSON.parse(userData);
            
            // Проверяем роль
            if (this.currentUser.role !== 'listener') {
                console.log('❌ Недостаточно прав: требуется роль listener');
                this.redirectToLogin();
                return;
            }

            console.log('✅ Пользователь аутентифицирован:', this.currentUser.username);
            
            // Инициализируем интерфейс
            this.initializeInterface();
            
        } catch (error) {
            console.error('❌ Ошибка проверки аутентификации:', error);
            this.redirectToLogin();
        }
    }

    initializeInterface() {
        if (this.isInitialized) {
            console.log('⚠️ Интерфейс уже инициализирован');
            return;
        }

        console.log('🎨 Инициализация интерфейса...');
        
        this.updateUserInterface();
        this.bindEvents();
        this.setupSocketConnection();
        this.loadDashboardData();
        
        this.isInitialized = true;
        console.log('✅ Интерфейс успешно инициализирован');
    }

    redirectToLogin() {
        console.log('🔀 Перенаправление на страницу входа');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 1000);
    }

    updateUserInterface() {
        console.log('👤 Обновление интерфейса пользователя');
        
        const userNameElement = document.getElementById('userName');
        const userAvatarElement = document.getElementById('userAvatar');
        const userRatingElement = document.getElementById('userRating');
        const userSessionsElement = document.getElementById('userSessions');
        
        if (userNameElement && this.currentUser) {
            userNameElement.textContent = this.currentUser.username || 'Слушатель';
        }
        
        if (userAvatarElement && this.currentUser) {
            userAvatarElement.src = this.currentUser.avatar_url || '/images/default-avatar.svg';
            userAvatarElement.alt = this.currentUser.username || 'Аватар';
        }

        if (userRatingElement) {
            userRatingElement.textContent = `⭐ ${this.currentUser.rating || '5.0'}`;
        }
        
        if (userSessionsElement) {
            userSessionsElement.textContent = `💬 ${this.currentUser.total_sessions || '0'}`;
        }

        // Обновляем статус онлайн
        this.updateStatusUI(this.isOnline);
    }

    bindEvents() {
        console.log('🎯 Привязка событий...');

        // Навигация
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = item.dataset.tab;
                console.log('📱 Переключение на вкладку:', tab);
                this.switchTab(tab);
            });
        });

        // Быстрые действия
        document.getElementById('quickChats')?.addEventListener('click', () => this.switchTab('chats'));
        document.getElementById('quickListenersChat')?.addEventListener('click', () => this.switchTab('listeners-chat'));
        document.getElementById('quickStats')?.addEventListener('click', () => this.switchTab('statistics'));
        document.getElementById('quickReviews')?.addEventListener('click', () => this.switchTab('reviews'));

        // Переключатель онлайн статуса
        const onlineToggle = document.getElementById('onlineToggle');
        if (onlineToggle) {
            onlineToggle.checked = this.isOnline;
            onlineToggle.addEventListener('change', (e) => {
                console.log('🔄 Изменение онлайн статуса:', e.target.checked);
                this.toggleOnlineStatus(e.target.checked);
            });
        }

        // Кнопки обновления
        document.getElementById('refreshBtn')?.addEventListener('click', () => {
            console.log('🔄 Обновление текущей вкладки');
            this.refreshCurrentTab();
        });
        
        document.getElementById('refreshChatsBtn')?.addEventListener('click', () => {
            console.log('🔄 Обновление чатов');
            this.loadChats();
        });

        // Чат слушателей
        const chatInput = document.getElementById('listenersChatInput');
        const sendButton = document.getElementById('sendListenersMessage');
        
        if (chatInput && sendButton) {
            sendButton.addEventListener('click', () => this.sendListenersMessage());
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendListenersMessage();
                }
            });
        }

        // Период статистики
        const statsPeriod = document.getElementById('statsPeriod');
        if (statsPeriod) {
            statsPeriod.addEventListener('change', () => {
                console.log('📊 Изменение периода статистики');
                this.loadStatistics();
            });
        }

        console.log('✅ Все события привязаны');
    }

    switchTab(tabName) {
        console.log('📑 Переключение на вкладку:', tabName);
        
        // Обновляем навигацию
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeNavItem = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }

        // Скрываем все вкладки
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        // Показываем целевую вкладку
        const targetTab = document.getElementById(`${tabName}Tab`);
        if (targetTab) {
            targetTab.classList.add('active');
        }

        // Обновляем заголовок
        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) {
            const titles = {
                'dashboard': 'Дашборд',
                'chats': 'Мои чаты',
                'listeners-chat': 'Чат слушателей',
                'reviews': 'Отзывы',
                'statistics': 'Статистика'
            };
            pageTitle.textContent = titles[tabName] || 'Дашборд';
        }

        this.currentTab = tabName;

        // Загружаем данные для вкладки
        switch(tabName) {
            case 'dashboard':
                this.loadDashboardData();
                break;
            case 'chats':
                this.loadChats();
                break;
            case 'listeners-chat':
                this.loadListenersChat();
                break;
            case 'reviews':
                this.loadReviews();
                break;
            case 'statistics':
                this.loadStatistics();
                break;
        }
    }

    async loadDashboardData() {
        try {
            console.log('📊 Загрузка данных дашборда...');
            
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/listener/statistics', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Данные дашборда получены:', data);
                this.updateDashboardStats(data);
            } else {
                console.error('❌ Ошибка загрузки статистики:', response.status);
                this.updateDashboardStats(this.getDefaultStats());
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки дашборда:', error);
            this.updateDashboardStats(this.getDefaultStats());
        }
    }

    getDefaultStats() {
        return {
            activeChats: 0,
            averageRating: 5.0,
            averageSessionTime: 0,
            totalSessions: 0,
            helpfulness: 0
        };
    }

    updateDashboardStats(stats) {
        console.log('📈 Обновление статистики дашборда:', stats);
        
        const activeChats = document.getElementById('dashboardActiveChats');
        const rating = document.getElementById('dashboardRating');
        const avgTime = document.getElementById('dashboardAvgTime');
        const sessions = document.getElementById('dashboardSessions');

        if (activeChats) activeChats.textContent = stats.activeChats || '0';
        if (rating) rating.textContent = (stats.averageRating || 0).toFixed(1);
        if (avgTime) avgTime.textContent = stats.averageSessionTime || '0';
        if (sessions) sessions.textContent = stats.totalSessions || '0';

        this.updateRecentActivity(stats);
    }

    updateRecentActivity(stats) {
        const activityList = document.getElementById('recentActivity');
        if (!activityList) return;

        const activities = [
            {
                icon: '💬',
                text: `Завершен чат с пользователем`,
                time: '2 минуты назад'
            },
            {
                icon: '⭐',
                text: `Получен новый отзыв (${stats.averageRating || 5}⭐)`,
                time: '1 час назад'
            },
            {
                icon: '👥',
                text: 'Присоединились к общему чату',
                time: '2 часа назад'
            }
        ];

        activityList.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon">${activity.icon}</div>
                <div class="activity-content">
                    <div class="activity-text">${activity.text}</div>
                    <div class="activity-time">${activity.time}</div>
                </div>
            </div>
        `).join('');
    }

    async loadChats() {
        try {
            console.log('💬 Загрузка чатов...');
            const token = localStorage.getItem('auth_token');
            
            const response = await fetch('/api/listener/chats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const chatsList = document.getElementById('chatsList');
            if (!chatsList) return;

            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Получено чатов: ${data.chats?.length || 0}`);
                this.renderChats(data.chats || []);
            } else {
                console.error('❌ Ошибка загрузки чатов:', response.status);
                this.renderChats([]);
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки чатов:', error);
            this.showChatsError();
        }
    }

    renderChats(chats) {
        const chatsList = document.getElementById('chatsList');
        if (!chatsList) return;

        if (!chats || chats.length === 0) {
            chatsList.innerHTML = `
                <div class="empty-state">
                    <i>💬</i>
                    <h3>Нет активных чатов</h3>
                    <p>Когда пользователи начнут с вами чат, они появятся здесь</p>
                </div>
            `;
            return;
        }

        chatsList.innerHTML = chats.map(chat => `
            <div class="chat-item ${chat.unread_count > 0 ? 'unread' : ''}" data-chat-id="${chat.id}">
                <div class="chat-avatar">
                    ${chat.user_avatar ? 
                        `<img src="${chat.user_avatar}" alt="${chat.user_name}" onerror="this.src='/images/default-avatar.svg'">` : 
                        '<div class="avatar-placeholder">' + (chat.user_name?.charAt(0) || 'U') + '</div>'
                    }
                </div>
                <div class="chat-info">
                    <div class="chat-user">
                        ${chat.user_name || 'Пользователь'}
                        <span class="user-status ${chat.user_online ? 'online' : 'offline'}"></span>
                    </div>
                    <div class="chat-preview">${this.escapeHtml(chat.last_message || 'Чат начат')}</div>
                </div>
                <div class="chat-meta">
                    <div class="chat-time">${this.formatTime(chat.last_message_time)}</div>
                    ${chat.unread_count > 0 ? 
                        `<div class="chat-badge">${chat.unread_count}</div>` : 
                        ''
                    }
                </div>
            </div>
        `).join('');

        // Добавляем обработчики событий
        chatsList.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', () => {
                const chatId = item.dataset.chatId;
                this.openChat(chatId);
            });
        });

        // Обновляем бейджи
        const totalUnread = chats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);
        this.updateChatsBadge(totalUnread);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    openChat(chatId) {
        console.log('💬 Открытие чата:', chatId);
        this.activeChatId = chatId;
        this.showNotification(`Чат #${chatId} открыт`, 'success');
    }

    updateChatsBadge(count) {
        const chatsBadge = document.getElementById('chatsBadge');
        const globalBadge = document.getElementById('globalNotificationBadge');
        
        if (chatsBadge) {
            if (count > 0) {
                chatsBadge.textContent = count > 99 ? '99+' : count;
                chatsBadge.classList.remove('hidden');
            } else {
                chatsBadge.classList.add('hidden');
            }
        }

        if (globalBadge) {
            if (count > 0) {
                globalBadge.textContent = count > 99 ? '99+' : count;
                globalBadge.classList.remove('hidden');
            } else {
                globalBadge.classList.add('hidden');
            }
        }
    }

    showChatsError() {
        const chatsList = document.getElementById('chatsList');
        if (chatsList) {
            chatsList.innerHTML = `
                <div class="empty-state error">
                    <i>❌</i>
                    <h3>Ошибка загрузки чатов</h3>
                    <p>Попробуйте обновить страницу</p>
                    <button onclick="window.listenerApp.loadChats()" class="retry-btn">Повторить</button>
                </div>
            `;
        }
    }

    async loadListenersChat() {
        try {
            console.log('👥 Загрузка чата слушателей...');
            
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/listener/online-listeners', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Онлайн слушателей: ${data.listeners?.length || 0}`);
                this.updateOnlineListenersCount(data.listeners || []);
            } else {
                console.error('❌ Ошибка загрузки слушателей:', response.status);
                this.updateOnlineListenersCount([]);
            }

            await this.loadChatHistory();
            
        } catch (error) {
            console.error('❌ Ошибка загрузки чата слушателей:', error);
            this.updateOnlineListenersCount([]);
        }
    }

    updateOnlineListenersCount(listeners) {
        const onlineCount = document.getElementById('onlineListenersCount');
        if (onlineCount) {
            const onlineListeners = listeners.filter(l => l.is_online).length;
            onlineCount.textContent = onlineListeners;
            console.log(`👥 Онлайн слушателей: ${onlineListeners}`);
        }
    }

    async loadChatHistory() {
        try {
            console.log('📨 Загрузка истории чата...');
            
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/listeners-chat/messages', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const messagesContainer = document.getElementById('listenersChatMessages');
            if (!messagesContainer) return;

            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Загружено сообщений: ${data.messages?.length || 0}`);
                this.renderChatHistory(data.messages || []);
            } else {
                console.error('❌ Ошибка загрузки истории:', response.status);
                this.renderChatHistory([]);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки истории чата:', error);
            this.renderChatHistory([]);
        }
    }

    renderChatHistory(messages) {
        const messagesContainer = document.getElementById('listenersChatMessages');
        if (!messagesContainer) return;

        messagesContainer.innerHTML = '';

        if (!messages || messages.length === 0) {
            messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <div class="welcome-icon">👥</div>
                    <h3>Добро пожаловать в общий чат!</h3>
                    <p>Здесь вы можете общаться с другими слушателями, делиться опытом и задавать вопросы.</p>
                </div>
            `;
            return;
        }

        messages.forEach(message => {
            this.addMessageToChat({
                ...message,
                is_outgoing: message.sender_id === this.currentUser.id
            });
        });

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async sendListenersMessage() {
        const input = document.getElementById('listenersChatInput');
        if (!input || !input.value.trim()) {
            console.log('⚠️ Пустое сообщение, отправка отменена');
            return;
        }

        const message = input.value.trim();
        console.log('📤 Отправка сообщения:', message);

        const messagesContainer = document.getElementById('listenersChatMessages');
        if (!messagesContainer) return;

        // Убираем приветственное сообщение
        const welcomeMessage = messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        // Временно добавляем сообщение
        const tempMessage = {
            id: 'temp_' + Date.now(),
            content: message,
            sender_id: this.currentUser.id,
            sender_name: this.currentUser.username,
            created_at: new Date().toISOString(),
            is_outgoing: true
        };

        this.addMessageToChat(tempMessage);

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/listeners-chat/send', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: message
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Сообщение отправлено:', data);

            // Отправляем через WebSocket если есть
            if (this.socket) {
                this.socket.emit('send_listeners_message', {
                    content: message,
                    sender_id: this.currentUser.id,
                    sender_name: this.currentUser.username,
                    timestamp: new Date().toISOString()
                });
            }

        } catch (error) {
            console.error('❌ Ошибка отправки сообщения:', error);
            this.showNotification('Ошибка отправки сообщения', 'error');
            
            // Удаляем временное сообщение
            const messageElement = messagesContainer.querySelector(`[data-message-id="${tempMessage.id}"]`);
            if (messageElement) {
                messageElement.remove();
            }
            return;
        }

        input.value = '';
        input.focus();
    }

    addMessageToChat(messageData) {
        const messagesContainer = document.getElementById('listenersChatMessages');
        if (!messagesContainer) return;

        const messageElement = document.createElement('div');
        messageElement.className = `message ${messageData.is_outgoing ? 'outgoing' : 'incoming'}`;
        messageElement.setAttribute('data-message-id', messageData.id);
        messageElement.innerHTML = `
            <div class="message-bubble">
                <div class="message-content">${this.escapeHtml(messageData.content)}</div>
                <div class="message-meta">
                    <span class="message-sender">${this.escapeHtml(messageData.sender_name)}</span>
                    <span class="message-time">${this.formatTime(messageData.created_at)}</span>
                </div>
            </div>
        `;

        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async loadReviews() {
        try {
            console.log('⭐ Загрузка отзывов...');
            const token = localStorage.getItem('auth_token');
            
            const response = await fetch('/api/listener/reviews', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const reviewsList = document.getElementById('reviewsList');
            if (!reviewsList) return;

            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Загружено отзывов: ${data.reviews?.length || 0}`);
                this.renderReviews(data);
            } else {
                console.error('❌ Ошибка загрузки отзывов:', response.status);
                this.renderReviews({ reviews: [] });
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки отзывов:', error);
            this.showReviewsError();
        }
    }

    renderReviews(data) {
        const avgRating = document.getElementById('reviewsAvgRating');
        const totalReviews = document.getElementById('reviewsTotal');
        const helpfulness = document.getElementById('reviewsHelpfulness');

        if (avgRating) avgRating.textContent = data.averageRating?.toFixed(1) || '0.0';
        if (totalReviews) totalReviews.textContent = data.totalReviews || '0';
        if (helpfulness) helpfulness.textContent = '95%';

        const reviewsList = document.getElementById('reviewsList');
        if (!reviewsList) return;

        if (!data.reviews || data.reviews.length === 0) {
            reviewsList.innerHTML = `
                <div class="empty-state">
                    <i>⭐</i>
                    <h3>Пока нет отзывов</h3>
                    <p>Отзывы от пользователей появятся здесь после завершения чатов</p>
                </div>
            `;
            return;
        }

        reviewsList.innerHTML = data.reviews.map(review => `
            <div class="review-item">
                <div class="review-header">
                    <div>
                        <div class="review-user">${this.escapeHtml(review.user_name || 'Аноним')}</div>
                        <div class="review-date">${this.formatDate(review.created_at)}</div>
                    </div>
                    <div class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
                </div>
                <div class="review-text">${this.escapeHtml(review.comment || 'Без комментария')}</div>
            </div>
        `).join('');
    }

    showReviewsError() {
        const reviewsList = document.getElementById('reviewsList');
        if (reviewsList) {
            reviewsList.innerHTML = `
                <div class="empty-state error">
                    <i>❌</i>
                    <h3>Ошибка загрузки отзывов</h3>
                    <p>Попробуйте обновить страницу</p>
                    <button onclick="window.listenerApp.loadReviews()" class="retry-btn">Повторить</button>
                </div>
            `;
        }
    }

    async loadStatistics() {
        try {
            console.log('📈 Загрузка статистики...');
            const token = localStorage.getItem('auth_token');
            
            const response = await fetch('/api/listener/statistics', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Статистика загружена:', data);
                this.renderStatistics(data);
            } else {
                console.error('❌ Ошибка загрузки статистики:', response.status);
                this.renderStatistics(this.getDefaultStats());
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
            this.renderStatistics(this.getDefaultStats());
        }
    }

    renderStatistics(data) {
        console.log('📊 Отрисовка статистики:', data);
        
        const totalSessions = document.getElementById('statTotalSessions');
        const completedChats = document.getElementById('statCompletedChats');
        const avgSessionTime = document.getElementById('statAvgSessionTime');
        const totalTime = document.getElementById('statTotalTime');

        if (totalSessions) totalSessions.textContent = data.totalSessions || '0';
        if (completedChats) completedChats.textContent = data.completedChats || '0';
        if (avgSessionTime) avgSessionTime.textContent = `${data.averageSessionTime || '0'} мин`;
        if (totalTime) {
            const totalMinutes = (data.totalSessions || 0) * (data.averageSessionTime || 0);
            const totalHours = Math.round(totalMinutes / 60);
            totalTime.textContent = `${totalHours} ч`;
        }

        this.renderActivityChart(data.weeklyActivity || {});
        this.renderRatingDistribution(data);
    }

    renderActivityChart(weeklyActivity) {
        const chartContainer = document.getElementById('detailedActivityChart');
        if (!chartContainer) return;

        const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        const values = days.map(day => weeklyActivity[day] || 0);
        const maxValue = Math.max(...values, 1);

        chartContainer.innerHTML = `
            <div class="activity-chart">
                ${days.map((day, index) => {
                    const value = values[index];
                    const height = (value / maxValue) * 100;
                    return `
                        <div class="chart-bar" style="height: ${height}%" title="${day}: ${value} сессий">
                            <span class="chart-value">${value}</span>
                            <span class="chart-label">${day}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    renderRatingDistribution(data) {
        const distributionContainer = document.getElementById('ratingDistribution');
        if (!distributionContainer) return;

        // Временные данные для демонстрации
        const ratings = [
            { stars: 5, count: 12, percentage: 60 },
            { stars: 4, count: 6, percentage: 30 },
            { stars: 3, count: 1, percentage: 5 },
            { stars: 2, count: 1, percentage: 5 },
            { stars: 1, count: 0, percentage: 0 }
        ];

        distributionContainer.innerHTML = `
            <div class="rating-distribution">
                ${ratings.map(rating => `
                    <div class="rating-row">
                        <div class="rating-stars">${'★'.repeat(rating.stars)}</div>
                        <div class="rating-bar">
                            <div class="rating-fill" style="width: ${rating.percentage}%"></div>
                        </div>
                        <div class="rating-count">${rating.count}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    async toggleOnlineStatus(online) {
        try {
            console.log('🔄 Изменение онлайн статуса на:', online);
            
            this.isOnline = online;
            const token = localStorage.getItem('auth_token');
            
            const response = await fetch('/api/listener/status', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    online: online
                })
            });

            if (response.ok) {
                this.updateStatusUI(online);
                this.showNotification(
                    `Статус изменен: ${online ? 'онлайн' : 'оффлайн'}`,
                    'success'
                );
                console.log('✅ Статус успешно обновлен');
            } else {
                console.error('❌ Ошибка сервера при изменении статуса:', response.status);
                this.isOnline = !online;
                document.getElementById('onlineToggle').checked = !online;
                this.showNotification('Ошибка изменения статуса', 'error');
            }
            
        } catch (error) {
            console.error('❌ Ошибка изменения статуса:', error);
            this.isOnline = !online;
            document.getElementById('onlineToggle').checked = !online;
            this.showNotification('Ошибка соединения', 'error');
        }
    }

    updateStatusUI(online) {
        const statusIndicator = document.getElementById('statusIndicator');
        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${online ? 'online' : 'offline'}`;
            statusIndicator.innerHTML = `
                <div class="indicator-dot"></div>
                <span>${online ? 'Доступен для чатов' : 'Не доступен'}</span>
            `;
        }
    }

    refreshCurrentTab() {
        console.log('🔄 Обновление вкладки:', this.currentTab);
        
        switch(this.currentTab) {
            case 'dashboard':
                this.loadDashboardData();
                break;
            case 'chats':
                this.loadChats();
                break;
            case 'listeners-chat':
                this.loadListenersChat();
                break;
            case 'reviews':
                this.loadReviews();
                break;
            case 'statistics':
                this.loadStatistics();
                break;
        }
        this.showNotification('Данные обновлены', 'success');
    }

    setupSocketConnection() {
        console.log('🔌 Настройка Socket.io подключения...');
        
        if (typeof io !== 'undefined') {
            this.initializeSocket();
        } else {
            console.log('⏳ Socket.io не загружен, повторная попытка через 1 секунду...');
            setTimeout(() => {
                if (typeof io !== 'undefined') {
                    this.initializeSocket();
                } else {
                    console.error('❌ Socket.io не удалось загрузить');
                }
            }, 1000);
        }
    }

    initializeSocket() {
        try {
            console.log('🚀 Инициализация Socket.io...');
            
            if (typeof io === 'undefined') {
                throw new Error('Socket.io не доступен');
            }
            
            this.socket = io({
                auth: {
                    token: localStorage.getItem('auth_token')
                }
            });
            
            console.log('✅ Socket.io подключен');
            this.setupSocketListeners();
            
        } catch (error) {
            console.error('❌ Ошибка подключения Socket.io:', error);
        }
    }

    setupSocketListeners() {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('✅ Подключение к серверу установлено');
            
            if (this.currentUser) {
                this.socket.emit('user_connected', {
                    id: this.currentUser.id,
                    username: this.currentUser.username,
                    role: this.currentUser.role,
                    is_listener: true
                });
            }
        });

        this.socket.on('disconnect', (reason) => {
            console.log('🔌 Отключение от сервера:', reason);
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ Ошибка подключения Socket.io:', error);
        });

        this.socket.on('new_message', (data) => {
            console.log('📨 Новое сообщение:', data);
            this.handleNewMessage(data);
        });

        this.socket.on('new_listeners_message', (data) => {
            console.log('👥 Новое сообщение в чате слушателей:', data);
            this.addMessageToChat({
                ...data,
                is_outgoing: data.sender_id === this.currentUser.id
            });
        });

        this.socket.on('user_online', (userData) => {
            console.log('🟢 Пользователь онлайн:', userData.username);
            if (userData.is_listener && this.currentTab === 'listeners-chat') {
                this.updateOnlineListeners();
            }
        });

        this.socket.on('user_offline', (userData) => {
            console.log('🔴 Пользователь оффлайн:', userData.username);
            if (userData.is_listener && this.currentTab === 'listeners-chat') {
                this.updateOnlineListeners();
            }
        });

        this.socket.on('chat_accepted', (data) => {
            console.log('✅ Чат принят:', data);
            this.showNotification(`Новый чат #${data.chatId}`, 'info');
            this.loadChats();
        });

        console.log('✅ Socket слушатели настроены');
    }

    handleNewMessage(data) {
        if (data.chatId === this.activeChatId) {
            this.showNotification(`Новое сообщение в чате #${data.chatId}`, 'info');
        }
        
        this.loadChats();
    }

    updateOnlineListeners() {
        if (this.currentTab === 'listeners-chat') {
            this.loadListenersChat();
        }
    }

    formatTime(dateString) {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            
            if (diffMins < 1) return 'только что';
            if (diffMins < 60) return `${diffMins} мин назад`;
            
            return date.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } catch (error) {
            return 'только что';
        }
    }

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch (error) {
            return 'недавно';
        }
    }

    showNotification(message, type = 'info') {
        console.log(`📢 Уведомление [${type}]:`, message);
        
        const container = document.getElementById('notificationsContainer');
        if (!container) {
            console.warn('⚠️ Контейнер уведомлений не найден');
            return;
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i>${this.getNotificationIcon(type)}</i>
            <span>${message}</span>
        `;

        container.appendChild(notification);

        // Автоматическое скрытие
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    }

    // Метод для ручного выхода
    logout() {
        console.log('🚪 Выход из системы...');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        this.showNotification('Выход выполнен', 'info');
        
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 1000);
    }
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 DOM загружен, инициализация приложения слушателя');
    window.listenerApp = new ListenerApp();
    
    // Добавляем глобальный обработчик ошибок
    window.addEventListener('error', function(e) {
        console.error('🚨 Глобальная ошибка:', e.error);
    });
});
