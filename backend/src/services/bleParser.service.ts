/**
 * BLE Parser Service
 * 
 * Parses BLE advertising data from different sensor types:
 * - F525 (JHT Gateway): Temperature and humidity with formula conversion
 * - 39F5 (JHT-UP): Same format as F525
 * - 35F5 (Wifi-PT100): IEEE 754 32-bit float for temperature
 * - JW-U: Water sensors
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 3.3
 */

export enum DeviceType {
  F525_GATEWAY = 'F525_GATEWAY',
  JHT_UP_39F5 = 'JHT_UP_39F5',
  WIFI_PT100_35F5 = 'WIFI_PT100_35F5',
  JW_U_WATER = 'JW_U_WATER',
}

export interface ParsedSensorData {
  temperature?: number;
  humidity?: number;
  batteryLevel?: number;
  waterLevel?: number;
  mac: string;
}

export interface BLEAdvertisingData {
  manufacturerData?: Buffer;
  serviceData?: Record<string, Buffer>;
  localName?: string;
}

/**
 * Identifies device type from BLE advertising data
 * Requirement 3.3: Device type identification from advertising data
 */
export function identifyDeviceType(
  advertisingData: BLEAdvertisingData
): DeviceType | null {
  const { manufacturerData, serviceData, localName } = advertisingData;

  // Check manufacturer data for device type identifiers
  if (manufacturerData && manufacturerData.length >= 2) {
    const manufacturerId = manufacturerData.readUInt16LE(0);
    
    // F525 Gateway identifier
    if (manufacturerId === 0xF525) {
      return DeviceType.F525_GATEWAY;
    }
    
    // 39F5 (JHT-UP) identifier
    if (manufacturerId === 0x39F5) {
      return DeviceType.JHT_UP_39F5;
    }
    
    // 35F5 (Wifi-PT100) identifier
    if (manufacturerId === 0x35F5) {
      return DeviceType.WIFI_PT100_35F5;
    }
  }

  // Check service data for JW-U water sensors
  if (serviceData) {
    const jwuServiceUUID = '0000fff0-0000-1000-8000-00805f9b34fb';
    if (serviceData[jwuServiceUUID]) {
      return DeviceType.JW_U_WATER;
    }
  }

  // Check local name for device type hints
  if (localName) {
    if (localName.includes('JHT') || localName.includes('F525')) {
      return DeviceType.F525_GATEWAY;
    }
    if (localName.includes('39F5')) {
      return DeviceType.JHT_UP_39F5;
    }
    if (localName.includes('PT100') || localName.includes('35F5')) {
      return DeviceType.WIFI_PT100_35F5;
    }
    if (localName.includes('JW-U') || localName.includes('Water')) {
      return DeviceType.JW_U_WATER;
    }
  }

  return null;
}

/**
 * Extracts MAC address from advertising data
 */
function extractMAC(data: Buffer, offset: number = 0): string {
  if (data.length < offset + 6) {
    throw new Error('Insufficient data for MAC address extraction');
  }
  
  const macBytes = [];
  for (let i = 0; i < 6; i++) {
    const byte = data[offset + i];
    if (byte !== undefined) {
      macBytes.push(byte.toString(16).padStart(2, '0').toUpperCase());
    }
  }
  
  return macBytes.join(':');
}

/**
 * Parses F525 format (JHT Gateway)
 * Requirement 13.1: Temperature = (hex2dec / 65535) * 175 - 45
 *                   Humidity = (hex2dec / 65535) * 100
 */
function parseF525Format(data: Buffer): ParsedSensorData {
  // Expected format: [manufacturer_id(2)] [mac(6)] [temp(2)] [humidity(2)] [battery(1)]
  if (data.length < 13) {
    throw new Error('Insufficient data for F525 format');
  }

  const mac = extractMAC(data, 2);
  const tempRaw = data.readUInt16BE(8);
  const humRaw = data.readUInt16BE(10);
  const battery = data.length >= 13 ? data[12] : undefined;

  const temperature = parseFloat(((tempRaw / 65535) * 175 - 45).toFixed(2));
  const humidity = parseFloat(((humRaw / 65535) * 100).toFixed(2));

  return {
    temperature,
    humidity,
    batteryLevel: battery,
    mac,
  };
}

/**
 * Parses 39F5 format (JHT-UP)
 * Requirement 13.2: Same formula as F525
 */
function parse39F5Format(data: Buffer): ParsedSensorData {
  // Same format as F525
  return parseF525Format(data);
}

/**
 * Parses 35F5 format (Wifi-PT100)
 * Requirement 13.3: IEEE 754 32-bit float for temperature
 */
function parse35F5Format(data: Buffer): ParsedSensorData {
  // Expected format: [manufacturer_id(2)] [mac(6)] [temp_float(4)] [battery(1)]
  if (data.length < 12) {
    throw new Error('Insufficient data for 35F5 format');
  }

  const mac = extractMAC(data, 2);
  const temperature = parseFloat(data.readFloatBE(8).toFixed(2));
  const battery = data.length >= 13 ? data[12] : undefined;

  return {
    temperature,
    batteryLevel: battery,
    mac,
  };
}

/**
 * Parses JW-U format (Water sensors)
 * Requirement 13.4: JW-U water sensor format
 */
