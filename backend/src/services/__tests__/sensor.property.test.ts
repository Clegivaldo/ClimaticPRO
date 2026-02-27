import * as fc from 'fast-check';
import { DeviceType } from '@prisma/client';
import { 
  getSensors, 
  getSensorById, 
  updateSensor
} from '../sensor.service';
import { prisma } from '../../utils/prisma';

// Mock prisma
jest.mock('../../utils/prisma', () => ({
  prisma: {
    sensor: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

describe('Sensor Management Service - Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Feature: cross-platform-mobile-app, Property 12: Sensor Alias Update
  // Validates: Requirements 5.6
  it('should update sensor alias for any sensor and alias string', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // sensorId
        fc.uuid(), // userId
        fc.string({ minLength: 1, maxLength: 50 }), // new alias
        async (sensorId, userId, newAlias) => {
          (prisma.sensor.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
          
          await updateSensor(sensorId, userId, { alias: newAlias });
          
          expect(prisma.sensor.updateMany).toHaveBeenCalledWith({
            where: { id: sensorId, userId },
            data: { alias: newAlias, isActive: undefined }
          });
          
          jest.clearAllMocks();
        }
      )
    );
  });

  // Feature: cross-platform-mobile-app, Property 8: All User Sensors Displayed
  // Validates: Requirements 4.1
  it('should return all sensors for a user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.array(
          fc.record({
            id: fc.uuid(),
            mac: fc.string(),
            alias: fc.string(),
            deviceType: fc.constantFrom(...Object.values(DeviceType))
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (userId, mockSensors) => {
          (prisma.sensor.findMany as jest.Mock).mockResolvedValue(mockSensors);
          (prisma.sensor.count as jest.Mock).mockResolvedValue(mockSensors.length);
          
          const result = await getSensors(userId);
          
          expect(result.items).toHaveLength(mockSensors.length);
          expect(result.items).toEqual(mockSensors);
          expect(result.pagination.total).toBe(mockSensors.length);
          
          jest.clearAllMocks();
        }
      )
    );
  });

  // Feature: cross-platform-mobile-app, Property 7: Sensor Display Completeness
  // Validates: Requirements 3.5, 4.2, 5.1
  it('should return all required sensor fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // sensorId
        fc.uuid(), // userId
        async (sensorId, userId) => {
          const mockSensor = {
            id: sensorId,
            userId,
            mac: 'AA:BB:CC:DD:EE:FF',
            alias: 'Living Room',
            deviceType: DeviceType.F525_GATEWAY,
            isActive: true,
            lastSeenAt: new Date(),
            batteryLevel: 85,
            alertConfig: {
              isEnabled: true,
              cooldownMinutes: 15
            }
          };
          
          (prisma.sensor.findFirst as jest.Mock).mockResolvedValue(mockSensor);
          
          const result = await getSensorById(sensorId, userId);
          
          expect(result).toBeDefined();
          if (result) {
            expect(result.id).toBe(sensorId);
            expect(result.mac).toBeDefined();
            expect(result.deviceType).toBeDefined();
            expect(result.alias).toBeDefined();
            expect(result.batteryLevel).toBeDefined();
            expect(result.lastSeenAt).toBeDefined();
            expect(result.alertConfig).toBeDefined();
          }
          
          jest.clearAllMocks();
        }
      )
    );
  });

  // Feature: cross-platform-mobile-app, Property 24: API Pagination Limit
  // Validates: Requirements 9.5
  it('should cap pagination limit at 100 items', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.integer({ min: 101, max: 1000 }), // large limit
        async (userId, largeLimit) => {
          (prisma.sensor.findMany as jest.Mock).mockResolvedValue([]);
          (prisma.sensor.count as jest.Mock).mockResolvedValue(0);
          
          await getSensors(userId, { limit: largeLimit });
          
          const findManyCall = (prisma.sensor.findMany as jest.Mock).mock.calls[0][0];
          expect(findManyCall.take).toBe(100);
          
          jest.clearAllMocks();
        }
      )
    );
  });
});
