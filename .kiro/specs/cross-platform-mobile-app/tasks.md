# Implementation Plan: Cross-Platform Mobile App

## Overview

Este plano de implementação detalha as tarefas para construir o sistema Climatic Pro completo, incluindo aplicativos móveis nativos (React Native + Expo), plataforma web React (PWA), e backend Node.js com PostgreSQL e Prisma ORM. A implementação seguirá uma abordagem incremental, começando pelo backend, depois mobile, web, e finalmente testes de propriedades.

## Technology Stack

- **Mobile**: React Native 0.73+ com Expo SDK 50+
- **Web**: React 18+ com Vite
- **Backend**: Node.js 20+ com TypeScript, Express.js, PostgreSQL 15+, Prisma ORM
- **Testing**: Jest, fast-check (property-based testing), React Native Testing Library

## Tasks

### 1. Backend Infrastructure Setup

- [x] 1.1 Initialize backend project structure
  - Create Node.js TypeScript project with Express
  - Configure tsconfig.json for strict type checking
  - Set up ESLint and Prettier
  - Create directory structure (src/routes, src/services, src/middleware, src/utils)
  - _Requirements: 9.1, 9.2_

- [x] 1.2 Configure PostgreSQL and Prisma
  - Install Prisma CLI and client
  - Initialize Prisma with PostgreSQL datasource
  - Create complete Prisma schema with all models (User, Sensor, SensorReading, Alert, AlertConfig, etc.)
  - Set up database indexes for performance (mac, userId, timestamp)
  - _Requirements: 9.1, 9.2, 9.4_

- [x] 1.3 Create initial database migration
  - Run prisma migrate dev to create initial migration
  - Verify all tables, indexes, and constraints are created
  - _Requirements: 9.8_


### 2. Authentication System

- [x] 2.1 Implement verification code service
  - Create service to generate 6-digit verification codes
  - Implement code storage with expiration (5 minutes)
  - Add email/SMS sending integration (mock for development)
  - _Requirements: 2.1_

- [x] 2.2 Write property test for authentication code generation
  - **Property 1: Authentication Code Generation**
  - **Validates: Requirements 2.1**

- [x] 2.3 Implement JWT authentication service
  - Create JWT token generation with user claims (userId, expiration)
  - Implement token verification middleware
  - Add token refresh endpoint
  - _Requirements: 2.2, 2.3_

- [x] 2.4 Write property test for JWT token validity
  - **Property 2: JWT Token Validity**
  - **Validates: Requirements 2.2**

- [x] 2.5 Write property test for expired token handling
  - **Property 3: Expired Token Handling**
  - **Validates: Requirements 2.4**

- [x] 2.6 Implement rate limiting for authentication
  - Add rate limiting middleware (3 attempts per 60 seconds)
  - Track failed attempts per identifier
  - _Requirements: 2.6_

- [x] 2.7 Write property test for rate limiting
  - **Property 4: Rate Limiting After Failed Attempts**
  - **Validates: Requirements 2.6**

- [x] 2.8 Create authentication API endpoints
  - POST /api/v1/auth/send-code
  - POST /api/v1/auth/verify-code
  - POST /api/v1/auth/refresh
  - POST /api/v1/auth/logout
  - _Requirements: 2.1, 2.2_

### 3. BLE Data Parser Module

- [x] 3.1 Implement BLE parser for all device types
  - Create parser for F525 format (temperature and humidity formulas)
  - Create parser for 39F5 format (same as F525)
  - Create parser for 35F5 format (IEEE 754 32-bit)
  - Create parser for JW-U water sensors
  - Implement device type identification from advertising data
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 3.3_

- [x] 3.2 Write property test for device type identification
  - **Property 5: Device Type Identification**
  - **Validates: Requirements 3.3**

- [x] 3.3 Write property test for BLE data parsing round-trip
  - **Property 6: BLE Data Parsing Round-Trip**
  - **Validates: Requirements 3.4, 13.1, 13.2, 13.3, 13.4, 13.5**

