const socket = io();
let currentChat = null;

// Загрузка профиля пользователя
async function loadProfile() {
  const user = JSON.parse(localStorage.getItem('user'));
  document.getElementById('username').textContent = user.username;
  document.getElementById('avatar').src = user.avatar;

  // Загрузка диалогов
  const response = await fetch('/api/user/chats', {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
  });
  const chats = await response.json();
  
  const chatsList = document.getElementById('chats-list');
  chats.forEach(chat => {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.textContent = chat.participant.username;
    div.onclick = () => openChat(chat.participant._id);
    chatsList.appendChild(div);
  });
}

// Открытие чата
function openChat(userId) {
  currentChat = userId;
  document.getElementById('messages').innerHTML = '';

  // Загрузка истории сообщений
  fetch(`/api/user/chats/${userId}/messages`, {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
  })
  .then(res => res.json())
  .then(messages => {
    messages.forEach(renderMessage);
  });

  socket.emit('joinChat', userId);
}

// Отправка сообщения
document.getElementById('send-btn').onclick = () => {
  const input = document.getElementById('message-input');
  const content =
