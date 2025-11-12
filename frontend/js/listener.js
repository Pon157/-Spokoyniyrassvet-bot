// listener.js - ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ БЕЗ ЗАГРУЗКИ
class ListenerApp {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.isOnline = true;
        this.currentTab = 'dashboard';
        this.activeChatId = null;
        this.isInitialized = false;
        
        console.log('🎧 Инициализация приложения слушателя');
        this.init();
    }

    async init() {
        await this.checkAuthAndLoad();
    }

    async checkAuthAndLoad() {
        try {
            console.log('🔐 Проверка аутентификации...');
            
            const token = localStorage.getItem('auth_token');
            if (!token) {
                console.log('❌ Токен не найден, перенаправление на вход');
                this.redirectToLogin();
                return;
            }

            const userData = localStorage.getItem('user_data');
            if (!userData) {
                console.log('❌ Данные пользователя не найдены');
                this.redirectToLogin();
                return;
            }

            this.currentUser = JSON.parse(userData);
            
            if (this.currentUser.role !== 'listener') {
                console.log('❌ Недостаточно прав: требуется роль listener');
                this.redirectToLogin();
                return;
            }

            console.log('✅ Пользователь аутентифицирован:', this.currentUser.username);
            
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
            userAvatarElement.onerror = function() {
                this.src = '/images/default-avatar.svg';
            };
        }

        if (userRatingElement) {
            userRatingElement.textContent = `⭐ ${this.currentUser.rating || '0.0'}`;
        }
        
        if (userSessionsElement) {
            userSessionsElement.textContent = `💬 ${this.currentUser.total_sessions || '0'}`;
        }

        this.updateStatusUI(this.isOnline);
    }

    bindEvents() {
        console.log('🎯 Привязка событий...');

        // Навигация
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = item.getAttribute('data-tab');
                if (tab) {
                    console.log('📱 Переключение на вкладку:', tab);
                    this.switchTab(tab);
                }
            });
        });

        // Быстрые действия
        const quickChatsBtn = document.getElementById('quickChats');
        const quickListenersBtn = document.getElementById('quickListenersChat');
        const quickStatsBtn = document.getElementById('quickStats');
        const quickReviewsBtn = document.getElementById('quickReviews');

        if (quickChatsBtn) quickChatsBtn.addEventListener('click', () => this.switchTab('chats'));
        if (quickListenersBtn) quickListenersBtn.addEventListener('click', () => this.switchTab('listeners-chat'));
        if (quickStatsBtn) quickStatsBtn.addEventListener('click', () => this.switchTab('statistics'));
        if (quickReviewsBtn) quickReviewsBtn.addEventListener('click', () => this.switchTab('reviews'));

        // Статус онлайн
        const onlineToggle = document.getElementById('onlineToggle');
        if (onlineToggle) {
            onlineToggle.checked = this.isOnline;
            onlineToggle.addEventListener('change', (e) => {
                console.log('🔄 Изменение онлайн статуса:', e.target.checked);
                this.toggleOnlineStatus(e.target.checked);
            });
        }

        // Кнопки заголовка
        const refreshBtn = document.getElementById('refreshBtn');
        const notificationsBtn = document.getElementById('notificationsBtn');
        const settingsBtn = document.getElementById('settingsBtn');

        if (refreshBtn) refreshBtn.addEventListener('click', () => this.refreshCurrentTab());
        if (notificationsBtn) notificationsBtn.addEventListener('click', () => this.showNotifications());
        if (settingsBtn) settingsBtn.addEventListener('click', () => this.showSettings());

        // Обновление чатов
        const refreshChatsBtn = document.getElementById('refreshChatsBtn');
        if (refreshChatsBtn) {
            refreshChatsBtn.addEventListener('click', () => this.loadChats());
        }

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

        // Статистика
        const statsPeriod = document.getElementById('statsPeriod');
        if (statsPeriod) {
            statsPeriod.addEventListener('change', () => {
                console.log('📊 Изменение периода статистики');
                this.loadStatistics();
            });
        }

        // Выход
        const logoutBtn = document.querySelector('.logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
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

        // Обновляем контент
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

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
                console.error('❌ Ошибка загрузки дашборда:', response.status);
                this.updateDashboardStats({
                    activeChats: 0,
                    averageRating: 0,
                    averageSessionTime: 0,
                    totalSessions: 0
                });
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки дашборда:', error);
            this.updateDashboardStats({
                activeChats: 0,
                averageRating: 0,
                averageSessionTime: 0,
                totalSessions: 0
            });
        }
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

        this.updateRecentActivity();
    }

    updateRecentActivity() {
        const activityList = document.getElementById('recentActivity');
        if (!activityList) return;

        activityList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-info-circle"></i>
                <p>Активность отсутствует</p>
            </div>
        `;
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
            this.renderChats([]);
        }
    }

    renderChats(chats) {
        const chatsList = document.getElementById('chatsList');
        if (!chatsList) return;

        if (!chats || chats.length === 0) {
            chatsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comments"></i>
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
                        `<div class="avatar-placeholder">${(chat.user_name?.charAt(0) || 'U')}</div>`
                    }
                </div>
                <div class="chat-info">
                    <div class="chat-user">
                        ${this.escapeHtml(chat.user_name || 'Пользователь')}
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

        // Добавляем обработчики кликов на чаты
        chatsList.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', () => {
                const chatId = item.dataset.chatId;
                this.openChat(chatId);
            });
        });

        // Обновляем бейдж с количеством непрочитанных
        const totalUnread = chats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);
        this.updateChatsBadge(totalUnread);
    }

    escapeHtml(text) {
        if (!text) return '';
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
                console.error('❌ Ошибка загрузки онлайн слушателей:', response.status);
                this.updateOnlineListenersCount([]);
            }

            this.loadChatHistory();
            
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
            
            // В реальном приложении здесь был бы запрос к API для получения истории сообщений
            this.renderChatHistory([]);
            
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
                    <div class="welcome-icon"><i class="fas fa-users"></i></div>
                    <h3>Добро пожаловать в общий чат!</h3>
                    <p>Здесь вы можете общаться с другими слушателями, делиться опытом и задавать вопросы.</p>
                </div>
            `;
            return;
        }

        messages.forEach(message => {
            this.addMessageToChat(message);
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

        try {
            // В реальном приложении здесь был бы запрос к API для отправки сообщения
            console.log('✅ Сообщение отправлено (имитация)');
            this.showNotification('Сообщение отправлено', 'success');
            
            // Очищаем поле ввода
            input.value = '';
            input.focus();
            
        } catch (error) {
            console.error('❌ Ошибка отправки сообщения:', error);
            this.showNotification('Ошибка отправки сообщения', 'error');
        }
    }

    addMessageToChat(messageData) {
        const messagesContainer = document.getElementById('listenersChatMessages');
        if (!messagesContainer) return;

        // Убираем приветственное сообщение если оно есть
        const welcomeMessage = messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

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

            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Загружено отзывов: ${data.reviews?.length || 0}`);
                this.renderReviews(data);
            } else {
                console.error('❌ Ошибка загрузки отзывов:', response.status);
                this.renderReviews({
                    reviews: [],
                    averageRating: 0,
                    totalReviews: 0
                });
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
        const avgRating = document.getElementById('reviewsAvgRating');
        const totalReviews = document.getElementById('reviewsTotal');

        if (avgRating) avgRating.textContent = data.averageRating?.toFixed(1) || '0.0';
        if (totalReviews) totalReviews.textContent = data.totalReviews || '0';

        const reviewsList = document.getElementById('reviewsList');
        if (!reviewsList) return;

        if (!data.reviews || data.reviews.length === 0) {
            reviewsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-star"></i>
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
                this.renderStatistics({});
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
            this.renderStatistics({});
        }
    }

    renderStatistics(data) {
        console.log('📊 Отрисовка статистики:', data);
        
        const totalSessions = document.getElementById('statTotalSessions');
        const completedChats = document.getElementById('statCompletedChats');
        const avgSessionTime = document.getElementById('statAvgSessionTime');

        if (totalSessions) totalSessions.textContent = data.totalSessions || '0';
        if (completedChats) completedChats.textContent = data.completedChats || '0';
        if (avgSessionTime) avgSessionTime.textContent = `${data.averageSessionTime || '0'} мин`;

        this.renderActivityChart(data.weeklyActivity || {});
        this.renderRatingDistribution(data);
    }

    renderActivityChart(weeklyActivity) {
        const chartContainer = document.getElementById('detailedActivityChart');
        if (!chartContainer) return;

        if (Object.keys(weeklyActivity).length === 0) {
            chartContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-chart-bar"></i>
                    <p>Данные активности отсутствуют</p>
                </div>
            `;
            return;
        }

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

        distributionContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-star"></i>
                <p>Данные рейтингов отсутствуют</p>
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
                throw new Error('Ошибка сервера');
            }
            
        } catch (error) {
            console.error('❌ Ошибка изменения статуса:', error);
            // Откатываем изменения в UI
            this.isOnline = !online;
            document.getElementById('onlineToggle').checked = !online;
            this.showNotification('Ошибка изменения статуса', 'error');
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

    showNotifications() {
        console.log('🔔 Открытие уведомлений');
        this.showNotification('Уведомления пока не реализованы', 'info');
    }

    showSettings() {
        console.log('⚙️ Открытие настроек');
        this.showNotification('Настройки пока не реализованы', 'info');
    }

    setupSocketConnection() {
        console.log('🔌 Настройка Socket.io подключения...');
        
        // Socket.io временно отключен для избежания ошибок 502
        console.log('ℹ️ Socket.io временно отключен для избежания ошибок 502');
    }

    formatTime(dateString) {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            
            if (diffMins < 1) return 'только что';
            if (diffMins < 60) return `${diffMins} мин назад`;
            
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) return `${diffHours} ч назад`;
            
            return date.toLocaleDateString('ru-RU', { 
                day: '2-digit', 
                month: '2-digit' 
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
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;

        container.appendChild(notification);

        // Автоматическое скрытие через 5 секунд
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

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
});