- [x] 3.4 Add error handling for malformed data
  - Return undefined for unparseable values
  - Log parsing errors for debugging
  - _Requirements: 13.6_


### 4. Sensor Management API

- [x] 4.1 Implement sensor CRUD operations
  - Create service for sensor creation, update, deletion
  - Implement sensor listing with pagination
  - Add sensor details retrieval
  - _Requirements: 4.1, 9.5_

- [x] 4.2 Write property test for sensor alias update
  - **Property 12: Sensor Alias Update**
  - **Validates: Requirements 5.6**

- [x] 4.3 Create sensor API endpoints
  - GET /api/v1/sensors (with pagination)
  - GET /api/v1/sensors/:id
  - POST /api/v1/sensors
  - PATCH /api/v1/sensors/:id
  - DELETE /api/v1/sensors/:id
  - _Requirements: 4.1, 4.2_

- [x] 4.4 Write property test for all user sensors displayed
  - **Property 8: All User Sensors Displayed**
  - **Validates: Requirements 4.1**

- [x] 4.5 Write property test for sensor display completeness
  - **Property 7: Sensor Display Completeness**
  - **Validates: Requirements 3.5, 4.2, 5.1**

### 5. Sensor Data Management

- [x] 5.1 Implement sensor reading storage
  - Create service to store sensor readings
  - Add batch insert for multiple readings
  - Implement data retention policy (optional)
  - _Requirements: 5.1, 5.2_

- [x] 5.2 Implement historical data retrieval
  - Create service to query readings by date range
  - Add pagination support (50 records per page)
  - Implement filtering by parameter type
  - _Requirements: 5.2, 5.4_

- [x] 5.3 Write property test for pagination chunk size
  - **Property 11: Pagination Chunk Size**
  - **Validates: Requirements 5.4**

- [x] 5.4 Write property test for historical data period filtering
  - **Property 10: Historical Data Period Filtering**
  - **Validates: Requirements 5.2**

- [x] 5.5 Create sensor data API endpoints
  - GET /api/v1/sensors/:id/data (with pagination and date filters)
  - POST /api/v1/sensors/:id/data
  - GET /api/v1/sensors/:id/data/latest
  - _Requirements: 5.1, 5.2_

- [x] 5.6 Write property test for timestamp localization
  - **Property 13: Timestamp Localization**
  - **Validates: Requirements 5.7**


### 6. Alert System

- [x] 6.1 Implement alert configuration service
  - Create service to store alert thresholds per sensor
  - Add enable/disable toggle functionality
  - Implement cooldown tracking (15 minutes)
  - _Requirements: 7.1, 7.4, 7.6_

- [x] 6.2 Write property test for alert threshold configuration
  - **Property 17: Alert Threshold Configuration**
  - **Validates: Requirements 7.1**

- [x] 6.3 Write property test for alert toggle state
  - **Property 18: Alert Toggle State**
  - **Validates: Requirements 7.4**

- [x] 6.4 Implement alert checking service
  - Create service to check readings against thresholds
  - Implement automatic dangerous value detection (CO2 > 1000, humidity < 30% or > 70%)
  - Add cooldown enforcement logic
  - _Requirements: 6.4, 7.2, 7.6_

- [x] 6.5 Write property test for automatic dangerous value alerts
  - **Property 15: Automatic Dangerous Value Alerts**
  - **Validates: Requirements 6.4, 7.2**

- [x] 6.6 Write property test for alert cooldown enforcement
  - **Property 20: Alert Cooldown Enforcement**
  - **Validates: Requirements 7.6**

- [x] 6.7 Implement Firebase Cloud Messaging integration
  - Set up FCM admin SDK
  - Create service to send push notifications
  - Implement FCM token management
  - _Requirements: 7.7_

- [x] 6.8 Create alert API endpoints
  - GET /api/v1/alerts (with pagination)
  - GET /api/v1/sensors/:id/alerts/config
  - PUT /api/v1/sensors/:id/alerts/config
  - POST /api/v1/alerts/:id/acknowledge
  - _Requirements: 7.1, 7.4, 7.5_

