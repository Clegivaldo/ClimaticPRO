import * as fc from 'fast-check';
import { generateCSV, generatePDF } from '../export.service';
import { prisma } from '../../utils/prisma';

// Mock prisma
jest.mock('../../utils/prisma', () => ({
  prisma: {
    sensor: {
      findFirst: jest.fn(),
    },
    sensorReading: {
      findMany: jest.fn(),
    },
  },
}));

describe('Export Service - Property Tests', () => {
  const userId = 'user-123';
  const sensorId = 'sensor-123';
  const mockSensor = { id: sensorId, alias: 'Living Room', deviceType: 'F525_GATEWAY' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Feature: cross-platform-mobile-app, Property 21: CSV Export Validity
  // Validates: Requirements 8.1, 8.3, 8.4
  it('should generate valid CSV with data and metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            timestamp: fc.date(),
            temperature: fc.float(),
            humidity: fc.float(),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (mockReadings) => {
          (prisma.sensor.findFirst as jest.Mock).mockResolvedValue(mockSensor);
          (prisma.sensorReading.findMany as jest.Mock).mockResolvedValue(mockReadings);

          const csv = await generateCSV({
            sensorId,
            userId,
            startDate: new Date(),
            endDate: new Date(),
            parameters: ['temperature', 'humidity']
          });

          expect(typeof csv).toBe('string');
          expect(csv).toContain('Living Room');
          expect(csv).toContain('temperature');
          expect(csv).toContain('humidity');
          
          // Verify that it contains data rows (not just metadata)
          const rows = csv.split('\n');
          expect(rows.length).toBeGreaterThan(5); // metadata lines + header + at least 1 data row
          
          jest.clearAllMocks();
        }
      )
    );
  });

  // Feature: cross-platform-mobile-app, Property 22: PDF Export Validity
  // Validates: Requirements 8.2, 8.3, 8.4
  it('should generate valid PDF buffer', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            timestamp: fc.date(),
            temperature: fc.float(),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (mockReadings) => {
          (prisma.sensor.findFirst as jest.Mock).mockResolvedValue(mockSensor);
          (prisma.sensorReading.findMany as jest.Mock).mockResolvedValue(mockReadings);

          const pdf = await generatePDF({
            sensorId,
            userId,
            startDate: new Date(),
            endDate: new Date(),
            parameters: ['temperature']
          });

          expect(Buffer.isBuffer(pdf)).toBe(true);
          expect(pdf.length).toBeGreaterThan(0);
          
          // PDF signature is %PDF-
          expect(pdf.toString('utf-8', 0, 5)).toBe('%PDF-');
          
          jest.clearAllMocks();
        }
      )
    );
  });

  // Feature: cross-platform-mobile-app, Property 23: Export Metadata Inclusion
  // Validates: Requirements 8.7
  it('should include metadata in exports', async () => {
    (prisma.sensor.findFirst as jest.Mock).mockResolvedValue(mockSensor);
    (prisma.sensorReading.findMany as jest.Mock).mockResolvedValue([]);

    const csv = await generateCSV({
      sensorId,
      userId,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-02'),
      parameters: ['temperature']
    });

    expect(csv).toContain('# Sensor: Living Room');
    expect(csv).toContain('# Start Date: 2024-01-01');
    expect(csv).toContain('# End Date: 2024-01-02');
  });
});
