const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);

// Самый простой CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', '*');
    next();
});

app.use(express.json());

// Простейший health check
app.get('/health', (req, res) => {
    console.log('✅ Health check called');
    res.json({ 
        status: 'OK', 
        message: 'ULTRA SIMPLE SERVER WORKS',
        time: new Date().toISOString()
    });
});

// Простейший login
app.post('/auth/login', (req, res) => {
    console.log('🔧 Login called:', req.body);
    res.json({
        message: 'LOGIN WORKS!',
        token: 'test-token-123',
        user: { id: 'test-1', username: 'testuser', role: 'user' }
    });
});

// Любой другой запрос
app.all('*', (req, res) => {
    console.log('📨 Request:', req.method, req.url);
    res.json({ 
        message: 'SERVER IS RESPONDING!',
        method: req.method,
        url: req.url,
        body: req.body
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ULTRA SIMPLE SERVER ON PORT ${PORT}`);
    console.log(`🔗 Test URL: https://pon157-git--f288.twc1.net/health`);
});
