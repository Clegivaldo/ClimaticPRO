import * as fc from 'fast-check';
import jwt from 'jsonwebtoken';
import { createVerificationCode } from '../verificationCode.service';
import { generateToken, verifyToken } from '../jwt.service';
import { 
  recordFailedAttempt, 
  getRateLimitStatus, 
  clearAllRateLimits 
} from '../../middleware/rateLimit.middleware';
import { prisma } from '../../utils/prisma';

// Mock prisma
jest.mock('../../utils/prisma', () => ({
  prisma: {
    verificationCode: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    }
  },
}));

describe('Authentication System - Property Tests', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    clearAllRateLimits();
    process.env['JWT_SECRET'] = 'test-secret';
    // Silence console.log to avoid noise and async log issues
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  // Feature: cross-platform-mobile-app, Property 1: Authentication Code Generation
  // Validates: Requirements 2.1
  it('should generate a 6-digit code for any valid identifier', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(fc.emailAddress(), fc.string({ minLength: 10, maxLength: 15 })),
        async (identifier) => {
          (prisma.verificationCode.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
          (prisma.verificationCode.create as jest.Mock).mockResolvedValue({});

          const result = await createVerificationCode(identifier);

          expect(result.success).toBe(true);
          expect(result.expiresAt).toBeInstanceOf(Date);
          
          // Verify that create was called with a 6-digit code
          const createCall = (prisma.verificationCode.create as jest.Mock).mock.calls[0][0];
          expect(createCall.data.code).toMatch(/^\d{6}$/);
          expect(createCall.data.identifier).toBe(identifier);
          
          jest.clearAllMocks();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: cross-platform-mobile-app, Property 2: JWT Token Validity
  // Validates: Requirements 2.2
  it('should generate a valid JWT token that can be verified', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          userId: fc.uuid(),
          email: fc.oneof(fc.constant(null), fc.emailAddress()),
          phone: fc.oneof(fc.constant(null), fc.string({ minLength: 10, maxLength: 15 }))
        }),
        (payload) => {
          const result = generateToken(payload);
          expect(result.token).toBeDefined();
          
          const verifyResult = verifyToken(result.token);
          expect(verifyResult.valid).toBe(true);
          expect(verifyResult.payload).toMatchObject({
            userId: payload.userId,
            email: payload.email,
            phone: payload.phone
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: cross-platform-mobile-app, Property 3: Expired Token Handling
  // Validates: Requirements 2.4
  it('should reject an expired token', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          userId: fc.uuid(),
          email: fc.oneof(fc.constant(null), fc.emailAddress()),
          phone: fc.oneof(fc.constant(null), fc.string({ minLength: 10, maxLength: 15 }))
        }),
        (payload) => {
          // Manually create an expired token
          const token = jwt.sign(
            { ...payload },
            process.env['JWT_SECRET'] as string,
            { expiresIn: '0s' } // Expire immediately
          );
          
          const verifyResult = verifyToken(token);
          expect(verifyResult.valid).toBe(false);
          expect(verifyResult.error).toBe('Token has expired');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: cross-platform-mobile-app, Property 4: Rate Limiting After Failed Attempts
  // Validates: Requirements 2.6
  it('should block an identifier after 3 failed attempts within 60 seconds', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(fc.emailAddress(), fc.string({ minLength: 10, maxLength: 15 })),
        (identifier) => {
          clearAllRateLimits();
          
          // 1st failed attempt
          recordFailedAttempt(identifier);
          let status = getRateLimitStatus(identifier);
          expect(status?.attempts).toBe(1);
          expect(status?.blockedUntil).toBeUndefined();
          
          // 2nd failed attempt
          recordFailedAttempt(identifier);
          status = getRateLimitStatus(identifier);
          expect(status?.attempts).toBe(2);
          expect(status?.blockedUntil).toBeUndefined();
          
          // 3rd failed attempt
          recordFailedAttempt(identifier);
          status = getRateLimitStatus(identifier);
          expect(status?.attempts).toBe(3);
          expect(status?.blockedUntil).toBeDefined();
          expect(status?.blockedUntil).toBeGreaterThan(Date.now());
        }
      ),
      { numRuns: 100 }
    );
  });
});
