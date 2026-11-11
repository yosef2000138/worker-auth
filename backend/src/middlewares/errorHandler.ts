import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { env } from '../config/env';
import { logger } from '../utils/logger';

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
  const isUploadError = err instanceof multer.MulterError;
  const status = isUploadError
    ? ['LIMIT_FILE_SIZE', 'LIMIT_FILE_COUNT', 'LIMIT_PART_COUNT'].includes(err.code) ? 413 : 422
    : err.status ?? 500;
  const isServerError = status >= 500;
  const message = isServerError
    ? 'Internal server error'
    : isUploadError
      ? 'The uploaded files are invalid or exceed the allowed limit.'
      : err.message ?? 'Request failed';
  const code = isUploadError ? 'UPLOAD_REJECTED' : err.code;

  if (isServerError) {
    logger.error('http.request.failed', {
      requestId: res.locals.requestId,
      method: req.method,
      path: req.path,
      status,
      code: err.code ?? 'INTERNAL_SERVER_ERROR',
      environment: env.NODE_ENV,
      errorName: err instanceof Error ? err.name : 'AppError',
    });
  }

  res.status(status).json({
    success: false,
    requestId: res.locals.requestId,
    message,
    ...(code && {
      error: {
        code,
        message,
        ...(!isServerError && err.details !== undefined && { details: err.details }),
      },
    }),
  });
}
