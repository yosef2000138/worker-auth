import rateLimit from 'express-rate-limit';

export const messageWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => req.user?.sub ?? 'unauthenticated',
  message: {
    success: false,
    code: 'MESSAGE_RATE_LIMITED',
    message: 'Too many messages. Please wait a moment.',
  },
});
