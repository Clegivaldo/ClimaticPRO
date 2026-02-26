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

- [ ] 2.1 Implement verification code service
  - Create service to generate 6-digit verification codes
  - Implement code storage with expiration (5 minutes)
  - Add email/SMS sending integration (mock for development)
  - _Requirements: 2.1_

- [ ]* 2.2 Write property test for authentication code generation
  - **Property 1: Authentication Code Generation**
  - **Validates: Requirements 2.1**

- [ ] 2.3 Implement JWT authentication service
  - Create JWT token generation with user claims (userId, expiration)
  - Implement token verification middleware
  - Add token refresh endpoint
  - _Requirements: 2.2, 2.3_

- [ ]* 2.4 Write property test for JWT token validity
  - **Property 2: JWT Token Validity**
  - **Validates: Requirements 2.2**

- [ ]* 2.5 Write property test for expired token handling
  - **Property 3: Expired Token Handling**
  - **Validates: Requirements 2.4**

- [ ] 2.6 Implement rate limiting for authentication
  - Add rate limiting middleware (3 attempts per 60 seconds)
  - Track failed attempts per identifier
  - _Requirements: 2.6_

- [ ]* 2.7 Write property test for rate limiting
  - **Property 4: Rate Limiting After Failed Attempts**
  - **Validates: Requirements 2.6**

- [ ] 2.8 Create authentication API endpoints
  - POST /api/v1/auth/send-code
  - POST /api/v1/auth/verify-code
  - POST /api/v1/auth/refresh
  - POST /api/v1/auth/logout
  - _Requirements: 2.1, 2.2_

### 3. BLE Data Parser Module

- [ ] 3.1 Implement BLE parser for all device types
  - Create parser for F525 format (temperature and humidity formulas)
  - Create parser for 39F5 format (same as F525)
  - Create parser for 35F5 format (IEEE 754 32-bit)
  - Create parser for JW-U water sensors
  - Implement device type identification from advertising data
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 3.3_

- [ ]* 3.2 Write property test for device type identification
  - **Property 5: Device Type Identification**
  - **Validates: Requirements 3.3**

- [ ]* 3.3 Write property test for BLE data parsing round-trip
  - **Property 6: BLE Data Parsing Round-Trip**
  - **Validates: Requirements 3.4, 13.1, 13.2, 13.3, 13.4, 13.5**

- [ ] 3.4 Add error handling for malformed data
  - Return undefined for unparseable values
  - Log parsing errors for debugging
  - _Requirements: 13.6_


### 4. Sensor Management API

- [ ] 4.1 Implement sensor CRUD operations
  - Create service for sensor creation, update, deletion
  - Implement sensor listing with pagination
  - Add sensor details retrieval
  - _Requirements: 4.1, 9.5_

- [ ]* 4.2 Write property test for sensor alias update
  - **Property 12: Sensor Alias Update**
  - **Validates: Requirements 5.6**

- [ ] 4.3 Create sensor API endpoints
  - GET /api/v1/sensors (with pagination)
  - GET /api/v1/sensors/:id
  - POST /api/v1/sensors
  - PATCH /api/v1/sensors/:id
  - DELETE /api/v1/sensors/:id
  - _Requirements: 4.1, 4.2_

- [ ]* 4.4 Write property test for all user sensors displayed
  - **Property 8: All User Sensors Displayed**
  - **Validates: Requirements 4.1**

- [ ]* 4.5 Write property test for sensor display completeness
  - **Property 7: Sensor Display Completeness**
  - **Validates: Requirements 3.5, 4.2, 5.1**

### 5. Sensor Data Management

- [ ] 5.1 Implement sensor reading storage
  - Create service to store sensor readings
  - Add batch insert for multiple readings
  - Implement data retention policy (optional)
  - _Requirements: 5.1, 5.2_

- [ ] 5.2 Implement historical data retrieval
  - Create service to query readings by date range
  - Add pagination support (50 records per page)
  - Implement filtering by parameter type
  - _Requirements: 5.2, 5.4_

- [ ]* 5.3 Write property test for pagination chunk size
  - **Property 11: Pagination Chunk Size**
  - **Validates: Requirements 5.4**

