/**
 * Advertising parser for JHT / JAALEE and wifi-pt100 devices.
 * Tries to extract temperature and humidity when present in manufacturer/service data.
 */

function hexToBytes(hex: string) {
  const s = hex.replace(/[^0-9a-fA-F]/g, '');
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 2) out.push(parseInt(s.substr(i, 2), 16));
  return out;
}

function base64ToBytes(b64: string) {
  try {
    const atobFn = typeof atob !== 'undefined' ? atob : (globalThis as any).atob;
    if (typeof atobFn === 'function') {
      const bin = atobFn(b64);
      const bytes: number[] = [];
      for (let i = 0; i < bin.length; i++) bytes.push(bin.charCodeAt(i));
      return bytes;
    }
  } catch (e) { }
  return [];
}

function bytesToHex(bytes: number[]) {
  return bytes.map(b => (b < 16 ? '0' : '') + b.toString(16)).join('').toUpperCase();
}

function formatMacFromBytes(bytes: number[], offset: number) {
  if (offset + 5 >= bytes.length) return null;
  const macParts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const v = bytes[offset + i];
    if (typeof v !== 'number') return null;
    macParts.push(v.toString(16).padStart(2, '0').toUpperCase());
  }
  return macParts.join(':');
}

function normalizeMac(mac?: string | null) {
  if (!mac) return null;
  const compact = mac.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
  if (compact.length !== 12) return null;
  return compact.match(/.{1,2}/g)?.join(':') || null;
}

function decodeAnyToBytes(value: any): number[] {
  if (!value) return [];
  if (value instanceof ArrayBuffer) return Array.from(new Uint8Array(value));
  if (Array.isArray(value)) return value.filter(v => typeof v === 'number');
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return [];
    const hexCandidate = s.replace(/[^0-9A-Fa-f]/g, '');
    if (hexCandidate.length >= 2 && hexCandidate.length % 2 === 0 && hexCandidate.length === s.length) {
      return hexToBytes(hexCandidate);
    }
    if (/^[A-Za-z0-9+/=\r\n]+$/.test(s) && s.length % 4 === 0) {
      return base64ToBytes(s);
    }
  }
  return [];
}

function containsMarker(bytes: number[], a: number, b: number) {
  for (let i = 0; i < bytes.length - 1; i++) {
    if ((bytes[i] === a && bytes[i + 1] === b) || (bytes[i] === b && bytes[i + 1] === a)) return true;
  }
  return false;
}

function parseJaaleeIBeacon(bytes: number[]) {
  const startsWithIBeacon = (i: number) => {
    // Full AD structure snippet: FF 4C 00 02 15 ...
    if (i + 4 < bytes.length && bytes[i] === 0xFF && bytes[i + 1] === 0x4C && bytes[i + 2] === 0x00 && bytes[i + 3] === 0x02 && bytes[i + 4] === 0x15) {
      return { start: i + 1 };
    }
    // Manufacturer data may already begin at company id: 4C 00 02 15 ...
    if (i + 3 < bytes.length && bytes[i] === 0x4C && bytes[i + 1] === 0x00 && bytes[i + 2] === 0x02 && bytes[i + 3] === 0x15) {
      return { start: i };
    }
    return null;
  };

  for (let i = 0; i <= bytes.length - 25; i++) {
    const match = startsWithIBeacon(i);
    if (!match) continue;

    const base = match.start;
    // base points to 4C
    // layout from base: [4C 00 02 15] [UUID16] [major2] [minor2] [tx1]
    if (base + 24 >= bytes.length) continue;

    const uuidBytes = bytes.slice(base + 4, base + 20);
    if (uuidBytes.length !== 16) continue;
    const uuidHex = bytesToHex(uuidBytes).toUpperCase();
    const modelMarker = uuidHex.slice(-4);
    const isJaaleeUUID = uuidHex.includes('EBEFD083');
    if (!['F525', '39F5', '35F5'].includes(modelMarker) && !isJaaleeUUID) continue;

    const major = (bytes[base + 20] << 8) | bytes[base + 21];
    const minor = (bytes[base + 22] << 8) | bytes[base + 23];

    const out: any = {
      marker: modelMarker,
      uuidHex,
      major,
      minor,
      hasExplicitMac: false,
      type: modelMarker === 'F525' ? 'F525_GATEWAY' : modelMarker === '39F5' ? 'JHT_UP_39F5' : modelMarker === '35F5' ? 'WIFI_PT100_35F5' : 'JHT',
    };

    if (modelMarker === 'F525' || modelMarker === '39F5' || isJaaleeUUID) {
      const temperature = (major / 65535) * 175 - 45;
      const humidity = (minor / 65535) * 100;
      if (temperature >= -40 && temperature <= 125) out.temperature = Number(temperature.toFixed(2));
      if (humidity >= 0 && humidity <= 100) out.humidity = Number(humidity.toFixed(2));
    }

    return out;
  }
  return null;
}

