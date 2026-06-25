import { Router } from 'express';
import * as controller from './admin.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import {
  listUsersSchema,
  userIdParamSchema,
  listWorkersAdminSchema,
  workerIdParamSchema,
  listRequestsAdminSchema,
  analyticsSchema,
  categorySchema,
  categoryIdParamSchema,
  updateCategorySchema,
} from './admin.schema';

const router = Router();

// All admin routes require authentication + ADMIN role
router.use(authenticate, authorize('ADMIN'));

// ─── Dashboard & analytics ────────────────────────────────────────────────────
router.get('/dashboard', controller.getDashboard);
router.get('/analytics', validate(analyticsSchema), controller.getAnalytics);

// ─── Users ────────────────────────────────────────────────────────────────────
router.get('/users', validate(listUsersSchema), controller.listUsers);
router.get('/users/:id', validate(userIdParamSchema), controller.getUser);
router.patch('/users/:id/suspend', validate(userIdParamSchema), controller.suspendUser);
router.patch('/users/:id/reinstate', validate(userIdParamSchema), controller.reinstateUser);

// ─── Workers ──────────────────────────────────────────────────────────────────
router.get('/workers', validate(listWorkersAdminSchema), controller.listWorkers);
router.patch('/workers/:id/approve', validate(workerIdParamSchema), controller.approveWorker);
router.patch('/workers/:id/revoke', validate(workerIdParamSchema), controller.revokeWorker);

// ─── Requests ─────────────────────────────────────────────────────────────────
router.get('/requests', validate(listRequestsAdminSchema), controller.listRequests);
router.patch('/requests/:id/cancel', validate(userIdParamSchema), controller.cancelRequest);

// ─── Categories ───────────────────────────────────────────────────────────────
router.get('/categories', controller.listCategories);
router.post('/categories', validate(categorySchema), controller.createCategory);
router.put('/categories/:id', validate(updateCategorySchema), controller.updateCategory);
router.delete('/categories/:id', validate(categoryIdParamSchema), controller.deleteCategory);

export default router;