- [ ]* 5.4 Write property test for historical data period filtering
  - **Property 10: Historical Data Period Filtering**
  - **Validates: Requirements 5.2**

- [ ] 5.5 Create sensor data API endpoints
  - GET /api/v1/sensors/:id/data (with pagination and date filters)
  - POST /api/v1/sensors/:id/data
  - GET /api/v1/sensors/:id/data/latest
  - _Requirements: 5.1, 5.2_

- [ ]* 5.6 Write property test for timestamp localization
  - **Property 13: Timestamp Localization**
  - **Validates: Requirements 5.7**


### 6. Alert System

- [ ] 6.1 Implement alert configuration service
  - Create service to store alert thresholds per sensor
  - Add enable/disable toggle functionality
  - Implement cooldown tracking (15 minutes)
  - _Requirements: 7.1, 7.4, 7.6_

- [ ]* 6.2 Write property test for alert threshold configuration
  - **Property 17: Alert Threshold Configuration**
  - **Validates: Requirements 7.1**

- [ ]* 6.3 Write property test for alert toggle state
  - **Property 18: Alert Toggle State**
  - **Validates: Requirements 7.4**

- [ ] 6.4 Implement alert checking service
  - Create service to check readings against thresholds
  - Implement automatic dangerous value detection (CO2 > 1000, humidity < 30% or > 70%)
  - Add cooldown enforcement logic
  - _Requirements: 6.4, 7.2, 7.6_

- [ ]* 6.5 Write property test for automatic dangerous value alerts
  - **Property 15: Automatic Dangerous Value Alerts**
  - **Validates: Requirements 6.4, 7.2**

- [ ]* 6.6 Write property test for alert cooldown enforcement
  - **Property 20: Alert Cooldown Enforcement**
  - **Validates: Requirements 7.6**

- [ ] 6.7 Implement Firebase Cloud Messaging integration
  - Set up FCM admin SDK
  - Create service to send push notifications
  - Implement FCM token management
  - _Requirements: 7.7_

- [ ] 6.8 Create alert API endpoints
  - GET /api/v1/alerts (with pagination)
  - GET /api/v1/sensors/:id/alerts/config
  - PUT /api/v1/sensors/:id/alerts/config
  - POST /api/v1/alerts/:id/acknowledge
  - _Requirements: 7.1, 7.4, 7.5_

- [ ]* 6.9 Write property test for alert history completeness
  - **Property 19: Alert History Completeness**
  - **Validates: Requirements 7.5**

- [ ]* 6.10 Write property test for alert indicators
  - **Property 9: Alert Indicators for Threshold Violations**
  - **Validates: Requirements 4.4**


### 7. AI Assistant Integration

- [ ] 7.1 Implement Gemini AI service
  - Set up Google Gemini 2.5 Flash Lite API client
  - Create service to send messages with sensor context
  - Implement 500 token limit for responses
  - Add 5-second timeout handling
  - _Requirements: 6.1, 6.2, 6.7_

- [ ]* 7.2 Write property test for AI context completeness
  - **Property 14: AI Context Completeness**
  - **Validates: Requirements 6.3**

- [ ]* 7.3 Write property test for AI response markdown formatting
  - **Property 16: AI Response Markdown Formatting**
  - **Validates: Requirements 6.6**

- [ ] 7.4 Create AI assistant API endpoints
  - POST /api/v1/ai/chat
  - GET /api/v1/ai/insights
  - _Requirements: 6.1, 6.2_

### 8. Data Export Module

- [ ] 8.1 Implement CSV export service
  - Create service to generate CSV from sensor data
  - Add date range and parameter filtering
  - Include metadata (sensor name, date range, timestamp)
  - _Requirements: 8.1, 8.3, 8.4, 8.7_

- [ ]* 8.2 Write property test for CSV export validity
  - **Property 21: CSV Export Validity**
  - **Validates: Requirements 8.1, 8.3, 8.4**

- [ ] 8.3 Implement PDF export service
  - Create service to generate PDF with charts
  - Use library like pdfkit or puppeteer
  - Add date range and parameter filtering
  - Include metadata
  - _Requirements: 8.2, 8.3, 8.4, 8.7_

