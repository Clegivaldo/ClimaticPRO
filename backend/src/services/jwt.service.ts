import jwt, { SignOptions } from 'jsonwebtoken';

/**
 * Service for JWT token generation and verification
 * Handles token creation, verification, and refresh logic
 */

export interface TokenPayload {
  userId: string;
  email?: string | null;
  phone?: string | null;
}

export interface TokenResult {
  token: string;
  expiresIn: string | number;
}

export interface VerifyTokenResult {
  valid: boolean;
  payload?: TokenPayload;
  error?: string;
}

/**
 * Get JWT secret from environment variables
 * Throws error if not configured
 */
function getJWTSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    throw new Error('JWT_SECRET is not configured in environment variables');
  }
  return secret;
}

/**
 * Get JWT expiration time from environment variables
 * Defaults to 7 days if not configured
 */
function getJWTExpiresIn(): string | number {
  const expiresIn = process.env['JWT_EXPIRES_IN'] || '7d';
  // Return as-is - jwt library handles both string and number formats
  return expiresIn;
}

/**
 * Generate a JWT token with user claims
 * @param payload - User information to encode in token
 * @returns Token and expiration information
 */
export function generateToken(payload: TokenPayload): TokenResult {
  const secret = getJWTSecret();
  const expiresIn = getJWTExpiresIn();
  
  const options: SignOptions = {
    expiresIn: expiresIn as any, // Type assertion needed for StringValue branded type
    issuer: 'climatic-pro-api',
    audience: 'climatic-pro-app'
  };
  
  const token = jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
      phone: payload.phone
    },
    secret,
    options
  );
  
  return {
    token,
    expiresIn
  };
}

/**
 * Verify a JWT token and extract payload
 * @param token - JWT token to verify
 * @returns Verification result with payload if valid
 */
export function verifyToken(token: string): VerifyTokenResult {
  try {
    const secret = getJWTSecret();
    
    const decoded = jwt.verify(token, secret, {
      issuer: 'climatic-pro-api',
      audience: 'climatic-pro-app'
    }) as jwt.JwtPayload;
    
    // Extract user claims
    const payload: TokenPayload = {
      userId: decoded['userId'] as string,
      email: decoded['email'] as string | null | undefined,
      phone: decoded['phone'] as string | null | undefined
    };
    
    return {
      valid: true,
      payload
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message
    };
  }
}

/**
 * Refresh a JWT token
 * @param token - Current JWT token
 * @returns New token and expiration information
 */
export function refreshToken(token: string): TokenResult | null {
  try {
    const secret = getJWTSecret();
    
    // Decode token even if expired
    const decoded = jwt.decode(token) as jwt.JwtPayload;
    
    if (!decoded || !decoded['userId']) {
      return null;
    }
    
    // Generate new token for the same user
    return generateToken({
      userId: decoded['userId'] as string,
      email: decoded['email'] as string | null | undefined,
      phone: decoded['phone'] as string | null | undefined
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

/**
 * Decode a JWT token without verification (for debugging/logging)
 * @param token - JWT token to decode
 * @returns Decoded payload or null if invalid format
 */
export function decodeToken(token: string): jwt.JwtPayload | null {
  try {
    return jwt.decode(token) as jwt.JwtPayload;
  } catch {
    return null;
  }
}
