import { prisma } from '../utils/prisma';

const JAALEE_BASE = 'https://sensor.jaalee.com/v1/open';

export interface JaaleeDeviceItem {
  mac: string;
  temperature?: number;
  humidity?: number;
  power?: number;
  time?: number; // milliseconds
  createTime?: number;
  [key: string]: any;
}

export async function fetchAllDevices(token?: string): Promise<JaaleeDeviceItem[]> {
  const auth = token || process.env['JAALEE_TOKEN'];
  if (!auth) throw new Error('JAALEE_TOKEN not configured');

  const url = `${JAALEE_BASE}/data/all`;
  const res = await fetch(url, { headers: { Authorization: auth } });
  const body = await res.json();
  if (!body) throw new Error('Empty response from Jaalee API');
  if (body.code && String(body.code) !== '0') {
    throw new Error(`Jaalee API error: ${body.message || JSON.stringify(body)}`);
  }

  const items = body.data || [];
  return items as JaaleeDeviceItem[];
}

export async function importJaaleeToDb(items: JaaleeDeviceItem[]) {
  const results = [];
  for (const it of items) {
    const mac = it.mac || it.bleMac || it.serial || '';
    if (!mac) continue;

    // Find matching sensor by mac
    const sensor = await prisma.sensor.findFirst({ where: { mac } });
    if (!sensor) {
      // Skip devices that are not registered in our system
      continue;
    }

    const timestamp = (() => {
      const t = it.time ?? it.createTime ?? Date.now();
      // If timestamp looks like seconds, convert to ms
      return t > 1e12 ? new Date(t) : new Date(t);
    })();

    const temperature = typeof it.temperature !== 'undefined' ? Number(it.temperature) : null;
    const humidity = typeof it.humidity !== 'undefined' ? Number(it.humidity) : null;

    const reading = await prisma.sensorReading.create({
      data: {
        sensorId: sensor.id,
        timestamp,
        temperature: temperature === null ? null : temperature,
        humidity: humidity === null ? null : humidity,
        co2: typeof it.co2 !== 'undefined' ? Number(it.co2) : null,
        pm25: typeof it.pm25 !== 'undefined' ? Number(it.pm25) : null,
        tvoc: typeof it.tvocPpm !== 'undefined' ? Number(it.tvocPpm) : null,
        pressure: typeof it.pressure !== 'undefined' ? Number(it.pressure) : null,
        waterLevel: typeof it.water !== 'undefined' ? Number(it.water) : null,
      }
    });

    results.push(reading);
  }

  return results;
}

export default { fetchAllDevices, importJaaleeToDb };
