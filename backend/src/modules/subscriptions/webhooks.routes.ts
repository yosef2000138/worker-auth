import { Router } from 'express';
import * as controller from './subscriptions.controller';

const router = Router();

router.post('/revenuecat', controller.revenueCatWebhook);

export default router;
