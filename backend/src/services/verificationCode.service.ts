import { prisma } from '../utils/prisma';

/**
 * Service for managing verification codes
 * Handles generation, storage, and validation of 6-digit verification codes
 */

export interface VerificationCodeResult {
  success: boolean;
  message: string;
  expiresAt?: Date;
}

export interface VerificationValidationResult {
  success: boolean;
  message: string;
  userId?: string;
}

/**
 * Generate a random 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Store verification code in database with 5-minute expiration
 * @param identifier - Email or phone number
 * @returns Result with success status and expiration time
 */
export async function createVerificationCode(
  identifier: string
): Promise<VerificationCodeResult> {
  try {
    // Generate 6-digit code
    const code = generateVerificationCode();
    
    // Set expiration to 5 minutes from now
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    
    // Delete any existing codes for this identifier
    await prisma.verificationCode.deleteMany({
      where: { identifier }
    });
    
    // Store new verification code
    await prisma.verificationCode.create({
      data: {
        identifier,
        code,
        expiresAt,
        attempts: 0
      }
    });
    
    // Mock sending the code (in production, this would send via email/SMS)
    await mockSendVerificationCode(identifier, code);
    
    return {
      success: true,
      message: 'Verification code sent successfully',
      expiresAt
    };
  } catch (error) {
    console.error('Error creating verification code:', error);
    return {
      success: false,
      message: 'Failed to create verification code'
    };
  }
}

/**
 * Verify a code against stored verification code
 * @param identifier - Email or phone number
 * @param code - 6-digit code to verify
 * @returns Validation result with success status
 */
export async function verifyCode(
  identifier: string,
  code: string
): Promise<VerificationValidationResult> {
  try {
    // Find the verification code
    const verificationCode = await prisma.verificationCode.findFirst({
      where: { identifier },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!verificationCode) {
      return {
        success: false,
        message: 'No verification code found for this identifier'
      };
    }
    
    // Check if code has expired
    if (new Date() > verificationCode.expiresAt) {
      await prisma.verificationCode.delete({
        where: { id: verificationCode.id }
      });
      return {
        success: false,
        message: 'Verification code has expired'
      };
    }
    
    // Increment attempt counter
    await prisma.verificationCode.update({
      where: { id: verificationCode.id },
      data: { attempts: verificationCode.attempts + 1 }
    });
    
    // Check if code matches
    if (verificationCode.code !== code) {
      return {
        success: false,
        message: 'Invalid verification code'
      };
    }
    
    // Code is valid - find or create user
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.includes('@') ? identifier : undefined },
          { phone: !identifier.includes('@') ? identifier : undefined }
        ]
      }
    });
    
    if (!user) {
      // Create new user
      user = await prisma.user.create({
        data: {
          email: identifier.includes('@') ? identifier : null,
          phone: !identifier.includes('@') ? identifier : null,
          lastLoginAt: new Date()
        }
      });
    } else {
      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });
    }
    
    // Delete used verification code
    await prisma.verificationCode.delete({
      where: { id: verificationCode.id }
    });
    
    return {
      success: true,
      message: 'Verification successful',
      userId: user.id
    };
  } catch (error) {
    console.error('Error verifying code:', error);
    return {
      success: false,
      message: 'Failed to verify code'
    };
  }
}

/**
 * Mock function to simulate sending verification code via email/SMS
 * In production, this would integrate with email service (SendGrid, AWS SES)
 * or SMS service (Twilio, AWS SNS)
 */
async function mockSendVerificationCode(
  identifier: string,
  code: string
): Promise<void> {
  const isEmail = identifier.includes('@');
  const method = isEmail ? 'email' : 'SMS';
  
  console.log(`[MOCK ${method}] Sending verification code to ${identifier}`);
  console.log(`[MOCK ${method}] Code: ${code}`);
  console.log(`[MOCK ${method}] Expires in 5 minutes`);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));
}

/**
 * Clean up expired verification codes
 * This should be run periodically (e.g., via cron job)
 */
export async function cleanupExpiredCodes(): Promise<number> {
  try {
    const result = await prisma.verificationCode.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
    
    return result.count;
  } catch (error) {
    console.error('Error cleaning up expired codes:', error);
    return 0;
  }
}
