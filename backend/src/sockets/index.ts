import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { isSessionActive } from '../config/redis';
import { verifyAccessToken } from '../utils/jwt';
import { registerChatHandlers } from './chat.handler';
import { registerNotificationHandlers } from './notification.handler';
import { corsOrigin } from '../config/cors';
import { logger } from '../utils/logger';

let ioInstance: Server | null = null;
const SOCKET_EVENT_WINDOW_MS = 60_000;
const MAX_SOCKET_EVENTS_PER_WINDOW = 180;

export function initSockets(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
    // Increase ping timeout for mobile clients
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 64 * 1024,
    perMessageDeflate: false,
    allowEIO3: false,
  });

  // ── JWT authentication middleware ────────────────────────────────────────────
  io.use(async (socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

    if (typeof token !== 'string' || !token) {
      return next(new Error('No token provided'));
    }

    try {
      const payload = verifyAccessToken(token);
      if (!(await isSessionActive(payload.sub, payload.sid))) {
        return next(new Error('Session is no longer active'));
      }

      socket.data.userId = payload.sub;
      socket.data.sessionId = payload.sid;
      socket.data.role = payload.role;
      socket.data.tokenExpiresAt = payload.exp ? payload.exp * 1000 : 0;
      next();
    } catch {
      next(new Error('Token invalid or expired'));
    }
  });

  // ── Connection handler ───────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const { userId, sessionId, role, tokenExpiresAt } = socket.data as {
      userId: string;
      sessionId: string;
      role: string;
      tokenExpiresAt: number;
    };
    logger.info('socket.connected', { userId, role, socketId: socket.id });

    let eventTimestamps: number[] = [];
    socket.use((_event, next) => {
      const cutoff = Date.now() - SOCKET_EVENT_WINDOW_MS;
      eventTimestamps = eventTimestamps.filter(timestamp => timestamp > cutoff);
      if (eventTimestamps.length >= MAX_SOCKET_EVENTS_PER_WINDOW) {
        next(new Error('Socket event rate limit exceeded'));
        return;
      }
      eventTimestamps.push(Date.now());

      void isSessionActive(userId, sessionId)
        .then((active) => {
          if (!active || Date.now() >= tokenExpiresAt) {
            socket.disconnect(true);
            next(new Error('Session is no longer active'));
            return;
          }
          next();
        })
        .catch(() => {
          socket.disconnect(true);
          next(new Error('Unable to validate session'));
        });
    });

    const expirationDelay = Math.max(0, tokenExpiresAt - Date.now());
    const expirationTimer = setTimeout(() => socket.disconnect(true), expirationDelay);

    // Register feature-specific handlers
    registerChatHandlers(io, socket);
    registerNotificationHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      clearTimeout(expirationTimer);
      logger.info('socket.disconnected', { userId, socketId: socket.id, reason });
    });

    socket.on('error', (err) => {
      logger.error('socket.error', { userId, socketId: socket.id, errorName: err.name });
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

export function disconnectUserSockets(userId: string) {
  ioInstance?.in(`user:${userId}`).disconnectSockets(true);
}

export async function closeSockets() {
  if (!ioInstance) return;
  await new Promise<void>(resolve => ioInstance!.close(() => resolve()));
  ioInstance = null;
}
