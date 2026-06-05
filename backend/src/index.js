require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/stocks', require('./routes/stocks'));
app.use('/api/relationships', require('./routes/relationships'));
app.use('/api/portfolio', require('./routes/portfolio'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/config', require('./routes/config'));
app.use('/api/company', require('./routes/company'));
app.use('/api/ideas', require('./routes/ideas'));
app.use('/api/sip', require('./routes/sip'));
app.use('/api/trade-requests', require('./routes/trade-requests'));
app.use('/api/news', require('./routes/news'));
app.use('/api/stock-alerts', require('./routes/stock-alerts'));
const notificationsModule = require('./routes/notifications');
app.use('/api/notifications', notificationsModule.router);

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// HTTP server + Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  path: '/socket.io',
});

// Authenticate socket connections with JWT
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Unauthorized'));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  // Each user joins their own room so we can target notifications
  socket.join(`user:${socket.user.id}`);
  console.log(`[Socket.IO] User ${socket.user.id} connected`);

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] User ${socket.user.id} disconnected`);
  });
});

const priceScheduler = require('./services/priceScheduler');
priceScheduler.setIo(io);
notificationsModule.setIo(io);

const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
  console.log(`Money Matriz backend running on port ${PORT}`);
  priceScheduler.start();
});
