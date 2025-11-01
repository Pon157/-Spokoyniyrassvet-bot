// Фиксы для работы на Timeweb хостинге
const fs = require('fs');
const path = require('path');

class TimewebFix {
    static applyFixes() {
        console.log('🔧 Applying Timeweb fixes...');
        
        // Создаем необходимые директории если их нет
        const dirs = [
            'logs',
            'uploads',
            'uploads/avatars',
            'uploads/media'
        ];
        
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`✅ Created directory: ${dir}`);
            }
        });
        
        // Проверяем наличие .env файла
        if (!fs.existsSync('.env')) {
            console.log('⚠️  .env file not found, using environment variables...');
        }
        
        console.log('✅ Timeweb fixes applied');
    }
    
    static getServerConfig() {
        return {
            port: process.env.PORT || 3000,
            host: '0.0.0.0',
            // Timeweb специфичные настройки
            staticOptions: {
                maxAge: '1d',
                etag: true,
                dotfiles: 'ignore'
            }
        };
    }
}

module.exports = TimewebFix;
