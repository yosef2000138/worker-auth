import { Router } from 'express';
import * as controller from './requests.controller';
// Re-use the auth middleware already in this project
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { upload } from '../../middlewares/upload';
import {
  createRequestSchema,
  updateStatusSchema,
  listRequestsSchema,
  idParamSchema,
  cancelSchema,
  createRequestReviewSchema,
} from './requests.schema';

const router = Router();

// All requests routes require a valid JWT
router.use(authenticate);

// Customers create requests; up to 5 images via multipart/form-data
router.post(
  '/',
  authorize('CUSTOMER'),
  upload.array('images', 5),
  validate(createRequestSchema),
  controller.create,
);

// Both roles can list (service returns role-appropriate results)
router.get(
  '/',
  validate(listRequestsSchema),
  controller.list,
);

router.get(
  '/:id/rating-eligibility',
  authorize('CUSTOMER'),
  validate(idParamSchema),
  controller.ratingEligibility,
);

router.post(
  '/:id/reviews',
  authorize('CUSTOMER'),
  validate(createRequestReviewSchema),
  controller.createReview,
);

// Single request — role-aware visibility in service layer
router.get(
  '/:id',
  validate(idParamSchema),
  controller.getOne,
);

// Workers advance status; customers can only cancel via this route too
router.put(
  '/:id/status',
  validate(updateStatusSchema),
  controller.updateStatus,
);

// Explicit cancel endpoint (customer or worker)
router.post(
  '/:id/cancel',
  validate(cancelSchema),
  controller.cancel,
);

export default router;
