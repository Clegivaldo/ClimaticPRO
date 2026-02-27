# Authentication API Endpoints

This document describes the authentication endpoints implemented in the backend API.

## Base URL
All endpoints are prefixed with `/api/v1/auth`

## Endpoints

### 1. Send Verification Code
**POST** `/api/v1/auth/send-code`

Sends a 6-digit verification code to the provided email or phone number.

**Request Body:**
```json
{
  "identifier": "user@example.com" // or "+1234567890"
}
```

**Success Response (200):**
```json
{
  "code": 200,
  "message": "Verification code sent successfully",
  "data": {
    "expiresAt": "2024-01-01T12:05:00.000Z"
  }
}
```

**Error Responses:**
- 400: Invalid identifier format
- 429: Too many failed attempts (rate limited)
- 500: Internal server error

---

### 2. Verify Code
**POST** `/api/v1/auth/verify-code`

Verifies the code and returns a JWT token for authentication.

**Request Body:**
```json
{
  "identifier": "user@example.com",
  "code": "123456"
}
```

**Success Response (200):**
```json
{
  "code": 200,
  "message": "Verification successful",
  "data": {
    "userId": "uuid-here",
    "token": "jwt-token-here",
    "expiresIn": "1h"
  }
}
```

**Error Responses:**
- 400: Invalid code format
- 401: Invalid or expired code
- 429: Too many failed attempts (rate limited)
- 500: Internal server error

---

### 3. Refresh Token
**POST** `/api/v1/auth/refresh`

Refreshes an existing JWT token to extend the session.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Success Response (200):**
```json
{
  "code": 200,
  "message": "Token refreshed successfully",
  "data": {
    "token": "new-jwt-token-here",
    "expiresIn": "1h"
  }
}
```

**Error Responses:**
- 401: No token provided or invalid token
- 500: Internal server error

---

### 4. Logout
**POST** `/api/v1/auth/logout`

Logs out the user. In a stateless JWT system, this is primarily handled client-side by removing the token from storage.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Success Response (200):**
```json
{
  "code": 200,
  "message": "Logged out successfully"
}
```

**Error Responses:**
- 401: No token provided or invalid token
- 500: Internal server error

---

## Rate Limiting

The authentication endpoints implement rate limiting to prevent brute force attacks:

- After 3 failed verification attempts, the identifier is blocked for 60 seconds
- Rate limits are tracked separately per identifier
- Successful verification clears the rate limit for that identifier

## Security Features

1. **JWT Authentication**: Tokens are signed with a secret key and include user claims
2. **Token Expiration**: Tokens expire after a configurable time (default: 1 hour)
3. **Rate Limiting**: Prevents brute force attacks on verification codes
4. **Input Validation**: All inputs are validated using Zod schemas
5. **Secure Storage**: Tokens should be stored in Keychain (iOS) or Keystore (Android)

## Testing

All endpoints are covered by comprehensive unit tests. Run tests with:

```bash
npm test -- auth.routes.test.ts
```

## Integration

The auth routes are integrated into the main Express app at `/api/v1/auth`. See `src/routes/index.ts` and `src/index.ts` for the integration details.
