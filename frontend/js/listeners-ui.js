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
        this.showOffline = false;
        
        this.init();
    }

    init() {
        console.log('🎧 Инициализация UI слушателей');
        this.renderListenersContainer();
        this.setupEventListeners();
        this.loadListeners();
    }

    renderListenersContainer() {
        const listenersTab = document.getElementById('listenersTab');
        if (!listenersTab) {
            console.error('❌ Вкладка слушателей не найдена');
            return;
        }

        listenersTab.innerHTML = `
            <div class="listeners-container">
                <div class="listeners-header">
                    <h2>🎧 Слушатели</h2>
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

                    <label class="toggle-offline">
                        <input type="checkbox" id="showOfflineToggle">
                        <span class="toggle-slider"></span>
                        <span>Показать офлайн</span>
                    </label>

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

                <div class="listeners-pagination" id="listenersPagination"></div>

                <div class="listeners-empty-state hidden" id="emptyState">
                    <div class="empty-state">
                        <i class="fas fa-users-slash"></i>
                        <h3>Нет доступных слушателей</h3>
                        <p>В данный момент нет слушателей онлайн. Попробуйте позже или проверьте фильтры.</p>
                        <button class="btn btn-primary" onclick="window.listenersUI.loadListeners()">
                            <i class="fas fa-sync-alt"></i>
                            Обновить список
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

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

        // Переключатель офлайн слушателей
        const offlineToggle = document.getElementById('showOfflineToggle');
        if (offlineToggle) {
            offlineToggle.addEventListener('change', (e) => {
                this.showOffline = e.target.checked;
                this.filterListeners();
            });
        }

        // Кнопка обновления списка
        const refreshBtn = document.getElementById('refreshListeners');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadListeners();
                this.app.showNotification('Список слушателей обновлен', 'success');
            });
        }

        // WebSocket события
        if (this.app.socket) {
            this.app.socket.on('active_listeners_list', (listeners) => {
                this.handleListenersUpdate(listeners);
            });
        }
    }

    async loadListeners(page = 1) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.currentPage = page;
        this.showLoadingState();

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/chat/listeners?page=${page}&limit=12`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.listeners = data.listeners || [];
                this.filteredListeners = [...this.listeners];
                this.totalPages = data.pagination?.totalPages || 1;
                
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

    handleListenersUpdate(listeners) {
        this.listeners = listeners;
        this.filteredListeners = listeners;
        this.renderListenersList();
        this.updateStats();
        this.hideEmptyState();
        
        console.log(`🔄 WebSocket: Обновлено ${listeners.length} слушателей`);
    }

    filterListeners() {
        this.filteredListeners = this.listeners.filter(listener => {
            // Фильтр по онлайн/офлайн
            const matchesOnline = this.showOffline || listener.is_online;

            // Фильтр по поисковому запросу
            const matchesSearch = !this.searchQuery || 
                listener.username.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                (listener.bio && listener.bio.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
                (listener.specialties && listener.specialties.some(spec => 
                    spec.toLowerCase().includes(this.searchQuery.toLowerCase())
                ));

            // Фильтр по специализации
            const matchesSpecialty = this.selectedSpecialty === 'all' ||
                (listener.specialties && listener.specialties.includes(this.selectedSpecialty));

            // Фильтр по языку
            const matchesLanguage = this.selectedLanguage === 'all' ||
                (listener.languages && listener.languages.includes(this.selectedLanguage));

            // Фильтр по рейтингу
            const matchesRating = this.minRating === 0 || (listener.rating >= this.minRating);

            return matchesOnline && matchesSearch && matchesSpecialty && matchesLanguage && matchesRating;
        });

        this.renderListenersList();
        this.updateStats();

        if (this.filteredListeners.length === 0) {
            this.showEmptyState(this.listeners.length > 0 ? 'Нет слушателей, соответствующих фильтрам' : '');
        } else {
            this.hideEmptyState();
        }
    }

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
                            <span class="rating-value">${listener.rating || 'Нет оценок'}</span>
                            <span class="reviews-count">(${listener.total_sessions || 0})</span>
                        </div>
                    </div>
                    
                    ${listener.specialties ? `
                    <div class="listener-specialties">
                        ${listener.specialties.map(spec => 
                            `<span class="specialty-tag">${spec}</span>`
                        ).join('')}
                    </div>
                    ` : ''}
                    
                    ${listener.bio ? `<p class="listener-bio">${listener.bio}</p>` : ''}
                    
                    <div class="listener-details">
                        <div class="detail-item">
                            <i class="fas fa-clock"></i>
                            <span>${listener.response_time || 'Не указано'}</span>
                        </div>
                        ${listener.languages ? `
                        <div class="detail-item">
                            <i class="fas fa-language"></i>
                            <span>${listener.languages.join(', ')}</span>
                        </div>
                        ` : ''}
                        ${listener.experience_years ? `
                        <div class="detail-item">
                            <i class="fas fa-briefcase"></i>
                            <span>${listener.experience_years} лет опыта</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="listener-actions">
                    <button class="btn ${isAvailable ? 'btn-primary' : 'btn-secondary'} start-chat-btn" 
                            onclick="window.listenersUI.startChatWithListener('${listener.id}')">
                        <i class="fas fa-comment"></i>
                        ${isAvailable ? 'Начать чат' : 'Написать офлайн'}
                    </button>
                </div>
            </div>
        `;
    }

    async startChatWithListener(listenerId) {
        try {
            console.log('💬 Начало чата с слушателем:', listenerId);
            
            const listener = this.listeners.find(l => l.id === listenerId);
            if (!listener) {
                throw new Error('Слушатель не найден');
            }

            if (!listener.is_online) {
                if (!confirm('Этот слушатель сейчас не в сети. Вы можете отправить сообщение, и он увидит его когда вернется. Продолжить?')) {
                    return;
                }
            }

            this.app.showNotification('Создание чата...', 'info');

            // Используем API для создания чата
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/chat/create-with-listener', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    listener_id: listenerId
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.app.showNotification('Чат создан успешно!', 'success');
                
                // Переключаемся на вкладку чатов
                this.app.switchTab('chats');
                
                // Открываем созданный чат
                if (data.chat) {
                    setTimeout(() => {
                        this.app.openChat(data.chat.id);
                    }, 500);
                }
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка создания чата');
            }

        } catch (error) {
            console.error('❌ Ошибка начала чата:', error);
            this.app.showNotification(error.message || 'Ошибка создания чата', 'error');
        }
    }

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
                <button class="page-btn prev" onclick="window.listenersUI.loadListeners(${this.currentPage - 1})">
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
                paginationHTML += `<button class="page-btn" onclick="window.listenersUI.loadListeners(${i})">${i}</button>`;
            }
        }

        // Кнопка "Вперед"
        if (this.currentPage < this.totalPages) {
            paginationHTML += `
                <button class="page-btn next" onclick="window.listenersUI.loadListeners(${this.currentPage + 1})">
                    Вперед
                    <i class="fas fa-chevron-right"></i>
                </button>
            `;
        }

        paginationContainer.innerHTML = paginationHTML;
    }

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

    showErrorState() {
        const container = document.getElementById('listenersList');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Ошибка загрузки</h3>
                    <p>Не удалось загрузить список слушателей</p>
                    <button class="btn btn-primary" onclick="window.listenersUI.loadListeners()">
                        Попробовать снова
                    </button>
                </div>
            `;
        }
    }

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

    hideEmptyState() {
        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            emptyState.classList.add('hidden');
        }
    }

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
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    // Ждем инициализации основного приложения
    const checkApp = setInterval(() => {
        if (window.app) {
            clearInterval(checkApp);
            console.log('🎯 Инициализация UI слушателей...');
            window.listenersUI = new ListenersUI(window.app);
        }
    }, 100);
});
