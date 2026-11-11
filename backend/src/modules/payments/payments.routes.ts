import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as controller from './payments.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import {
  createPaymentIntentSchema,
  confirmPaymentSchema,
  paymentHistorySchema,
  paymentRequestParamSchema,
  recordCashPaymentSchema,
} from './payments.schema';

const router = Router();

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many checkout attempts, please try again later' },
});

router.use(authenticate);

// Customer creates payment intent
router.post('/create-intent', checkoutLimiter, authorize('CUSTOMER'), validate(createPaymentIntentSchema), controller.createIntent);

router.post('/confirm', checkoutLimiter, authorize('CUSTOMER'), validate(confirmPaymentSchema), controller.confirm);

// Worker records cash payment
router.post('/cash', checkoutLimiter, authorize('WORKER'), validate(recordCashPaymentSchema), controller.recordCash);

// Shared: get payment for a specific request
router.get('/request/:requestId', validate(paymentRequestParamSchema), controller.getByRequest);

// Payment history
router.get('/history', authorize('CUSTOMER', 'WORKER'), validate(paymentHistorySchema), controller.getHistory);

export default router;
