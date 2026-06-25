import { Router } from 'express';
import * as controller from './users.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import {
  updateProfileSchema,
  changePasswordSchema,
  toggleFavoriteSchema,
} from './users.schema';

const router = Router();

router.use(authenticate);

// Profile
router.get('/profile', controller.getProfile);
router.put('/profile', validate(updateProfileSchema), controller.updateProfile);
router.put('/change-password', validate(changePasswordSchema), controller.changePassword);

// Request history (all roles)
router.get('/history', controller.getHistory);

// Favorites (customers only)
router.get('/favorites', authorize('CUSTOMER'), controller.getFavorites);
router.post('/favorites/:workerId', authorize('CUSTOMER'), validate(toggleFavoriteSchema), controller.addFavorite);
router.delete('/favorites/:workerId', authorize('CUSTOMER'), validate(toggleFavoriteSchema), controller.removeFavorite);

export default router;
