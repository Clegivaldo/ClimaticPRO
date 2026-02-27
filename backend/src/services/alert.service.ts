import { prisma } from '../utils/prisma';
import { AlertCondition, SensorReading } from '@prisma/client';
import { sendUserNotification } from './notification.service';

/**
 * Service for managing alerts and alert configurations
 * Requirement 6.4: Automatic dangerous value detection
 * Requirement 7.1: Alert threshold configuration
 * Requirement 7.4: Enable/disable alerts
 * Requirement 7.6: Cooldown enforcement (15 minutes)
 */

export interface UpdateAlertConfigData {
  isEnabled?: boolean;
  tempMin?: number;
  tempMax?: number;
  humidityMin?: number;
  humidityMax?: number;
  co2Max?: number;
  pm25Max?: number;
  tvocMax?: number;
  cooldownMinutes?: number;
}

/**
 * Get alert configuration for a sensor
 */
export async function getAlertConfig(sensorId: string, userId: string) {
  // Verify ownership
  const sensor = await prisma.sensor.findFirst({
    where: { id: sensorId, userId },
    include: { alertConfig: true }
  });

  if (!sensor) {
    throw new Error('Sensor not found or access denied');
  }

  return sensor.alertConfig;
}

/**
 * Update alert configuration for a sensor
 */
export async function updateAlertConfig(
  sensorId: string, 
  userId: string, 
  data: UpdateAlertConfigData
) {
  // Verify ownership
  const sensor = await prisma.sensor.findFirst({
    where: { id: sensorId, userId }
  });

  if (!sensor) {
    throw new Error('Sensor not found or access denied');
  }

  return prisma.alertConfig.upsert({
    where: { sensorId },
    create: {
      ...data,
      sensorId
    },
    update: data
  });
}

/**
 * Check a sensor reading against its alert configuration
 * Requirement 6.4: CO2 > 1000, Humidity < 30% or > 70%
 * Requirement 7.2: Trigger alerts on threshold violations
 * Requirement 7.6: Cooldown enforcement
 */
export async function checkReadingForAlerts(reading: SensorReading) {
  const sensor = await prisma.sensor.findUnique({
    where: { id: reading.sensorId },
    include: { alertConfig: true, user: true }
  });

  if (!sensor || !sensor.alertConfig || !sensor.alertConfig.isEnabled) {
    return [];
  }

  const config = sensor.alertConfig;
  const alertsToTrigger: any[] = [];

  // 1. Check custom thresholds
  checkThreshold(alertsToTrigger, reading, config, 'temperature', 'tempMin', 'tempMax');
  checkThreshold(alertsToTrigger, reading, config, 'humidity', 'humidityMin', 'humidityMax');
  checkMaxThreshold(alertsToTrigger, reading, config, 'co2', 'co2Max');
  checkMaxThreshold(alertsToTrigger, reading, config, 'pm25', 'pm25Max');
  checkMaxThreshold(alertsToTrigger, reading, config, 'tvoc', 'tvocMax');

  // 2. Check automatic dangerous values (Requirement 6.4)
  if (reading.co2 !== null && reading.co2 > 1000) {
    addAlertIfNotPresent(alertsToTrigger, reading, 'co2', reading.co2, 1000, AlertCondition.ABOVE_MAX);
  }
  if (reading.humidity !== null && (reading.humidity < 30 || reading.humidity > 70)) {
    const condition = reading.humidity < 30 ? AlertCondition.BELOW_MIN : AlertCondition.ABOVE_MAX;
    const threshold = reading.humidity < 30 ? 30 : 70;
    addAlertIfNotPresent(alertsToTrigger, reading, 'humidity', reading.humidity, threshold, condition);
  }

  if (alertsToTrigger.length === 0) return [];

  // 3. Filter by cooldown (Requirement 7.6)
  const now = new Date();
  const cooldownMs = config.cooldownMinutes * 60 * 1000;
  
  const finalAlerts = [];
  for (const alertData of alertsToTrigger) {
    const lastAlert = await prisma.alert.findFirst({
      where: {
        sensorId: reading.sensorId,
        parameter: alertData.parameter,
        condition: alertData.condition
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!lastAlert || (now.getTime() - lastAlert.createdAt.getTime()) > cooldownMs) {
      const createdAlert = await prisma.alert.create({
        data: {
          ...alertData,
          userId: sensor.userId,
          sensorId: reading.sensorId
        }
      });
      finalAlerts.push(createdAlert);
      
      // TODO: Requirement 7.7: Send push notification via FCM
      await sendAlertNotification(sensor.userId, createdAlert);
    }
  }

  return finalAlerts;
}

function checkThreshold(
  alerts: any[], 
  reading: any, 
  config: any, 
  param: string, 
  minKey: string, 
  maxKey: string
) {
  const val = reading[param];
  if (val === null || val === undefined) return;

  if (config[minKey] !== null && config[minKey] !== undefined && val < config[minKey]) {
    addAlertIfNotPresent(alerts, reading, param, val, config[minKey], AlertCondition.BELOW_MIN);
  }
  if (config[maxKey] !== null && config[maxKey] !== undefined && val > config[maxKey]) {
    addAlertIfNotPresent(alerts, reading, param, val, config[maxKey], AlertCondition.ABOVE_MAX);
  }
}

function checkMaxThreshold(
  alerts: any[], 
  reading: any, 
  config: any, 
  param: string, 
  maxKey: string
) {
  const val = reading[param];
  if (val === null || val === undefined) return;

  if (config[maxKey] !== null && config[maxKey] !== undefined && val > config[maxKey]) {
    addAlertIfNotPresent(alerts, reading, param, val, config[maxKey], AlertCondition.ABOVE_MAX);
  }
}

function addAlertIfNotPresent(
  alerts: any[], 
  _reading: any, 
  param: string, 
  val: number, 
  threshold: number, 
  condition: AlertCondition
) {
  const exists = alerts.some(a => a.parameter === param && a.condition === condition);
  if (!exists) {
    alerts.push({
      parameter: param,
      value: val,
      threshold,
      condition
    });
  }
}

/**
 * Get alert history for a user
 * Requirement 7.5: Alert history with timestamp
 */
export async function getAlertHistory(userId: string, params: { page?: number, limit?: number } = {}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, params.limit || 50);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.alert.findMany({
      where: { userId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { sensor: true }
    }),
    prisma.alert.count({ where: { userId } })
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
 * Acknowledge an alert
 */
export async function acknowledgeAlert(alertId: string, userId: string) {
  return prisma.alert.updateMany({
    where: { id: alertId, userId },
    data: {
      isAcknowledged: true,
      acknowledgedAt: new Date()
    }
  });
}

/**
 * Send alert notifications to the user
 * Requirement 7.7: Push notifications via FCM
 */
async function sendAlertNotification(userId: string, alert: any) {
  const title = `Alert: ${alert.parameter.toUpperCase()}`;
  const body = `${alert.parameter} is ${alert.condition.toLowerCase().replace('_', ' ')} threshold (${alert.value} vs ${alert.threshold})`;
  
  await sendUserNotification(userId, title, body, {
    type: 'alert',
    alertId: alert.id,
    sensorId: alert.sensorId,
    parameter: alert.parameter
  });
}
