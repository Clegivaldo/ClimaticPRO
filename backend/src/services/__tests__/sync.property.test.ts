import * as fc from 'fast-check';
import { processBatchSync } from '../sync.service';
import { prisma } from '../../utils/prisma';

// Mock prisma
jest.mock('../../utils/prisma', () => ({
  prisma: {
    $transaction: jest.fn().mockImplementation((callback) => callback(prisma)),
    sensor: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    sensorReading: {
      create: jest.fn(),
    },
    alertConfig: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    }
  },
}));

describe('Sync Service - Property Tests', () => {
  const userId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Feature: cross-platform-mobile-app, Property 31: Sync Conflict Resolution (Last Write Wins)
  // Validates: Requirements 10.7
  it('should apply last-write-wins for sensor updates', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.date(), // existing remote timestamp
        fc.date(), // incoming local timestamp
        async (remoteTime, localTime) => {
          const sensorId = 's1';
          const payload = { alias: 'New Alias' };
          
          (prisma.sensor.findUnique as jest.Mock).mockResolvedValue({
            id: sensorId,
            updatedAt: remoteTime
          });

          const result = await processBatchSync(userId, [
            {
              type: 'update',
              resource: 'sensor',
              resourceId: sensorId,
              payload,
              timestamp: localTime
            }
          ]);

          if (localTime > remoteTime) {
            // Should update
            expect(prisma.sensor.upsert).toHaveBeenCalledWith(expect.objectContaining({
              where: { id: sensorId },
              update: expect.objectContaining({ ...payload, updatedAt: localTime })
            }));
          } else {
            // Should NOT update (remote is newer or same)
            expect(prisma.sensor.upsert).not.toHaveBeenCalled();
          }
          
          expect(result.success).toBe(1);
          
          jest.clearAllMocks();
        }
      )
    );
  });

  it('should process operations in chronological order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: fc.constant('create' as const),
            resource: fc.constant('reading' as const),
            resourceId: fc.uuid(),
            payload: fc.record({ temperature: fc.float() }),
            timestamp: fc.date()
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (operations) => {
          (prisma.sensorReading.create as jest.Mock).mockResolvedValue({});

          await processBatchSync(userId, operations);

          // Verify chronological order
          const callTimestamps = (prisma.sensorReading.create as jest.Mock).mock.calls.map(c => c[0].data.timestamp);
          const sortedTimestamps = [...callTimestamps].sort((a, b) => a.getTime() - b.getTime());
          
          expect(callTimestamps).toEqual(sortedTimestamps);
          
          jest.clearAllMocks();
        }
      )
    );
  });
});