function parseJWUFormat(data: Buffer): ParsedSensorData {
  // Expected format: [mac(6)] [water_level(2)] [battery(1)]
  if (data.length < 9) {
    throw new Error('Insufficient data for JW-U format');
  }

  const mac = extractMAC(data, 0);
  const waterLevelRaw = data.readUInt16BE(6);
  const battery = data.length >= 9 ? data[8] : undefined;

  // Water level as percentage (0-100)
  const waterLevel = parseFloat(((waterLevelRaw / 65535) * 100).toFixed(2));

  return {
    waterLevel,
    batteryLevel: battery,
    mac,
  };
}

/**
 * Main parser function that routes to appropriate format parser
 * Requirement 3.4: Parse temperature and humidity from advertising packet
 * Requirement 13.5: Return values with 2 decimal precision
 * Requirement 13.6: Return undefined for unparseable values
 */
export function parseBLEData(
  advertisingData: BLEAdvertisingData,
  deviceType?: DeviceType
): ParsedSensorData | undefined {
  try {
    // Identify device type if not provided
    const type = deviceType || identifyDeviceType(advertisingData);
    
    if (!type) {
      return undefined;
    }

    // Get the data buffer to parse
    let dataBuffer: Buffer | undefined;
    
    if (advertisingData.manufacturerData) {
      dataBuffer = advertisingData.manufacturerData;
    } else if (advertisingData.serviceData) {
      const jwuServiceUUID = '0000fff0-0000-1000-8000-00805f9b34fb';
      dataBuffer = advertisingData.serviceData[jwuServiceUUID];
    }

    if (!dataBuffer) {
      return undefined;
    }

    // Route to appropriate parser based on device type
    switch (type) {
      case DeviceType.F525_GATEWAY:
        return parseF525Format(dataBuffer);
      
      case DeviceType.JHT_UP_39F5:
        return parse39F5Format(dataBuffer);
      
      case DeviceType.WIFI_PT100_35F5:
        return parse35F5Format(dataBuffer);
      
      case DeviceType.JW_U_WATER:
        return parseJWUFormat(dataBuffer);
      
      default:
        return undefined;
    }
  } catch (error) {
    // Requirement 13.6: Return undefined for malformed data
    console.error('BLE parsing error:', error);
    return undefined;
  }
}

/**
 * Encodes sensor data back into BLE advertising format
 * Used for testing round-trip parsing
 */
export function encodeBLEData(
  deviceType: DeviceType,
  sensorData: Partial<ParsedSensorData>
): Buffer {
  switch (deviceType) {
    case DeviceType.F525_GATEWAY:
    case DeviceType.JHT_UP_39F5: {
      const buffer = Buffer.alloc(13);
      const manufacturerId = deviceType === DeviceType.F525_GATEWAY ? 0xF525 : 0x39F5;
      
      buffer.writeUInt16LE(manufacturerId, 0);
      
      // Write MAC (dummy for testing)
      const macParts = (sensorData.mac || '00:00:00:00:00:00').split(':');
      for (let i = 0; i < 6; i++) {
        const macPart = macParts[i];
        if (macPart) {
          buffer[2 + i] = parseInt(macPart, 16);
        }
      }
      
      // Encode temperature: reverse formula (temp + 45) * 65535 / 175
      if (sensorData.temperature !== undefined) {
        const tempRaw = Math.round(((sensorData.temperature + 45) * 65535) / 175);
        buffer.writeUInt16BE(tempRaw, 8);
      }
      
      // Encode humidity: reverse formula humidity * 65535 / 100
      if (sensorData.humidity !== undefined) {
        const humRaw = Math.round((sensorData.humidity * 65535) / 100);
        buffer.writeUInt16BE(humRaw, 10);
      }
      
      // Battery level
      if (sensorData.batteryLevel !== undefined) {
        buffer[12] = sensorData.batteryLevel;
      }
      
      return buffer;
    }
    
    case DeviceType.WIFI_PT100_35F5: {
      const buffer = Buffer.alloc(13);
      
      buffer.writeUInt16LE(0x35F5, 0);
      
      // Write MAC (dummy for testing)
      const macParts = (sensorData.mac || '00:00:00:00:00:00').split(':');
      for (let i = 0; i < 6; i++) {
        const macPart = macParts[i];
        if (macPart) {
          buffer[2 + i] = parseInt(macPart, 16);
        }
      }
      
      // Write temperature as IEEE 754 float
      if (sensorData.temperature !== undefined) {
        buffer.writeFloatBE(sensorData.temperature, 8);
      }
      
      // Battery level
      if (sensorData.batteryLevel !== undefined) {
        buffer[12] = sensorData.batteryLevel;
      }
      
      return buffer;
    }
    
    case DeviceType.JW_U_WATER: {
      const buffer = Buffer.alloc(9);
      
      // Write MAC
      const macParts = (sensorData.mac || '00:00:00:00:00:00').split(':');
      for (let i = 0; i < 6; i++) {
        const macPart = macParts[i];
        if (macPart) {
          buffer[i] = parseInt(macPart, 16);
        }
      }
      
      // Encode water level: reverse formula waterLevel * 65535 / 100
      if (sensorData.waterLevel !== undefined) {
        const waterRaw = Math.round((sensorData.waterLevel * 65535) / 100);
        buffer.writeUInt16BE(waterRaw, 6);
      }
      
      // Battery level
      if (sensorData.batteryLevel !== undefined) {
        buffer[8] = sensorData.batteryLevel;
      }
      
      return buffer;
    }
    
    default:
      throw new Error(`Unsupported device type: ${deviceType}`);
  }
}
