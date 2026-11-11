import { Request, Response, NextFunction } from 'express';
import { isSessionActive } from '../config/redis';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';

// Augment Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'No token provided' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    if (!(await isSessionActive(payload.sub, payload.sid))) {
      res.status(401).json({
        success: false,
        code: 'SESSION_REVOKED',
        message: 'Session is no longer active',
      });
      return;
    }

    req.user = payload;
    next();
  } catch {
    res.status(401).json({
      success: false,
      code: 'TOKEN_INVALID_OR_EXPIRED',
      message: 'Token invalid or expired',
    });
  }
}