- [ ]* 8.4 Write property test for PDF export validity
  - **Property 22: PDF Export Validity**
  - **Validates: Requirements 8.2, 8.3, 8.4**

- [ ]* 8.5 Write property test for export metadata inclusion
  - **Property 23: Export Metadata Inclusion**
  - **Validates: Requirements 8.7**

- [ ] 8.6 Create export API endpoints
  - POST /api/v1/export/csv
  - POST /api/v1/export/pdf
  - _Requirements: 8.1, 8.2_


### 9. Sync and Offline Support (Backend)

- [ ] 9.1 Implement batch sync endpoint
  - Create endpoint to accept batch operations (create, update, delete)
  - Implement conflict resolution (last write wins)
  - Add transaction support for atomic operations
  - _Requirements: 10.3, 10.6, 10.7_

- [ ]* 9.2 Write property test for sync conflict resolution
  - **Property 31: Sync Conflict Resolution (Last Write Wins)**
  - **Validates: Requirements 10.7**

- [ ] 9.3 Create sync API endpoint
  - POST /api/v1/sync/batch
  - _Requirements: 10.3_

### 10. API Middleware and Security

- [ ] 10.1 Implement global rate limiting middleware
  - Add rate limiter (100 requests per minute per user)
  - Return HTTP 429 for rate limit violations
  - _Requirements: 9.6_

- [ ]* 10.2 Write property test for API rate limiting
  - **Property 25: API Rate Limiting**
  - **Validates: Requirements 9.6**

- [ ] 10.3 Implement pagination middleware
  - Add pagination helper with max 100 items per page
  - Include pagination metadata in responses
  - _Requirements: 9.5_

- [ ]* 10.4 Write property test for API pagination limit
  - **Property 24: API Pagination Limit**
  - **Validates: Requirements 9.5**

- [ ] 10.5 Implement security middleware
  - Add CORS configuration with restricted origins
  - Implement input sanitization for SQL injection prevention
  - Add helmet.js for security headers
  - _Requirements: 15.1, 15.4, 15.5_

- [ ]* 10.6 Write property test for CORS origin restriction
  - **Property 35: CORS Origin Restriction**
  - **Validates: Requirements 15.4**

- [ ]* 10.7 Write property test for SQL injection prevention
  - **Property 36: SQL Injection Prevention**
  - **Validates: Requirements 15.5**

- [ ] 10.8 Implement audit logging service
  - Create service to log sensitive actions
  - Store logs with action type, user ID, resource ID, timestamp, metadata
  - _Requirements: 15.7_

- [ ]* 10.9 Write property test for audit log creation
  - **Property 37: Audit Log Creation**
  - **Validates: Requirements 15.7**

- [ ] 10.10 Implement standardized API response format
  - Create response wrapper with code, message, data fields
  - Add error response formatter
  - _Requirements: 9.7_

- [ ]* 10.11 Write property test for API response format consistency
  - **Property 26: API Response Format Consistency**
  - **Validates: Requirements 9.7**


### 11. Backend Testing and Deployment Setup

- [ ] 11.1 Set up backend testing infrastructure
  - Configure Jest for Node.js
  - Set up test database with Docker
  - Create test fixtures and factories
  - _Requirements: 9.1_

- [ ]* 11.2 Write unit tests for authentication service
  - Test code generation, verification, token creation
  - Test error cases (expired codes, invalid codes)
  - _Requirements: 2.1, 2.2_

- [ ]* 11.3 Write unit tests for BLE parser
  - Test each device type parser with known values
  - Test edge cases (min/max values, malformed data)
  - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [ ]* 11.4 Write integration tests for API endpoints
  - Test all endpoints with real database
  - Test authentication flow end-to-end
  - Test error responses
  - _Requirements: 9.3_

- [ ] 11.5 Configure environment variables and secrets
  - Create .env.example with all required variables
  - Document DATABASE_URL, JWT_SECRET, GEMINI_API_KEY, FCM credentials
  - _Requirements: 6.1, 7.7, 9.1_

- [ ] 11.6 Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.


### 12. Mobile App Project Setup

- [ ] 12.1 Initialize React Native project with Expo
  - Create new Expo project with TypeScript template
  - Configure app.json with app name, bundle identifiers, permissions
  - Set up folder structure (src/screens, src/components, src/services, src/hooks, src/utils)
  - _Requirements: 1.1, 1.4_

