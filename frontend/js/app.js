/**
 * ChatApp - Основной класс приложения чата
 * Управляет всей логикой приложения, включая работу со слушателями
 */
class ChatApp {
    constructor() {
        this.currentUser = null;
        this.socket = null;
        this.currentChat = null;
        this.chats = [];
        this.listeners = [];
        this.stickers = [];
        this.telegramBot = null;
        this.rolePermissions = {
            'user': ['chat.basic', 'media.send', 'stickers.use'],
            'listener': ['chat.basic', 'media.send', 'stickers.use', 'chat.moderate', 'reviews.view'],
            'admin': ['chat.basic', 'media.send', 'stickers.use', 'chat.moderate', 'reviews.view', 'users.manage', 'system.monitor'],
            'coowner': ['chat.basic', 'media.send', 'stickers.use', 'chat.moderate', 'reviews.view', 'users.manage', 'system.monitor', 'financial.view'],
            'owner': ['*']
        };
        
        // Получаем данные пользователя из localStorage
        const userData = localStorage.getItem('user_data');
        if (userData) {
            this.currentUser = JSON.parse(userData);
        }
        
        this.init();
    }

    async init() {
        console.log('🚀 Инициализация чата для:', this.currentUser.username, 'Роль:', this.currentUser.role);
        
        // Проверяем аутентификацию через API
        const isAuthenticated = await this.verifyAuth();
        if (!isAuthenticated) {
            this.logout();
            return;
        }
        
        // Инициализируем Telegram бота
        this.telegramBot = new TelegramBot();
        
        this.initSocket();
        this.loadUserData();
        this.setupEventListeners();
        this.loadStickers();
        
        // Загружаем функции в зависимости от роли
        this.loadRoleSpecificFeatures();
        
        // Инициализируем UI слушателей если пользователь не слушатель
        if (this.currentUser.role !== 'listener') {
            this.initListenersUI();
        }
    }

