const express = require('express');
const http = require('http');
const { v4: uuidV4 } = require('uuid');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const roomHosts = {};           // roomId => hostSocketId
const roomApprovals = {};       // roomId => Set of approved socketIds

const roomHostPeerIds = {};


app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.redirect(`/${uuidV4()}/host`);
});

app.get('/:room/host', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/host.html'));
});

app.get('/:room/client', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/client.html'));
});

io.on('connection', socket => {
  console.log('[Socket Connected]', socket.id);

  socket.on('host-peer-id', ({ roomId, peerId }) => {
    roomHostPeerIds[roomId] = peerId;
    // Optionally, broadcast to all approved clients in the room
    if (roomApprovals[roomId]) {
        roomApprovals[roomId].forEach(socketId => {
            io.to(socketId).emit('host-peer-id', peerId);
        });
    }
});

  socket.on('register-host', (roomId) => {
    roomHosts[roomId] = socket.id;
    roomApprovals[roomId] = new Set();
    console.log(`[HOST REGISTERED] Room: ${roomId}`);
  });

  socket.on('request-to-join', ({ roomId, userId, socketId }) => {
    console.log(`[JOIN REQUEST] Room: ${roomId}, From: ${userId}, Socket: ${socketId}`);
    const hostId = roomHosts[roomId];
    if (hostId) {
      io.to(hostId).emit('join-request', { userId, socketId });
    }
  });

  socket.on('approve-user', ({ roomId, socketId }) => {
    if (!roomApprovals[roomId]) roomApprovals[roomId] = new Set();
    roomApprovals[roomId].add(socketId);
    console.log(`[USER APPROVED] ${socketId} for Room: ${roomId}`);
    io.to(socketId).emit('approved');
    // In 'approve-user' handler, after io.to(socketId).emit('approved');
    if (roomHostPeerIds[roomId]) {
      io.to(socketId).emit('host-peer-id', roomHostPeerIds[roomId]);
    }
  });

  socket.on('join-room', ({ roomId, userId, socketId }) => {
    if (!roomApprovals[roomId] || !roomApprovals[roomId].has(socketId)) {
      console.log('[Join denied: not approved]');
      return;
    }

    console.log(`✅ User ${userId} joined room ${roomId}`);
    socket.join(roomId);
    socket.to(roomId).emit('user-connected', userId);

    socket.on('disconnect', () => {
      socket.rooms.forEach(roomId => {
        if (roomId !== socket.id) { // Skip the socket's own room
          socket.to(roomId).emit('user-disconnected', socket.peerId);
        }
      });
    });
  });
});

server.listen(5000, () => console.log('✅ Server running at http://localhost:5000'));
