# Prisma Database Schema

This directory contains the Prisma schema and migrations for the Climatic Pro backend.

## Schema Overview

The database schema includes the following models:

### Core Models

- **User**: User accounts with email/phone authentication
- **VerificationCode**: Temporary codes for authentication
- **Sensor**: IoT sensor devices (F525, 39F5, 35F5, JW-U)
- **SensorReading**: Time-series data from sensors
- **AlertConfig**: Alert threshold configuration per sensor
- **Alert**: Alert history when thresholds are exceeded
- **AuditLog**: Audit trail for sensitive operations
- **FCMToken**: Firebase Cloud Messaging tokens for push notifications

### Enums

- **DeviceType**: F525_GATEWAY, JHT_UP_39F5, WIFI_PT100_35F5, JW_U_WATER
- **AlertCondition**: ABOVE_MAX, BELOW_MIN
- **Platform**: ANDROID, IOS, WEB

## Performance Indexes

The schema includes optimized indexes for common query patterns:

- **User**: Indexed on email and phone for fast authentication lookups
- **VerificationCode**: Composite index on (identifier, expiresAt) for code validation
- **Sensor**: Indexed on userId, mac, and lastSeenAt for dashboard queries
- **SensorReading**: Composite index on (sensorId, timestamp) and standalone timestamp index for historical data queries
- **Alert**: Composite indexes on (userId, createdAt) and (sensorId, createdAt) for alert history
- **AuditLog**: Composite indexes on (userId, createdAt) and (action, createdAt) for audit queries
- **FCMToken**: Indexed on userId for notification delivery

## Database Setup

### Prerequisites

- PostgreSQL 15+ installed and running
- Node.js 20+ installed

### Initial Setup

1. Configure your database connection in `.env`:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/climatic_pro?schema=public"
   ```

2. Generate Prisma Client:
   ```bash
   npx prisma generate
   ```

3. Create the database and run migrations:
   ```bash
   npx prisma migrate dev --name init
   ```

### Common Commands

- **Generate Prisma Client**: `npx prisma generate`
- **Create migration**: `npx prisma migrate dev --name <migration_name>`
- **Apply migrations**: `npx prisma migrate deploy`
- **Reset database**: `npx prisma migrate reset`
- **Open Prisma Studio**: `npx prisma studio`
- **Format schema**: `npx prisma format`
- **Validate schema**: `npx prisma validate`

## Relationships

- User has many Sensors, Alerts, AuditLogs, and FCMTokens
- Sensor belongs to User and has many SensorReadings, Alerts, and one optional AlertConfig
- Alert belongs to User and Sensor
- SensorReading belongs to Sensor
- AlertConfig belongs to Sensor (one-to-one)
- AuditLog belongs to User
- FCMToken belongs to User

## Cascade Deletes

All foreign key relationships use `onDelete: Cascade` to ensure data integrity:
- Deleting a User will delete all their Sensors, Alerts, AuditLogs, and FCMTokens
- Deleting a Sensor will delete all its SensorReadings, AlertConfig, and Alerts
