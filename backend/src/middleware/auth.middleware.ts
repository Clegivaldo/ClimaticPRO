import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../services/jwt.service';

/**
 * Extend Express Request type to include user information
 */
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Authentication middleware to verify JWT tokens
 * Extracts token from Authorization header and validates it
 * Attaches user information to request object if valid
 */
export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;
    
    if (!token) {
      res.status(401).json({
        code: 401,
        message: 'Authentication required',
        error: {
          details: 'No token provided'
        }
      });
      return;
    }
    
    // Verify token
    const verifyResult = verifyToken(token);
    
    if (!verifyResult.valid) {
      res.status(401).json({
        code: 401,
        message: 'Authentication failed',
        error: {
          details: verifyResult.error || 'Invalid token'
        }
      });
      return;
    }
    
    // Attach user information to request
    req.user = verifyResult.payload;
    
    next();
  } catch (error) {
    console.error('Error in authentication middleware:', error);
    res.status(500).json({
      code: 500,
      message: 'Internal server error'
    });
  }
}

/**
 * Optional authentication middleware
 * Attaches user information if token is present and valid
 * Does not reject requests without tokens
 */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;
    
    if (token) {
      const verifyResult = verifyToken(token);
      if (verifyResult.valid && verifyResult.payload) {
        req.user = verifyResult.payload;
      }
    }
    
    next();
  } catch (error) {
    console.error('Error in optional auth middleware:', error);
    next();
  }
}
