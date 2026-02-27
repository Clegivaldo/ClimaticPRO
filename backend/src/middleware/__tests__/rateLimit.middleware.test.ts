import { Request, Response, NextFunction } from 'express';
import {
  checkRateLimit,
  recordFailedAttempt,
  clearRateLimit,
  getRateLimitStatus,
  clearAllRateLimits,
  stopCleanup
} from '../rateLimit.middleware';

describe('Rate Limit Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  afterAll(() => {
    // Stop cleanup interval to allow Jest to exit
    stopCleanup();
  });

  beforeEach(() => {
    // Clear all rate limits before each test
    clearAllRateLimits();

    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      body: {}
    };

    mockRes = {
      status: statusMock,
      json: jsonMock
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow request when no identifier is provided', () => {
      mockReq.body = {};

      checkRateLimit(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should allow first request with valid identifier', () => {
      mockReq.body = { identifier: 'test@example.com' };

      checkRateLimit(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should allow requests before reaching rate limit', () => {
      const identifier = 'test@example.com';
      mockReq.body = { identifier };

      // First attempt
      checkRateLimit(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Record failed attempt
      recordFailedAttempt(identifier);

      // Second attempt
      checkRateLimit(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(2);

      // Record second failed attempt
      recordFailedAttempt(identifier);

      // Third attempt (still allowed, but will trigger block after)
      checkRateLimit(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(3);
    });

    it('should block requests after 3 failed attempts', () => {
      const identifier = 'test@example.com';
      mockReq.body = { identifier };

      // Simulate 3 failed attempts
      for (let i = 0; i < 3; i++) {
        checkRateLimit(mockReq as Request, mockRes as Response, mockNext);
        recordFailedAttempt(identifier);
      }

      // Fourth attempt should be blocked
      checkRateLimit(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(429);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 429,
          message: expect.stringContaining('Too many failed attempts'),
          error: expect.objectContaining({
            details: expect.stringContaining('Rate limit exceeded'),
            retryAfter: expect.any(Number)
          })
        })
      );
    });

    it('should include retry-after time in blocked response', () => {
      const identifier = 'test@example.com';
      mockReq.body = { identifier };

      // Simulate 3 failed attempts
      for (let i = 0; i < 3; i++) {
        recordFailedAttempt(identifier);
      }

      // Next attempt should be blocked
      checkRateLimit(mockReq as Request, mockRes as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            retryAfter: expect.any(Number)
          })
        })
      );

      const callArgs = jsonMock.mock.calls[0][0];
      expect(callArgs.error.retryAfter).toBeGreaterThan(0);
      expect(callArgs.error.retryAfter).toBeLessThanOrEqual(60);
    });

    it('should allow requests after block period expires', async () => {
      const identifier = 'test@example.com';
      mockReq.body = { identifier };

      // Simulate 3 failed attempts
      for (let i = 0; i < 3; i++) {
        recordFailedAttempt(identifier);
      }

      // Verify blocked
      checkRateLimit(mockReq as Request, mockRes as Response, mockNext);
      expect(statusMock).toHaveBeenCalledWith(429);

      // Wait for block to expire (simulate by manipulating the entry)
      // In a real test, you'd wait 60 seconds or use fake timers
      const status = getRateLimitStatus(identifier);
      if (status) {
        status.blockedUntil = Date.now() - 1000; // Set to past
      }

      // Reset mocks
      jest.clearAllMocks();

      // Should now be allowed
      checkRateLimit(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('recordFailedAttempt', () => {
    it('should record first failed attempt', () => {
      const identifier = 'test@example.com';

      recordFailedAttempt(identifier);

      const status = getRateLimitStatus(identifier);
      expect(status).not.toBeNull();
      expect(status?.attempts).toBe(1);
      expect(status?.blockedUntil).toBeUndefined();
    });

    it('should increment attempts on subsequent failures', () => {
      const identifier = 'test@example.com';

      recordFailedAttempt(identifier);
      recordFailedAttempt(identifier);

      const status = getRateLimitStatus(identifier);
      expect(status?.attempts).toBe(2);
    });

    it('should block after 3 failed attempts', () => {
      const identifier = 'test@example.com';

      recordFailedAttempt(identifier);
      recordFailedAttempt(identifier);
      recordFailedAttempt(identifier);

      const status = getRateLimitStatus(identifier);
      expect(status?.attempts).toBe(3);
      expect(status?.blockedUntil).toBeDefined();
      expect(status?.blockedUntil).toBeGreaterThan(Date.now());
    });

    it('should reset counter after time window expires', () => {
      const identifier = 'test@example.com';

      // First attempt
      recordFailedAttempt(identifier);
      let status = getRateLimitStatus(identifier);
      expect(status?.attempts).toBe(1);

      // Simulate time window expiration
      if (status) {
        status.firstAttemptAt = Date.now() - 61 * 1000; // 61 seconds ago
      }

      // New attempt should reset counter
      recordFailedAttempt(identifier);
      status = getRateLimitStatus(identifier);
      expect(status?.attempts).toBe(1);
    });
  });

  describe('clearRateLimit', () => {
    it('should clear rate limit for identifier', () => {
      const identifier = 'test@example.com';

      recordFailedAttempt(identifier);
      expect(getRateLimitStatus(identifier)).not.toBeNull();

      clearRateLimit(identifier);
      expect(getRateLimitStatus(identifier)).toBeNull();
    });

    it('should allow requests after clearing rate limit', () => {
      const identifier = 'test@example.com';
      mockReq.body = { identifier };

      // Block the identifier
      for (let i = 0; i < 3; i++) {
        recordFailedAttempt(identifier);
      }

      // Verify blocked
      checkRateLimit(mockReq as Request, mockRes as Response, mockNext);
      expect(statusMock).toHaveBeenCalledWith(429);

      // Clear rate limit
      clearRateLimit(identifier);

      // Reset mocks
      jest.clearAllMocks();

      // Should now be allowed
      checkRateLimit(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return null for non-existent identifier', () => {
      const status = getRateLimitStatus('nonexistent@example.com');
      expect(status).toBeNull();
    });

    it('should return status for existing identifier', () => {
      const identifier = 'test@example.com';

      recordFailedAttempt(identifier);

      const status = getRateLimitStatus(identifier);
      expect(status).not.toBeNull();
      expect(status?.attempts).toBe(1);
      expect(status?.firstAttemptAt).toBeDefined();
    });
  });

  describe('clearAllRateLimits', () => {
    it('should clear all rate limits', () => {
      recordFailedAttempt('user1@example.com');
      recordFailedAttempt('user2@example.com');
      recordFailedAttempt('user3@example.com');

      expect(getRateLimitStatus('user1@example.com')).not.toBeNull();
      expect(getRateLimitStatus('user2@example.com')).not.toBeNull();
      expect(getRateLimitStatus('user3@example.com')).not.toBeNull();

      clearAllRateLimits();

      expect(getRateLimitStatus('user1@example.com')).toBeNull();
      expect(getRateLimitStatus('user2@example.com')).toBeNull();
      expect(getRateLimitStatus('user3@example.com')).toBeNull();
    });
  });
});
