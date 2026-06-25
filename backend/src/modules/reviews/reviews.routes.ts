import { Router } from 'express';
import * as controller from './reviews.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import {
  createReviewSchema,
  listWorkerReviewsSchema,
  reviewIdSchema,
} from './reviews.schema';

const router = Router();

// Public
router.get('/worker/:workerId', validate(listWorkerReviewsSchema), controller.getWorkerReviews);
router.get('/:id', validate(reviewIdSchema), controller.getReview);

// Customers only
router.post(
  '/',
  authenticate,
  authorize('CUSTOMER'),
  validate(createReviewSchema),
  controller.createReview,
);

export default router;
