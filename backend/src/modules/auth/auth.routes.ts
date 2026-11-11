import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as controller from './auth.controller';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/authenticate';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshSchema,
  verifyEmailSchema,
} from './auth.schema';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'AUTH_RATE_LIMITED', message: 'Too many login attempts. Try again later.' },
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'REGISTRATION_RATE_LIMITED', message: 'Too many registration attempts. Try again later.' },
});

const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'AUTH_RATE_LIMITED', message: 'Too many attempts. Try again later.' },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register',        registrationLimiter, validate(registerSchema),       controller.register);
router.post('/login',           loginLimiter,        validate(loginSchema),          controller.login);
router.post('/logout',          authenticate,                   controller.logout);
router.post('/refresh',         refreshLimiter,      validate(refreshSchema),        controller.refresh);
router.post('/verify-email',    recoveryLimiter,     validate(verifyEmailSchema),    controller.verifyEmail);
router.post('/forgot-password', recoveryLimiter,     validate(forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password',  recoveryLimiter,     validate(resetPasswordSchema),  controller.resetPassword);

export default router;
