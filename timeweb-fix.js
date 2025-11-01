// Простой тестовый сервер для Timeweb
const express = require('express');
const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Timeweb test' });
});

app.get('*', (req, res) => {
    res.json({ 
        message: 'Server is running on Timeweb',
        url: req.url,
        method: req.method
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 TIMEWEB SERVER ON PORT ${PORT}`);
});
