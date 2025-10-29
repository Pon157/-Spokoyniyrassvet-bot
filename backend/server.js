const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Маршрутизация
const authRoutes = require('./auth');
const userRoutes = require('./controllers/user');
const listenerRoutes = require('./controllers/listener');
const adminRoutes = require('./controllers/admin');
const coownerRoutes = require('./controllers/coowner');
const ownerRoutes = require('./controllers/owner');

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/listener', listenerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/coowner', coownerRoutes);
app.use('/api/owner', ownerRoutes);

require('./sockets')(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

