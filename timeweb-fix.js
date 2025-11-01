// Файл для исправления специфичных проблем TimeWeb хостинга
const fs = require('fs');
const path = require('path');

// Проверяем и создаем необходимые папки
const requiredFolders = [
    './frontend/media/avatars',
    './frontend/media/uploads', 
    './frontend/media/stickers',
    './frontend/images',
    './logs'
];

requiredFolders.forEach(folder => {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
        console.log(`✅ Created folder: ${folder}`);
    }
});

// Проверяем наличие стандартных файлов
const defaultAvatarPath = './frontend/images/default-avatar.png';
if (!fs.existsSync(defaultAvatarPath)) {
    // Создаем простой SVG аватар как fallback
    const svgAvatar = `
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="100" fill="#007bff"/>
        <text x="100" y="110" text-anchor="middle" fill="white" font-size="40">👤</text>
    </svg>`;
    
    fs.writeFileSync(defaultAvatarPath.replace('.png', '.svg'), svgAvatar);
    console.log('✅ Created default avatar placeholder');
}

// Функция для проверки доступности порта
function findAvailablePort(startPort = 3000, maxAttempts = 10) {
    return new Promise((resolve) => {
        let port = startPort;
        let attempts = 0;
        
        function tryPort() {
            const net = require('net');
            const server = net.createServer();
            
            server.listen(port, () => {
                server.close();
                resolve(port);
            });
            
            server.on('error', () => {
                attempts++;
                if (attempts >= maxAttempts) {
                    resolve(null);
                } else {
                    port++;
                    tryPort();
                }
            });
        }
        
        tryPort();
    });
}

module.exports = {
    findAvailablePort,
    requiredFolders
};
