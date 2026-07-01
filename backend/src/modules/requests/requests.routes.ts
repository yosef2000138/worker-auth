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
  requestIdParamSchema,
  cancelSchema,
  createRequestReviewSchema,
  createOfferSchema,
  offerParamSchema,
  listOfferMessagesSchema,
  sendOfferMessageSchema,
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
  '/:requestId/offers',
  validate(requestIdParamSchema),
  controller.listOffers,
);

router.post(
  '/:requestId/offers',
  authorize('WORKER'),
  validate(createOfferSchema),
  controller.createOffer,
);

router.post(
  '/:requestId/offers/:offerId/confirm',
  authorize('CUSTOMER'),
  validate(offerParamSchema),
  controller.confirmOffer,
);

router.post(
  '/:requestId/offers/:offerId/withdraw',
  authorize('WORKER'),
  validate(offerParamSchema),
  controller.withdrawOffer,
);

router.get(
  '/:requestId/offers/:offerId/messages',
  validate(listOfferMessagesSchema),
  controller.listOfferMessages,
);

router.post(
  '/:requestId/offers/:offerId/messages',
  validate(sendOfferMessageSchema),
  controller.sendOfferMessage,
);

router.get(
  '/:id/rating-eligibility',
  authorize('CUSTOMER'),
  validate(idParamSchema),
  controller.ratingEligibility,
);

router.get(
  '/:id/review',
  authorize('CUSTOMER'),
  validate(idParamSchema),
  controller.getReview,
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
