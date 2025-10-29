module.exports = (io) => {
  const connectedUsers = {};

  io.on('connection', (socket) => {
    socket.on('authorize', (token) => {
      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return socket.disconnect();
        connectedUsers[socket.id] = decoded.id;
        socket.join(decoded.id.toString());
      });
    });

    socket.on('sendMessage', async (data) => {
      const { to, content, type } = data;
      const from = connectedUsers[socket.id];

      const message = new Message({ from, to, content, type, sentAt: new Date() });
      await message.save();

      io.to(to.toString()).emit('newMessage', message);
    });

    socket.on('disconnect', () => {
      delete connectedUsers[socket.id];
    });
  });
};

