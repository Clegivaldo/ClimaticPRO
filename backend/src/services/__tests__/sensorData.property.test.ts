import * as fc from 'fast-check';
import { getSensorHistory } from '../sensorData.service';
import { prisma } from '../../utils/prisma';

// Mock prisma
jest.mock('../../utils/prisma', () => ({
  prisma: {
    sensor: {
      findFirst: jest.fn(),
    },
    sensorReading: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

describe('Sensor Data Service - Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Feature: cross-platform-mobile-app, Property 11: Pagination Chunk Size
  // Validates: Requirements 5.4
  it('should cap pagination limit at 100 items and default to 50', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // sensorId
        fc.uuid(), // userId
        fc.integer({ min: 1, max: 200 }), // provided limit
        async (sensorId, userId, providedLimit) => {
          (prisma.sensor.findFirst as jest.Mock).mockResolvedValue({ id: sensorId });
          (prisma.sensorReading.findMany as jest.Mock).mockResolvedValue([]);
          (prisma.sensorReading.count as jest.Mock).mockResolvedValue(0);
          
          await getSensorHistory(sensorId, userId, { limit: providedLimit });
          
          const findManyCall = (prisma.sensorReading.findMany as jest.Mock).mock.calls[0][0];
          const expectedLimit = Math.min(100, providedLimit || 50);
          expect(findManyCall.take).toBe(expectedLimit);
          
          jest.clearAllMocks();
        }
      )
    );
  });

  // Feature: cross-platform-mobile-app, Property 10: Historical Data Period Filtering
  // Validates: Requirements 5.2
  it('should apply correct date filters for historical data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // sensorId
        fc.uuid(), // userId
        fc.date(), // startDate
        fc.date(), // endDate
        async (sensorId, userId, startDate, endDate) => {
          // Ensure startDate <= endDate for meaningful test
          const start = startDate < endDate ? startDate : endDate;
          const end = startDate < endDate ? endDate : startDate;
          
          (prisma.sensor.findFirst as jest.Mock).mockResolvedValue({ id: sensorId });
          (prisma.sensorReading.findMany as jest.Mock).mockResolvedValue([]);
          (prisma.sensorReading.count as jest.Mock).mockResolvedValue(0);
          
          await getSensorHistory(sensorId, userId, { startDate: start, endDate: end });
          
          const findManyCall = (prisma.sensorReading.findMany as jest.Mock).mock.calls[0][0];
          expect(findManyCall.where.timestamp.gte).toEqual(start);
          expect(findManyCall.where.timestamp.lte).toEqual(end);
          
          jest.clearAllMocks();
        }
      )
    );
  });

  // Feature: cross-platform-mobile-app, Property 13: Timestamp Localization
  // Validates: Requirements 5.7
  it('should return valid Date objects for sensor reading timestamps', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // sensorId
        fc.uuid(), // userId
        fc.date(), // mock timestamp
        async (sensorId, userId, mockTimestamp) => {
          (prisma.sensor.findFirst as jest.Mock).mockResolvedValue({ id: sensorId });
          (prisma.sensorReading.findMany as jest.Mock).mockResolvedValue([
            { id: '1', sensorId, timestamp: mockTimestamp }
          ]);
          (prisma.sensorReading.count as jest.Mock).mockResolvedValue(1);
          
          const result = await getSensorHistory(sensorId, userId);
          
          const firstItem = result.items[0];
          expect(firstItem).toBeDefined();
          if (firstItem) {
            expect(firstItem.timestamp).toBeInstanceOf(Date);
            expect(firstItem.timestamp.getTime()).toBe(mockTimestamp.getTime());
          }
          
          jest.clearAllMocks();
        }
      )
    );
  });
});
