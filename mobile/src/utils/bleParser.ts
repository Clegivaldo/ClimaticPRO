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
    if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
      return Array.from(Buffer.from(b64, 'base64'));
    }
  } catch (e) {}
  try {
    const atobFn = typeof atob !== 'undefined' ? atob : (globalThis as any).atob;
    if (typeof atobFn === 'function') {
      const bin = atobFn(b64);
      const bytes: number[] = [];
      for (let i = 0; i < bin.length; i++) bytes.push(bin.charCodeAt(i));
      return bytes;
    }
  } catch (e) {}
  return [];
}

function bytesToHex(bytes: number[]) {
  return bytes.map(b => (b < 16 ? '0' : '') + b.toString(16)).join('').toUpperCase();
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
  const rssi = ad.rssi || ad.RSSI || ad.rssiValue || 0;
  const mac = ad.id || ad.mac || ad.address || null;

  // Normalize possible hex payload sources
  let hexPayload = '';
  if (ad.manufacturerData) {
    if (typeof ad.manufacturerData === 'string') {
      const s = ad.manufacturerData.trim();
      // detect base64
      if (/^[A-Za-z0-9+/=\r\n]+$/.test(s) && s.length % 4 === 0) {
        const bytes = base64ToBytes(s);
        if (bytes.length) hexPayload += bytesToHex(bytes);
        else hexPayload += s;
      } else {
        hexPayload += s;
      }
    } else if (ad.manufacturerData instanceof ArrayBuffer) hexPayload += bytesToHex(Array.from(new Uint8Array(ad.manufacturerData)));
    else if (Array.isArray(ad.manufacturerData)) hexPayload += bytesToHex(ad.manufacturerData);
  }
  if (ad.serviceData) {
    if (typeof ad.serviceData === 'string') hexPayload += ad.serviceData;
    else if (Array.isArray(ad.serviceData)) hexPayload += bytesToHex(ad.serviceData);
    else if (typeof ad.serviceData === 'object') {
      Object.values(ad.serviceData).forEach((v: any) => {
        if (typeof v === 'string') {
          const s = v.trim();
          if (/^[A-Za-z0-9+/=\r\n]+$/.test(s) && s.length % 4 === 0) {
            const bytes = base64ToBytes(s);
            if (bytes.length) hexPayload += bytesToHex(bytes);
            else hexPayload += s;
          } else hexPayload += s;
        }
      });
    }
  }
  if (ad.scanRecord) {
    if (typeof ad.scanRecord === 'string') hexPayload += ad.scanRecord;
    else if (ad.scanRecord instanceof ArrayBuffer) hexPayload += bytesToHex(Array.from(new Uint8Array(ad.scanRecord)));
  }
  if (!hexPayload && ad.advertising) {
    if (typeof ad.advertising === 'string') hexPayload += ad.advertising;
    else if (ad.advertising instanceof ArrayBuffer) hexPayload += bytesToHex(Array.from(new Uint8Array(ad.advertising)));
  }

  // If we have any hex payload present, try generic numeric parsing first
  if (hexPayload) {
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
              const parsed: any = { id: mac || localName || ad.deviceName, name: localName || ad.localName || ad.name || null, mac, rssi, raw: ad };
              parsed.type = 'JHT';
              parsed.temperature = Number(temp.toFixed(2));
              parsed.humidity = Number(hum.toFixed(2));
              parsed.rawHex = bytesToHex(bytes);
              console.log('[bleParser] generic JHT parse', { mac, name: parsed.name, rawHex: parsed.rawHex, temperature: parsed.temperature, humidity: parsed.humidity });
              return parsed;
            }
          }
        }
      }

      // Try wifi-pt100 float32 pattern regardless of name
      for (let i = 0; i < bytes.length - 3; i++) {
        const f = readFloat32BE(bytes, i);
        if (!Number.isFinite(f)) continue;
        if (f > -50 && f < 150) {
          const parsed: any = { id: mac || localName || ad.deviceName, name: localName || ad.localName || ad.name || null, mac, rssi, raw: ad };
          parsed.type = 'WIFI_PT100';
          parsed.temperature = Number(f.toFixed(2));
          parsed.rawHex = bytesToHex(bytes);
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
    const parsed: any = { id: mac || localName, name: localName, mac, rssi, raw: ad };

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
        if (!Number.isFinite(f)) continue;
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
    parsed.type = parsed.type || ( /F525/i.test(localName) ? 'F525' : 'JHT' );
    console.log('[bleParser] heuristic parsed device', { mac, name: localName, type: parsed.type });
    return parsed;
  }

  // Also, if we have hexPayload but no localName match, try to extract a stable MAC embedded in the payload
  try {
    const hex = hexPayload.toUpperCase();
    // look for a contiguous 12-hex sequence that could be a MAC without separators
    const macMatch = hex.match(/([0-9A-F]{12})/);
    if (macMatch) {
      const rawMac = macMatch[1];
      // format as XX:XX:XX:XX:XX:XX
      const formatted = rawMac.match(/.{1,2}/g)?.join(':');
      const parsed: any = { id: formatted || mac || localName, name: localName || null, mac: formatted || mac, rssi, raw: ad, rawHex: hex };
      // mark that this MAC was extracted from payload
      parsed.realMac = formatted || null;
      parsed.type = parsed.type || 'JHT';
      console.log('[bleParser] extracted realMac from payload', { formatted, rawHex: hex });
      return parsed;
    }
  } catch (e) {}

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
              return { id: mac || localName, name: localName || 'JAALEE', mac, rssi, type: 'JHT', temperature: Number(temp.toFixed(2)), humidity: Number(hum.toFixed(2)), rawHex };
            }
          }
        }
      }
    }
  } catch (e) {}

  return null;
}