- [x] 6.9 Write property test for alert history completeness
  - **Property 19: Alert History Completeness**
  - **Validates: Requirements 7.5**

- [x] 6.10 Write property test for alert indicators
  - **Property 9: Alert Indicators for Threshold Violations**
  - **Validates: Requirements 4.4**


### 7. AI Assistant Integration

- [x] 7.1 Implement Gemini AI service
  - Set up Google Gemini 2.5 Flash Lite API client
  - Create service to send messages with sensor context
  - Implement 500 token limit for responses
  - Add 5-second timeout handling
  - _Requirements: 6.1, 6.2, 6.7_

- [x] 7.2 Write property test for AI context completeness
  - **Property 14: AI Context Completeness**
  - **Validates: Requirements 6.3**

- [x] 7.3 Write property test for AI response markdown formatting
  - **Property 16: AI Response Markdown Formatting**
  - **Validates: Requirements 6.6**

- [x] 7.4 Create AI assistant API endpoints
  - POST /api/v1/ai/chat
  - GET /api/v1/ai/insights
  - _Requirements: 6.1, 6.2_

### 8. Data Export Module

- [x] 8.1 Implement CSV export service
  - Create service to generate CSV from sensor data
  - Add date range and parameter filtering
  - Include metadata (sensor name, date range, timestamp)
  - _Requirements: 8.1, 8.3, 8.4, 8.7_

- [x] 8.2 Write property test for CSV export validity
  - **Property 21: CSV Export Validity**
  - **Validates: Requirements 8.1, 8.3, 8.4**

- [x] 8.3 Implement PDF export service
  - Create service to generate PDF with charts
  - Use library like pdfkit or puppeteer
  - Add date range and parameter filtering
  - Include metadata
  - _Requirements: 8.2, 8.3, 8.4, 8.7_

- [x] 8.4 Write property test for PDF export validity
  - **Property 22: PDF Export Validity**
  - **Validates: Requirements 8.2, 8.3, 8.4**

- [x] 8.5 Write property test for export metadata inclusion
  - **Property 23: Export Metadata Inclusion**
  - **Validates: Requirements 8.7**

- [x] 8.6 Create export API endpoints
  - POST /api/v1/export/csv
  - POST /api/v1/export/pdf
  - _Requirements: 8.1, 8.2_


### 9. Sync and Offline Support (Backend)

- [x] 9.1 Implement batch sync endpoint
  - Create endpoint to accept batch operations (create, update, delete)
  - Implement conflict resolution (last write wins)
  - Add transaction support for atomic operations
  - _Requirements: 10.3, 10.6, 10.7_

- [x] 9.2 Write property test for sync conflict resolution
  - **Property 31: Sync Conflict Resolution (Last Write Wins)**
  - **Validates: Requirements 10.7**

- [x] 9.3 Create sync API endpoint
  - POST /api/v1/sync/batch
  - _Requirements: 10.3_

### 10. API Middleware and Security

- [x] 10.1 Implement global rate limiting middleware
  - Add rate limiter (100 requests per minute per user)
  - Return HTTP 429 for rate limit violations
  - _Requirements: 9.6_

- [x] 10.2 Write property test for API rate limiting
  - **Property 25: API Rate Limiting**
  - **Validates: Requirements 9.6**

- [x] 10.3 Implement pagination middleware
  - Add pagination helper with max 100 items per page
  - Include pagination metadata in responses
  - _Requirements: 9.5_

- [x] 10.4 Write property test for API pagination limit
  - **Property 24: API Pagination Limit**
  - **Validates: Requirements 9.5**

- [x] 10.5 Implement security middleware
  - Add CORS configuration with restricted origins
  - Implement input sanitization for SQL injection prevention
  - Add helmet.js for security headers
  - _Requirements: 15.1, 15.4, 15.5_

- [x] 10.6 Write property test for CORS origin restriction
  - **Property 35: CORS Origin Restriction**
  - **Validates: Requirements 15.4**

