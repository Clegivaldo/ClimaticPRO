import { prisma } from '../utils/prisma';

/**
 * Service for handling synchronization from mobile/web clients
 * Requirement 10.3: Batch sync endpoint
 * Requirement 10.6: Queue offline operations
 * Requirement 10.7: Last-write-wins conflict resolution
 */

export interface SyncOperation {
  type: 'create' | 'update' | 'delete';
  resource: 'sensor' | 'reading' | 'alert_config';
  resourceId: string;
  payload: any;
  timestamp: Date;
}

export async function processBatchSync(userId: string, operations: SyncOperation[]) {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as any[]
  };

  // Sort operations by timestamp to ensure correct order
  const sortedOps = [...operations].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Use a transaction for atomic operations
  return prisma.$transaction(async (tx) => {
    for (const op of sortedOps) {
      try {
        switch (op.resource) {
          case 'sensor':
            await handleSensorSync(tx, userId, op);
            break;
          case 'reading':
            await handleReadingSync(tx, op);
            break;
          case 'alert_config':
            await handleAlertConfigSync(tx, userId, op);
            break;
        }
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push({ op, error: error.message });
      }
    }
    return results;
  });
}

async function handleSensorSync(tx: any, userId: string, op: SyncOperation) {
  const { type, resourceId, payload, timestamp } = op;

  if (type === 'create' || type === 'update') {
    // Last-write-wins: Only update if timestamp is strictly newer
    const existing = await tx.sensor.findUnique({ where: { id: resourceId } });
    if (existing && existing.updatedAt.getTime() >= timestamp.getTime()) {
      return; // Remote is newer or same, skip
    }

    await tx.sensor.upsert({
      where: { id: resourceId },
      create: {
        ...payload,
        id: resourceId,
        userId,
        updatedAt: timestamp
      },
      update: {
        ...payload,
        updatedAt: timestamp
      }
    });
  } else if (type === 'delete') {
    await tx.sensor.deleteMany({
      where: { id: resourceId, userId }
    });
  }
}

async function handleReadingSync(tx: any, op: SyncOperation) {
  const { type, payload } = op;
  if (type === 'create') {
    await tx.sensorReading.create({
      data: payload
    });
  }
}

async function handleAlertConfigSync(tx: any, userId: string, op: SyncOperation) {
  const { type, resourceId, payload, timestamp } = op;
  
  // Verify sensor ownership
  const sensor = await tx.sensor.findFirst({
    where: { id: payload.sensorId, userId }
  });
  if (!sensor) throw new Error('Sensor not found or access denied');

  if (type === 'create' || type === 'update') {
    const existing = await tx.alertConfig.findUnique({ where: { id: resourceId } });
    if (existing && existing.updatedAt.getTime() >= timestamp.getTime()) {
      return;
    }

    await tx.alertConfig.upsert({
      where: { id: resourceId },
      create: {
        ...payload,
        id: resourceId,
        updatedAt: timestamp
      },
      update: {
        ...payload,
        updatedAt: timestamp
      }
    });
  }
}
