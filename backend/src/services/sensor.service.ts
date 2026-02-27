import { prisma } from '../utils/prisma';
import { DeviceType } from '@prisma/client';

/**
 * Service for managing sensors
 * Requirement 4.1: Implement sensor CRUD operations
 * Requirement 9.5: Support pagination in listings
 */

export interface CreateSensorData {
  userId: string;
  mac: string;
  alias?: string;
  deviceType: DeviceType;
}

export interface UpdateSensorData {
  alias?: string;
  isActive?: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * Create a new sensor for a user
 */
export async function createSensor(data: CreateSensorData) {
  return prisma.sensor.create({
    data: {
      userId: data.userId,
      mac: data.mac,
      alias: data.alias,
      deviceType: data.deviceType,
      // Initialize with default alert configuration
      alertConfig: {
        create: {
          isEnabled: true,
          cooldownMinutes: 15
        }
      }
    },
    include: {
      alertConfig: true
    }
  });
}

/**
 * Get all sensors for a user with pagination
 * Requirement 9.5: Pagination support with max 100 items per page
 */
export async function getSensors(userId: string, params: PaginationParams = {}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, params.limit || 50);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.sensor.findMany({
      where: { userId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        alertConfig: true
      }
    }),
    prisma.sensor.count({ where: { userId } })
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
 * Get a single sensor by ID
 */
export async function getSensorById(id: string, userId: string) {
  return prisma.sensor.findFirst({
    where: { id, userId },
    include: {
      alertConfig: true
    }
  });
}

/**
 * Update a sensor
 */
export async function updateSensor(id: string, userId: string, data: UpdateSensorData) {
  return prisma.sensor.updateMany({
    where: { id, userId },
    data: {
      alias: data.alias,
      isActive: data.isActive
    }
  });
}

/**
 * Delete a sensor
 */
export async function deleteSensor(id: string, userId: string) {
  return prisma.sensor.deleteMany({
    where: { id, userId }
  });
}
