import rateLimit from 'express-rate-limit';
import { Request } from 'express';

/**
 * Global rate limiting middleware
 * Requirement 9.6: 100 requests per 60 seconds per user/IP
 */
export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: 429,
    message: 'Too many requests, please try again later.',
  },
  keyGenerator: (req: Request) => {
    return req.user?.userId || req.ip || 'anonymous';
  },
  skip: (req: Request) => {
    return req.path === '/health';
  }
});

/**
 * Authentication rate limiting
 * Requirement 2.6: 3 attempts per 60 seconds
 */
const authAttempts = new Map<string, { attempts: number, blockedUntil?: number }>();

export function recordFailedAttempt(identifier: string) {
  const now = Date.now();
  const current = authAttempts.get(identifier) || { attempts: 0 };
  
  current.attempts += 1;
  if (current.attempts >= 3) {
    current.blockedUntil = now + (60 * 1000); // Block for 60 seconds
  }
  
  authAttempts.set(identifier, current);
}

export function getRateLimitStatus(identifier: string) {
  const status = authAttempts.get(identifier);
  if (!status) return null;
  
  const now = Date.now();
  if (status.blockedUntil && now > status.blockedUntil) {
    authAttempts.delete(identifier);
    return null;
  }
  
  return status;
}

export function clearRateLimit(identifier: string) {
  authAttempts.delete(identifier);
}

export function clearAllRateLimits() {
  authAttempts.clear();
}

/**
 * Middleware to check authentication rate limit
 */
export const checkRateLimit = (req: any, res: any, next: any) => {
  const identifier = req.body.identifier;
  if (!identifier) return next();
  
  const status = getRateLimitStatus(identifier);
  if (status && status.blockedUntil && status.blockedUntil > Date.now()) {
    const remaining = Math.ceil((status.blockedUntil - Date.now()) / 1000);
    return res.status(429).json({
      code: 429,
      message: `Muitas tentativas. Tente novamente em ${remaining} segundos.`,
    });
  }
  
  next();
};
