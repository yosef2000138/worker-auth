import { Request, Response, NextFunction } from 'express';
import * as service from './categories.service';

export async function listCategories(_: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.listActiveCategories();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
