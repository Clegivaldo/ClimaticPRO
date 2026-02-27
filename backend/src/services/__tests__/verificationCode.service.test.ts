import {
  generateVerificationCode,
  createVerificationCode,
  verifyCode,
  cleanupExpiredCodes
} from '../verificationCode.service';
import { prisma } from '../../utils/prisma';

// Mock prisma
jest.mock('../../utils/prisma', () => ({
  prisma: {
    verificationCode: {
      deleteMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      update: jest.fn()
    },
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    }
  }
}));

describe('Verification Code Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateVerificationCode', () => {
    it('should generate a 6-digit code', () => {
      const code = generateVerificationCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(code.length).toBe(6);
    });

    it('should generate different codes on multiple calls', () => {
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        codes.add(generateVerificationCode());
      }
      // With 100 calls, we should have at least 90 unique codes (allowing for some collisions)
      expect(codes.size).toBeGreaterThan(90);
    });

    it('should generate codes between 100000 and 999999', () => {
      for (let i = 0; i < 50; i++) {
        const code = parseInt(generateVerificationCode());
        expect(code).toBeGreaterThanOrEqual(100000);
        expect(code).toBeLessThanOrEqual(999999);
      }
    });
  });

  describe('createVerificationCode', () => {
    it('should create verification code for email', async () => {
      const identifier = 'test@example.com';
      const mockDate = new Date('2024-01-01T12:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());

      (prisma.verificationCode.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.verificationCode.create as jest.Mock).mockResolvedValue({
        id: '1',
        identifier,
        code: '123456',
        expiresAt: new Date(mockDate.getTime() + 5 * 60 * 1000),
        attempts: 0,
        createdAt: mockDate
      });

      const result = await createVerificationCode(identifier);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Verification code sent successfully');
      expect(result.expiresAt).toBeDefined();
      expect(prisma.verificationCode.deleteMany).toHaveBeenCalledWith({
        where: { identifier }
      });
      expect(prisma.verificationCode.create).toHaveBeenCalled();
    });

    it('should create verification code for phone', async () => {
      const identifier = '+5511999999999';
      (prisma.verificationCode.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.verificationCode.create as jest.Mock).mockResolvedValue({
        id: '1',
        identifier,
        code: '654321',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
        createdAt: new Date()
      });

      const result = await createVerificationCode(identifier);

      expect(result.success).toBe(true);
      expect(prisma.verificationCode.create).toHaveBeenCalled();
    });

    it('should delete existing codes before creating new one', async () => {
      const identifier = 'test@example.com';
      (prisma.verificationCode.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.verificationCode.create as jest.Mock).mockResolvedValue({
        id: '1',
        identifier,
        code: '123456',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
        createdAt: new Date()
      });

      await createVerificationCode(identifier);

      expect(prisma.verificationCode.deleteMany).toHaveBeenCalledWith({
        where: { identifier }
      });
    });

    it('should set expiration to 5 minutes from now', async () => {
      const identifier = 'test@example.com';
      const mockDate = new Date('2024-01-01T12:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());

      (prisma.verificationCode.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.verificationCode.create as jest.Mock).mockResolvedValue({
        id: '1',
        identifier,
        code: '123456',
        expiresAt: new Date(mockDate.getTime() + 5 * 60 * 1000),
        attempts: 0,
        createdAt: mockDate
      });

      const result = await createVerificationCode(identifier);

      const expectedExpiration = new Date(mockDate.getTime() + 5 * 60 * 1000);
      expect(result.expiresAt?.getTime()).toBe(expectedExpiration.getTime());
    });

    it('should handle database errors gracefully', async () => {
      const identifier = 'test@example.com';
      (prisma.verificationCode.deleteMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const result = await createVerificationCode(identifier);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to create verification code');
    });
  });

  describe('verifyCode', () => {
    it('should verify valid code and return userId', async () => {
      const identifier = 'test@example.com';
      const code = '123456';
      const userId = 'user-123';
      const mockDate = new Date('2024-01-01T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      (prisma.verificationCode.findFirst as jest.Mock).mockResolvedValue({
        id: 'vc-1',
        identifier,
        code,
        expiresAt: new Date(mockDate.getTime() + 2 * 60 * 1000), // 2 minutes in future
        attempts: 0,
        createdAt: mockDate
      });

      (prisma.verificationCode.update as jest.Mock).mockResolvedValue({});
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: userId,
        email: identifier,
        phone: null
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});
      (prisma.verificationCode.delete as jest.Mock).mockResolvedValue({});

      const result = await verifyCode(identifier, code);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Verification successful');
      expect(result.userId).toBe(userId);
      expect(prisma.verificationCode.delete).toHaveBeenCalled();
      
      jest.restoreAllMocks();
    });

    it('should create new user if not exists', async () => {
      const identifier = 'newuser@example.com';
      const code = '123456';
      const newUserId = 'new-user-123';
      const mockDate = new Date('2024-01-01T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      (prisma.verificationCode.findFirst as jest.Mock).mockResolvedValue({
        id: 'vc-1',
        identifier,
        code,
        expiresAt: new Date(mockDate.getTime() + 2 * 60 * 1000),
        attempts: 0,
        createdAt: mockDate
      });

      (prisma.verificationCode.update as jest.Mock).mockResolvedValue({});
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: newUserId,
        email: identifier,
        phone: null,
        lastLoginAt: mockDate
      });
      (prisma.verificationCode.delete as jest.Mock).mockResolvedValue({});

      const result = await verifyCode(identifier, code);

      expect(result.success).toBe(true);
      expect(result.userId).toBe(newUserId);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: identifier,
          phone: null,
          lastLoginAt: mockDate
        }
      });
      
      jest.restoreAllMocks();
    });

    it('should reject if no verification code found', async () => {
      (prisma.verificationCode.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await verifyCode('test@example.com', '123456');

      expect(result.success).toBe(false);
      expect(result.message).toBe('No verification code found for this identifier');
    });

    it('should reject expired code', async () => {
      const identifier = 'test@example.com';
      const code = '123456';
      const mockNow = new Date('2024-01-01T12:00:00Z').getTime();
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      (prisma.verificationCode.findFirst as jest.Mock).mockResolvedValue({
        id: 'vc-1',
        identifier,
        code,
        expiresAt: new Date(mockNow - 1000), // Expired 1 second ago
        attempts: 0,
        createdAt: new Date(mockNow - 6 * 60 * 1000)
      });

      (prisma.verificationCode.delete as jest.Mock).mockResolvedValue({});

      const result = await verifyCode(identifier, code);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Verification code has expired');
      expect(prisma.verificationCode.delete).toHaveBeenCalled();
      
      jest.restoreAllMocks();
    });

    it('should reject invalid code', async () => {
      const identifier = 'test@example.com';
      const mockDate = new Date('2024-01-01T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      (prisma.verificationCode.findFirst as jest.Mock).mockResolvedValue({
        id: 'vc-1',
        identifier,
        code: '123456',
        expiresAt: new Date(mockDate.getTime() + 2 * 60 * 1000),
        attempts: 0,
        createdAt: mockDate
      });

      (prisma.verificationCode.update as jest.Mock).mockResolvedValue({});

      const result = await verifyCode(identifier, '999999');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid verification code');
      expect(prisma.verificationCode.update).toHaveBeenCalled(); // Attempt counter incremented
      
      jest.restoreAllMocks();
    });

    it('should increment attempt counter on verification', async () => {
      const identifier = 'test@example.com';
      const code = '123456';
      const mockDate = new Date('2024-01-01T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      (prisma.verificationCode.findFirst as jest.Mock).mockResolvedValue({
        id: 'vc-1',
        identifier,
        code,
        expiresAt: new Date(mockDate.getTime() + 2 * 60 * 1000),
        attempts: 2,
        createdAt: mockDate
      });

      (prisma.verificationCode.update as jest.Mock).mockResolvedValue({});
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: identifier
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});
      (prisma.verificationCode.delete as jest.Mock).mockResolvedValue({});

      await verifyCode(identifier, code);

      expect(prisma.verificationCode.update).toHaveBeenCalledWith({
        where: { id: 'vc-1' },
        data: { attempts: 3 }
      });
      
      jest.restoreAllMocks();
    });

    it('should handle phone number identifier', async () => {
      const identifier = '+5511999999999';
      const code = '123456';
      const mockDate = new Date('2024-01-01T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      (prisma.verificationCode.findFirst as jest.Mock).mockResolvedValue({
        id: 'vc-1',
        identifier,
        code,
        expiresAt: new Date(mockDate.getTime() + 2 * 60 * 1000),
        attempts: 0,
        createdAt: mockDate
      });

      (prisma.verificationCode.update as jest.Mock).mockResolvedValue({});
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: null,
        phone: identifier,
        lastLoginAt: mockDate
      });
      (prisma.verificationCode.delete as jest.Mock).mockResolvedValue({});

      const result = await verifyCode(identifier, code);

      expect(result.success).toBe(true);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: null,
          phone: identifier,
          lastLoginAt: mockDate
        }
      });
      
      jest.restoreAllMocks();
    });
  });

  describe('cleanupExpiredCodes', () => {
    it('should delete expired codes', async () => {
      (prisma.verificationCode.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });

      const count = await cleanupExpiredCodes();

      expect(count).toBe(5);
      // Just verify the function was called with the correct structure
      const callArgs = (prisma.verificationCode.deleteMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.expiresAt.lt).toBeInstanceOf(Date);
    });

    it('should return 0 on error', async () => {
      (prisma.verificationCode.deleteMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const count = await cleanupExpiredCodes();

      expect(count).toBe(0);
    });
  });
});
