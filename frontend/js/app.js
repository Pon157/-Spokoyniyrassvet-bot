
const socket = io();
let currentChat = null;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/index.html';
    return;
  }

  await loadProfile();
  setupEventListeners();
});

// Загрузка профиля пользователя и диалогов
async function loadProfile() {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    document.getElementById('username').textContent = user.username;
    document.getElementById('avatar').src = user.avatar || '/images/default-avatar.png';

    // Загрузка диалогов
    const response = await fetch('/api/user/chats', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) throw new Error('Ошибка загрузки диалогов');

    const chats = await response.json();
    renderChatsList(chats);
  } catch (err) {
    console.error('Ошибка при загрузке профиля:', err);
    alert('Не удалось загрузить профиль. Попробуйте перезайти.');
  }
}

// Отображение списка диалогов
function renderChatsList(chats) {
  const chatsList = document.getElementById('chats-list');
  chatsList.innerHTML = '';

  if (chats.length === 0) {
    chatsList.innerHTML = '<p class="no-chats">Нет диалогов</p>';
    return;
  }

  chats.forEach(chat => {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.dataset.userId = chat.participant._id;
    
    div.innerHTML = `
      <div class="chat-info">
        <strong>${chat.participant.username}</strong>
        <small>${formatDate(chat.lastMessage.sentAt)}</small>
      </div>
      <div class="message-preview">${escapeHtml(chat.lastMessage.content)}</div>
    `;
    
    div.onclick = () => openChat(chat.participant._id);
    chatsList.appendChild(div);
  });
}

// Форматирование даты
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Экранирование HTML для безопасности
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Открытие чата с пользователем
function openChat(userId) {
  currentChat = userId;

  // Очистка области сообщений
  document.getElementById('messages').innerHTML = '';
  
  // Обновление заголовка чата
  const chatItem = document.querySelector(`.chat-item[data-userId="${userId}"]`);
  if (chatItem) {
    document.querySelector('.chat-title').textContent =
      chatItem.querySelector('.chat-info strong').textContent;
  }

  // Загрузка истории сообщений
  fetch(`/api/user/chats/${userId}/messages`, {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
  })
  .then(res => res.json())
  .then(messages => {
    messages.forEach(renderMessage);
  })
  .catch(err => console.error('Ошибка загрузки сообщений:', err));

  // Подключение к WebSocket-чату
  socket.emit('joinChat', userId);
}

// Отображение сообщения в чате
function renderMessage(msg) {
  const messagesEl = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = `message ${msg.from === currentUser().id ? 'sent' : 'received'}`;

  let contentEl;
  switch (msg.type) {
    case 'text':
      contentEl = document.createTextNode(msg.content);
      break;
    case 'image':
      contentEl = document.createElement('img');
      contentEl.src = msg.content;
      contentEl.style.maxWidth = '200px';
      contentEl.style.borderRadius = '8px';
      break;
    case 'sticker':
      contentEl = document.createElement('img');
      contentEl.src = msg.content;
      contentEl.style.height = '80px';
      contentEl.style.margin = '4px 0';
      break;
    case 'file':
      contentEl = document.createElement('a');
      contentEl.href = msg.content;
      contentEl.target = '_blank';
      contentEl.textContent = 'Файл: ' + (msg.fileName || 'Скачать');
      break;
    default:
      contentEl = document.createTextNode('Неподдерживаемый тип');
  }

  div.appendChild(contentEl);
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Отправка сообщения
function sendMessage() {
  const input = document.getElementById('message-input');
  const content = input.value.trim();
  if (!content) return;

  const message = {
    to: currentChat,
    content,
    type: 'text'
  };

  socket.emit('sendMessage', message);
  input.value = '';
}

// Отправка стикера
function sendSticker(url) {
  const message = {
    to: currentChat,
    content: url,
    type: 'sticker'
  };
  socket.emit('sendMessage', message);
}

// Добавление стикера по URL
function addSticker() {
  const urlInput = document.getElementById('sticker-url');
  const url = urlInput.value.trim();
  if (!url) return;

  const stickersEl = document.getElementById('stickers');
  const img = document.createElement('img');
  img.src = url;
  img.style.height = '60px';
  img.style.margin = '4px';
  img.style.cursor = 'pointer';
  img.onclick = () => sendSticker(url);
  stickersEl.appendChild(img);

  urlInput.value = '';
}

// Обработка загрузки медиафайлов
document.getElementById('media-input').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const message = {
      to: currentChat,
      content: reader.result,
      type: file.type.startsWith('image/') ? 'image' : 'file',
      fileName: file.name
    };
    socket.emit('sendMessage', message);
  };
  reader.readAsDataURL(file);
};

