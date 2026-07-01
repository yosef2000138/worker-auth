import { Router } from 'express';
import * as controller from './users.controller';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import {
  updateProfileSchema,
  changePasswordSchema,
} from './users.schema';

const router = Router();

router.use(authenticate);

// Profile
router.get('/profile', controller.getProfile);
router.put('/profile', validate(updateProfileSchema), controller.updateProfile);
router.put('/change-password', validate(changePasswordSchema), controller.changePassword);

// Request history (all roles)
router.get('/history', controller.getHistory);

export default router;
