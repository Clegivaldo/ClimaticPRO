# Services Documentation

## JWT Authentication Service

The JWT authentication service provides token generation, verification, and refresh functionality for the Climatic Pro API.

### Configuration

Set the following environment variables in your `.env` file:

```env
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d  # Can be: 7d, 24h, 3600 (seconds), etc.
```

### Usage

#### Generate a Token

```typescript
import { generateToken } from './services/jwt.service';

const tokenResult = generateToken({
  userId: 'user-123',
  email: 'user@example.com',
  phone: null
});

console.log(tokenResult.token); // JWT token string
console.log(tokenResult.expiresIn); // '7d'
```

#### Verify a Token

```typescript
import { verifyToken } from './services/jwt.service';

const result = verifyToken(token);

if (result.valid) {
  console.log('User ID:', result.payload?.userId);
  console.log('Email:', result.payload?.email);
} else {
  console.error('Error:', result.error);
}
```

#### Refresh a Token

```typescript
import { refreshToken } from './services/jwt.service';

const newTokenResult = refreshToken(currentToken);

if (newTokenResult) {
  console.log('New token:', newTokenResult.token);
} else {
  console.error('Failed to refresh token');
}
```

### Authentication Middleware

Use the `authenticateToken` middleware to protect routes:

```typescript
import { authenticateToken } from './middleware/auth.middleware';
import { Router } from 'express';

const router = Router();

// Protected route - requires valid JWT token
router.get('/protected', authenticateToken, (req, res) => {
  // Access user information from req.user
  console.log('User ID:', req.user?.userId);
  res.json({ message: 'Access granted' });
});

// Optional authentication - attaches user if token is present
router.get('/public', optionalAuth, (req, res) => {
  if (req.user) {
    console.log('Authenticated user:', req.user.userId);
  } else {
    console.log('Anonymous user');
  }
  res.json({ message: 'Public content' });
});
```

### API Endpoints

#### POST /api/v1/auth/send-code

Send a verification code to email or phone.

**Request:**
```json
{
  "identifier": "user@example.com"  // or "+1234567890"
}
```

**Response:**
```json
{
  "code": 200,
  "message": "Verification code sent successfully",
  "data": {
    "expiresAt": "2024-01-01T12:05:00.000Z"
  }
}
```

#### POST /api/v1/auth/verify-code

Verify code and receive JWT token.

**Request:**
```json
{
  "identifier": "user@example.com",
  "code": "123456"
}
```

**Response:**
```json
{
  "code": 200,
  "message": "Verification successful",
  "data": {
    "userId": "user-123",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "7d"
  }
}
```

#### POST /api/v1/auth/refresh

Refresh JWT token (requires valid token in Authorization header).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "code": 200,
  "message": "Token refreshed successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "7d"
  }
}
```

#### POST /api/v1/auth/logout

Logout user (requires valid token in Authorization header).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "code": 200,
  "message": "Logged out successfully"
}
```

### Error Responses

All authentication errors follow this format:

```json
{
  "code": 401,
  "message": "Authentication failed",
  "error": {
    "details": "Token has expired"
  }
}
```

Common error codes:
- `400`: Validation error (invalid input)
- `401`: Authentication failed (invalid/expired token, wrong code)
- `500`: Internal server error

### Security Notes

1. **Token Storage**: Clients should store JWT tokens securely:
   - Mobile: Use Keychain (iOS) or Keystore (Android)
   - Web: Use httpOnly cookies or secure localStorage

2. **Token Expiration**: Tokens expire after the configured time (default 7 days). Clients should:
   - Handle 401 errors by redirecting to login
   - Implement automatic token refresh before expiration

3. **Logout**: JWT tokens are stateless, so logout is primarily client-side (removing the token). The logout endpoint exists for consistency and future server-side token blacklisting.

4. **Secret Key**: Keep `JWT_SECRET` secure and never commit it to version control. Use a strong, random string (at least 32 characters).

### Testing

Run tests with:

```bash
npm test -- jwt.service.test.ts
npm test -- auth.routes.test.ts
```

All tests include:
- Token generation and verification
- Expiration handling
- Refresh functionality
- Integration tests for all endpoints
