import * as fc from 'fast-check';
import { 
  updateAlertConfig, 
  checkReadingForAlerts,
  getAlertHistory
} from '../alert.service';
import { prisma } from '../../utils/prisma';
import { AlertCondition } from '@prisma/client';

// Mock prisma
jest.mock('../../utils/prisma', () => ({
  prisma: {
    sensor: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    alertConfig: {
      upsert: jest.fn(),
    },
    alert: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

describe('Alert System Service - Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Feature: cross-platform-mobile-app, Property 17: Alert Threshold Configuration
  // Validates: Requirements 7.1
  it('should store and retrieve alert thresholds for any parameter', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // sensorId
        fc.uuid(), // userId
        fc.record({
          tempMin: fc.oneof(fc.constant(undefined), fc.float()),
          tempMax: fc.oneof(fc.constant(undefined), fc.float()),
          humidityMin: fc.oneof(fc.constant(undefined), fc.float()),
          humidityMax: fc.oneof(fc.constant(undefined), fc.float()),
          co2Max: fc.oneof(fc.constant(undefined), fc.float()),
        }),
        async (sensorId, userId, thresholds) => {
          (prisma.sensor.findFirst as jest.Mock).mockResolvedValue({ id: sensorId });
          (prisma.alertConfig.upsert as jest.Mock).mockResolvedValue({});
          
          await updateAlertConfig(sensorId, userId, thresholds);
          
          expect(prisma.alertConfig.upsert).toHaveBeenCalledWith({
            where: { sensorId },
            create: expect.objectContaining(thresholds),
            update: expect.objectContaining(thresholds)
          });
          
          jest.clearAllMocks();
        }
      )
    );
  });

  // Feature: cross-platform-mobile-app, Property 18: Alert Toggle State
  // Validates: Requirements 7.4
  it('should toggle alert enabled state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // sensorId
        fc.uuid(), // userId
        fc.boolean(), // isEnabled
        async (sensorId, userId, isEnabled) => {
          (prisma.sensor.findFirst as jest.Mock).mockResolvedValue({ id: sensorId });
          (prisma.alertConfig.upsert as jest.Mock).mockResolvedValue({});
          
          await updateAlertConfig(sensorId, userId, { isEnabled });
          
          expect(prisma.alertConfig.upsert).toHaveBeenCalledWith({
            where: { sensorId },
            create: expect.objectContaining({ isEnabled }),
            update: expect.objectContaining({ isEnabled })
          });
          
          jest.clearAllMocks();
        }
      )
    );
  });

  // Feature: cross-platform-mobile-app, Property 15: Automatic Dangerous Value Alerts
  // Validates: Requirements 6.4, 7.2
  it('should trigger automatic alerts for dangerous values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          co2: fc.float({ min: 1001, max: 5000, noNaN: true, noDefaultInfinity: true }),
          humidity: fc.oneof(
            fc.float({ min: 0, max: 29, noNaN: true, noDefaultInfinity: true }), 
            fc.float({ min: 71, max: 100, noNaN: true, noDefaultInfinity: true })
          )
        }),
        async (dangerousValues) => {
          jest.clearAllMocks();
          
          const mockSensor = {
            id: 's1',
            userId: 'u1',
            alertConfig: { isEnabled: true, cooldownMinutes: 15 }
          };
          
          (prisma.sensor.findUnique as jest.Mock).mockResolvedValue(mockSensor);
          (prisma.alert.findFirst as jest.Mock).mockResolvedValue(null); // No recent alert (no cooldown)
          (prisma.alert.create as jest.Mock).mockResolvedValue({ id: 'a1' });

          const reading: any = { sensorId: 's1', ...dangerousValues, timestamp: new Date() };
          await checkReadingForAlerts(reading);
          
          // Verify at least one of the dangerous values triggered an alert
          const triggeredParams = (prisma.alert.create as jest.Mock).mock.calls.map(c => c[0].data.parameter);
          expect(triggeredParams.length).toBeGreaterThan(0);
          
          const expectedParams = ['co2', 'humidity'].filter(p => dangerousValues[p as keyof typeof dangerousValues] !== undefined);
          expect(triggeredParams).toEqual(expect.arrayContaining(expectedParams));
        }
      )
    );
  });

  // Feature: cross-platform-mobile-app, Property 20: Alert Cooldown Enforcement
  // Validates: Requirements 7.6
  it('should suppress alerts within cooldown period', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 14 }), // minutes since last alert (less than 15)
        async (minutesAgo) => {
          const mockSensor = {
            id: 's1',
            userId: 'u1',
            alertConfig: { isEnabled: true, cooldownMinutes: 15 }
          };
          
          const lastAlert = {
            createdAt: new Date(Date.now() - minutesAgo * 60 * 1000),
            parameter: 'co2',
            condition: AlertCondition.ABOVE_MAX
          };
          
          (prisma.sensor.findUnique as jest.Mock).mockResolvedValue(mockSensor);
          (prisma.alert.findFirst as jest.Mock).mockResolvedValue(lastAlert);
          
          const reading: any = { sensorId: 's1', co2: 2000, timestamp: new Date() };
          const alerts = await checkReadingForAlerts(reading);
          
          expect(alerts).toHaveLength(0);
          expect(prisma.alert.create).not.toHaveBeenCalled();
          
          jest.clearAllMocks();
        }
      )
    );
  });

  // Feature: cross-platform-mobile-app, Property 9: Alert Indicators for Threshold Violations
  // Validates: Requirements 4.4
  it('should trigger alerts for any threshold violation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tempMin: fc.constant(20),
          tempMax: fc.constant(30),
          isEnabled: fc.constant(true),
          cooldownMinutes: fc.constant(0) // No cooldown for this test
        }),
        fc.oneof(
           fc.record({ temperature: fc.float({ min: 0, max: 19, noNaN: true, noDefaultInfinity: true }) }), // Below min
           fc.record({ temperature: fc.float({ min: 31, max: 100, noNaN: true, noDefaultInfinity: true }) }) // Above max
         ),
        async (config, readingData) => {
          jest.clearAllMocks();
          
          const mockSensor = {
            id: 's1',
            userId: 'u1',
            alertConfig: config
          };
          
          (prisma.sensor.findUnique as jest.Mock).mockResolvedValue(mockSensor);
          (prisma.alert.findFirst as jest.Mock).mockResolvedValue(null);
          (prisma.alert.create as jest.Mock).mockResolvedValue({ id: 'a1' });

          const reading: any = { sensorId: 's1', ...readingData, timestamp: new Date() };
          await checkReadingForAlerts(reading);
          
          expect(prisma.alert.create).toHaveBeenCalled();
          const createCall = (prisma.alert.create as jest.Mock).mock.calls[0][0];
          expect(createCall.data.parameter).toBe('temperature');
          
          if (readingData.temperature < 20) {
            expect(createCall.data.condition).toBe(AlertCondition.BELOW_MIN);
          } else {
            expect(createCall.data.condition).toBe(AlertCondition.ABOVE_MAX);
          }
        }
      )
    );
  });

  // Feature: cross-platform-mobile-app, Property 19: Alert History Completeness
  // Validates: Requirements 7.5
  it('should return all alert history for a user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.array(
          fc.record({
            id: fc.uuid(),
            parameter: fc.string(),
            value: fc.float(),
            createdAt: fc.date()
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (userId, mockAlerts) => {
          (prisma.alert.findMany as jest.Mock).mockResolvedValue(mockAlerts);
          (prisma.alert.count as jest.Mock).mockResolvedValue(mockAlerts.length);
          
          const result = await getAlertHistory(userId);
          
          expect(result.items).toHaveLength(mockAlerts.length);
          expect(result.pagination.total).toBe(mockAlerts.length);
          
          jest.clearAllMocks();
        }
      )
    );
  });
});