- [ ] 12.2 Install and configure core dependencies
  - Install React Navigation 6.x (stack, tab, native)
  - Install React Query for server state management
  - Install Zustand for client state management
  - Install Axios for API client
  - Install React Native BLE Manager
  - Install Expo SQLite for local storage
  - _Requirements: 1.1, 3.1, 10.1_

- [ ] 12.3 Configure TypeScript and linting
  - Set up tsconfig.json with strict mode
  - Configure ESLint with React Native rules
  - Add Prettier for code formatting
  - _Requirements: 1.1_

- [ ] 12.4 Create API client service
  - Create Axios instance with base URL configuration
  - Add request interceptor for JWT token
  - Add response interceptor for error handling
  - Implement token refresh logic
  - _Requirements: 2.3, 9.7_

### 13. Mobile Authentication Flow

- [ ] 13.1 Create authentication screens
  - Create LoginScreen with email/phone input
  - Create VerifyCodeScreen with 6-digit code input
  - Create DemoModeScreen for unauthenticated access
  - _Requirements: 2.1, 2.2, 2.5_

- [ ] 13.2 Implement secure token storage
  - Use Expo SecureStore for JWT token storage
  - Create auth service to manage token lifecycle
  - _Requirements: 2.3, 15.3_

- [ ] 13.3 Implement authentication state management
  - Create Zustand store for auth state (isAuthenticated, user, token)
  - Add login, logout, and token refresh actions
  - _Requirements: 2.2, 2.4_

- [ ] 13.4 Create authentication navigation flow
  - Set up AuthNavigator for login screens
  - Implement conditional navigation based on auth state
  - Add auto-redirect on token expiration
  - _Requirements: 2.4_


### 14. Mobile BLE Scanner Implementation

- [ ] 14.1 Implement BLE permission handling
  - Request Bluetooth and Location permissions
  - Show explanation dialogs for denied permissions
  - Add link to app settings
  - _Requirements: 3.1, 3.7_

- [ ] 14.2 Create BLE scanner service
  - Implement device scanning with 2-second update interval
  - Add device discovery callback
  - Implement scan start/stop methods
  - Filter devices within 10-meter range (RSSI-based)
  - _Requirements: 3.2, 3.6_

- [ ] 14.3 Integrate BLE parser into scanner
  - Use BLE parser module to decode advertising data
  - Identify device type from advertising packet
  - Extract temperature, humidity, battery level
  - _Requirements: 3.3, 3.4_

- [ ] 14.4 Create BLE scan screen
  - Create BLEScanScreen with device list
  - Show MAC address, device type, parsed data, RSSI
  - Add start/stop scan button
  - Implement real-time list updates
  - _Requirements: 3.5_

- [ ] 14.5 Implement offline BLE scanning
  - Allow scanning without network connection
  - Cache discovered devices locally
  - _Requirements: 10.5_

### 15. Mobile Local Storage and Sync

- [ ] 15.1 Set up Expo SQLite database
  - Create database schema for local storage
  - Implement tables: LocalSensor, LocalSensorReading, LocalPendingOperation
  - Add indexes for performance
  - _Requirements: 10.1_

- [ ] 15.2 Implement local data service
  - Create service to read/write sensors locally
  - Implement caching for sensor readings
  - Add pending operation queue
  - _Requirements: 10.1, 10.2_

- [ ]* 15.3 Write property test for offline data access
  - **Property 27: Offline Data Access**
  - **Validates: Requirements 10.2**

- [ ] 15.4 Implement sync service
  - Create service to detect online/offline transitions
  - Implement batch sync with backend
  - Add conflict resolution (last write wins)
  - _Requirements: 10.3, 10.7_

- [ ]* 15.5 Write property test for online sync trigger
  - **Property 28: Online Sync Trigger**
  - **Validates: Requirements 10.3**

- [ ]* 15.6 Write property test for offline operation queuing
  - **Property 30: Offline Operation Queuing**
  - **Validates: Requirements 10.6**

- [ ] 15.7 Implement connection status indicator
  - Create component to show online/offline status
  - Add to app header or status bar
  - _Requirements: 10.4_

