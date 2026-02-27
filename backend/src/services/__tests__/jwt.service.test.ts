import {
  generateToken,
  verifyToken,
  refreshToken,
  decodeToken,
  TokenPayload
} from '../jwt.service';

describe('JWT Service', () => {
  // Set up test environment variables
  beforeAll(() => {
    process.env['JWT_SECRET'] = 'test-secret-key-for-jwt-testing';
    process.env['JWT_EXPIRES_IN'] = '1h';
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token with user claims', () => {
      const payload: TokenPayload = {
        userId: 'test-user-123',
        email: 'test@example.com',
        phone: null
      };

      const result = generateToken(payload);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('expiresIn');
      expect(typeof result.token).toBe('string');
      expect(result.token.split('.').length).toBe(3); // JWT has 3 parts
      expect(result.expiresIn).toBe('1h');
    });

    it('should generate different tokens for different users', () => {
      const payload1: TokenPayload = {
        userId: 'user-1',
        email: 'user1@example.com',
        phone: null
      };

      const payload2: TokenPayload = {
        userId: 'user-2',
        email: 'user2@example.com',
        phone: null
      };

      const token1 = generateToken(payload1);
      const token2 = generateToken(payload2);

      expect(token1.token).not.toBe(token2.token);
    });

    it('should include phone number in token when provided', () => {
      const payload: TokenPayload = {
        userId: 'test-user-456',
        email: null,
        phone: '+1234567890'
      };

      const result = generateToken(payload);
      const decoded = decodeToken(result.token);

      expect(decoded).not.toBeNull();
      expect(decoded?.['userId']).toBe('test-user-456');
      expect(decoded?.['phone']).toBe('+1234567890');
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token and return payload', () => {
      const payload: TokenPayload = {
        userId: 'test-user-789',
        email: 'verify@example.com',
        phone: null
      };

      const { token } = generateToken(payload);
      const result = verifyToken(token);

      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload?.userId).toBe('test-user-789');
      expect(result.payload?.email).toBe('verify@example.com');
      expect(result.error).toBeUndefined();
    });

    it('should reject an invalid token', () => {
      const invalidToken = 'invalid.token.here';
      const result = verifyToken(invalidToken);

      expect(result.valid).toBe(false);
      expect(result.payload).toBeUndefined();
      expect(result.error).toBeDefined();
    });

    it('should reject a token with wrong signature', () => {
      const payload: TokenPayload = {
        userId: 'test-user-999',
        email: 'tamper@example.com',
        phone: null
      };

      const { token } = generateToken(payload);
      // Tamper with the token by changing the last character
      const tamperedToken = token.slice(0, -1) + 'X';
      const result = verifyToken(tamperedToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject an expired token', () => {
      // Temporarily set expiration to 0 seconds
      process.env['JWT_EXPIRES_IN'] = '0s';

      const payload: TokenPayload = {
        userId: 'test-user-expired',
        email: 'expired@example.com',
        phone: null
      };

      const { token } = generateToken(payload);

      // Wait a bit to ensure token expires
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const result = verifyToken(token);

          expect(result.valid).toBe(false);
          expect(result.error).toContain('expired');

          // Reset expiration
          process.env['JWT_EXPIRES_IN'] = '1h';
          resolve();
        }, 100);
      });
    });
  });

  describe('refreshToken', () => {
    it('should generate a new token from a valid token', async () => {
      const payload: TokenPayload = {
        userId: 'test-user-refresh',
        email: 'refresh@example.com',
        phone: null
      };

      const { token: originalToken } = generateToken(payload);
      
      // Wait a bit to ensure different iat (issued at) timestamp
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const refreshResult = refreshToken(originalToken);

      expect(refreshResult).not.toBeNull();
      expect(refreshResult?.token).toBeDefined();
      expect(refreshResult?.token).not.toBe(originalToken);

      // Verify the new token contains the same user data
      const verifyResult = verifyToken(refreshResult!.token);
      expect(verifyResult.valid).toBe(true);
      expect(verifyResult.payload?.userId).toBe('test-user-refresh');
      expect(verifyResult.payload?.email).toBe('refresh@example.com');
    });

    it('should return null for an invalid token', () => {
      const invalidToken = 'invalid.token.here';
      const result = refreshToken(invalidToken);

      expect(result).toBeNull();
    });
  });

  describe('decodeToken', () => {
    it('should decode a token without verification', () => {
      const payload: TokenPayload = {
        userId: 'test-user-decode',
        email: 'decode@example.com',
        phone: '+9876543210'
      };

      const { token } = generateToken(payload);
      const decoded = decodeToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.['userId']).toBe('test-user-decode');
      expect(decoded?.['email']).toBe('decode@example.com');
      expect(decoded?.['phone']).toBe('+9876543210');
      expect(decoded?.iss).toBe('climatic-pro-api');
      expect(decoded?.aud).toBe('climatic-pro-app');
    });

    it('should return null for an invalid token format', () => {
      const invalidToken = 'not-a-jwt-token';
      const result = decodeToken(invalidToken);

      expect(result).toBeNull();
    });
  });

  describe('JWT_SECRET validation', () => {
    it('should throw error if JWT_SECRET is not set', () => {
      const originalSecret = process.env['JWT_SECRET'];
      delete process.env['JWT_SECRET'];

      const payload: TokenPayload = {
        userId: 'test-user',
        email: 'test@example.com',
        phone: null
      };

      expect(() => generateToken(payload)).toThrow('JWT_SECRET is not configured');

      // Restore secret
      process.env['JWT_SECRET'] = originalSecret;
    });
  });
});
