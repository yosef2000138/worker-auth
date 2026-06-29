import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

interface AppError {
  status?: number;
  message?: string;
  code?: string;
  details?: unknown;
  stack?: string;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const status = err.status ?? 500;
  const message = err.message ?? 'Internal server error';

  if (env.NODE_ENV === 'development') {
    console.error(`[${req.method}] ${req.path} →`, err);
  }

  res.status(status).json({
    success: false,
    message,
    ...(err.code && {
      error: {
        code: err.code,
        message,
        ...(err.details !== undefined && { details: err.details }),
      },
    }),
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
