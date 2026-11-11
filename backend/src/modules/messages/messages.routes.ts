import { Router } from 'express';
import * as controller from './messages.controller';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import { messageWriteLimiter } from '../../middlewares/rateLimiters';
import {
  listMessagesSchema,
  sendMessageSchema,
  requestIdParamSchema,
} from './messages.schema';

const router = Router();

router.use(authenticate);

// Unread count (before :requestId routes to avoid conflict)
router.get('/unread-count', controller.getUnreadCount);

// Per-request conversation
router.get('/:requestId', validate(listMessagesSchema), controller.listMessages);
router.post('/:requestId', messageWriteLimiter, validate(sendMessageSchema), controller.sendMessage);
router.patch('/:requestId/read', validate(requestIdParamSchema), controller.markRead);

export default router;
