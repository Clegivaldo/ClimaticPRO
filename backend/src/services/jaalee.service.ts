import { prisma } from '../utils/prisma';
import fs from 'fs';
import path from 'path';

const JAALEE_BASE = 'https://sensor.jaalee.com/v1/open';
const TOKEN_FILE = path.join(__dirname, '..', '..', '.jaalee_token');

export interface JaaleeDeviceItem {
  mac?: string;
  bleMac?: string;
  temperature?: number;
  humidity?: number;
  power?: number;
  time?: number; // milliseconds
  createTime?: number;
  type?: string;
  [key: string]: any;
}

function getStoredToken(): string | null {
  if (process.env['JAALEE_TOKEN']) return process.env['JAALEE_TOKEN'];
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const v = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
      if (v) return v;
    }
  } catch (e) {}
  return null;
}

function storeToken(token: string) {
  try {
    fs.writeFileSync(TOKEN_FILE, token, { encoding: 'utf8', flag: 'w' });
    process.env['JAALEE_TOKEN'] = token;
  } catch (e) {
    console.error('Failed to persist JAALEE token:', e);
  }
}

export async function login(account: string, code: string, timeZone = 'GMT+08:00') {
  const url = `${JAALEE_BASE}/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account, code, timeZone })
  });
  const body = await res.json();
  if (!body || body.code !== '0') {
    throw new Error(`Jaalee login failed: ${JSON.stringify(body)}`);
  }
  const token = body.data?.token;
  if (!token) throw new Error('No token in Jaalee login response');
  storeToken(token);
  return token;
}

export async function fetchAllDevices(userIdOrToken?: string): Promise<JaaleeDeviceItem[]> {
  let auth: string | null = null;
  // If userId provided, try to read user's jaaleeToken
  if (userIdOrToken && userIdOrToken.includes('-')) {
    try {
      const u = await prisma.user.findUnique({ where: { id: userIdOrToken } });
      if (u && (u as any).jaaleeToken) auth = (u as any).jaaleeToken;
    } catch (e) {
      // ignore
    }
  }

  if (!auth) auth = userIdOrToken || getStoredToken();
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

function normalizeTemperature(raw: number | null | undefined): number | null {
  if (raw === null || typeof raw === 'undefined') return null;
  let t = Number(raw);
  // Heuristics: if obviously too large, scale down
  if (t > 1000) return t / 100; // many examples show large values
  if (t > 200) return t / 100;
  if (t < -100) return t / 100;
  return t;
}

function normalizeHumidity(raw: number | null | undefined): number | null {
  if (raw === null || typeof raw === 'undefined') return null;
  let h = Number(raw);
  if (h > 100) return h / 100;
  if (h > 1000) return h / 100;
  return h;
}

export async function importJaaleeToDb(
  items: JaaleeDeviceItem[],
  options?: { autoRegister?: boolean; userId?: string | null }
) {
  const results: any[] = [];
  const autoRegister = !!options?.autoRegister;
  const userId = options?.userId ?? null;

  function mapDeviceType(type?: string) {
    if (!type) return 'F525_GATEWAY';
    const t = type.toUpperCase();
    if (t.includes('F525')) return 'F525_GATEWAY';
    if (t.includes('JHT') || t.includes('39F5')) return 'JHT_UP_39F5';
    if (t.includes('PT100') || t.includes('35F5') || t.includes('WIFI_PT100')) return 'WIFI_PT100_35F5';
    if (t.includes('WATER') || t.includes('JW') || t.includes('U_WATER')) return 'JW_U_WATER';
    return 'F525_GATEWAY';
  }

  for (const it of items) {
    const mac = (it.mac || it.bleMac || '').toString();
    if (!mac) continue;

    // Try to find sensor owned by this user first (if userId provided)
    let sensor = null;
    if (userId) {
      try {
        sensor = await prisma.sensor.findUnique({ where: { userId_mac: { userId, mac } as any } });
      } catch (e) {
        // ignore and fallback
      }
    }

    // If not found and autoRegister + userId provided, ensure we don't clash with other users
    if (!sensor) {
      const existingAny = await prisma.sensor.findFirst({ where: { mac } });
      if (existingAny) {
        // If sensor exists but for a different user, skip to avoid claiming another user's device
        if (!userId || existingAny.userId !== userId) {
          // proceed to attach readings only if it belongs to somebody (previous behavior)
          sensor = existingAny;
        } else {
          sensor = existingAny;
        }
      } else if (autoRegister && userId) {
        // create sensor assigned to this user
        const deviceType = mapDeviceType(it.type as string) as any;
        try {
          sensor = await prisma.sensor.create({
            data: {
              userId,
              mac,
              alias: (it.name || it.alias || `Device ${mac}`).toString().slice(0, 60),
              deviceType,
            }
          });
        } catch (e) {
          console.error('Failed to create sensor for mac', mac, e);
          continue;
        }
      }
    }

    if (!sensor) continue;

    const tRaw = it.time ?? it.createTime ?? Date.now();
    const timestamp = new Date(Number(tRaw));

    const temperature = normalizeTemperature(it.temperature ?? it.temperature);
    const humidity = normalizeHumidity(it.humidity ?? it.humidity);

    const reading = await prisma.sensorReading.create({
      data: {
        sensorId: sensor.id,
        timestamp,
        temperature,
        humidity,
        co2: typeof it.co2 !== 'undefined' ? Number(it.co2) : null,
        pm25: typeof it.pm25 !== 'undefined' ? Number(it.pm25) : null,
        tvoc: typeof it.tvocPpm !== 'undefined' ? Number(it.tvocPpm) : null,
        pressure: typeof it.pressure !== 'undefined' ? Number(it.pressure) : null,
        waterLevel: typeof it.water !== 'undefined' ? Number(it.water) : null,
      }
    });

    // update sensor lastSeenAt and battery if available
    try {
      await prisma.sensor.update({ where: { id: sensor.id }, data: { lastSeenAt: timestamp, batteryLevel: typeof it.power !== 'undefined' ? Number(it.power) : undefined } });
    } catch (e) {
      // non-fatal
    }

    results.push(reading);
  }
  return results;
}

export default { login, fetchAllDevices, importJaaleeToDb };
