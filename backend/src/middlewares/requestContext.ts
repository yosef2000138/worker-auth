import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

function requestIdFromHeader(value: unknown) {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value) ? value : null;
}
export function requestContext(req: Request, res: Response, next: NextFunction) {
  const requestId = requestIdFromHeader(req.header('x-request-id')) ?? crypto.randomUUID();
  const startedAt = process.hrtime.bigint();

  res.locals.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logger.info('http.request.completed', {
      requestId,
      method: req.method,
      path: req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      userId: req.user?.sub,
      role: req.user?.role,
    });
  });

  next();
}
