import 'dotenv/config';
import http from 'http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import { connectRedis } from './config/redis';
import { disconnectRedis } from './config/redis';
import { db } from './config/database';
import { corsOrigin } from './config/cors';

import './config/cloudinary';

// ─── Routes ───────────────────────────────────────────────────────────────────
import authRoutes          from './modules/auth/auth.routes';
import requestsRoutes      from './modules/requests/requests.routes';
import usersRoutes         from './modules/users/users.routes';
import workersRoutes       from './modules/workers/workers.routes';
import reviewsRoutes       from './modules/reviews/reviews.routes';
import messagesRoutes      from './modules/messages/messages.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import paymentsRoutes      from './modules/payments/payments.routes';
import adminRoutes         from './modules/admin/admin.routes';
import categoriesRoutes    from './modules/categories/categories.routes';
import subscriptionsRoutes from './modules/subscriptions/subscriptions.routes';
import webhooksRoutes      from './modules/subscriptions/webhooks.routes';

import { errorHandler } from './middlewares/errorHandler';
import { requestContext } from './middlewares/requestContext';
import { closeSockets, initSockets }  from './sockets/index';
import { buildHealthResponse, buildReadinessResponse } from './modules/health/health.service';
import { logger } from './utils/logger';

const app = express();
app.disable('x-powered-by');

// Render terminates TLS and forwards the original client IP. Trust one proxy
// hop so rate limiting uses the phone/browser IP instead of Render's proxy.
app.set('trust proxy', 1);
app.use(requestContext);

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);

// ─── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buffer) => {
    if (req.url?.startsWith('/api/v1/webhooks/revenuecat')) {
      (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
    }
  },
}));
app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 100 }));

// ─── Rate limiting ───────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' },
});

app.use(globalLimiter);

app.use('/api/v1', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/v1/auth',          authRoutes);
app.use('/api/v1/requests',      requestsRoutes);
app.use('/api/v1/users',         usersRoutes);
app.use('/api/v1/workers',       workersRoutes);
app.use('/api/v1/reviews',       reviewsRoutes);
app.use('/api/v1/messages',      messagesRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/payments',      paymentsRoutes);
app.use('/api/v1/categories',    categoriesRoutes);
app.use('/api/v1/subscriptions', subscriptionsRoutes);
app.use('/api/v1/webhooks',      webhooksRoutes);
app.use('/api/v1/admin',         adminRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_, res) => {
  res.json(buildHealthResponse());
});

app.get('/ready', async (_req, res) => {
  const readiness = await buildReadinessResponse();
  res.status(readiness.status === 'ready' ? 200 : 503).json(readiness);
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
export async function startApplication(port = env.PORT) {
  await connectRedis();

  const httpServer = http.createServer(app);
  initSockets(httpServer);

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, () => {
      httpServer.off('error', reject);
      resolve();
    });
  });

  const address = httpServer.address();
  const boundPort = typeof address === 'object' && address ? address.port : port;
  logger.info('server.started', { port: boundPort, environment: env.NODE_ENV });
  return { httpServer, port: boundPort };
}

export async function stopApplication(httpServer: http.Server) {
  await closeSockets();
  if (httpServer.listening) {
    await new Promise<void>((resolve, reject) => {
      httpServer.close(error => error ? reject(error) : resolve());
    });
  }
  await Promise.allSettled([disconnectRedis(), db.$disconnect()]);
  logger.info('server.stopped');
}

async function main() {
  const { httpServer } = await startApplication();
  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info('server.shutdown_requested', { signal });
    try {
      await stopApplication(httpServer);
      process.exit(0);
    } catch (error) {
      logger.error('server.shutdown_failed', { error });
      process.exit(1);
    }
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}

if (require.main === module) {
  main().catch((error) => {
    logger.error('server.start_failed', { error });
    process.exit(1);
  });
}

export default app;