// Получение сообщений через WebSocket
socket.on('newMessage', (msg) => {
  if (msg.to === currentChat || msg.from === currentChat) {
    renderMessage(msg);
  }
});

// Вспомогательные функции
function currentUser() {
  return JSON.parse(localStorage.getItem('user'));
}

function setupEventListeners() {
  // Кнопка отправки
  document.getElementById('send-btn').addEventListener('click', sendMessage);
  
  // Enter для отправки
  document.getElementById('message-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  // Переключение темы
  const themeToggle = document.getElementById('theme-toggle');
  themeToggle.checked = localStorage.getItem('theme') === 'dark';
  themeToggle.addEventListener('change', () => {
    const theme = themeToggle.checked ? 'dark' : 'light';
    localStorage.setItem('theme', theme);
    document.getElementById('theme-link').href = `css/${theme}-theme.css`;
  });
    // Применить тему при загрузке
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.getElementById('theme-link').href = `css/${savedTheme}-theme.css`;
    themeToggle.checked = savedTheme === 'dark';
  }

  // Обработка изменения размера окна (адаптивность)
  window.addEventListener('resize', () => {
    if (window.innerWidth < 768) {
      document.body.classList.add('mobile-view');
    } else {
      document.body.classList.remove('mobile-view');
    }
  });

  // Инициализация мобильного вида при загрузке
  if (window.innerWidth < 768) {
    document.body.classList.add('mobile-view');
  }

  // Кнопка для открытия/закрытия списка диалогов на мобильных
  const toggleChatsBtn = document.getElementById('toggle-chats');
  if (toggleChatsBtn) {
    toggleChatsBtn.addEventListener('click', () => {
      const sidebar = document.querySelector('.sidebar');
      sidebar.classList.toggle('hidden');
    });
  }

  // Закрытие бокового меню при клике вне его на мобильных
  document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.sidebar');
    const isMobile = document.body.classList.contains('mobile-view');
    
    if (isMobile && !sidebar.contains(e.target) && !e.target.closest('#toggle-chats')) {
      sidebar.classList.add('hidden');
    }
  });
}

// Функция для обновления индикатора активности собеседника
function updateTypingIndicator(userId, isTyping) {
  const chatItem = document.querySelector(`.chat-item[data-userId="${userId}"]`);
  if (!chatItem) return;

  let typingIndicator = chatItem.querySelector('.typing-indicator');
  
  if (isTyping) {
    if (!typingIndicator) {
      typingIndicator = document.createElement('span');
      typingIndicator.className = 'typing-indicator';
      typingIndicator.textContent = 'печатает...';
      chatItem.appendChild(typingIndicator);
    }
  } else if (typingIndicator) {
    typingIndicator.remove();
  }
}

// Обработка событий WebSocket для индикации набора текста
socket.on('userTyping', (data) => {
  if (data.chatId === currentChat) {
    updateTypingIndicator(data.userId, true);
  }
});

socket.on('userStoppedTyping', (data) => {
  if (data.chatId === currentChat) {
    updateTypingIndicator(data.userId, false);
  }
});

// Отслеживание ввода текста для отправки сигнала "печатает"
let typingTimeout;
document.getElementById('message-input').addEventListener('input', () => {
  if (!currentChat) return;

  socket.emit('startTyping', { chatId: currentChat });

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('stopTyping', { chatId: currentChat });
  }, 1000);
});

// Обновление списка диалогов в реальном времени
socket.on('chatUpdated', (chatData) => {
  // Перезагружаем список диалогов, чтобы отразить изменения
  loadProfile();
});

// Обработка ошибок соединения
socket.on('connect_error', (error) => {
  console.error('Ошибка соединения с сервером:', error);
  alert('Произошла ошибка соединения с сервером. Проверьте интернет-соединение.');
});

socket.on('disconnect', () => {
  console.log('Отключено от сервера');
});

socket.on('reconnect', () => {
  console.log('Переподключено к серверу');
  // После переподключения нужно заново авторизоваться
  const token = localStorage.getItem('token');
  if (token) {
    socket.emit('authorize', token);
  }
});
