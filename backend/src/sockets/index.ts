import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import { registerChatHandlers } from './chat.handler';
import { registerNotificationHandlers } from './notification.handler';
import { corsOrigin } from '../config/cors';

let ioInstance: Server | null = null;

export function initSockets(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
    // Increase ping timeout for mobile clients
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ── JWT authentication middleware ────────────────────────────────────────────
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('No token provided'));
    }

    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      socket.data.email = payload.email;
      next();
    } catch {
      next(new Error('Token invalid or expired'));
    }
  });

  // ── Connection handler ───────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const { userId, role } = socket.data as { userId: string; role: string };
    console.log(`🔌 Socket connected: ${userId} (${role}) — ${socket.id}`);

    // Register feature-specific handlers
    registerChatHandlers(io, socket);
    registerNotificationHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket disconnected: ${userId} — ${reason}`);
    });

    socket.on('error', (err) => {
      console.error(`Socket error for ${userId}:`, err.message);
    });
  });

  ioInstance = io;
  return io;
}

/** Get the singleton Socket.IO instance (for use in services) */
export function getIO(): Server {
  if (!ioInstance) throw new Error('Socket.IO not initialised. Call initSockets() first.');
  return ioInstance;
}