    async verifyAuth() {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                console.log('✅ Аутентификация подтверждена');
                localStorage.setItem('user_data', JSON.stringify(data.user));
                this.currentUser = data.user;
                return true;
            } else {
                console.log('❌ Аутентификация не прошла:', data.error);
                return false;
            }
        } catch (error) {
            console.error('Ошибка проверки аутентификации:', error);
            return false;
        }
    }

    initSocket() {
        const token = localStorage.getItem('auth_token');
        
        try {
            // Проверяем, что Socket.io доступен
            if (typeof io === 'undefined') {
                console.error('❌ Socket.io не загружен');
                setTimeout(() => this.initSocket(), 3000);
                return;
            }

            console.log('🔌 Инициализация WebSocket подключения...');
            
            this.socket = io({
                auth: {
                    token: token
                },
                transports: ['websocket', 'polling'],
                timeout: 10000
            });

            this.socket.on('connect', () => {
                console.log('✅ WebSocket подключен');
                this.showNotification('Подключено к чату', 'success');
                
                // Загружаем активных слушателей после подключения
                if (this.currentUser.role !== 'listener') {
                    this.loadActiveListeners();
                }
            });

            this.socket.on('disconnect', (reason) => {
                console.log('❌ WebSocket отключен:', reason);
                this.showNotification('Соединение прервано', 'error');
            });

            this.socket.on('connect_error', (error) => {
                console.error('❌ Ошибка подключения WebSocket:', error);
                this.showNotification('Ошибка подключения', 'error');
            });

            // Обработчики событий WebSocket
            this.socket.on('authenticated', (data) => {
                console.log('✅ WebSocket аутентифицирован');
            });

            this.socket.on('auth_error', (error) => {
                console.log('❌ Ошибка аутентификации WebSocket:', error);
                this.showNotification('Ошибка аутентификации', 'error');
                this.logout();
            });

            this.socket.on('new_message', (message) => {
                this.handleNewMessage(message);
            });

            this.socket.on('user_typing', (data) => {
                this.showTypingIndicator(data);
            });

            this.socket.on('user_status_changed', (data) => {
                this.updateUserStatus(data);
            });

            this.socket.on('message_sent', (data) => {
                console.log('✅ Сообщение доставлено на сервер');
            });

            this.socket.on('notification', (notification) => {
                this.handleNotification(notification);
            });

            // 🔄 НОВЫЕ WebSocket ОБРАБОТЧИКИ ДЛЯ СЛУШАТЕЛЕЙ
            this.setupListenerSocketHandlers();

        } catch (error) {
            console.error('❌ Ошибка инициализации WebSocket:', error);
            setTimeout(() => this.initSocket(), 5000);
        }
    }

    /**
     * Инициализирует UI слушателей
     */
    initListenersUI() {
        // Проверяем, что компонент слушателей еще не инициализирован
        if (!window.listenersUI && typeof ListenersUI !== 'undefined') {
            console.log('🎧 Инициализация UI слушателей...');
            window.listenersUI = new ListenersUI(this);
        }
    }

    /**
     * Настраивает WebSocket обработчики для работы со слушателями
     */
    setupListenerSocketHandlers() {
        if (!this.socket) return;

        // Чат создан успешно
        this.socket.on('chat_created', (data) => {
            console.log('✅ Чат создан:', data.chat.id);
            this.showNotification(
                data.is_new ? 'Чат создан!' : 'Продолжаем существующий чат', 
                'success'
            );
            
            // Переходим в созданный чат
            this.selectChat(data.chat);
        });

        // Новый запрос чата (для слушателей)
        this.socket.on('new_chat_request', (data) => {
            if (this.currentUser.role === 'listener') {
                this.showChatRequestNotification(data);
            }
        });

        // Чат принят слушателем (для пользователей)
        this.socket.on('chat_accepted', (data) => {
            this.showNotification(
                `Слушатель ${data.listener_name} принял ваш чат!`,
                'success'
            );
            
            // Обновляем статус в активном чате
            if (this.currentChat && this.currentChat.id === data.chat_id) {
                this.updateChatStatus('accepted');
            }
        });

        // Список активных слушателей
        this.socket.on('active_listeners_list', (listeners) => {
            console.log('📋 Получен список слушателей:', listeners.length);
            this.listeners = listeners;
            
            // Обновляем UI если он инициализирован
            if (window.listenersUI) {
                window.listenersUI.handleListenersUpdate(listeners);
            }
        });

        // Слушатель появился онлайн
        this.socket.on('listener_online', (listener) => {
            console.log('🟢 Слушатель онлайн:', listener.username);
            
            // Обновляем UI если он инициализирован
            if (window.listenersUI) {
                window.listenersUI.handleListenerOnline(listener);
            }
        });

        // Слушатель ушел оффлайн
        this.socket.on('listener_offline', (data) => {
            console.log('🔴 Слушатель оффлайн:', data.username);
            
            // Обновляем UI если он инициализирован
            if (window.listenersUI) {
                window.listenersUI.handleListenerOffline(data);
            }
        });

        // Изменение доступности слушателя
        this.socket.on('listener_availability_changed', (data) => {
            console.log('🔄 Изменение доступности:', data.username, data.is_available);
            
            // Обновляем UI если он инициализирован
            if (window.listenersUI) {
                window.listenersUI.handleAvailabilityChange(data);
            }
        });

        // Статистика слушателя
        this.socket.on('listener_stats', (stats) => {
            console.log('📊 Статистика слушателя:', stats);
            // Можно использовать для отображения в профиле
        });
    }

    /**
     * Загружает активных слушателей через WebSocket
     */
    loadActiveListeners() {
        if (this.socket) {
            console.log('📋 Запрос активных слушателей...');
            this.socket.emit('get_active_listeners');
        } else {
            console.error('❌ WebSocket не подключен');
        }
    }

    /**
     * Начать чат с конкретным слушателем
     */
    async startChatWithListener(listenerId) {
        try {
            console.log('💬 Начало чата с слушателем:', listenerId);
            
            if (!this.socket) {
                throw new Error('Нет подключения к серверу');
            }

            // Показываем индикатор загрузки
            this.showNotification('Создание чата...', 'info');

            // Используем WebSocket для real-time создания чата
            this.socket.emit('start_chat_with_listener', { 
                listener_id: listenerId 
            });

        } catch (error) {
            console.error('❌ Ошибка начала чата:', error);
            this.showNotification('Ошибка создания чата', 'error');
        }
    }

    /**
     * Показывает уведомление о запросе чата (для слушателей)
     */
    showChatRequestNotification(data) {
        const notificationHTML = `
            <div class="chat-request-notification">
                <div class="notification-header">
                    <img src="${data.user_avatar || '/images/default-avatar.svg'}" 
                         class="user-avatar"
                         onerror="this.src='/images/default-avatar.svg'">
                    <div class="user-info">
                        <strong>${data.username}</strong>
                        <span>хочет начать чат</span>
                    </div>
                </div>
                <div class="notification-actions">
                    <button class="btn btn-sm btn-success accept-chat-btn" 
                            data-chat-id="${data.chat_id}">
                        <i class="fas fa-check"></i>
                        Принять
                    </button>
                    <button class="btn btn-sm btn-secondary decline-chat-btn"
                            data-chat-id="${data.chat_id}">
                        <i class="fas fa-times"></i>
                        Отклонить
                    </button>
                </div>
            </div>
        `;

        // Показываем уведомление
        this.showCustomNotification(notificationHTML, 'info', 15000);

        // Добавляем обработчики для кнопок
        setTimeout(() => {
            const acceptBtn = document.querySelector('.accept-chat-btn');
            const declineBtn = document.querySelector('.decline-chat-btn');
            
            if (acceptBtn) {
                acceptBtn.addEventListener('click', () => {
                    this.acceptChatRequest(data.chat_id);
                    this.closeCustomNotification();
                });
            }
            
            if (declineBtn) {
                declineBtn.addEventListener('click', () => {
                    this.closeCustomNotification();
                });
            }
        }, 100);
    }

    /**
     * Слушатель принимает запрос чата
     */
    async acceptChatRequest(chatId) {
        try {
            if (!this.socket) return;

            this.socket.emit('listener_accept_chat', { chat_id: chatId });
            this.showNotification('Чат принят!', 'success');
            
        } catch (error) {
            console.error('❌ Ошибка принятия чата:', error);
            this.showNotification('Ошибка принятия чата', 'error');
        }
    }

    /**
     * Просмотр профиля слушателя
     */
    async viewListenerProfile(listenerId) {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/chat/listeners/${listenerId}/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.showListenerProfileModal(data.profile);
            } else {
                throw new Error('Ошибка загрузки профиля');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки профиля:', error);
            this.showNotification('Ошибка загрузки профиля', 'error');
        }
    }

    /**
     * Показывает модальное окно с профилем слушателя
     */
    showListenerProfileModal(profile) {
        const modalHTML = `
            <div class="modal active" id="listenerProfileModal">
                <div class="modal-content profile-modal">
                    <div class="modal-header">
                        <h2>👤 Профиль слушателя</h2>
                        <button class="btn-close" onclick="this.closeListenerProfileModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="profile-header">
                            <img src="${profile.avatar_url}" 
                                 class="profile-avatar" 
                                 alt="${profile.username}"
                                 onerror="this.src='/images/default-avatar.svg'">
                            <div class="profile-info">
                                <h3>${profile.username}</h3>
                                <div class="profile-rating">
                                    ${this.generateStarRating(profile.rating)}
                                    <span class="rating-text">${profile.rating}</span>
                                </div>
                                <div class="profile-status ${profile.is_online ? 'online' : 'offline'}">
                                    <div class="status-dot"></div>
                                    <span>${profile.is_online ? 'Online' : 'Offline'}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="profile-details">
                            <div class="detail-section">
                                <h4>🎯 Специализация</h4>
                                <div class="specialties">
                                    ${profile.specialties.map(spec => 
                                        `<span class="specialty-tag">${spec}</span>`
                                    ).join('')}
                                </div>
                            </div>
                            
                            <div class="detail-section">
                                <h4>📝 О себе</h4>
                                <p>${profile.bio}</p>
                            </div>
                            
                            <div class="stats-grid">
                                <div class="stat-card">
                                    <div class="stat-value">${profile.total_sessions}</div>
                                    <div class="stat-label">Сессий</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-value">${profile.experience_years}+</div>
                                    <div class="stat-label">Лет опыта</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-value">${profile.response_time}</div>
                                    <div class="stat-label">Время ответа</div>
                                </div>
                            </div>
                        </div>
                        
                        ${profile.reviews && profile.reviews.length > 0 ? `
                            <div class="reviews-section">
                                <h4>💬 Последние отзывы</h4>
                                <div class="reviews-list">
                                    ${profile.reviews.slice(0, 3).map(review => `
                                        <div class="review-item">
                                            <div class="review-header">
                                                <span class="review-user">${review.user?.username || 'Аноним'}</span>
                                                <span class="review-rating">${this.generateStarRating(review.rating)}</span>
                                            </div>
                                            <p class="review-comment">${review.comment || 'Без комментария'}</p>
                                            <div class="review-date">${this.formatTime(review.created_at)}</div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.closeListenerProfileModal()">
                            Закрыть
                        </button>
                        <button class="btn btn-primary" 
                                ${!profile.is_online ? 'disabled' : ''}
                                onclick="window.chatApp.startChatWithListener('${profile.id}')">
                            ${profile.is_online ? '💬 Начать чат' : '❌ Не в сети'}
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Добавляем модальное окно в DOM
        const existingModal = document.getElementById('listenerProfileModal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    closeListenerProfileModal() {
        const modal = document.getElementById('listenerProfileModal');
        if (modal) {
            modal.remove();
        }
    }

    // 🔄 ОСТАЛЬНЫЕ СУЩЕСТВУЮЩИЕ МЕТОДЫ (без изменений)

    loadUserData() {
        // Обновляем интерфейс пользователя
        const usernameElement = document.getElementById('username');
        const userRoleElement = document.getElementById('userRole');
        const userAvatarElement = document.getElementById('userAvatar');
        
        if (usernameElement) usernameElement.textContent = this.currentUser.username;
        if (userRoleElement) userRoleElement.textContent = this.getRoleDisplayName(this.currentUser.role);
        if (userAvatarElement) {
            userAvatarElement.src = this.currentUser.avatar_url || '/images/default-avatar.svg';
            userAvatarElement.onerror = () => {
                userAvatarElement.src = '/images/default-avatar.svg';
            };
        }

        this.loadChats();
        this.loadListeners();
    }

    setupEventListeners() {
        // Навигация по табам
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchSidebarTab(e.target.dataset.tab);
            });
        });

        // Кнопка настроек
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                window.location.href = 'settings.html';
            });
        }

        // Новый чат
        const newChatBtn = document.getElementById('newChatBtn');
        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => {
                this.createNewChat();
            });
        }

        // Поиск
        const chatSearch = document.getElementById('chatSearch');
        if (chatSearch) {
            chatSearch.addEventListener('input', (e) => {
                this.filterChats(e.target.value);
            });
        }

        const listenerSearch = document.getElementById('listenerSearch');
        if (listenerSearch) {
            listenerSearch.addEventListener('input', (e) => {
                this.filterListeners(e.target.value);
            });
        }

        // Закрытие чата
        const closeChatBtn = document.getElementById('closeChatBtn');
        if (closeChatBtn) {
            closeChatBtn.addEventListener('click', () => {
                this.closeCurrentChat();
            });
        }

        // Кнопка "Начать чат" в заглушке
        const startChatBtn = document.getElementById('startChatBtn');
        if (startChatBtn) {
            startChatBtn.addEventListener('click', () => {
                this.createNewChat();
            });
        }

        // Отправка сообщения
        const messageInput = document.getElementById('messageInput');
        const sendMessageBtn = document.getElementById('sendMessageBtn');
        
        if (messageInput && sendMessageBtn) {
            // Отправка по кнопке
            sendMessageBtn.addEventListener('click', () => {
                this.sendMessage();
            });
            
            // Отправка по Enter
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            
            // Индикатор набора текста
            messageInput.addEventListener('input', () => {
                this.handleTyping();
            });
        }

        // Прикрепление файлов
        const attachBtn = document.getElementById('attachBtn');
        const fileInput = document.getElementById('fileInput');
        
        if (attachBtn && fileInput) {
            attachBtn.addEventListener('click', () => {
                fileInput.click();
            });
            
            fileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e);
            });
        }

        // Стикеры
        const stickerBtn = document.getElementById('stickerBtn');
        const stickerModal = document.getElementById('stickerModal');
        const closeStickerModal = document.getElementById('closeStickerModal');
        
        if (stickerBtn && stickerModal) {
            stickerBtn.addEventListener('click', () => {
                stickerModal.style.display = 'block';
            });
        }
        
        if (closeStickerModal) {
            closeStickerModal.addEventListener('click', () => {
                stickerModal.style.display = 'none';
            });
        }

        // Закрытие модального окна по клику вне его
        window.addEventListener('click', (e) => {
            if (stickerModal && e.target === stickerModal) {
                stickerModal.style.display = 'none';
            }
        });

        // Telegram уведомления
        const telegramToggle = document.getElementById('telegramNotifications');
        if (telegramToggle) {
            telegramToggle.addEventListener('change', (e) => {
                this.toggleTelegramNotifications(e.target.checked);
            });
        }
    }

    loadRoleSpecificFeatures() {
        const role = this.currentUser.role;
        
        switch(role) {
            case 'listener':
                this.loadListenerFeatures();
                break;
            case 'admin':
                this.loadAdminFeatures();
                break;
            case 'coowner':
                this.loadCoownerFeatures();
                break;
            case 'owner':
                this.loadOwnerFeatures();
                break;
            default:
                this.loadUserFeatures();
        }
    }

    loadListenerFeatures() {
        console.log('🎧 Загрузка функций слушателя');
        this.showListenerFeatures();
        this.loadReviews();
    }

    loadAdminFeatures() {
        console.log('⚡ Загрузка функций администратора');
        this.showAdminFeatures();
        this.loadAdminStats();
    }

    loadCoownerFeatures() {
        console.log('👑 Загрузка функций совладельца');
        this.showCoownerFeatures();
        this.loadFinancialData();
    }

    loadOwnerFeatures() {
        console.log('💎 Загрузка функций владельца');
        this.showOwnerFeatures();
        this.loadSystemStats();
    }

    loadUserFeatures() {
        console.log('👤 Загрузка функций пользователя');
    }

    showListenerFeatures() {
        const listenersTab = document.getElementById('listenersTab');
        const reviewsTab = document.getElementById('reviewsTab');
        
        if (listenersTab) listenersTab.style.display = 'flex';
        if (reviewsTab) reviewsTab.style.display = 'flex';
        
        this.loadReviews();
    }

    showAdminFeatures() {
        const adminTab = document.getElementById('adminTab');
        if (adminTab) adminTab.style.display = 'flex';
        
        // Показываем кнопки администрирования
        const adminControls = document.querySelectorAll('.admin-control');
        adminControls.forEach(control => {
            control.style.display = 'block';
        });
    }

    showCoownerFeatures() {
        const coownerTab = document.getElementById('coownerTab');
        if (coownerTab) coownerTab.style.display = 'flex';
        
        // Показываем финансовые элементы
        const financialControls = document.querySelectorAll('.financial-control');
        financialControls.forEach(control => {
            control.style.display = 'block';
        });
    }

    showOwnerFeatures() {
        const ownerTab = document.getElementById('ownerTab');
        if (ownerTab) ownerTab.style.display = 'flex';
        
        // Показываем все элементы управления
        const ownerControls = document.querySelectorAll('.owner-control');
        ownerControls.forEach(control => {
            control.style.display = 'block';
        });
    }

    async switchSidebarTab(tabName) {
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        const activeContent = document.getElementById(`${tabName}Tab`);
        
        if (activeTab) activeTab.classList.add('active');
        if (activeContent) activeContent.classList.add('active');

        // Загружаем данные для вкладки при переключении
        switch(tabName) {
            case 'chats':
                await this.loadChats();
                break;
            case 'listeners':
                // Загружаем слушателей при переключении на вкладку
                this.loadActiveListeners();
                break;
            case 'reviews':
                await this.loadReviews();
                break;
            case 'admin':
                await this.loadAdminStats();
                break;
            case 'coowner':
                await this.loadFinancialData();
                break;
            case 'owner':
                await this.loadSystemStats();
                break;
        }
    }

    // ... остальные существующие методы (loadChats, loadListeners, sendMessage и т.д.)

    // Вспомогательные методы
    generateStarRating(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        
        let stars = '';
        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                stars += '★';
            } else if (i === fullStars && hasHalfStar) {
                stars += '☆';
            } else {
                stars += '☆';
            }
        }
        return stars;
    }

    getRoleDisplayName(role) {
        const roles = {
            'user': 'Пользователь',
            'listener': 'Слушатель',
            'admin': 'Администратор',
            'coowner': 'Совладелец',
            'owner': 'Владелец'
        };
        return roles[role] || role;
    }

    formatTime(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'только что';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
        if (diff < 86400000) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        return date.toLocaleDateString('ru-RU');
    }

    showNotification(message, type = 'info') {
        // Создаем контейнер для уведомлений если его нет
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
            padding: 12px 16px;
            border-radius: 8px;
            color: white;
            background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            animation: slideInRight 0.3s ease;
            min-width: 200px;
            max-width: 300px;
            word-wrap: break-word;
        `;
        notification.textContent = message;

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
        }, 3000);
    }

    showCustomNotification(html, type = 'info', duration = 5000) {
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
            padding: 16px;
            border-radius: 8px;
            background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            animation: slideInRight 0.3s ease;
            min-width: 300px;
            max-width: 400px;
            color: white;
        `;
        notification.innerHTML = html;

        container.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                this.closeCustomNotification(notification);
            }
        }, duration);

        return notification;
    }

    closeCustomNotification(notification = null) {
        if (!notification) {
            notification = document.querySelector('.chat-request-notification')?.closest('.notification');
        }
        
        if (notification && notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }

    logout() {
        if (this.socket) {
            this.socket.disconnect();
        }
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        window.location.href = '/';
    }
}

// Добавляем CSS анимации для уведомлений
const style = document.createElement('style');
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
    
    .notification {
        transition: all 0.3s ease;
    }
    
    .chat-request-notification {
        color: white;
    }
    
    .chat-request-notification .notification-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
    }
    
    .chat-request-notification .user-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: cover;
    }
    
    .chat-request-notification .user-info {
        flex: 1;
    }
    
    .chat-request-notification .user-info strong {
        display: block;
        font-size: 14px;
        margin-bottom: 2px;
    }
    
    .chat-request-notification .user-info span {
        font-size: 12px;
        opacity: 0.9;
    }
    
    .chat-request-notification .notification-actions {
        display: flex;
        gap: 8px;
    }
    
    .chat-request-notification .btn {
        flex: 1;
        padding: 8px 12px;
        font-size: 12px;
    }
`;
document.head.appendChild(style);

// ПРОВЕРКА АУТЕНТИФИКАЦИИ ПРИ ЗАГРУЗКЕ ЧАТА
document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    
    console.log('🔐 Проверка аутентификации для чата...');
    console.log('Токен:', token ? 'есть' : 'нет');
    console.log('Данные пользователя:', userData ? 'есть' : 'нет');
    console.log('Текущая страница:', window.location.pathname);
    
    // Если нет токена - перенаправляем на главную
    if (!token || !userData) {
        console.log('❌ Нет аутентификации, перенаправляем на главную');
        window.location.href = '/';
        return;
    }
    
    // Проверяем, что пользователь на правильной странице
    try {
        const user = JSON.parse(userData);
        const currentPage = window.location.pathname;
        const correctPage = getCorrectPageForRole(user.role);
        
        console.log('🔍 Проверка страницы:', {
            userRole: user.role,
            currentPage: currentPage,
            correctPage: correctPage
        });
        
        if (!isOnCorrectPage(user.role, currentPage)) {
            console.log(`🔄 Перенаправление ${user.username} (${user.role}) на ${correctPage}`);
            window.location.href = correctPage;
            return;
        }
        
        console.log('✅ Пользователь на правильной странице');
        
    } catch (error) {
        console.error('Ошибка проверки страницы:', error);
        window.location.href = '/';
        return;
    }
    
    // ЕСЛИ УЖЕ ЕСТЬ ПРИЛОЖЕНИЕ - НЕ СОЗДАВАЙ ЕЩЕ РАЗ
    if (window.chatApp) {
        console.log('✅ Приложение уже инициализировано');
        return;
    }
    
    try {
        const user = JSON.parse(userData);
        console.log('✅ Пользователь аутентифицирован:', user.username);
        
        // Инициализируем приложение чата
        window.chatApp = new ChatApp();
        
    } catch (error) {
        console.error('Ошибка загрузки пользователя:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        window.location.href = '/';
    }
});

// Вспомогательные функции для проверки страницы
function getCorrectPageForRole(role) {
    const routes = {
        'owner': '/owner.html',
        'admin': '/admin.html',
        'coowner': '/coowner.html',
        'listener': '/listener.html',
        'user': '/chat.html'
    };
    return routes[role] || '/chat.html';
}

function isOnCorrectPage(role, currentPage) {
    const correctPage = getCorrectPageForRole(role);
    return currentPage === correctPage || currentPage.includes(correctPage.replace('/', ''));
}

// Глобальные функции для модальных окон
window.closeListenerProfileModal = function() {
    if (window.chatApp) {
        window.chatApp.closeListenerProfileModal();
    }
};
