const fs = require('fs');
const path = require('path');

console.log('🛠️  Исправление структуры папок...');

const requiredFolders = [
  './frontend/media/avatars',
  './frontend/media/uploads',
  './frontend/media/stickers',
  './frontend/images'
];

const requiredFiles = [
  './frontend/index.html',
  './frontend/chat.html', 
  './frontend/admin.html',
  './frontend/settings.html'
];

// Функция для безопасного создания папок
function ensureDirectory(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      const stats = fs.statSync(dirPath);
      if (stats.isFile()) {
        console.log(`⚠️  ${dirPath} - это файл, переименовываем...`);
        const backupName = `${dirPath}.backup_${Date.now()}`;
        fs.renameSync(dirPath, backupName);
        console.log(`✅ Переименован в: ${backupName}`);
      } else if (stats.isDirectory()) {
        console.log(`✅ ${dirPath} - папка уже существует`);
        return true;
      }
    }
    
    // Создаем папку
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Создана папка: ${dirPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Ошибка создания ${dirPath}:`, error.message);
    return false;
  }
}

// Функция для проверки файлов
function checkFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${filePath} - файл существует`);
      return true;
    } else {
      console.log(`❌ ${filePath} - файл отсутствует`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Ошибка проверки ${filePath}:`, error.message);
    return false;
  }
}

// Создаем папки
console.log('\n📁 Проверка и создание папок:');
requiredFolders.forEach(folder => {
  ensureDirectory(folder);
});

// Проверяем файлы
console.log('\n📄 Проверка основных файлов:');
requiredFiles.forEach(file => {
  checkFile(file);
});

// Создаем стандартный аватар если его нет
const defaultAvatarPath = './frontend/images/default-avatar.png';
if (!fs.existsSync(defaultAvatarPath)) {
  console.log('\n🎨 Создание стандартного аватара...');
  try {
    // Создаем простой SVG как fallback
    const svgContent = `
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="100" fill="url(#gradient)"/>
      <text x="100" y="125" text-anchor="middle" fill="white" font-size="80" font-family="Arial">👤</text>
    </svg>`;
    
    fs.writeFileSync('./frontend/images/default-avatar.svg', svgContent);
    console.log('✅ Создан SVG аватар');
  } catch (error) {
    console.error('❌ Ошибка создания аватара:', error.message);
  }
}

console.log('\n✨ Исправление структуры завершено!');