- [ ]* 15.8 Write property test for connection status display
  - **Property 29: Connection Status Display**
  - **Validates: Requirements 10.4**


### 16. Mobile Dashboard and Sensor List

- [ ] 16.1 Create sensor list screen
  - Create DashboardScreen with FlatList of sensors
  - Implement pull-to-refresh
  - Add auto-refresh every 60 seconds in foreground
  - _Requirements: 4.1, 4.6, 4.7_

- [ ] 16.2 Create SensorCard component
  - Display sensor alias, type, battery level, online/offline status
  - Show last sync timestamp
  - Add visual alert indicators for threshold violations
  - Implement onPress navigation to details
  - _Requirements: 4.2, 4.4, 4.5_

- [ ] 16.3 Implement sensor data fetching with React Query
  - Create useQuery hook for sensor list
  - Add pagination support
  - Implement optimistic updates
  - _Requirements: 4.1, 9.5_

- [ ] 16.4 Add loading and error states
  - Show skeleton loaders while fetching
  - Display error messages with retry button
  - _Requirements: 4.1_

### 17. Mobile Sensor Details and Charts

- [ ] 17.1 Create sensor details screen
  - Create SensorDetailsScreen with parameter display
  - Show all available parameters (temperature, humidity, CO2, PM2.5, TVOC, etc.)
  - Add alias editing functionality
  - _Requirements: 5.1, 5.6_

- [ ] 17.2 Implement chart component
  - Create ChartView component using react-native-chart-kit or Victory Native
  - Add period selector (24h, 7d, 30d, 90d)
  - Implement zoom and pan gestures
  - _Requirements: 5.2, 5.3_

- [ ] 17.3 Implement historical data fetching
  - Create useQuery hook for historical data with date range
  - Add pagination for large datasets
  - Implement loading states for charts
  - _Requirements: 5.2, 5.4_

- [ ] 17.4 Add empty state handling
  - Show informative message when no data available
  - _Requirements: 5.5_


### 18. Mobile AI Assistant

- [ ] 18.1 Create AI chat screen
  - Create AIAssistantScreen with chat interface
  - Implement message list with FlatList
  - Add text input with send button
  - _Requirements: 6.1_

- [ ] 18.2 Implement AI chat service
  - Create service to send messages to backend
  - Include sensor context in requests
  - Handle 5-second timeout
  - _Requirements: 6.2, 6.3_

- [ ] 18.3 Add markdown rendering for AI responses
  - Use react-native-markdown-display for formatting
  - _Requirements: 6.6_

- [ ] 18.4 Implement AI service unavailable handling
  - Show error message when Gemini API key not configured
  - _Requirements: 6.8_

- [ ] 18.5 Add loading indicator during AI response
  - Show typing indicator while waiting for response
  - _Requirements: 6.2_

### 19. Mobile Alert Configuration

- [ ] 19.1 Create alert configuration screen
  - Create AlertConfigScreen with threshold inputs
  - Add min/max inputs for each parameter (temperature, humidity, CO2, PM2.5, TVOC)
  - Add enable/disable toggle
  - _Requirements: 7.1, 7.4_

- [ ] 19.2 Implement alert configuration service
  - Create service to fetch and update alert config
  - Add validation for threshold values
  - _Requirements: 7.1_

- [ ] 19.3 Create alert history screen
  - Create AlertsListScreen with alert history
  - Show timestamp, parameter, value, threshold
  - Add acknowledge button
  - _Requirements: 7.5_

- [ ] 19.4 Implement local notifications
  - Set up Expo Notifications
  - Create service to schedule local notifications for alerts
  - _Requirements: 7.3_

- [ ] 19.5 Implement push notification handling
  - Register FCM token with backend
  - Handle incoming push notifications
  - Navigate to relevant screen on notification tap
  - _Requirements: 7.7_


### 20. Mobile Data Export

- [ ] 20.1 Create export screen
  - Create ExportScreen with date range picker
  - Add parameter selection checkboxes
  - Add format selection (CSV/PDF)
  - _Requirements: 8.3, 8.4_

- [ ] 20.2 Implement export service
  - Create service to request export from backend
  - Download generated file
  - Save to device storage
  - _Requirements: 8.1, 8.2, 8.5_

