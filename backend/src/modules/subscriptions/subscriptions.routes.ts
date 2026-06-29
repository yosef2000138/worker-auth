import { Router } from 'express';
import * as controller from './subscriptions.controller';
import { authenticate } from '../../middlewares/authenticate';

const router = Router();

router.get('/me', authenticate, controller.getMine);

export default router;