function parseF525EmbeddedPayload(bytes: number[]) {
  // Common field shape seen in community parsers:
  // [battery(1)] [macReversed(6)] [tempRaw(2)] [humRaw(2)]

  // Strict block: if the buffer contains a ThermoBeacon signature early on, abort before falling back to F525
  for (let i = 0; i <= bytes.length - 4; i++) {
    if ((bytes[i] === 0x10 || bytes[i] === 0x11 || bytes[i] === 0x15) && bytes[i + 1] === 0x00 && bytes[i + 2] === 0x00 && bytes[i + 3] === 0x00) {
      return null;
    }
  }

  for (let i = 0; i <= bytes.length - 11; i++) {

    const battery = bytes[i];
    if (battery < 0 || battery > 100) continue;

    const macRev = bytes.slice(i + 1, i + 7);
    if (macRev.length !== 6) continue;
    const mac = [...macRev].reverse().map(v => v.toString(16).padStart(2, '0').toUpperCase()).join(':');

    const tRaw = readUint16BE(bytes, i + 7);
    const hRaw = readUint16BE(bytes, i + 9);
    if (tRaw === null || hRaw === null) continue;

    // Primary Jaalee/JHT formula from official examples
    const temperature = (tRaw / 65535) * 175 - 45;
    const humidity = (hRaw / 65535) * 100;
    if (temperature < -40 || temperature > 125 || humidity < 0 || humidity > 100) continue;

    return {
      type: 'F525_GATEWAY',
      mac,
      hasExplicitMac: true,
      batteryLevel: battery,
      temperature: Number(temperature.toFixed(2)),
      humidity: Number(humidity.toFixed(2)),
    };
  }
  return null;
}