- [x] 10.7 Write property test for SQL injection prevention
  - **Property 36: SQL Injection Prevention**
  - **Validates: Requirements 15.5**

- [x] 10.8 Implement audit logging service
  - Create service to log sensitive actions
  - Store logs with action type, user ID, resource ID, timestamp, metadata
  - _Requirements: 15.7_

- [x] 10.9 Write property test for audit log creation
  - **Property 37: Audit Log Creation**
  - **Validates: Requirements 15.7**

- [x] 10.10 Implement standardized API response format
  - Create response wrapper with code, message, data fields
  - Add error response formatter
  - _Requirements: 9.7_

- [x] 10.11 Write property test for API response format consistency
  - **Property 26: API Response Format Consistency**
  - **Validates: Requirements 9.7**


### 11. Backend Infrastructure and DevOps

- [x] 11.1 Configure environment variables for production
  - Create .env.example with all required variables
  - Set up validation for environment variables
  - _Requirements: 15.6_

- [x] 11.2 Implement health check endpoint
  - Add /health endpoint returning service status
  - Include database connectivity check
  - _Requirements: 9.8_

- [x] 11.3 Set up Docker configuration
  - Create Dockerfile for backend
  - Create docker-compose.yml for backend and database
  - _Requirements: 15.1_

- [x] 11.4 Implement structured logging
  - Use library like pino or winston
  - Format logs as JSON for production
  - _Requirements: 9.8_


### 12. Mobile and Web Shared Logic

- [x] 12.1 Set up shared state management (Zustand)
  - Create store for user authentication
  - Create store for sensor list and readings
  - Implement persistence for offline support
  - _Requirements: 10.1, 10.4_

- [x] 12.2 Implement common API client (Axios)
  - Create axios instance with base URL and interceptors
  - Add auth header interceptor
  - Implement request retry logic for offline support
  - _Requirements: 9.3, 10.5_

- [x] 12.3 Create shared ApiService
  - Refactor existing api.ts to use new backend structure
  - Implement all core feature methods (auth, sensors, alerts, ai, export)
  - _Requirements: 9.3_

### 13. Mobile and Web UI Refinement

- [x] 13.1 Implement responsive Dashboard
  - Create grid layout for sensor cards
  - Add summary widgets (total sensors, active alerts)
  - _Requirements: 3.5, 4.2_

- [x] 13.2 Refactor Login flow
  - Update LoginScreen to use new shared auth logic
  - Support 6-digit verification code input
  - _Requirements: 2.1, 2.2_

- [x] 13.3 Implement Sensor Details refinement
  - Update DetailsScreen to use real data from backend
  - Add responsive charts for all parameters
  - _Requirements: 5.1, 5.2_

- [x] 13.4 Implement AI Assistant interface
  - Create interactive chat interface
  - Add markdown rendering for AI responses
  - _Requirements: 6.1, 6.6_

- [x] 13.5 Implement Alert Configuration UI
  - Create screen to manage thresholds and toggles
  - _Requirements: 7.1, 7.4_

### 14. Mobile BLE Implementation

- [x] 14.1 Implement BLE permission handling
  - Request Bluetooth and Location permissions
  - Show explanation dialogs for denied permissions
  - _Requirements: 3.1, 3.7_

- [x] 14.2 Create BLE scanner service
  - Implement device scanning with 2-second update interval
  - _Requirements: 3.2, 3.6_

- [x] 14.3 Integrate BLE parser into scanner
  - Use BLE parser module to decode advertising data
  - _Requirements: 3.3, 3.4_

### 15. Final Integration and Testing

- [x] 15.1 End-to-end integration testing
  - Test complete user flows across mobile, web, and backend
  - _Requirements: 2.1, 3.1, 7.1, 8.1_

- [x] 15.2 Cross-platform compatibility testing
  - Test mobile app on Android/iOS and web app on major browsers
  - _Requirements: 1.1, 12.3, 12.4_

- [x] 15.3 Offline/online transition testing
  - Test app behavior during network loss and reconnection
  - _Requirements: 10.3, 10.7_
