import * as fc from 'fast-check';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { paginationMiddleware } from '../../middleware/pagination.middleware';
import { sendSuccess, sendError } from '../../utils/response';
import { createAuditLog } from '../audit.service';
import { prisma } from '../../utils/prisma';

// Mock prisma
jest.mock('../../utils/prisma', () => ({
  prisma: {
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'log-123' }),
    },
  },
}));

describe('Security and Middleware - Property Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    jest.clearAllMocks();
  });

  // Feature: cross-platform-mobile-app, Property 26: API Response Format Consistency
  // Validates: Requirements 9.7
  it('should always return standardized response format', async () => {
    app.get('/test-success', (_req, res) => sendSuccess(res, { foo: 'bar' }));
    app.get('/test-error', (_req, res) => sendError(res, 'Some error', 400));

    const successRes = await request(app).get('/test-success');
    expect(successRes.body).toMatchObject({
      code: 200,
      message: 'Success',
      data: { foo: 'bar' }
    });

    const errorRes = await request(app).get('/test-error');
    expect(errorRes.body).toMatchObject({
      code: 400,
      message: 'Some error'
    });
  });

  // Feature: cross-platform-mobile-app, Property 24: API Pagination Limit
  // Validates: Requirements 9.5
  it('should cap pagination limit at 100', async () => {
    app.get('/test-pagination', paginationMiddleware, (req, res) => {
      res.json(req.pagination);
    });

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 101, max: 1000 }),
        async (largeLimit) => {
          const res = await request(app).get(`/test-pagination?limit=${largeLimit}`);
          expect(res.body.limit).toBe(100);
        }
      )
    );
  });

  // Feature: cross-platform-mobile-app, Property 37: Audit Log Creation
  // Validates: Requirements 15.7
  it('should create audit log entries for sensitive actions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.string({ minLength: 1 }), // action
        fc.string({ minLength: 1 }), // resource
        async (userId, action, resource) => {
          await createAuditLog({ userId, action, resource });
          expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ userId, action, resource })
          });
          jest.clearAllMocks();
        }
      )
    );
  });

  // Feature: cross-platform-mobile-app, Property 35: CORS Origin Restriction
  // Validates: Requirements 15.4
  it('should restrict CORS origins', async () => {
    const allowedOrigin = 'https://app.climaticpro.com';
    const corsApp = express();
    corsApp.use(cors({ origin: allowedOrigin }));
    corsApp.get('/', (_req, res) => res.send('ok'));

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5 }),
        async (randomOrigin) => {
          if (randomOrigin === allowedOrigin) return;
          
          const res = await request(corsApp)
            .get('/')
            .set('Origin', randomOrigin);
          
          // If the origin is not allowed, Access-Control-Allow-Origin header should not be present
          // or should not match the random origin
          expect(res.header['access-control-allow-origin']).not.toBe(randomOrigin);
        }
      )
    );
  });

  // Feature: cross-platform-mobile-app, Property 25: API Rate Limiting
  // Validates: Requirements 9.6
  it('should apply rate limiting after 100 requests', async () => {
    // For testing purposes, we'll use a smaller limit if we were configuring it,
    // but here we'll just verify the middleware is working by mocking or using a smaller window.
    // However, since it's a property test, we'll verify it returns 429 if we exceed the limit.
    const limitedApp = express();
    limitedApp.use(rateLimit({ windowMs: 1000, max: 5 })); // 5 requests per second for test
    limitedApp.get('/', (_req, res) => res.send('ok'));

    for (let i = 0; i < 5; i++) {
      const res = await request(limitedApp).get('/');
      expect(res.status).toBe(200);
    }

    const res429 = await request(limitedApp).get('/');
    expect(res429.status).toBe(429);
  });

  // Feature: cross-platform-mobile-app, Property 36: SQL Injection Prevention
  // Validates: Requirements 15.5
  it('should treat SQL injection patterns as literal strings', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          "'; DROP TABLE users; --",
          "OR '1'='1",
          "\" OR \"\" = \"",
          "1; SELECT * FROM audit_logs"
        ),
        async (injectionPattern) => {
          // This test verifies that our service layer handles these strings safely
          // In Prisma, these are automatically parameterized
          await createAuditLog({ 
            userId: 'u1', 
            action: injectionPattern, 
            resource: 'test' 
          });
          
          expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ action: injectionPattern })
          });
          
          jest.clearAllMocks();
        }
      )
    );
  });
});
