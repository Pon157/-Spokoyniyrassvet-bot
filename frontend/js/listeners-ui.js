/**
 * ListenersUI - Компонент для управления отображением активных слушателей
 * Обеспечивает взаимодействие пользователей со слушателями через красивый UI
 */
class ListenersUI {
    constructor(app) {
        this.app = app;
        this.listeners = [];
        this.filteredListeners = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.isLoading = false;
        this.searchQuery = '';
        this.selectedSpecialty = 'all';
        this.selectedLanguage = 'all';
        this.minRating = 0;
        
        this.init();
    }

    init() {
        console.log('🎧 Инициализация UI слушателей');
        this.renderListenersContainer();
        this.setupEventListeners();
        this.loadActiveListeners();
        this.loadFiltersData();
    }

    /**
     * Создает контейнер для отображения слушателей
     */
    renderListenersContainer() {
        const listenersTab = document.getElementById('listenersTab');
        if (!listenersTab) {
            console.error('❌ Вкладка слушателей не найдена');
            return;
        }

        listenersTab.innerHTML = `
            <div class="listeners-container">
                <div class="listeners-header">
                    <h2>🎧 Активные слушатели</h2>
                    <p>Выберите слушателя для начала консультации</p>
                </div>

                <div class="listeners-filters">
                    <div class="search-box">
                        <i class="fas fa-search"></i>
                        <input type="text" id="listenerSearch" placeholder="Поиск по имени или специализации...">
                    </div>
                    
                    <select id="specialtyFilter" class="filter-select">
                        <option value="all">Все специализации</option>
                    </select>
                    
                    <select id="languageFilter" class="filter-select">
                        <option value="all">Все языки</option>
                    </select>
                    
                    <select id="ratingFilter" class="filter-select">
                        <option value="0">Любой рейтинг</option>
                        <option value="4.5">4.5+ ⭐</option>
                        <option value="4.0">4.0+ ⭐</option>
                        <option value="3.5">3.5+ ⭐</option>
                    </select>

                    <button class="btn btn-primary" id="refreshListeners">
                        <i class="fas fa-sync-alt"></i>
                        Обновить
                    </button>
                </div>

                <div class="listeners-stats" id="listenersStats">
                    <div class="stats-info">
                        <span id="activeListenersCount">0 слушателей онлайн</span>
                        <span class="last-updated">Обновлено: только что</span>
                    </div>
                </div>

                <div class="listeners-grid" id="listenersList">
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Загрузка слушателей...</p>
                    </div>
                </div>

                <div class="listeners-pagination" id="listenersPagination">
                    <!-- Пагинация будет добавлена динамически -->
                </div>

                <div class="listeners-empty-state hidden" id="emptyState">
                    <div class="empty-state">
                        <i class="fas fa-users-slash"></i>
                        <h3>Нет доступных слушателей</h3>
                        <p>В данный момент нет слушателей онлайн. Попробуйте позже или проверьте фильтры.</p>
                        <button class="btn btn-primary" onclick="window.listenersUI.loadActiveListeners()">
                            <i class="fas fa-sync-alt"></i>
                            Обновить список
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Настраивает обработчики событий
     */
    setupEventListeners() {
        // Поиск слушателей
        const searchInput = document.getElementById('listenerSearch');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.filterListeners();
                }, 300);
            });
        }

        // Фильтр по специализации
        const specialtyFilter = document.getElementById('specialtyFilter');
        if (specialtyFilter) {
            specialtyFilter.addEventListener('change', (e) => {
                this.selectedSpecialty = e.target.value;
                this.filterListeners();
            });
        }

        // Фильтр по языку
        const languageFilter = document.getElementById('languageFilter');
        if (languageFilter) {
            languageFilter.addEventListener('change', (e) => {
                this.selectedLanguage = e.target.value;
                this.filterListeners();
            });
        }

        // Фильтр по рейтингу
        const ratingFilter = document.getElementById('ratingFilter');
        if (ratingFilter) {
            ratingFilter.addEventListener('change', (e) => {
                this.minRating = parseFloat(e.target.value);
                this.filterListeners();
            });
        }

        // Кнопка обновления списка
        const refreshBtn = document.getElementById('refreshListeners');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadActiveListeners();
                this.app.showNotification('Список слушателей обновлен', 'success');
            });
        }

        // WebSocket события
        if (this.app.socket) {
            this.app.socket.on('active_listeners_list', (listeners) => {
                this.handleListenersUpdate(listeners);
            });

            this.app.socket.on('listener_online', (listener) => {
                this.handleListenerOnline(listener);
            });

            this.app.socket.on('listener_offline', (data) => {
                this.handleListenerOffline(data);
            });

            this.app.socket.on('listener_availability_changed', (data) => {
                this.handleAvailabilityChange(data);
            });
        }

        // Обработка изменения видимости вкладки
        this.setupTabVisibilityHandler();
    }

    /**
     * Загружает данные для фильтров
     */
    async loadFiltersData() {
        try {
            const token = localStorage.getItem('auth_token');
            
            // Загрузка специализаций
            const specialtiesResponse = await fetch('/chat/specialties', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (specialtiesResponse.ok) {
                const data = await specialtiesResponse.json();
                this.populateSpecialtiesFilter(data.specialties);
            }

            // Загрузка языков
            const languagesResponse = await fetch('/chat/languages', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (languagesResponse.ok) {
                const data = await languagesResponse.json();
                this.populateLanguagesFilter(data.languages);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки данных фильтров:', error);
        }
    }

    /**
     * Заполняет фильтр специализаций
     */
    populateSpecialtiesFilter(specialties) {
        const filter = document.getElementById('specialtyFilter');
        if (!filter || !specialties) return;

        specialties.forEach(specialty => {
            const option = document.createElement('option');
            option.value = specialty;
            option.textContent = specialty;
            filter.appendChild(option);
        });
    }

    /**
     * Заполняет фильтр языков
     */
    populateLanguagesFilter(languages) {
        const filter = document.getElementById('languageFilter');
        if (!filter || !languages) return;

        languages.forEach(language => {
            const option = document.createElement('option');
            option.value = language;
            option.textContent = language;
            filter.appendChild(option);
        });
    }

    /**
     * Загружает активных слушателей
     */
    async loadActiveListeners(page = 1) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.currentPage = page;
        this.showLoadingState();

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/chat/active-listeners?page=${page}&limit=12`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.listeners = data.listeners;
                this.filteredListeners = data.listeners;
                this.totalPages = data.pagination.totalPages;
                
                this.renderListenersList();
                this.updateStats();
                this.updatePagination();
                this.hideEmptyState();
                
                console.log(`✅ Загружено ${this.listeners.length} слушателей`);
            } else {
                throw new Error('Ошибка загрузки слушателей');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки слушателей:', error);
            this.showErrorState();
            this.app.showNotification('Ошибка загрузки слушателей', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Обрабатывает обновление списка слушателей через WebSocket
     */
    handleListenersUpdate(listeners) {
        this.listeners = listeners;
        this.filteredListeners = listeners;
        this.renderListenersList();
        this.updateStats();
        this.hideEmptyState();
        
        console.log(`🔄 WebSocket: Обновлено ${listeners.length} слушателей`);
    }

    /**
     * Обрабатывает появление слушателя онлайн
     */
    handleListenerOnline(listener) {
        const existingIndex = this.listeners.findIndex(l => l.id === listener.listener_id);
        
        if (existingIndex >= 0) {
            // Обновляем существующего слушателя
            this.listeners[existingIndex] = {
                ...this.listeners[existingIndex],
                is_online: true,
                ...listener
            };
        } else {
            // Добавляем нового слушателя
            this.listeners.unshift({
                id: listener.listener_id,
                username: listener.username,
                avatar_url: listener.avatar_url,
                is_online: true,
                rating: listener.rating,
                specialties: listener.specialties,
                bio: 'Новый слушатель присоединился',
                total_sessions: 0,
                response_time: '2-5 мин',
                experience_years: 1,
                languages: ['Русский']
            });
        }
        
        this.filteredListeners = [...this.listeners];
        this.renderListenersList();
        this.updateStats();
        this.hideEmptyState();
        
        this.app.showNotification(`${listener.username} теперь онлайн`, 'info');
    }

    /**
     * Обрабатывает уход слушателя оффлайн
     */
    handleListenerOffline(data) {
        const listenerIndex = this.listeners.findIndex(l => l.id === data.listener_id);
        if (listenerIndex >= 0) {
            this.listeners[listenerIndex].is_online = false;
            this.filteredListeners = [...this.listeners];
            this.renderListenersList();
            this.updateStats();
            this.app.showNotification(`${data.username} теперь оффлайн`, 'info');
        }
    }

    /**
     * Обрабатывает изменение доступности слушателя
     */
    handleAvailabilityChange(data) {
        const listener = this.listeners.find(l => l.id === data.listener_id);
        if (listener) {
            listener.is_online = data.is_available;
            this.filteredListeners = [...this.listeners];
            this.renderListenersList();
            this.updateStats();
        }
    }

    /**
     * Фильтрует слушателей по текущим критериям
     */
    filterListeners() {
        this.filteredListeners = this.listeners.filter(listener => {
            // Фильтр по поисковому запросу
            const matchesSearch = !this.searchQuery || 
                listener.username.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                listener.bio.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                listener.specialties.some(spec => 
                    spec.toLowerCase().includes(this.searchQuery.toLowerCase())
                );

            // Фильтр по специализации
            const matchesSpecialty = this.selectedSpecialty === 'all' ||
                listener.specialties.includes(this.selectedSpecialty);

            // Фильтр по языку
            const matchesLanguage = this.selectedLanguage === 'all' ||
                listener.languages.includes(this.selectedLanguage);

            // Фильтр по рейтингу
            const matchesRating = this.minRating === 0 || listener.rating >= this.minRating;

            return matchesSearch && matchesSpecialty && matchesLanguage && matchesRating;
        });

        this.renderListenersList();
        this.updateStats();

        // Показываем пустое состояние если нет результатов
        if (this.filteredListeners.length === 0 && this.listeners.length > 0) {
            this.showEmptyState('Нет слушателей, соответствующих фильтрам');
        } else if (this.filteredListeners.length === 0) {
            this.showEmptyState();
        } else {
            this.hideEmptyState();
        }
    }

    /**
     * Отображает список слушателей
     */
    renderListenersList() {
        const container = document.getElementById('listenersList');
        if (!container) return;

        if (this.filteredListeners.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = this.filteredListeners.map(listener => 
            this.createListenerCard(listener)
        ).join('');
    }

    /**
     * Создает карточку слушателя
     */
    createListenerCard(listener) {
        const isAvailable = listener.is_online;
        const ratingStars = this.generateStars(listener.rating);
        
        return `
            <div class="listener-card ${!isAvailable ? 'offline' : ''}" data-listener-id="${listener.id}">
                <div class="listener-header">
                    <img src="${listener.avatar_url}" 
                         class="listener-avatar" 
                         alt="${listener.username}"
                         onerror="this.src='/images/default-avatar.svg'">
                    <div class="listener-status ${isAvailable ? 'online' : 'offline'}">
                        <div class="status-dot"></div>
                        <span class="status-text">${isAvailable ? 'Online' : 'Offline'}</span>
                    </div>
                </div>
                
                <div class="listener-info">
                    <div class="listener-main">
                        <h3 class="listener-name">${listener.username}</h3>
                        <div class="listener-rating">
                            ${ratingStars}
                            <span class="rating-value">${listener.rating}</span>
                            <span class="reviews-count">(${listener.total_sessions})</span>
                        </div>
                    </div>
                    
                    <div class="listener-specialties">
                        ${listener.specialties.map(spec => 
                            `<span class="specialty-tag">${spec}</span>`
                        ).join('')}
                    </div>
                    
                    <p class="listener-bio">${listener.bio}</p>
                    
                    <div class="listener-details">
                        <div class="detail-item">
                            <i class="fas fa-clock"></i>
                            <span>${listener.response_time}</span>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-language"></i>
                            <span>${listener.languages.join(', ')}</span>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-briefcase"></i>
                            <span>${listener.experience_years} лет опыта</span>
                        </div>
                    </div>
                </div>
                
                <div class="listener-actions">
                    <button class="btn btn-primary start-chat-btn" 
                            ${!isAvailable ? 'disabled' : ''}
                            onclick="window.listenersUI.startChatWithListener('${listener.id}')">
                        <i class="fas fa-comment"></i>
                        ${isAvailable ? 'Начать чат' : 'Не в сети'}
                    </button>
                    
                    <div class="secondary-actions">
                        <button class="btn btn-secondary view-profile-btn" 
                                onclick="window.listenersUI.viewListenerProfile('${listener.id}')">
                            <i class="fas fa-user"></i>
                            Профиль
                        </button>
                        
                        <button class="btn btn-icon favorite-btn" 
                                onclick="window.listenersUI.toggleFavorite('${listener.id}')"
                                title="Добавить в избранное">
                            <i class="far fa-heart"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Начинает чат с выбранным слушателем
     */
    async startChatWithListener(listenerId) {
        try {
            console.log('💬 Начало чата с слушателем:', listenerId);
            
            if (!this.app.socket) {
                throw new Error('Нет подключения к серверу');
            }

            // Показываем индикатор загрузки
            this.app.showNotification('Создание чата...', 'info');

            // Используем WebSocket для real-time создания чата
            this.app.socket.emit('start_chat_with_listener', { 
                listener_id: listenerId 
            });

        } catch (error) {
            console.error('❌ Ошибка начала чата:', error);
            this.app.showNotification('Ошибка создания чата', 'error');
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
            this.app.showNotification('Ошибка загрузки профиля', 'error');
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
                        <button class="btn-close" onclick="window.listenersUI.closeListenerProfileModal()">
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
                                    ${this.generateStars(profile.rating)}
                                    <span class="rating-text">${profile.rating} (${profile.total_reviews} отзывов)</span>
                                </div>
                                <div class="profile-status ${profile.is_online ? 'online' : 'offline'}">
                                    <div class="status-dot"></div>
                                    <span>${profile.is_online ? 'Online' : 'Offline'}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="profile-details">
                            <div class="detail-section">
                                <h4>📊 Статистика</h4>
                                <div class="stats-grid">
                                    <div class="stat-item">
                                        <span class="stat-label">Сессии</span>
                                        <span class="stat-value">${profile.total_sessions}</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-label">Опыт</span>
                                        <span class="stat-value">${profile.experience_years} лет</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-label">Ответ</span>
                                        <span class="stat-value">${profile.response_time}</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-label">В сети</span>
                                        <span class="stat-value">${profile.member_since}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="detail-section">
                                <h4>🎯 Специализация</h4>
                                <div class="specialties">
                                    ${profile.specialties.map(spec => 
                                        `<span class="specialty-tag">${spec}</span>`
                                    ).join('')}
                                </div>
                            </div>
                            
                            <div class="detail-section">
                                <h4>🗣️ Языки</h4>
                                <div class="languages">
                                    ${profile.languages.map(lang => 
                                        `<span class="language-tag">${lang}</span>`
                                    ).join('')}
                                </div>
                            </div>
                            
                            <div class="detail-section">
                                <h4>📝 О себе</h4>
                                <p class="profile-bio">${profile.bio}</p>
                            </div>
                            
                            ${profile.rating_distribution ? `
                                <div class="detail-section">
                                    <h4>⭐ Распределение оценок</h4>
                                    <div class="rating-distribution">
                                        ${[5,4,3,2,1].map(stars => {
                                            const count = profile.rating_distribution[stars-1] || 0;
                                            const percentage = profile.total_reviews > 0 ? 
                                                (count / profile.total_reviews) * 100 : 0;
                                            return `
                                                <div class="rating-row">
                                                    <div class="rating-stars">${'★'.repeat(stars)}</div>
                                                    <div class="rating-bar">
                                                        <div class="rating-fill" style="width: ${percentage}%"></div>
                                                    </div>
                                                    <div class="rating-count">${count}</div>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${profile.reviews && profile.reviews.length > 0 ? `
                                <div class="detail-section">
                                    <h4>💬 Последние отзывы</h4>
                                    <div class="reviews-list">
                                        ${profile.reviews.map(review => `
                                            <div class="review-item">
                                                <div class="review-header">
                                                    <div class="review-user">
                                                        <img src="${review.user.avatar_url || '/images/default-avatar.svg'}" 
                                                             class="user-avatar"
                                                             onerror="this.src='/images/default-avatar.svg'">
                                                        <span>${review.user.username}</span>
                                                    </div>
                                                    <div class="review-rating">${'★'.repeat(review.rating)}</div>
                                                </div>
                                                <p class="review-comment">${review.comment || 'Без комментария'}</p>
                                                <div class="review-date">${this.formatDate(review.created_at)}</div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="window.listenersUI.closeListenerProfileModal()">
                            Закрыть
                        </button>
                        <button class="btn btn-primary" 
                                ${!profile.is_online ? 'disabled' : ''}
                                onclick="window.listenersUI.startChatWithListener('${profile.id}')">
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

    /**
     * Закрывает модальное окно профиля
     */
    closeListenerProfileModal() {
        const modal = document.getElementById('listenerProfileModal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * Переключает слушателя в избранное
     */
    toggleFavorite(listenerId) {
        // В реальном приложении здесь будет сохранение в localStorage или отправка на сервер
        const favorites = JSON.parse(localStorage.getItem('favorite_listeners') || '[]');
        const index = favorites.indexOf(listenerId);
        
        if (index > -1) {
            favorites.splice(index, 1);
            this.app.showNotification('Удалено из избранного', 'info');
        } else {
            favorites.push(listenerId);
            this.app.showNotification('Добавлено в избранное', 'success');
        }
        
        localStorage.setItem('favorite_listeners', JSON.stringify(favorites));
        
        // Обновляем иконку кнопки
        const button = document.querySelector(`[onclick="window.listenersUI.toggleFavorite('${listenerId}')"]`);
        if (button) {
            const icon = button.querySelector('i');
            if (icon) {
                icon.className = index > -1 ? 'far fa-heart' : 'fas fa-heart';
            }
        }
    }

    /**
     * Обновляет статистику
     */
    updateStats() {
        const statsElement = document.getElementById('listenersStats');
        const countElement = document.getElementById('activeListenersCount');
        
        if (statsElement && countElement) {
            const onlineCount = this.filteredListeners.filter(l => l.is_online).length;
            const totalCount = this.filteredListeners.length;
            
            countElement.textContent = `${onlineCount} из ${totalCount} слушателей онлайн`;
            
            // Обновляем время последнего обновления
            const lastUpdated = statsElement.querySelector('.last-updated');
            if (lastUpdated) {
                lastUpdated.textContent = `Обновлено: ${new Date().toLocaleTimeString()}`;
            }
        }
    }

    /**
     * Обновляет пагинацию
     */
    updatePagination() {
        const paginationContainer = document.getElementById('listenersPagination');
        if (!paginationContainer || this.totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let paginationHTML = '';
        
        // Кнопка "Назад"
        if (this.currentPage > 1) {
            paginationHTML += `
                <button class="page-btn prev" onclick="window.listenersUI.loadActiveListeners(${this.currentPage - 1})">
                    <i class="fas fa-chevron-left"></i>
                    Назад
                </button>
            `;
        }

        // Номера страниц
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(this.totalPages, startPage + 4);
        
        for (let i = startPage; i <= endPage; i++) {
            if (i === this.currentPage) {
                paginationHTML += `<span class="page-current">${i}</span>`;
            } else {
                paginationHTML += `<button class="page-btn" onclick="window.listenersUI.loadActiveListeners(${i})">${i}</button>`;
            }
        }

        // Кнопка "Вперед"
        if (this.currentPage < this.totalPages) {
            paginationHTML += `
                <button class="page-btn next" onclick="window.listenersUI.loadActiveListeners(${this.currentPage + 1})">
                    Вперед
                    <i class="fas fa-chevron-right"></i>
                </button>
            `;
        }

        paginationContainer.innerHTML = paginationHTML;
    }

    /**
     * Показывает состояние загрузки
     */
    showLoadingState() {
        const container = document.getElementById('listenersList');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Загрузка слушателей...</p>
                </div>
            `;
        }
        this.hideEmptyState();
    }

    /**
     * Показывает состояние ошибки
     */
    showErrorState() {
        const container = document.getElementById('listenersList');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Ошибка загрузки</h3>
                    <p>Не удалось загрузить список слушателей</p>
                    <button class="btn btn-primary" onclick="window.listenersUI.loadActiveListeners()">
                        Попробовать снова
                    </button>
                </div>
            `;
        }
    }

    /**
     * Показывает пустое состояние
     */
    showEmptyState(message = '') {
        const emptyState = document.getElementById('emptyState');
        const container = document.getElementById('listenersList');
        
        if (emptyState && container) {
            if (message) {
                emptyState.querySelector('h3').textContent = 'Ничего не найдено';
                emptyState.querySelector('p').textContent = message;
            }
            emptyState.classList.remove('hidden');
            container.innerHTML = '';
        }
    }

    /**
     * Скрывает пустое состояние
     */
    hideEmptyState() {
        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            emptyState.classList.add('hidden');
        }
    }

    /**
     * Настраивает обработчик видимости вкладки
     */
    setupTabVisibilityHandler() {
        // Обновляем список при переключении на вкладку слушателей
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && document.getElementById('listenersTab')?.classList.contains('active')) {
                this.loadActiveListeners();
            }
        });
    }

    // Вспомогательные методы

    /**
     * Генерирует HTML для звезд рейтинга
     */
    generateStars(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        
        let stars = '';
        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                stars += '<i class="fas fa-star"></i>';
            } else if (i === fullStars && hasHalfStar) {
                stars += '<i class="fas fa-star-half-alt"></i>';
            } else {
                stars += '<i class="far fa-star"></i>';
            }
        }
        return stars;
    }

    /**
     * Форматирует дату
     */
    formatDate(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'только что';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
        if (diff < 86400000) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        return date.toLocaleDateString('ru-RU');
    }

    /**
     * Экранирует HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    // Ждем инициализации основного приложения
    const checkApp = setInterval(() => {
        if (window.chatApp) {
            clearInterval(checkApp);
            console.log('🎯 Инициализация UI слушателей...');
            window.listenersUI = new ListenersUI(window.chatApp);
        }
    }, 100);
});
