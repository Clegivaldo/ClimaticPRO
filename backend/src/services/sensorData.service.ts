import { prisma } from '../utils/prisma';

/**
 * Service for managing sensor readings
 * Requirement 5.1: Implement sensor reading storage
 * Requirement 5.2: Implement historical data retrieval
 */

export interface CreateReadingData {
  sensorId: string;
  temperature?: number;
  humidity?: number;
  co2?: number;
  pm25?: number;
  tvoc?: number;
  pressure?: number;
  waterLevel?: number;
  timestamp?: Date;
}

export interface HistoryQueryParams {
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

/**
 * Store a single sensor reading
 */
export async function createReading(data: CreateReadingData) {
  return prisma.sensorReading.create({
    data: {
      sensorId: data.sensorId,
      temperature: data.temperature,
      humidity: data.humidity,
      co2: data.co2,
      pm25: data.pm25,
      tvoc: data.tvoc,
      pressure: data.pressure,
      waterLevel: data.waterLevel,
      timestamp: data.timestamp || new Date()
    }
  });
}

/**
 * Batch insert multiple readings
 */
export async function createReadingsBatch(readings: CreateReadingData[]) {
  return prisma.sensorReading.createMany({
    data: readings.map(r => ({
      sensorId: r.sensorId,
      temperature: r.temperature,
      humidity: r.humidity,
      co2: r.co2,
      pm25: r.pm25,
      tvoc: r.tvoc,
      pressure: r.pressure,
      waterLevel: r.waterLevel,
      timestamp: r.timestamp || new Date()
    }))
  });
}

/**
 * Get historical data for a sensor with filtering and pagination
 * Requirement 5.2: Query readings by date range
 * Requirement 5.4: Pagination support with 50 records per page
 */
export async function getSensorHistory(
  sensorId: string, 
  userId: string,
  params: HistoryQueryParams = {}
) {
  // Verify sensor ownership
  const sensor = await prisma.sensor.findFirst({
    where: { id: sensorId, userId }
  });

  if (!sensor) {
    throw new Error('Sensor not found or access denied');
  }

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, params.limit || 50);
  const skip = (page - 1) * limit;

  const where: any = { sensorId };

  if (params.startDate || params.endDate) {
    where.timestamp = {};
    if (params.startDate) where.timestamp.gte = params.startDate;
    if (params.endDate) where.timestamp.lte = params.endDate;
  }

  const [items, total] = await Promise.all([
    prisma.sensorReading.findMany({
      where,
      skip,
      take: limit,
      orderBy: { timestamp: 'desc' }
    }),
    prisma.sensorReading.count({ where })
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      hasMore: total > skip + items.length
    }
  };
}

/**
 * Get the latest reading for a sensor
 */
export async function getLatestReading(sensorId: string, userId: string) {
  // Verify sensor ownership
  const sensor = await prisma.sensor.findFirst({
    where: { id: sensorId, userId }
  });

  if (!sensor) {
    throw new Error('Sensor not found or access denied');
  }

  return prisma.sensorReading.findFirst({
    where: { sensorId },
    orderBy: { timestamp: 'desc' }
  });
}
