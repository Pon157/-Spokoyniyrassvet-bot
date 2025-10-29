class ChatApp {
    constructor() {
        this.currentUser = null;
        this.currentChat = null;
        this.socket = null;
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.loadUserData();
        this.setupEventListeners();
        this.initializeSocket();
        this.loadInterfaceData();
    }

    async checkAuth() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        
        if (!token || !user) {
            window.location.href = '/';
            return;
        }
        
        this.currentUser = JSON.parse(user);
    }

    loadUserData() {
        document.getElementById('userName').textContent = this.currentUser.username;
        document.getElementById('userRole').textContent = this.getRoleDisplayName(this.currentUser.role);
        
        if (this.currentUser.avatar) {
            document.getElementById('userAvatar').src = this.currentUser.avatar;
        }

        // Показать соответствующие секции в зависимости от роли
        this.showRoleSpecificSections();
    }

    getRoleDisplayName(role) {
        const roleNames = {
            'user': 'Пользователь',
            'listener': 'Слушатель',
            'admin': 'Администратор',
            'coowner': 'Совладелец',
            'owner': 'Владелец'
        };
        return roleNames[role] || role;
    }

    showRoleSpecificSections() {
        const userSection = document.getElementById('userSection');
        const listenerSection = document.getElementById('listenerSection');
        
        if (this.currentUser.role === 'user') {
            userSection.classList.remove('hidden');
            this.loadListeners();
        } else if (this.currentUser.role === 'listener') {
            listenerSection.classList.remove('hidden');
            this.loadListenerData();
        }
        
        this.loadUserChats();
    }

    setupEventListeners() {
        // Навигация
        document.getElementById('settingsBtn').addEventListener('click', () => {
            window.location.href = '/settings';
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Отправка сообщений
        document.getElementById('sendBtn').addEventListener('click', () => {
            this.sendMessage();
        });

        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // Медиа
        document.getElementById('mediaBtn').addEventListener('click', () => {
            document.getElementById('mediaInput').click();
        });

        document.getElementById('stickerBtn').addEventListener('click', () => {
            document.getElementById('stickerInput').click();
        });

        document.getElementById('mediaInput').addEventListener('change', (
