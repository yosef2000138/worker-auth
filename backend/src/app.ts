import 'dotenv/config';
import http from 'http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import { connectRedis } from './config/redis';
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

import { errorHandler } from './middlewares/errorHandler';
import { initSockets }  from './sockets/index';

const app = express();

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);

// ─── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate limiting ───────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'development' ? 500 : 20,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
});

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
});

app.use(globalLimiter);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/v1/auth',          authLimiter, authRoutes);
app.use('/api/v1/requests',      requestsRoutes);
app.use('/api/v1/users',         usersRoutes);
app.use('/api/v1/workers',       workersRoutes);
app.use('/api/v1/reviews',       reviewsRoutes);
app.use('/api/v1/messages',      messagesRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/payments',      paymentsRoutes);
app.use('/api/v1/categories',    categoriesRoutes);
app.use('/api/v1/admin',         adminRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
async function main() {
  await connectRedis();

  // Wrap Express in a raw HTTP server so Socket.IO can share the same port
  const httpServer = http.createServer(app);
  initSockets(httpServer);

  httpServer.listen(env.PORT, () => {
    console.log(`🚀 Worker API running on port ${env.PORT}`);
    console.log(`🔌 Socket.IO listening on port ${env.PORT}`);
  });
}

main().catch(console.error);

export default app;
