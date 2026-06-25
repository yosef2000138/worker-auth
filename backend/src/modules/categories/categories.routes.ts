import { Router } from 'express';
import * as controller from './categories.controller';

const router = Router();

router.get('/', controller.listCategories);

export default router;
