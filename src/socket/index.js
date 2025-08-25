import { Server } from 'socket.io';
import { logger } from '../utils/logger.js';

export function setupSocket(server) {
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });

  io.on('connection', (socket) => {
    logger.info({ id: socket.id }, 'socket connected');

    socket.on('room:join', ({ room_id }) => {
      const roomKey = `room:${room_id}`;
      socket.join(roomKey);
      socket.emit('room:joined', { room_id });
    });

    socket.on('room:leave', ({ room_id }) => {
      const roomKey = `room:${room_id}`;
      socket.leave(roomKey);
      socket.emit('room:left', { room_id });
    });

    socket.on('typing', ({ room_id, user_id, is_typing }) => {
      socket.to(`room:${room_id}`).emit('typing', { room_id, user_id, is_typing });
    });

    socket.on('disconnect', () => {
      logger.info({ id: socket.id }, 'socket disconnected');
    });
  });

  return io;
}
