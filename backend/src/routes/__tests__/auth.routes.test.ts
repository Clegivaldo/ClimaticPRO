import request from 'supertest';
import express, { Application } from 'express';
import authRoutes from '../auth.routes';
import { prisma } from '../../utils/prisma';
import { clearAllRateLimits, stopCleanup } from '../../middleware/rateLimit.middleware';

// Mock the prisma client
jest.mock('../../utils/prisma', () => ({
  prisma: {
    verificationCode: {
      deleteMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    }
  }
}));

describe('Auth Routes', () => {
  let app: Application;

  beforeAll(() => {
    // Set up test environment
    process.env['JWT_SECRET'] = 'test-secret-key';
    process.env['JWT_EXPIRES_IN'] = '1h';

    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/v1/auth', authRoutes);
  });

  afterAll(() => {
    // Stop cleanup interval to allow Jest to exit
    stopCleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    clearAllRateLimits(); // Clear rate limits before each test
  });

  describe('POST /api/v1/auth/send-code', () => {
    it('should send verification code for valid email', async () => {
      (prisma.verificationCode.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.verificationCode.create as jest.Mock).mockResolvedValue({
        id: 'test-id',
        identifier: 'test@example.com',
        code: '123456',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
        createdAt: new Date()
      });

      const response = await request(app)
        .post('/api/v1/auth/send-code')
        .send({ identifier: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(200);
      expect(response.body.message).toContain('sent successfully');
      expect(response.body.data).toHaveProperty('expiresAt');
    });

    it('should send verification code for valid phone', async () => {
      (prisma.verificationCode.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.verificationCode.create as jest.Mock).mockResolvedValue({
        id: 'test-id',
        identifier: '+1234567890',
        code: '123456',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
        createdAt: new Date()
      });

      const response = await request(app)
        .post('/api/v1/auth/send-code')
        .send({ identifier: '+1234567890' });

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(200);
    });

    it('should reject invalid identifier', async () => {
      const response = await request(app)
        .post('/api/v1/auth/send-code')
        .send({ identifier: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(400);
      expect(response.body.message).toBe('Validation error');
    });

    it('should reject missing identifier', async () => {
      const response = await request(app)
        .post('/api/v1/auth/send-code')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(400);
    });
  });

  describe('POST /api/v1/auth/verify-code', () => {
    it('should verify code and return JWT token', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date()
      };

      (prisma.verificationCode.findFirst as jest.Mock).mockResolvedValue({
        id: 'code-id',
        identifier: 'test@example.com',
        code: '123456',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
        createdAt: new Date()
      });

      (prisma.verificationCode.update as jest.Mock).mockResolvedValue({});
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.verificationCode.delete as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/api/v1/auth/verify-code')
        .send({
          identifier: 'test@example.com',
          code: '123456'
        });

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(200);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('userId');
      expect(response.body.data).toHaveProperty('expiresIn');
      expect(typeof response.body.data.token).toBe('string');
    });

    it('should reject invalid code', async () => {
      (prisma.verificationCode.findFirst as jest.Mock).mockResolvedValue({
        id: 'code-id',
        identifier: 'test@example.com',
        code: '123456',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
        createdAt: new Date()
      });

      (prisma.verificationCode.update as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/api/v1/auth/verify-code')
        .send({
          identifier: 'test@example.com',
          code: '999999'
        });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe(401);
    });

    it('should reject expired code', async () => {
      (prisma.verificationCode.findFirst as jest.Mock).mockResolvedValue({
        id: 'code-id',
        identifier: 'test@example.com',
        code: '123456',
        expiresAt: new Date(Date.now() - 1000), // Expired
        attempts: 0,
        createdAt: new Date()
      });

      (prisma.verificationCode.delete as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/api/v1/auth/verify-code')
        .send({
          identifier: 'test@example.com',
          code: '123456'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('expired');
    });

    it('should reject invalid code format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify-code')
        .send({
          identifier: 'test@example.com',
          code: '12345' // Only 5 digits
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should block verify-code after 3 failed attempts', async () => {
      const identifier = 'ratelimit@example.com';

      (prisma.verificationCode.findFirst as jest.Mock).mockResolvedValue({
        id: 'code-id',
        identifier,
        code: '123456',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
        createdAt: new Date()
      });

      (prisma.verificationCode.update as jest.Mock).mockResolvedValue({});

      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/v1/auth/verify-code')
          .send({
            identifier,
            code: '999999' // Wrong code
          });

        expect(response.status).toBe(401);
      }

      // Fourth attempt should be rate limited
      const response = await request(app)
        .post('/api/v1/auth/verify-code')
        .send({
          identifier,
          code: '123456'
        });

      expect(response.status).toBe(429);
      expect(response.body.code).toBe(429);
      expect(response.body.message).toContain('Too many failed attempts');
      expect(response.body.error).toHaveProperty('retryAfter');
    });

    it('should block send-code after 3 failed verify attempts', async () => {
      const identifier = 'ratelimit2@example.com';

      (prisma.verificationCode.findFirst as jest.Mock).mockResolvedValue({
        id: 'code-id',
        identifier,
        code: '123456',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
        createdAt: new Date()
      });

      (prisma.verificationCode.update as jest.Mock).mockResolvedValue({});

      // Make 3 failed verify attempts
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/v1/auth/verify-code')
          .send({
            identifier,
            code: '999999'
          });
      }

      // Try to send new code - should be blocked
      const response = await request(app)
        .post('/api/v1/auth/send-code')
        .send({ identifier });

      expect(response.status).toBe(429);
      expect(response.body.message).toContain('Too many failed attempts');
    });

    it('should clear rate limit after successful verification', async () => {
      const identifier = 'success@example.com';
      const mockUser = {
        id: 'user-123',
        email: identifier,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date()
      };

      (prisma.verificationCode.findFirst as jest.Mock).mockResolvedValue({
        id: 'code-id',
        identifier,
        code: '123456',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
        createdAt: new Date()
      });

      (prisma.verificationCode.update as jest.Mock).mockResolvedValue({});

      // Make 2 failed attempts
      for (let i = 0; i < 2; i++) {
        await request(app)
          .post('/api/v1/auth/verify-code')
          .send({
            identifier,
            code: '999999'
          });
      }

      // Successful verification
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.verificationCode.delete as jest.Mock).mockResolvedValue({});

      const successResponse = await request(app)
        .post('/api/v1/auth/verify-code')
        .send({
          identifier,
          code: '123456'
        });

      expect(successResponse.status).toBe(200);

      // Should be able to request new code without rate limit
      (prisma.verificationCode.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.verificationCode.create as jest.Mock).mockResolvedValue({
        id: 'new-code-id',
        identifier,
        code: '654321',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
        createdAt: new Date()
      });

      const sendCodeResponse = await request(app)
        .post('/api/v1/auth/send-code')
        .send({ identifier });

      expect(sendCodeResponse.status).toBe(200);
    });

    it('should track rate limits separately per identifier', async () => {
      const identifier1 = 'user1@example.com';
      const identifier2 = 'user2@example.com';

      (prisma.verificationCode.findFirst as jest.Mock).mockResolvedValue({
        id: 'code-id',
        code: '123456',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
        createdAt: new Date()
      });

      (prisma.verificationCode.update as jest.Mock).mockResolvedValue({});

      // Make 3 failed attempts for identifier1
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/v1/auth/verify-code')
          .send({
            identifier: identifier1,
            code: '999999'
          });
      }

      // identifier1 should be blocked
      const response1 = await request(app)
        .post('/api/v1/auth/verify-code')
        .send({
          identifier: identifier1,
          code: '123456'
        });

      expect(response1.status).toBe(429);

      // identifier2 should still be allowed
      const response2 = await request(app)
        .post('/api/v1/auth/verify-code')
        .send({
          identifier: identifier2,
          code: '999999'
        });

      expect(response2.status).toBe(401); // Wrong code, but not rate limited
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh a valid token', async () => {
      // First, generate a valid token
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date()
      };

      (prisma.verificationCode.findFirst as jest.Mock).mockResolvedValue({
        id: 'code-id',
        identifier: 'test@example.com',
        code: '123456',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
        createdAt: new Date()
      });

      (prisma.verificationCode.update as jest.Mock).mockResolvedValue({});
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.verificationCode.delete as jest.Mock).mockResolvedValue({});

      const verifyResponse = await request(app)
        .post('/api/v1/auth/verify-code')
        .send({
          identifier: 'test@example.com',
          code: '123456'
        });

      const token = verifyResponse.body.data.token;

      // Now refresh the token
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${token}`);

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.code).toBe(200);
      expect(refreshResponse.body.data).toHaveProperty('token');
      expect(refreshResponse.body.data).toHaveProperty('expiresIn');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Authentication required');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      // First, generate a valid token
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date()
      };

      (prisma.verificationCode.findFirst as jest.Mock).mockResolvedValue({
        id: 'code-id',
        identifier: 'test@example.com',
        code: '123456',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
        createdAt: new Date()
      });

      (prisma.verificationCode.update as jest.Mock).mockResolvedValue({});
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.verificationCode.delete as jest.Mock).mockResolvedValue({});

      const verifyResponse = await request(app)
        .post('/api/v1/auth/verify-code')
        .send({
          identifier: 'test@example.com',
          code: '123456'
        });

      const token = verifyResponse.body.data.token;

      // Now logout
      const logoutResponse = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.message).toContain('Logged out successfully');
    });

    it('should reject logout without token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout');

      expect(response.status).toBe(401);
    });
  });
});
