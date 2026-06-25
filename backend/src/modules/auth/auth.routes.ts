import { Router } from 'express';
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

router.post('/register',        validate(registerSchema),       controller.register);
router.post('/login',           validate(loginSchema),          controller.login);
router.post('/logout',          authenticate,                   controller.logout);
router.post('/refresh',         validate(refreshSchema),        controller.refresh);
router.post('/verify-email',    validate(verifyEmailSchema),    controller.verifyEmail);
router.post('/forgot-password', validate(forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password',  validate(resetPasswordSchema),  controller.resetPassword);

export default router;
