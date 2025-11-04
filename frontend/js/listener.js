class ListenerApp {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.isOnline = true;
        this.currentTab = 'dashboard';
        this.activeChatId = null;
        
        this.init();
    }

    init() {
        console.log('Инициализация приложения слушателя');
        this.loadCurrentUser();
        this.bindEvents();
        this.setupSocketConnection();
        this.loadDashboardData();
    }

    async loadCurrentUser() {
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            console.log('Токен из localStorage:', token);
            
            if (!token) {
                window.location.href = '/index.html';
                return;
            }

            const response = await fetch('/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('Статус ответа verify:', response.status);

            const data = await response.json();
            console.log('Ответ verify:', data);
            
            if (data.success) {
                this.currentUser = data.user;
                this.updateUserInterface();
                console.log('Пользователь загружен:', this.currentUser.username);
            } else {
                console.log('Ошибка верификации:', data.error);
                this.handleAuthError();
            }
        } catch (error) {
            console.error('Ошибка загрузки пользователя:', error);
            this.handleAuthError();
        }
    }

    handleAuthError() {
        localStorage.removeItem('token');
        localStorage.removeItem('authToken');
        window.location.href = '/index.html';
    }

    updateUserInterface() {
        const userNameElement = document.getElementById('userName');
        const userAvatarElement = document.getElementById('userAvatar');
        const userRatingElement = document.getElementById('userRating');
        const userSessionsElement = document.getElementById('userSessions');
        
        if (userNameElement) {
            userNameElement.textContent = this.currentUser.username;
        }
        
        if (userAvatarElement) {
            userAvatarElement.src = this.currentUser.avatar_url || '/images/default-avatar.svg';
        }

        if (userRatingElement) userRatingElement.textContent = `⭐ ${this.currentUser.rating || '5.0'}`;
        if (userSessionsElement) userSessionsElement.textContent = `💬 ${this.currentUser.total_sessions || '0'}`;
    }

    bindEvents() {
        console.log('Привязка событий...');

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = item.dataset.tab;
                this.switchTab(tab);
            });
        });

        document.getElementById('quickChats')?.addEventListener('click', () => this.switchTab('chats'));
        document.getElementById('quickListenersChat')?.addEventListener('click', () => this.switchTab('listeners-chat'));
        document.getElementById('quickStats')?.addEventListener('click', () => this.switchTab('statistics'));
        document.getElementById('quickReviews')?.addEventListener('click', () => this.switchTab('reviews'));

        const onlineToggle = document.getElementById('onlineToggle');
        if (onlineToggle) {
            onlineToggle.addEventListener('change', (e) => {
                this.toggleOnlineStatus(e.target.checked);
            });
        }

        document.getElementById('refreshBtn')?.addEventListener('click', () => this.refreshCurrentTab());
        document.getElementById('refreshChatsBtn')?.addEventListener('click', () => this.loadChats());

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

        const statsPeriod = document.getElementById('statsPeriod');
        if (statsPeriod) {
            statsPeriod.addEventListener('change', () => {
                this.loadStatistics();
            });
        }

        console.log('Все события привязаны');
    }

    switchTab(tabName) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeNavItem = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }

        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        const targetTab = document.getElementById(`${tabName}Tab`);
        if (targetTab) {
            targetTab.classList.add('active');
        }

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

    refreshCurrentTab() {
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

    async loadDashboardData() {
        try {
            console.log('Загрузка данных дашборда...');
            
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            const response = await fetch('/api/listener/statistics', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.updateDashboardStats(data);
            } else {
                console.error('Ошибка загрузки статистики:', response.status);
                this.updateDashboardStats({
                    activeChats: 0,
                    averageRating: 5.0,
                    averageSessionTime: 0,
                    totalSessions: 0
                });
            }
            
        } catch (error) {
            console.error('Ошибка загрузки дашборда:', error);
            this.updateDashboardStats({
                activeChats: 0,
                averageRating: 5.0,
                averageSessionTime: 0,
                totalSessions: 0
            });
        }
    }

    updateDashboardStats(stats) {
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
            console.log('Загрузка чатов...');
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            
            const response = await fetch('/api/listener/chats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const chatsList = document.getElementById('chatsList');
            if (!chatsList) return;

            if (response.ok) {
                const data = await response.json();
                this.renderChats(data.chats);
            } else {
                this.renderChats([]);
            }
            
        } catch (error) {
            console.error('Ошибка загрузки чатов:', error);
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
                        `<img src="${chat.user_avatar}" alt="${chat.user_name}">` : 
                        chat.user_name?.charAt(0) || 'U'
                    }
                </div>
                <div class="chat-info">
                    <div class="chat-user">
                        ${chat.user_name || 'Пользователь'}
                        <span class="user-status ${chat.user_online ? 'online' : 'offline'}"></span>
                    </div>
                    <div class="chat-preview">${chat.last_message || 'Чат начат'}</div>
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

        chatsList.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', () => {
                const chatId = item.dataset.chatId;
                this.openChat(chatId);
            });
        });

        const totalUnread = chats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);
        this.updateChatsBadge(totalUnread);
    }

    openChat(chatId) {
        this.activeChatId = chatId;
        this.showNotification(`Чат #${chatId} открыт`, 'success');
        console.log('Открытие чата:', chatId);
    }

    updateChatsBadge(count) {
        const chatsBadge = document.getElementById('chatsBadge');
        const globalBadge = document.getElementById('globalNotificationBadge');
        
        if (chatsBadge) {
            if (count > 0) {
                chatsBadge.textContent = count;
                chatsBadge.classList.remove('hidden');
            } else {
                chatsBadge.classList.add('hidden');
            }
        }

        if (globalBadge) {
            if (count > 0) {
                globalBadge.textContent = count;
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
                <div class="empty-state">
                    <i>❌</i>
                    <h3>Ошибка загрузки чатов</h3>
                    <p>Попробуйте обновить страницу</p>
                </div>
            `;
        }
    }

    async loadListenersChat() {
        try {
            console.log('Загрузка чата слушателей...');
            
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            const response = await fetch('/api/listener/online-listeners', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.updateOnlineListenersCount(data.listeners);
            } else {
                this.updateOnlineListenersCount([]);
            }

            await this.loadChatHistory();
            
        } catch (error) {
            console.error('Ошибка загрузки чата слушателей:', error);
            this.updateOnlineListenersCount([]);
        }
    }

    updateOnlineListenersCount(listeners) {
        const onlineCount = document.getElementById('onlineListenersCount');
        if (onlineCount && listeners) {
            const onlineListeners = listeners.filter(l => l.is_online).length;
            onlineCount.textContent = onlineListeners;
        }
    }

    async loadChatHistory() {
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            const response = await fetch('/api/listeners-chat/messages', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const messagesContainer = document.getElementById('listenersChatMessages');
            if (!messagesContainer) return;

            if (response.ok) {
                const data = await response.json();
                this.renderChatHistory(data.messages);
            } else {
                this.renderChatHistory([]);
            }
        } catch (error) {
            console.error('Ошибка загрузки истории чата:', error);
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
        if (!input || !input.value.trim()) return;

        const message = input.value.trim();
        const messagesContainer = document.getElementById('listenersChatMessages');
        
        const welcomeMessage = messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

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
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
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
                throw new Error('Ошибка отправки');
            }

            const data = await response.json();
            console.log('Сообщение отправлено:', data);

        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
            this.showNotification('Ошибка отправки сообщения', 'error');
            
            const messageElement = messagesContainer.querySelector(`[data-message-id="${tempMessage.id}"]`);
            if (messageElement) {
                messageElement.remove();
            }
            return;
        }

        if (this.socket) {
            this.socket.emit('send_listeners_message', {
                content: message,
                sender_id: this.currentUser.id,
                sender_name: this.currentUser.username,
                timestamp: new Date().toISOString()
            });
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
                <div class="message-content">${messageData.content}</div>
                <div class="message-meta">
                    <span class="message-sender">${messageData.sender_name}</span>
                    <span class="message-time">${this.formatTime(messageData.created_at)}</span>
                </div>
            </div>
        `;

        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async loadReviews() {
        try {
            console.log('Загрузка отзывов...');
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            
            const response = await fetch('/api/listener/reviews', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const reviewsList = document.getElementById('reviewsList');
            if (!reviewsList) return;

            if (response.ok) {
                const data = await response.json();
                this.renderReviews(data);
            } else {
                this.renderReviews({ reviews: [] });
            }
            
        } catch (error) {
            console.error('Ошибка загрузки отзывов:', error);
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
                        <div class="review-user">${review.user_name || 'Аноним'}</div>
                        <div class="review-date">${this.formatDate(review.created_at)}</div>
                    </div>
                    <div class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
                </div>
                <div class="review-text">${review.comment || 'Без комментария'}</div>
            </div>
        `).join('');
    }

    showReviewsError() {
        const reviewsList = document.getElementById('reviewsList');
        if (reviewsList) {
            reviewsList.innerHTML = `
                <div class="empty-state">
                    <i>❌</i>
                    <h3>Ошибка загрузки отзывов</h3>
                    <p>Попробуйте обновить страницу</p>
                </div>
            `;
        }
    }

    async loadStatistics() {
        try {
            console.log('Загрузка статистики...');
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            
            const response = await fetch('/api/listener/statistics', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderStatistics(data);
            } else {
                this.renderStatistics({
                    totalSessions: 0,
                    completedChats: 0,
                    averageSessionTime: 0,
                    weeklyActivity: {}
                });
            }
            
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
            this.renderStatistics({
                totalSessions: 0,
                completedChats: 0,
                averageSessionTime: 0,
                weeklyActivity: {}
            });
        }
    }

    renderStatistics(data) {
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

        this.renderActivityChart(data.weeklyActivity);
        this.renderRatingDistribution(data);
    }

    renderActivityChart(weeklyActivity) {
        const chartContainer = document.getElementById('detailedActivityChart');
        if (!chartContainer) return;

        const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        const values = days.map(day => weeklyActivity?.[day] || 0);
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

        const ratings = [
            { stars: 5, count: 0, percentage: 0 },
            { stars: 4, count: 0, percentage: 0 },
            { stars: 3, count: 0, percentage: 0 },
            { stars: 2, count: 0, percentage: 0 },
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
            this.isOnline = online;
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            
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
            } else {
                this.isOnline = !online;
                document.getElementById('onlineToggle').checked = !online;
                this.showNotification('Ошибка изменения статуса', 'error');
            }
            
        } catch (error) {
            console.error('Ошибка изменения статуса:', error);
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

    setupSocketConnection() {
        console.log('Настройка Socket.io подключения...');
        
        if (typeof io !== 'undefined') {
            this.initializeSocket();
        } else {
            setTimeout(() => {
                if (typeof io !== 'undefined') {
                    this.initializeSocket();
                } else {
                    console.error('Socket.io не удалось загрузить');
                }
            }, 1000);
        }
    }

    initializeSocket() {
        try {
            console.log('Инициализация Socket.io...');
            
            if (typeof io === 'undefined') {
                throw new Error('Socket.io не доступен');
            }
            
            this.socket = io();
            console.log('Socket.io подключен');
            
            this.setupSocketListeners();
            
        } catch (error) {
            console.error('Ошибка подключения Socket.io:', error);
        }
    }

    setupSocketListeners() {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('Подключение к серверу установлено');
            
            if (this.currentUser) {
                this.socket.emit('user_connected', {
                    id: this.currentUser.id,
                    username: this.currentUser.username,
                    role: this.currentUser.role,
                    is_listener: this.currentUser.role === 'listener'
                });
            }
        });

        this.socket.on('disconnect', () => {
            console.log('Отключение от сервера');
        });

        this.socket.on('new_message', (data) => {
            console.log('Новое сообщение:', data);
            this.handleNewMessage(data);
        });

        this.socket.on('new_listeners_message', (data) => {
            console.log('Новое сообщение в чате слушателей:', data);
            this.addMessageToChat({
                ...data,
                is_outgoing: data.sender_id === this.currentUser.id
            });
        });

        this.socket.on('user_online', (userData) => {
            console.log('Пользователь онлайн:', userData.username);
            if (userData.is_listener) {
                this.updateOnlineListeners();
            }
        });

        this.socket.on('user_offline', (userData) => {
            console.log('Пользователь оффлайн:', userData.username);
            if (userData.is_listener) {
                this.updateOnlineListeners();
            }
        });

        this.socket.on('chat_accepted', (data) => {
            console.log('Чат принят:', data);
            this.showNotification(`Новый чат #${data.chatId}`, 'info');
            this.loadChats();
        });

        console.log('Socket слушатели настроены');
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
        const container = document.getElementById('notificationsContainer');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i>${this.getNotificationIcon(type)}</i>
            <span>${message}</span>
        `;

        container.appendChild(notification);

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
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, инициализация приложения слушателя');
    window.listenerApp = new ListenerApp();
});