function readUint16LE(bytes: number[], offset: number) {
  if (offset + 1 >= bytes.length) return null;
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readInt16LE(bytes: number[], offset: number) {
  if (offset + 1 >= bytes.length) return null;
  let v = bytes[offset] | (bytes[offset + 1] << 8);
  if (v & 0x8000) v = v - 0x10000;
  return v;
}

function parseThermoBeacon(bytes: number[]) {
  for (let i = 0; i <= bytes.length - 18; i++) {
    const isTB = (bytes[i] === 0x10 || bytes[i] === 0x11 || bytes[i] === 0x15) && bytes[i + 1] === 0x00 && bytes[i + 2] === 0x00 && bytes[i + 3] === 0x00;
    if (!isTB) continue;

    const macRev = bytes.slice(i + 4, i + 10);
    const mac = [...macRev].reverse().map(v => v.toString(16).padStart(2, '0').toUpperCase()).join(':');

    const vBattRaw = readUint16LE(bytes, i + 10);
    const tempRaw = readInt16LE(bytes, i + 12);
    const humRaw = readUint16LE(bytes, i + 14);

    if (vBattRaw === null || tempRaw === null || humRaw === null) continue;

    const temperature = tempRaw / 16.0;
    const humidity = humRaw / 16.0;

    if (vBattRaw < 1000 || vBattRaw > 4000) continue;
    if (temperature < -40 || temperature > 80) continue;
    if (humidity < 0 || humidity > 100) continue;

    let batteryLevel = Math.round(((vBattRaw - 2200) / 800) * 100);
    if (batteryLevel > 100) batteryLevel = 100;
    if (batteryLevel < 0) batteryLevel = 0;

    return {
      type: 'JHT',
      mac,
      hasExplicitMac: true,
      batteryLevel,
      temperature: Number(temperature.toFixed(2)),
      humidity: Number(humidity.toFixed(2)),
    };
  }
  return null;
}


function getAdvSignature(payloadCandidates: number[], localName: string, parsedIBeacon?: any) {
  const ib = parsedIBeacon || parseJaaleeIBeacon(payloadCandidates);
  if (ib?.uuidHex) {
    const suffix = (typeof ib.major === 'number' && typeof ib.minor === 'number')
      ? `-${ib.major}-${ib.minor}`
      : `-${ib.uuidHex.slice(-4)}`;
    return `ibeacon-${ib.uuidHex}${suffix}`;
  }
  const hex = bytesToHex(payloadCandidates || []);
  if (hex && hex.length >= 24) return `hex-${hex.slice(0, 24)}`;
  if (localName) return `name-${String(localName).toUpperCase()}`;
  return null;
}

function looksLikeJaalee(localName: string, payloadCandidates: number[][], rawHex: string) {
  if (localName && /F525|JHT|JAALEE|39F5|35F5|WIFI-PT100/i.test(localName)) return true;
  const hex = (rawHex || '').toUpperCase();
  if (hex.includes('4A41414C4545')) return true; // JAALEE
  for (const bytes of payloadCandidates) {
    if (parseJaaleeIBeacon(bytes)) return true;
    if (containsMarker(bytes, 0xF5, 0x25)) return true;
    if (containsMarker(bytes, 0x39, 0xF5)) return true;
    if (containsMarker(bytes, 0x35, 0xF5)) return true;
  }
  return false;
}

function parseKnownJaaleeLayouts(bytes: number[]) {
  const tb = parseThermoBeacon(bytes);
  if (tb) return tb;

  const f525Embedded = parseF525EmbeddedPayload(bytes);
  if (f525Embedded) return f525Embedded;

  const iBeacon = parseJaaleeIBeacon(bytes);
  if (iBeacon) return iBeacon;

  const markerAt = (offset: number, b0: number, b1: number) => {
    return offset + 1 < bytes.length && bytes[offset] === b0 && bytes[offset + 1] === b1;
  };

  const parseTempHumPair = (tempRaw: number | null, humRaw: number | null) => {
    if (tempRaw === null || humRaw === null) return null;
    const temperature = (tempRaw / 65535) * 175 - 45;
    const humidity = (humRaw / 65535) * 100;
    if (temperature < -40 || temperature > 125 || humidity < 0 || humidity > 100) return null;
    return {
      temperature: Number(temperature.toFixed(2)),
      humidity: Number(humidity.toFixed(2)),
    };
  };

  // Pattern from docs #1 (gateway scan payload): ... F525 TT TT HH HH ...
  for (let offset = 0; offset <= bytes.length - 6; offset++) {
    if (markerAt(offset, 0xF5, 0x25) || markerAt(offset, 0x25, 0xF5)) {
      const tempHum = parseTempHumPair(readUint16BE(bytes, offset + 2), readUint16BE(bytes, offset + 4));
      if (tempHum) {
        return {
          type: 'F525_GATEWAY',
          mac: null,
          hasExplicitMac: false,
          temperature: tempHum.temperature,
          humidity: tempHum.humidity,
        };
      }
    }
  }

  // Pattern from docs #2 (JHT-UP): ... 39F5 [optional 2 bytes] 39F5 TT TT HH HH ...
  for (let offset = 0; offset <= bytes.length - 12; offset++) {
    const is39f5 = markerAt(offset, 0x39, 0xF5) || markerAt(offset, 0xF5, 0x39);
    if (!is39f5) continue;

    const parseAt = (base: number) => {
      const tempHum = parseTempHumPair(readUint16BE(bytes, base), readUint16BE(bytes, base + 2));
      if (!tempHum) return null;
      // try mac right after temp/hum as in doc sample segment
      const macAfter = formatMacFromBytes(bytes, base + 4);
      return {
        type: 'JHT_UP_39F5',
        mac: macAfter,
        hasExplicitMac: false,
        temperature: tempHum.temperature,
        humidity: tempHum.humidity,
      };
    };

    // direct: 39F5 + temp/hum
    const direct = parseAt(offset + 2);
    if (direct) return direct;

    // nested marker: 39F5 xx xx 39F5 + temp/hum
    if (offset + 5 < bytes.length && (markerAt(offset + 4, 0x39, 0xF5) || markerAt(offset + 4, 0xF5, 0x39))) {
      const nested = parseAt(offset + 6);
      if (nested) return nested;
    }
  }

  // Pattern from docs #3 (WiFi-PT100): ... 35F5 [optional 2 bytes] 35F5 FLOAT32 ...
  for (let offset = 0; offset <= bytes.length - 10; offset++) {
    const is35f5 = markerAt(offset, 0x35, 0xF5) || markerAt(offset, 0xF5, 0x35);
    if (!is35f5) continue;

    const parseFloatAt = (base: number) => {
      const temp = readFloat32BE(bytes, base);
      if (temp === null || !Number.isFinite(temp)) return null;
      if (temp < -50 || temp > 150) return null;
      const macAfter = formatMacFromBytes(bytes, base + 4);
      return {
        type: 'WIFI_PT100_35F5',
        mac: macAfter,
        hasExplicitMac: false,
        temperature: Number(temp.toFixed(2)),
      };
    };

    const direct = parseFloatAt(offset + 2);
    if (direct) return direct;

    if (offset + 5 < bytes.length && (markerAt(offset + 4, 0x35, 0xF5) || markerAt(offset + 4, 0xF5, 0x35))) {
      const nested = parseFloatAt(offset + 6);
      if (nested) return nested;
    }
  }

  // Legacy/manufacturer pattern: [id(2)] [mac(6)] [temp/hum or float]
  for (let offset = 0; offset <= bytes.length - 12; offset++) {
    const manufacturerIdLE = (bytes[offset] | (bytes[offset + 1] << 8)) & 0xffff;
    const manufacturerIdBE = ((bytes[offset] << 8) | bytes[offset + 1]) & 0xffff;

    const isF525 = manufacturerIdLE === 0xF525 || manufacturerIdBE === 0xF525;
    const is39F5 = manufacturerIdLE === 0x39F5 || manufacturerIdBE === 0x39F5;
    const is35F5 = manufacturerIdLE === 0x35F5 || manufacturerIdBE === 0x35F5;

    if (isF525 || is39F5) {
      const mac = formatMacFromBytes(bytes, offset + 2);
      const tempHum = parseTempHumPair(readUint16BE(bytes, offset + 8), readUint16BE(bytes, offset + 10));
      if (!tempHum) continue;

      return {
        type: isF525 ? 'F525_GATEWAY' : 'JHT_UP_39F5',
        mac,
        hasExplicitMac: true,
        temperature: tempHum.temperature,
        humidity: tempHum.humidity,
      };
    }

    if (is35F5) {
      const mac = formatMacFromBytes(bytes, offset + 2);
      const temp = readFloat32BE(bytes, offset + 8);
      if (temp === null || !Number.isFinite(temp)) continue;
      if (temp < -50 || temp > 150) continue;

      return {
        type: 'WIFI_PT100_35F5',
        mac,
        hasExplicitMac: true,
        temperature: Number(temp.toFixed(2)),
      };
    }
  }

  return null;
}

function pickMacCandidateFromPayload(bytes: number[]) {
  const candidates = new Map<string, number>();

  const add = (mac: string | null, weight = 1) => {
    if (!mac) return;
    const n = normalizeMac(mac);
    if (!n) return;
    candidates.set(n, (candidates.get(n) || 0) + weight);
  };

  // all sliding windows as weak candidates
  for (let i = 0; i <= bytes.length - 6; i++) {
    const mac = formatMacFromBytes(bytes, i);
    const reversed = formatMacFromBytes([...bytes.slice(i, i + 6)].reverse(), 0);
    add(mac, 1);
    add(reversed, 1);
  }

  // stronger candidates around known markers
  const markerPairs: Array<[number, number]> = [[0xF5, 0x25], [0x39, 0xF5], [0x35, 0xF5]];
  for (let i = 0; i < bytes.length - 1; i++) {
    for (const [a, b] of markerPairs) {
      if ((bytes[i] === a && bytes[i + 1] === b) || (bytes[i] === b && bytes[i + 1] === a)) {
        add(formatMacFromBytes(bytes, i + 2), 4);
        add(formatMacFromBytes(bytes, i + 6), 4);
        if (i + 11 < bytes.length) {
          const reversed = formatMacFromBytes([...bytes.slice(i + 6, i + 12)].reverse(), 0);
          add(reversed, 3);
        }
      }
    }
  }

  let best: string | null = null;
  let bestScore = -1;
  for (const [mac, score] of candidates.entries()) {
    if (score > bestScore) {
      best = mac;
      bestScore = score;
    }
  }

  return best;
}

function readUint16BE(bytes: number[], offset: number) {
  if (offset + 1 >= bytes.length) return null;
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readFloat32BE(bytes: number[], offset: number) {
  if (offset + 3 >= bytes.length) return null;
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  for (let i = 0; i < 4; i++) view.setUint8(i, bytes[offset + i]);
  return view.getFloat32(0);
}

export function parseAdvertising(ad: any) {
  const localName = ad.localName || ad.name || ad.deviceName || '';
  const rawRssi = ad.rssi ?? ad.RSSI ?? ad.rssiValue;
  const rssi = typeof rawRssi === 'number' ? rawRssi : 0;
  const deviceId = ad.id || ad.deviceId || ad.uuid || localName || null;
  const macFromAddress = normalizeMac(ad.mac || ad.address || ad.deviceAddress || null);
  const macFromId = normalizeMac(typeof deviceId === 'string' ? deviceId : null);
  const mac = macFromAddress || macFromId;

  const payloadCandidates: number[][] = [];

  const pushPayload = (value: any) => {
    const decoded = decodeAnyToBytes(value);
    if (decoded.length) payloadCandidates.push(decoded);
  };

  pushPayload(ad.manufacturerData);

  if (ad.serviceData) {
    if (typeof ad.serviceData === 'object' && !Array.isArray(ad.serviceData)) {
      Object.values(ad.serviceData).forEach(v => pushPayload(v));
    } else {
      pushPayload(ad.serviceData);
    }
  }

  pushPayload(ad.scanRecord);
  pushPayload(ad.advertising);

  // Normalize possible hex payload sources
  let hexPayload = '';
  payloadCandidates.forEach(bytes => { hexPayload += bytesToHex(bytes); });

  // Ignore non-Jaalee-like packets to prevent random devices from appearing as sensors
  const jaaleeCandidate = looksLikeJaalee(localName, payloadCandidates, hexPayload);
  const serviceUuidSource = (() => {
    const uuids = ad?.serviceUUIDs || ad?.serviceUuids || ad?.uuids || [];
    if (Array.isArray(uuids)) return uuids.join(',');
    try { return JSON.stringify(uuids || ''); } catch (e) { return String(uuids || ''); }
  })();
  const hasJaaleeServiceHint = /d0611e78-bbb4-4591-a5f8-487910ae4366|9fa480e0-4967-4542-9390-d343dc5d04ae/i.test(String(serviceUuidSource));
  const hasThermoNameHint = /THERMOBEACON|JHT|JAALEE/i.test(String(localName || ''));
  const payloadMarkerHint = /4C000215|F525|39F5|35F5|4A41414C4545/i.test(String(hexPayload || ''));

  if (!(jaaleeCandidate || hasJaaleeServiceHint || hasThermoNameHint)) {
    // Controlled proximity fallback: allow only near BLE devices with sensor-specific hints.
    const nearBySignal = typeof rawRssi === 'number' && rawRssi >= -85;
    const hasMacLikeId = !!macFromId;
    const hasLikelySensorName = /JHT|JAALEE|THERMO|BEACON|F525|39F5|35F5|PT100/i.test(String(localName || ''));
    const hasLikelyBlePayload = payloadMarkerHint;
    const blockedByName = /EPSON|PRINTER|HP-|DESKTOP|LAPTOP|TV|SPEAKER/i.test(String(localName || ''));
    if (!(nearBySignal && hasMacLikeId && (hasLikelySensorName || hasLikelyBlePayload)) || blockedByName) return null;

    return {
      id: macFromId || deviceId,
      name: localName || ad.localName || ad.name || 'BLE',
      mac: macFromId || undefined,
      realMac: macFromId || undefined,
      rssi,
      raw: ad,
      rawHex: hexPayload || undefined,
      advSignature: macFromId ? `near-tail-${macFromId.replace(/:/g, '').slice(-4)}` : undefined,
      type: 'BLE_NEAR_CANDIDATE',
    };
  }

  let bestPayloadMac: string | null = null;
  for (const bytes of payloadCandidates) {
    const candidate = pickMacCandidateFromPayload(bytes);
    if (candidate) {
      bestPayloadMac = candidate;
      break;
    }
  }

  // First pass: strict Jaalee/JHT known layouts (stable MAC from payload, not random BLE id)
  for (const bytes of payloadCandidates) {
    const parsedKnown = parseKnownJaaleeLayouts(bytes);
    if (parsedKnown) {
      const payloadMac = pickMacCandidateFromPayload(bytes);
      const preferPayloadMac = !!parsedKnown?.hasExplicitMac;
      const stableMac = normalizeMac(parsedKnown.mac) || (preferPayloadMac ? payloadMac : null) || mac;
      const advSignature = getAdvSignature(bytes, localName || ad.localName || ad.name || '', parsedKnown);
      const parsed: any = {
        id: stableMac || deviceId,
        name: localName || ad.localName || ad.name || null,
        mac: stableMac,
        realMac: stableMac,
        rssi,
        raw: ad,
        rawHex: bytesToHex(bytes),
        advSignature,
        type: parsedKnown.type,
      };
      if (typeof parsedKnown.temperature === 'number') parsed.temperature = parsedKnown.temperature;
      if (typeof parsedKnown.humidity === 'number') parsed.humidity = parsedKnown.humidity;
      return parsed;
    }
  }

  // If we have any hex payload present, try generic numeric parsing first
  const hasStrongMarker = payloadCandidates.some(bytes => {
    return !!parseJaaleeIBeacon(bytes)
      || containsMarker(bytes, 0xF5, 0x25)
      || containsMarker(bytes, 0x39, 0xF5)
      || containsMarker(bytes, 0x35, 0xF5)
      || bytesToHex(bytes).includes('4A41414C4545');
  });

  if (hexPayload && hasStrongMarker && /JHT|JAALEE|THERMO|F525|39F5|35F5|PT100/i.test(String(localName || ''))) {
    try {
      const bytes = hexToBytes(hexPayload);
      // Try Jaalee/JHT numeric scan regardless of localName
      for (let i = 0; i < bytes.length - 3; i++) {
        const t = readUint16BE(bytes, i);
        if (t === null) continue;
        const temp = (t / 65535) * 175 - 45;
        if (temp > -40 && temp < 125) {
          for (let j = i + 2; j < Math.min(i + 8, bytes.length - 1); j++) {
            const h = readUint16BE(bytes, j);
            if (h === null) continue;
            const hum = (h / 65535) * 100;
            if (hum >= 0 && hum <= 100) {
              const parsed: any = { id: deviceId || localName || ad.deviceName, name: localName || ad.localName || ad.name || null, mac, rssi, raw: ad };
              parsed.type = 'JHT';
              parsed.temperature = Number(temp.toFixed(2));
              parsed.humidity = Number(hum.toFixed(2));
              parsed.rawHex = bytesToHex(bytes);
              parsed.advSignature = getAdvSignature(bytes, localName || ad.localName || ad.name || '');
              console.log('[bleParser] generic JHT parse', { mac, name: parsed.name, rawHex: parsed.rawHex, temperature: parsed.temperature, humidity: parsed.humidity });
              return parsed;
            }
          }
        }
      }

      // Try wifi-pt100 float32 pattern regardless of name
      for (let i = 0; i < bytes.length - 3; i++) {
        const f = readFloat32BE(bytes, i);
        if (f === null || !Number.isFinite(f)) continue;
        if (f > -50 && f < 150) {
          const parsed: any = { id: deviceId || localName || ad.deviceName, name: localName || ad.localName || ad.name || null, mac, rssi, raw: ad };
          parsed.type = 'WIFI_PT100';
          parsed.temperature = Number(f.toFixed(2));
          parsed.rawHex = bytesToHex(bytes);
          parsed.advSignature = getAdvSignature(bytes, localName || ad.localName || ad.name || '');
          console.log('[bleParser] generic WIFI_PT100 parse', { mac, name: parsed.name, rawHex: parsed.rawHex, temperature: parsed.temperature });
          return parsed;
        }
      }
    } catch (e) {
      // ignore and continue to heuristics
    }
  }

  // simple heuristics based on localName
  if (localName && /F525|JHT|JAALEE|39F5|35F5|WIFI-PT100/i.test(localName)) {
    const parsed: any = { id: deviceId || localName, name: localName, mac, rssi, raw: ad };

    // attempt to parse numeric readings from payload if available
    try {
      const bytes = hexToBytes(hexPayload);
      // Try Jaalee/JHT pattern: scan for two nearby uint16 values that map to plausible temp/humidity
      for (let i = 0; i < bytes.length - 3; i++) {
        const t = readUint16BE(bytes, i);
        if (t === null) continue;
        const temp = (t / 65535) * 175 - 45;
        if (temp > -40 && temp < 125) {
          // look ahead for humidity
          for (let j = i + 2; j < Math.min(i + 8, bytes.length - 1); j++) {
            const h = readUint16BE(bytes, j);
            if (h === null) continue;
            const hum = (h / 65535) * 100;
            if (hum >= 0 && hum <= 100) {
              parsed.type = 'JHT';
              parsed.temperature = Number(temp.toFixed(2));
              parsed.humidity = Number(hum.toFixed(2));
              parsed.rawHex = bytesToHex(bytes);
              console.log('[bleParser] detected JHT payload', { mac, name: localName, rawHex: parsed.rawHex, temperature: parsed.temperature, humidity: parsed.humidity });
              return parsed;
            }
          }
        }
      }

      // Try wifi-pt100: look for IEEE754 float32 that yields plausible temperature
      for (let i = 0; i < bytes.length - 3; i++) {
        const f = readFloat32BE(bytes, i);
        if (f === null || !Number.isFinite(f)) continue;
        if (f > -50 && f < 150) {
          parsed.type = 'WIFI_PT100';
          parsed.temperature = Number(f.toFixed(2));
          parsed.rawHex = bytesToHex(bytes);
          console.log('[bleParser] detected WIFI_PT100 payload', { mac, name: localName, rawHex: parsed.rawHex, temperature: parsed.temperature });
          return parsed;
        }
      }
    } catch (e) {
      // ignore parsing errors and fall back to simple type
    }

    // fallback: return basic device info when name suggests JHT
    parsed.type = parsed.type || (/F525/i.test(localName) ? 'F525' : 'JHT');
    console.log('[bleParser] heuristic parsed device', { mac, name: localName, type: parsed.type });
    return parsed;
  }

  // if manufacturer/service payload specifically contains ascii 'JAALEE' marker
  try {
    const hex = hexPayload.toUpperCase();
    if (hex.includes('4A41414C4545')) { // 'JAALEE' ASCII
      // attempt same parsing as above
      const bytes = hexToBytes(hex);
      for (let i = 0; i < bytes.length - 3; i++) {
        const t = readUint16BE(bytes, i);
        if (t === null) continue;
        const temp = (t / 65535) * 175 - 45;
        if (temp > -40 && temp < 125) {
          for (let j = i + 2; j < Math.min(i + 8, bytes.length - 1); j++) {
            const h = readUint16BE(bytes, j);
            if (h === null) continue;
            const hum = (h / 65535) * 100;
            if (hum >= 0 && hum <= 100) {
              const rawHex = bytesToHex(bytes);
              console.log('[bleParser] detected JAALEE marker payload', { mac, name: localName, rawHex, temperature: Number(temp.toFixed(2)), humidity: Number(hum.toFixed(2)) });
              return { id: deviceId || localName, name: localName || 'JAALEE', mac, rssi, type: 'JHT', temperature: Number(temp.toFixed(2)), humidity: Number(hum.toFixed(2)), rawHex };
            }
          }
        }
      }
    }
  } catch (e) { }

  // Last fallback: if localName contains a MAC string, expose it as realMac
  try {
    const byName = String(localName || '').match(/([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}/);
    if (byName) {
      const realMac = normalizeMac(byName[0]);
      if (realMac) {
        return { id: realMac, name: localName || null, mac: realMac, realMac, rssi, raw: ad, rawHex: hexPayload || undefined, type: 'JHT' };
      }
    }
  } catch (e) { }

  // Controlled fallback: expose Jaalee-like device even when numeric decoding fails
  // This prevents "Nenhum dispositivo encontrado" while still filtering non-Jaalee packets.
  const fallbackMac = mac || normalizeMac(bestPayloadMac);
  const fallbackSignature = payloadCandidates.length ? getAdvSignature(payloadCandidates[0], localName || ad.localName || ad.name || '') : null;
  return {
    id: fallbackMac || deviceId,
    name: localName || ad.localName || ad.name || 'JAALEE',
    mac: fallbackMac,
    realMac: fallbackMac || undefined,
    rssi,
    raw: ad,
    rawHex: hexPayload || undefined,
    advSignature: fallbackSignature || undefined,
    type: 'JHT_CANDIDATE',
  };

}
