import { Server, Socket } from 'socket.io';

// In-memory map of userId → socketId for targeted delivery
// In production with multiple instances, use Redis adapter (socket.io-redis)
const userSockets = new Map<string, Set<string>>();

export function registerNotificationHandlers(_io: Server, socket: Socket) {
  const userId = socket.data.userId as string;

  // Register this socket for the user
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId)!.add(socket.id);

  // Join a personal room for targeted notifications
  socket.join(`user:${userId}`);

  socket.on('disconnect', () => {
    const sockets = userSockets.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) userSockets.delete(userId);
    }
  });
}

/**
 * Emit a real-time notification to a specific user.
 * Called from service layer after persisting to DB.
 */
export function emitNotification(
  io: Server,
  userId: string,
  notification: {
    id: string;
    type: string;
    title: string;
    body: string;
    data?: unknown;
    createdAt: Date;
  },
) {
  io.to(`user:${userId}`).emit('notification:new', notification);
}

/**
 * Emit a request status change to all participants.
 */
export function emitRequestStatusChange(
  io: Server,
  participants: string[],  // array of userIds (customer, worker)
  payload: {
    requestId: string;
    status: string;
  },
) {
  participants.forEach((uid) => {
    io.to(`user:${uid}`).emit('request:status-changed', payload);
  });
}
