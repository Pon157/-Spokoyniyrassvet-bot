const socket = io();

// Переключение вкладок
function showTab(tabName) {
  document.getElementById('login-tab').style.display = tabName === 'login' ? 'block' : 'none';
  document.getElementById('register-tab').style.display = tabName === 'register' ? 'block' : 'none';
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase() === tabName);
  });
}

// Обработка входа
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = new FormData(form);

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(data))
    });

    const result = await response.json();
    if (response.ok) {
      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      window.location.href = '/chat.html';
    } else {
      alert(result.error);
    }
  } catch (err) {
    alert('Ошибка сети');
  }
});

// Обработка регистрации
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = new FormData(form);

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(data))
    });

    if (response.ok) {
      alert('Регистрация успешна! Войдите в систему.');
      showTab('login');
    } else {
      const result = await response.json();
      alert(result.error);
    }
  } catch (err) {
    alert('Ошибка сети');
  }
});

// Переключение темы
document.getElementById('theme-toggle').addEventListener('change', (e) => {
  const theme = e.target.checked ? 'dark' : 'light';
  document.getElementById('theme-link').href = `css/${theme}-theme.css`;
});

