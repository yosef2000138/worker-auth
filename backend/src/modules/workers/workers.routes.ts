import { Router } from 'express';
import * as controller from './workers.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import {
  searchWorkersSchema,
  workerIdParamSchema,
  updateWorkerProfileSchema,
  setCategoriesSchema,
  setAvailabilitySchema,
  toggleAvailabilitySchema,
} from './workers.schema';

const router = Router();

// ── Public routes ─────────────────────────────────────────────────────────────
router.get('/', validate(searchWorkersSchema), controller.search);

// ── Worker-only routes ────────────────────────────────────────────────────────
// IMPORTANT: /me routes must stay before /:id, otherwise Express treats "me" as an id.
router.get('/me', authenticate, authorize('WORKER'), controller.getMyProfile);
router.put('/me', authenticate, authorize('WORKER'), validate(updateWorkerProfileSchema), controller.updateMyProfile);
router.put('/me/categories', authenticate, authorize('WORKER'), validate(setCategoriesSchema), controller.setCategories);
router.put('/me/availability', authenticate, authorize('WORKER'), validate(setAvailabilitySchema), controller.setAvailability);
router.patch('/me/availability-status', authenticate, authorize('WORKER'), validate(toggleAvailabilitySchema), controller.toggleAvailability);
router.get('/me/earnings', authenticate, authorize('WORKER'), controller.getEarnings);

// Dynamic id route must be last.
router.get('/:id', validate(workerIdParamSchema), controller.getOne);

export default router;
