const socket = io();
let currentChat = null;

// Загрузка профиля и диалогов при старте
document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/index.html';
    return;
  }

  await loadProfile();
  setupEventListeners();
});

// Загрузка профиля пользователя и списка диалогов
async function loadProfile() {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    document.getElementById('username').textContent = user.username;
    document.getElementById('avatar').src = user.avatar;

    // Загрузка диалогов
    const response = await fetch('/api/user/chats', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) throw new Error('Ошибка загрузки диалогов');
    
    const chats = await response.json();
    renderChatsList(chats);
  } catch (err) {
    console.error('Ошибка профиля:', err);
    alert('Не удалось загрузить профиль');
  }
}

// Отображение списка диалогов
function renderChatsList(chats) {
  const chatsList = document.getElementById('chats-list');
  chatsList.innerHTML = '';

  chats.forEach(chat => {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.dataset.userId = chat.participant._id;
    div.innerHTML = `
      <div class="chat-info">
        <strong>${chat.participant.username}</strong>
        <small>${new Date(chat.lastMessage.sentAt).toLocaleTimeString()}</small>
      </div>
      <div class="message-preview">${chat.lastMessage.content}</div>
    `;
    div.onclick = () => openChat(chat.participant._id);
    chatsList.appendChild(div);
  });
}

// Открытие чата с пользователем
function openChat(userId) {
  currentChat = userId;
  
  // Очистка области сообщений
  document.getElementById('messages').innerHTML = '';
  
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

  if (msg.type === 'text') {
    div.textContent = msg.content;
  } else if (msg.type === 'image') {
    const img = document.createElement('img');
    img.src = msg.content;
    img.style.maxWidth = '200px';
    div.appendChild(img);
  } else if (msg.type === 'sticker') {
    const img = document.createElement('img');
    img.src = msg.content;
    img.style.height = '80px';
    div.appendChild(img);
  }

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
      type: file.type.startsWith('image/') ? 'image' : 'file'
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
  document.getElementById('send-btn').addEventListener('click', sendMessage);
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
}