- [ ] 20.3 Implement native share functionality
  - Use Expo Sharing to share exported files
  - _Requirements: 8.6_

- [ ] 20.4 Add export progress indicator
  - Show loading state during export generation
  - Display timeout message if export takes > 10 seconds
  - _Requirements: 8.5_

### 21. Mobile Settings and Configuration

- [ ] 21.1 Create settings screen
  - Create SettingsScreen with configuration options
  - Add theme selector (light/dark/auto)
  - Add temperature unit selector (Celsius/Fahrenheit)
  - Add language selector (Portuguese/English)
  - _Requirements: 11.1, 11.2, 11.3_

- [ ]* 21.2 Write property test for temperature unit conversion
  - **Property 32: Temperature Unit Conversion**
  - **Validates: Requirements 11.2**

- [ ] 21.3 Implement settings persistence
  - Store settings in AsyncStorage
  - Apply settings on app launch
  - _Requirements: 11.1, 11.2, 11.3_

- [ ] 21.4 Add app information section
  - Display app version
  - Add links to privacy policy and terms
  - _Requirements: 11.4_

- [ ] 21.5 Implement logout functionality
  - Add logout button with confirmation dialog
  - Clear stored token and local data
  - Navigate to login screen
  - _Requirements: 11.5_

- [ ] 21.6 Add Gemini API key configuration
  - Add input field for API key
  - Store securely in SecureStore
  - _Requirements: 11.6_


### 22. Mobile Navigation and UI Polish

- [ ] 22.1 Set up main navigation structure
  - Create MainNavigator with bottom tabs
  - Add tabs: Dashboard, Scan, AI, Alerts, Settings
  - Configure tab icons and labels
  - _Requirements: 4.1_

- [ ] 22.2 Implement navigation between screens
  - Set up stack navigation for details screens
  - Add proper back button handling
  - _Requirements: 4.5_

- [ ] 22.3 Add theme support
  - Create theme provider with light/dark themes
  - Apply theme colors throughout app
  - Respect system theme when auto mode selected
  - _Requirements: 11.1_

- [ ] 22.4 Implement performance optimizations
  - Add React.memo to expensive components
  - Implement FlatList optimizations (getItemLayout, removeClippedSubviews)
  - Add image caching with expo-image
  - _Requirements: 14.1, 14.2, 14.7_

- [ ]* 22.5 Write property test for LRU cache eviction
  - **Property 33: LRU Cache Eviction**
  - **Validates: Requirements 14.7**

- [ ] 22.6 Add debouncing to search inputs
  - Implement 300ms debounce for search fields
  - _Requirements: 14.4_

- [ ] 22.7 Optimize memory usage
  - Profile app with React DevTools
  - Fix memory leaks in useEffect hooks
  - Ensure memory usage < 150MB
  - _Requirements: 14.5_

### 23. Mobile Testing

- [ ] 23.1 Set up mobile testing infrastructure
  - Configure Jest for React Native
  - Install React Native Testing Library
  - Set up fast-check for property-based testing
  - _Requirements: 1.1_

- [ ]* 23.2 Write unit tests for BLE scanner service
  - Test device discovery and filtering
  - Test permission handling
  - Test scan start/stop
  - _Requirements: 3.1, 3.2_

- [ ]* 23.3 Write unit tests for sync service
  - Test online/offline detection
  - Test pending operation queue
  - Test conflict resolution
  - _Requirements: 10.3, 10.6, 10.7_

- [ ]* 23.4 Write component tests for key screens
  - Test DashboardScreen rendering and interactions
  - Test SensorDetailsScreen with mock data
  - Test AlertConfigScreen form validation
  - _Requirements: 4.1, 5.1, 7.1_

- [ ] 23.5 Checkpoint - Ensure all mobile tests pass
  - Ensure all tests pass, ask the user if questions arise.


### 24. Web Platform Setup

- [ ] 24.1 Set up React web project with Vite
  - Create new Vite project with React and TypeScript
  - Configure vite.config.ts for PWA
  - Set up folder structure matching mobile app
  - _Requirements: 12.1, 12.3_

