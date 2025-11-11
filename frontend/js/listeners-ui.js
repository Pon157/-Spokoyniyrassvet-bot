class ListenersUI {
    constructor(app) {
        this.app = app;
        this.listeners = [];
        this.filteredListeners = [];
        this.currentPage = 1;
        this.totalPages = 1;
        
        this.init();
    }

    init() {
        console.log('🎧 Инициализация UI слушателей');
        this.renderListenersList();
        this.setupEventListeners();
        this.loadActiveListeners();
    }

    setupEventListeners() {
        // Поиск слушателей
        const searchInput = document.getElementById('listenerSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterListeners(e.target.value);
            });
        }

        // Фильтр по специализации
        const specialtyFilter = document.getElementById('specialtyFilter');
        if (specialtyFilter) {
            specialtyFilter.addEventListener('change', (e) => {
                this.filterBySpecialty(e.target.value);
            });
        }

        // Кнопка обновления списка
        const refreshBtn = document.getElementById('refreshListeners');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadActiveListeners();
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
    }

    async loadActiveListeners(page = 1) {
        try {
            this.showLoadingState();
            
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
                this.currentPage = data.pagination.page;
                this.totalPages = data.pagination.totalPages;
                
                this.renderListenersList();
                this.updatePagination();
            } else {
                throw new Error('Ошибка загрузки слушателей');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки слушателей:', error);
            this.showErrorState();
        }
    }

    renderListenersList() {
        const container = document.getElementById('listenersList');
        if (!container) return;

        if (this.filteredListeners.length === 0) {
            container.innerHTML = this.getEmptyStateHTML();
            return;
        }

        container.innerHTML = this.filteredListeners.map(listener => 
            this.createListenerCard(listener)
        ).join('');
    }

    createListenerCard(listener) {
        return `
            <div class="listener-card" data-listener-id="${listener.id}">
                <div class="listener-header">
                    <img src="${listener.avatar_url}" 
                         class="listener-avatar" 
                         alt="${listener.username}"
                         onerror="this.src='/images/default-avatar.svg'">
                    <div class="listener-status ${listener.is_online ? 'online' : 'offline'}"></div>
                </div>
                
                <div class="listener-info">
                    <h3 class="listener-name">${listener.username}</h3>
                    <div class="listener-rating">
                        ${this.generateStars(listener.rating)}
                        <span class="rating-value">${listener.rating}</span>
                    </div>
                    
                    <div class="listener-specialties">
                        ${listener.specialties.map(spec => 
                            `<span class="specialty-tag">${spec}</span>`
                        ).join('')}
                    </div>
                    
                    <p class="listener-bio">${listener.bio}</p>
                    
                    <div class="listener-stats">
                        <div class="stat">
                            <i class="fas fa-comments"></i>
                            <span>${listener.total_sessions} сессий</span>
                        </div>
                        <div class="stat">
                            <i class="fas fa-clock"></i>
                            <span>${listener.response_time}</span>
                        </div>
                    </div>
                </div>
                
                <div class="listener-actions">
                    <button class="btn btn-primary start-chat-btn" 
                            ${!listener.is_online ? 'disabled' : ''}
                            onclick="window.chatApp.startChatWithListener('${listener.id}')">
                        <i class="fas fa-comment"></i>
                        ${listener.is_online ? 'Начать чат' : 'Не в сети'}
                    </button>
                    
                    <button class="btn btn-secondary view-profile-btn" 
                            onclick="window.chatApp.viewListenerProfile('${listener.id}')">
                        <i class="fas fa-user"></i>
                        Профиль
                    </button>
                </div>
            </div>
        `;
    }

    filterListeners(query) {
        if (!query) {
            this.filteredListeners = this.listeners;
        } else {
            this.filteredListeners = this.listeners.filter(listener =>
                listener.username.toLowerCase().includes(query.toLowerCase()) ||
                listener.bio.toLowerCase().includes(query.toLowerCase()) ||
                listener.specialties.some(spec => 
                    spec.toLowerCase().includes(query.toLowerCase())
                )
            );
        }
        this.renderListenersList();
    }

    filterBySpecialty(specialty) {
        if (specialty === 'all') {
            this.filteredListeners = this.listeners;
        } else {
            this.filteredListeners = this.listeners.filter(listener =>
                listener.specialties.includes(specialty)
            );
        }
        this.renderListenersList();
    }

    // WebSocket обработчики
    handleListenersUpdate(listeners) {
        this.listeners = listeners;
        this.filteredListeners = listeners;
        this.renderListenersList();
    }

    handleListenerOnline(listener) {
        const existingIndex = this.listeners.findIndex(l => l.id === listener.listener_id);
        
        if (existingIndex >= 0) {
            // Обновляем существующего слушателя
            this.listeners[existingIndex].is_online = true;
        } else {
            // Добавляем нового слушателя
            this.listeners.unshift({
                id: listener.listener_id,
                username: listener.username,
                avatar_url: listener.avatar_url,
                is_online: true,
                rating: listener.rating,
                specialties: listener.specialties,
                bio: 'Новый слушатель',
                total_sessions: 0,
                response_time: '2-5 мин'
            });
        }
        
        this.filteredListeners = this.listeners;
        this.renderListenersList();
        
        this.app.showNotification(`${listener.username} теперь онлайн`, 'info');
    }

    handleListenerOffline(data) {
        const listener = this.listeners.find(l => l.id === data.listener_id);
        if (listener) {
            listener.is_online = false;
            this.renderListenersList();
            this.app.showNotification(`${data.username} теперь оффлайн`, 'info');
        }
    }

    handleAvailabilityChange(data) {
        const listener = this.listeners.find(l => l.id === data.listener_id);
        if (listener) {
            listener.is_online = data.is_available;
            this.renderListenersList();
        }
    }

    // Вспомогательные методы
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

    showLoadingState() {
        const container = document.getElementById('listenersList');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Загрузка слушателей...</p>
                </div>
            `;
        }
    }

    showErrorState() {
        const container = document.getElementById('listenersList');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Ошибка загрузки слушателей</p>
                    <button class="btn btn-primary" onclick="window.listenersUI.loadActiveListeners()">
                        Попробовать снова
                    </button>
                </div>
            `;
        }
    }

    getEmptyStateHTML() {
        return `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>Нет доступных слушателей</h3>
                <p>В данный момент нет слушателей онлайн. Попробуйте позже.</p>
                <button class="btn btn-primary" onclick="window.listenersUI.loadActiveListeners()">
                    Обновить список
                </button>
            </div>
        `;
    }

    updatePagination() {
        const paginationContainer = document.getElementById('listenersPagination');
        if (!paginationContainer) return;

        if (this.totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let paginationHTML = '';
        
        // Кнопка "Назад"
        if (this.currentPage > 1) {
            paginationHTML += `<button class="page-btn" onclick="window.listenersUI.loadActiveListeners(${this.currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>`;
        }

        // Номера страниц
        for (let i = 1; i <= this.totalPages; i++) {
            if (i === this.currentPage) {
                paginationHTML += `<span class="page-current">${i}</span>`;
            } else {
                paginationHTML += `<button class="page-btn" onclick="window.listenersUI.loadActiveListeners(${i})">${i}</button>`;
            }
        }

        // Кнопка "Вперед"
        if (this.currentPage < this.totalPages) {
            paginationHTML += `<button class="page-btn" onclick="window.listenersUI.loadActiveListeners(${this.currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>`;
        }

        paginationContainer.innerHTML = paginationHTML;
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    if (window.chatApp) {
        window.listenersUI = new ListenersUI(window.chatApp);
    }
});
