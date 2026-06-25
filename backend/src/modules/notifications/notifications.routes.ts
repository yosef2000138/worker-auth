import { Router } from 'express';
import * as controller from './notifications.controller';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import { listNotificationsSchema, notifIdParamSchema } from './notifications.schema';

const router = Router();

router.use(authenticate);

router.get('/', validate(listNotificationsSchema), controller.list);

// Specific routes before wildcard
router.patch('/read-all', controller.markAllRead);
router.patch('/:id/read', validate(notifIdParamSchema), controller.markOneRead);
router.delete('/:id', validate(notifIdParamSchema), controller.deleteOne);

export default router;