- [ ] 24.2 Install web dependencies
  - Install React Router for navigation
  - Install React Query for server state
  - Install Zustand for client state
  - Install Axios for API client
  - Install Vite PWA plugin
  - _Requirements: 12.1, 12.2_

- [ ] 24.3 Configure PWA manifest and service worker
  - Create manifest.json with app metadata
  - Configure service worker for offline support
  - Add install prompt handling
  - _Requirements: 12.4, 12.5_

- [ ] 24.4 Create shared API client
  - Reuse API client logic from mobile (adapt for web)
  - Configure base URL and interceptors
  - _Requirements: 12.2_

### 25. Web Authentication and Core Features

- [ ] 25.1 Create web authentication screens
  - Create Login and VerifyCode pages
  - Implement auth flow matching mobile
  - Use localStorage for token storage
  - _Requirements: 2.1, 2.2, 12.1_

- [ ] 25.2 Create web dashboard
  - Create Dashboard page with sensor list
  - Implement responsive grid layout
  - Add auto-refresh functionality
  - _Requirements: 4.1, 12.3_

- [ ] 25.3 Create web sensor details page
  - Create SensorDetails page with charts
  - Use recharts or Chart.js for visualizations
  - Implement responsive layout
  - _Requirements: 5.1, 5.2, 12.3_

- [ ] 25.4 Implement Web Bluetooth API integration
  - Create BLE scanner using Web Bluetooth API
  - Add browser compatibility check
  - Show informative message for unsupported browsers
  - _Requirements: 12.6, 12.7_

- [ ] 25.5 Create web AI assistant page
  - Create AI chat interface
  - Implement markdown rendering
  - _Requirements: 6.1, 6.6_

- [ ] 25.6 Create web alert configuration
  - Create alert config page
  - Implement threshold inputs and toggles
  - _Requirements: 7.1, 7.4_

- [ ] 25.7 Create web export functionality
  - Create export page with date range and format selection
  - Implement file download
  - _Requirements: 8.1, 8.2_


### 26. Web Offline Support and PWA Features

- [ ] 26.1 Implement IndexedDB for local storage
  - Create IndexedDB wrapper for sensor data caching
  - Implement same schema as mobile SQLite
  - _Requirements: 12.5_

- [ ] 26.2 Implement web sync service
  - Create sync service matching mobile implementation
  - Handle online/offline transitions
  - _Requirements: 10.3, 12.5_

- [ ] 26.3 Configure service worker caching strategies
  - Cache static assets (CSS, JS, images)
  - Implement network-first strategy for API calls
  - Add offline fallback page
  - _Requirements: 12.5_

- [ ] 26.4 Add PWA install prompt
  - Detect if app is installable
  - Show custom install prompt
  - _Requirements: 12.4_

### 27. Web Settings and Polish

- [ ] 27.1 Create web settings page
  - Create Settings page with theme, units, language
  - Match mobile settings functionality
  - Use localStorage for persistence
  - _Requirements: 11.1, 11.2, 11.3_

- [ ] 27.2 Implement responsive design
  - Ensure all pages work on desktop, tablet, mobile
  - Add mobile-first breakpoints
  - Test on various screen sizes
  - _Requirements: 12.3_

- [ ] 27.3 Add web-specific optimizations
  - Implement code splitting with React.lazy
  - Add loading states for lazy-loaded routes
  - Optimize bundle size
  - _Requirements: 14.3_

### 28. Web Testing

- [ ] 28.1 Set up web testing infrastructure
  - Configure Jest for React web
  - Install React Testing Library
  - Set up fast-check for property tests
  - _Requirements: 12.1_

- [ ]* 28.2 Write unit tests for web components
  - Test Dashboard page rendering
  - Test authentication flow
  - Test Web Bluetooth integration
  - _Requirements: 4.1, 2.1, 12.6_

- [ ]* 28.3 Write integration tests for PWA features
  - Test service worker caching
  - Test offline functionality
  - Test install prompt
  - _Requirements: 12.4, 12.5_

- [ ] 28.4 Checkpoint - Ensure all web tests pass
  - Ensure all tests pass, ask the user if questions arise.


### 29. Security Hardening

- [ ] 29.1 Implement HTTPS enforcement
  - Configure backend to redirect HTTP to HTTPS
  - Add HSTS headers
  - _Requirements: 15.1_

