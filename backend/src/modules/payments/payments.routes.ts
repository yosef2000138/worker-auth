import { Router } from 'express';
import * as controller from './payments.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import {
  createPaymentIntentSchema,
  confirmPaymentSchema,
  paymentIdParamSchema,
} from './payments.schema';

const router = Router();

router.use(authenticate);

// Customer creates payment intent
router.post('/create-intent', authorize('CUSTOMER'), validate(createPaymentIntentSchema), controller.createIntent);

// Stripe webhook / manual confirm (no role restriction — webhook is server-to-server)
router.post('/confirm', validate(confirmPaymentSchema), controller.confirm);

// Worker records cash payment
router.post('/cash', authorize('WORKER'), controller.recordCash);

// Shared: get payment for a specific request
router.get('/request/:requestId', controller.getByRequest);

// Payment history
router.get('/history', controller.getHistory);

export default router;
