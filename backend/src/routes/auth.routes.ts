import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  createVerificationCode,
  verifyCode
} from '../services/verificationCode.service';
import {
  generateToken,
  refreshToken as refreshJWTToken
} from '../services/jwt.service';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  checkRateLimit,
  recordFailedAttempt,
  clearRateLimit
} from '../middleware/rateLimit.middleware';

const router = Router();

// Validation schemas
const sendCodeSchema = z.object({
  identifier: z.string().min(1, 'Identifier is required')
    .refine(
      (val) => {
        // Check if it's a valid email or phone number
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^\+?[1-9]\d{1,14}$/; // E.164 format
        return emailRegex.test(val) || phoneRegex.test(val);
      },
      { message: 'Must be a valid email or phone number' }
    )
});

const verifyCodeSchema = z.object({
  identifier: z.string().min(1, 'Identifier is required'),
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d{6}$/, 'Code must contain only digits')
});

/**
 * POST /api/v1/auth/send-code
 * Send verification code to email or phone
 */
router.post('/send-code', checkRateLimit, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = sendCodeSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        code: 400,
        message: 'Validation error',
        error: {
          details: validation.error.errors[0]?.message || 'Invalid input'
        }
      });
    }
    
    const { identifier } = validation.data;
    
    // Create and send verification code
    const result = await createVerificationCode(identifier);
    
    if (!result.success) {
      return res.status(500).json({
        code: 500,
        message: result.message
      });
    }
    
    return res.status(200).json({
      code: 200,
      message: result.message,
      data: {
        expiresAt: result.expiresAt
      }
    });
  } catch (error) {
    console.error('Error in send-code endpoint:', error);
    return res.status(500).json({
      code: 500,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/v1/auth/verify-code
 * Verify code and return JWT token
 */
router.post('/verify-code', checkRateLimit, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = verifyCodeSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        code: 400,
        message: 'Validation error',
        error: {
          details: validation.error.errors[0]?.message || 'Invalid input'
        }
      });
    }
    
    const { identifier, code } = validation.data;
    
    // Verify code
    const result = await verifyCode(identifier, code);
    
    if (!result.success) {
      // Record failed attempt for rate limiting
      recordFailedAttempt(identifier);
      
      return res.status(401).json({
        code: 401,
        message: result.message
      });
    }
    
    // Clear rate limit on successful verification
    clearRateLimit(identifier);
    
    // Get user from database to include email/phone in token
    const { prisma } = await import('../utils/prisma');
    const user = await prisma.user.findUnique({
      where: { id: result.userId }
    });
    
    if (!user) {
      return res.status(500).json({
        code: 500,
        message: 'User not found after verification'
      });
    }
    
    // Generate JWT token
    const tokenResult = generateToken({
      userId: user.id,
      email: user.email,
      phone: user.phone
    });
    
    return res.status(200).json({
      code: 200,
      message: result.message,
      data: {
        userId: result.userId,
        token: tokenResult.token,
        expiresIn: tokenResult.expiresIn
      }
    });
  } catch (error) {
    console.error('Error in verify-code endpoint:', error);
    return res.status(500).json({
      code: 500,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/v1/auth/refresh
 * Refresh JWT token
 * Requires valid (non-expired) token in Authorization header
 */
router.post('/refresh', authenticateToken, async (req: Request, res: Response) => {
  try {
    // Extract current token from Authorization header
    const authHeader = req.headers['authorization'];
    const currentToken = authHeader?.substring(7); // Remove 'Bearer ' prefix
    
    if (!currentToken) {
      return res.status(401).json({
        code: 401,
        message: 'No token provided'
      });
    }
    
    // Refresh token
    const tokenResult = refreshJWTToken(currentToken);
    
    if (!tokenResult) {
      return res.status(401).json({
        code: 401,
        message: 'Failed to refresh token'
      });
    }
    
    return res.status(200).json({
      code: 200,
      message: 'Token refreshed successfully',
      data: {
        token: tokenResult.token,
        expiresIn: tokenResult.expiresIn
      }
    });
  } catch (error) {
    console.error('Error in refresh endpoint:', error);
    return res.status(500).json({
      code: 500,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/v1/auth/logout
 * Logout user (client-side token invalidation)
 * Requires valid token in Authorization header
 * 
 * Note: JWT tokens are stateless, so logout is handled client-side
 * by removing the token from storage. This endpoint exists for
 * consistency and future server-side token blacklisting if needed.
 */
router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  try {
    // In a stateless JWT system, logout is primarily client-side
    // The client should remove the token from storage
    
    // Optional: Log the logout event for audit purposes
    if (req.user) {
      console.log(`User ${req.user.userId} logged out at ${new Date().toISOString()}`);
    }
    
    // Optional: In the future, implement token blacklisting here
    // by storing the token in a blacklist table with its expiration time
    
    return res.status(200).json({
      code: 200,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Error in logout endpoint:', error);
    return res.status(500).json({
      code: 500,
      message: 'Internal server error'
    });
  }
});

export default router;