- [ ]* 29.2 Write property test for password hashing (if implemented)
  - **Property 34: Password Hashing Verification**
  - **Validates: Requirements 15.2**

- [ ] 29.3 Implement certificate pinning in mobile app
  - Add certificate pinning for API communication
  - Handle pinning failures gracefully
  - _Requirements: 15.6_

- [ ] 29.4 Security audit and penetration testing
  - Run npm audit on all projects
  - Test for common vulnerabilities (XSS, CSRF, SQL injection)
  - Fix identified issues
  - _Requirements: 15.5_

### 30. Performance Testing and Optimization

- [ ] 30.1 Conduct mobile performance testing
  - Test app startup time on mid-range devices
  - Profile memory usage during normal operation
  - Test list scrolling performance with 100+ items
  - _Requirements: 14.1, 14.2, 14.5_

- [ ] 30.2 Conduct backend performance testing
  - Load test API with 1000 concurrent users
  - Measure 95th percentile response times
  - Optimize slow queries
  - _Requirements: 14.6_

- [ ] 30.3 Optimize database queries
  - Add missing indexes based on query patterns
  - Optimize N+1 queries with Prisma includes
  - Ensure all queries < 100ms
  - _Requirements: 9.4, 14.6_

### 31. Documentation and Deployment

- [ ] 31.1 Write API documentation
  - Document all endpoints with request/response examples
  - Add authentication requirements
  - Document error codes
  - _Requirements: 9.3_

- [ ] 31.2 Create deployment guides
  - Write backend deployment guide (Docker, environment variables)
  - Write mobile app build guide (Expo EAS Build)
  - Write web deployment guide (Vercel/Netlify)
  - _Requirements: 1.4_

- [ ] 31.3 Create user documentation
  - Write user guide for mobile app features
  - Create troubleshooting guide
  - Document BLE device compatibility
  - _Requirements: 3.3_

- [ ] 31.4 Set up CI/CD pipelines
  - Configure GitHub Actions for backend tests
  - Configure EAS Build for mobile app
  - Configure automated web deployment
  - _Requirements: 1.7_


### 32. Final Integration and Testing

- [ ] 32.1 End-to-end integration testing
  - Test complete user flows across mobile, web, and backend
  - Test authentication flow end-to-end
  - Test BLE scanning and data sync
  - Test alert configuration and notifications
  - Test export functionality
  - _Requirements: 2.1, 3.1, 7.1, 8.1_

- [ ] 32.2 Cross-platform compatibility testing
  - Test mobile app on Android (API 24+) and iOS (13+)
  - Test web app on Chrome, Firefox, Safari, Edge
  - Test PWA installation on supported browsers
  - _Requirements: 1.1, 12.3, 12.4_

- [ ] 32.3 Offline/online transition testing
  - Test app behavior during network loss
  - Test sync after reconnection
  - Test conflict resolution scenarios
  - _Requirements: 10.3, 10.7_

- [ ] 32.4 Load and stress testing
  - Test backend with high concurrent user load
  - Test mobile app with large datasets (1000+ sensors)
  - Test rate limiting under load
  - _Requirements: 9.6, 14.6_

- [ ] 32.5 Accessibility testing
  - Test screen reader compatibility
  - Test keyboard navigation
  - Ensure proper contrast ratios
  - _Requirements: General best practice_

- [ ] 32.6 Final checkpoint - Complete system verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Property tests validate universal correctness properties (37 total)
- Unit tests validate specific examples and edge cases
- Implementation follows incremental approach: Backend → Mobile → Web → Testing
- All 15 requirements are covered across 32 major task groups
- Total of 37 property-based test tasks corresponding to design properties

## Implementation Order Rationale

1. **Backend First (Tasks 1-11)**: Establishes API foundation that both mobile and web depend on
2. **Mobile Core (Tasks 12-23)**: Implements primary user experience with native features
3. **Web Platform (Tasks 24-28)**: Extends functionality to web while reusing backend
4. **Security & Performance (Tasks 29-30)**: Hardens system after core features complete
5. **Documentation & Deployment (Task 31)**: Prepares for production release
6. **Final Integration (Task 32)**: Validates complete system end-to-end
