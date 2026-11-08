import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as controller from './subscriptions.controller';

const router = Router();

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'WEBHOOK_RATE_LIMITED', message: 'Too many webhook requests' },
});

router.post('/revenuecat', webhookLimiter, controller.revenueCatWebhook);

export default router;
