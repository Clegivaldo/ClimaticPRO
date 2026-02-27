/**
 * Unit tests for BLE Parser Service
 * Tests parsing of different device types and edge cases
 */

import {
  DeviceType,
  identifyDeviceType,
  parseBLEData,
  encodeBLEData,
  BLEAdvertisingData,
  ParsedSensorData,
} from '../bleParser.service';

describe('BLE Parser Service', () => {
  describe('identifyDeviceType', () => {
    it('should identify F525 Gateway from manufacturer ID', () => {
      const data: BLEAdvertisingData = {
        manufacturerData: Buffer.from([0x25, 0xF5, 0x00, 0x00]),
      };
      expect(identifyDeviceType(data)).toBe(DeviceType.F525_GATEWAY);
    });

    it('should identify JHT-UP 39F5 from manufacturer ID', () => {
      const data: BLEAdvertisingData = {
        manufacturerData: Buffer.from([0xF5, 0x39, 0x00, 0x00]),
      };
      expect(identifyDeviceType(data)).toBe(DeviceType.JHT_UP_39F5);
    });

    it('should identify Wifi-PT100 35F5 from manufacturer ID', () => {
      const data: BLEAdvertisingData = {
        manufacturerData: Buffer.from([0xF5, 0x35, 0x00, 0x00]),
      };
      expect(identifyDeviceType(data)).toBe(DeviceType.WIFI_PT100_35F5);
    });

    it('should identify JW-U from service data', () => {
      const data: BLEAdvertisingData = {
        serviceData: {
          '0000fff0-0000-1000-8000-00805f9b34fb': Buffer.from([0x00]),
        },
      };
      expect(identifyDeviceType(data)).toBe(DeviceType.JW_U_WATER);
    });

    it('should identify device from local name', () => {
      expect(identifyDeviceType({ localName: 'JHT-Sensor' })).toBe(
        DeviceType.F525_GATEWAY
      );
      expect(identifyDeviceType({ localName: 'Device-39F5' })).toBe(
        DeviceType.JHT_UP_39F5
      );
      expect(identifyDeviceType({ localName: 'PT100-Temp' })).toBe(
        DeviceType.WIFI_PT100_35F5
      );
      expect(identifyDeviceType({ localName: 'JW-U-Water-01' })).toBe(
        DeviceType.JW_U_WATER
      );
    });

    it('should return null for unknown device', () => {
      const data: BLEAdvertisingData = {
        manufacturerData: Buffer.from([0xFF, 0xFF]),
      };
      expect(identifyDeviceType(data)).toBeNull();
    });
  });

  describe('parseBLEData - F525 Format', () => {
    it('should parse F525 temperature and humidity correctly', () => {
      // Create test data: temp = 25°C, humidity = 60%
      // tempRaw = (25 + 45) * 65535 / 175 = 26214
      // humRaw = 60 * 65535 / 100 = 39321
      const buffer = Buffer.alloc(13);
      buffer.writeUInt16LE(0xF525, 0); // Manufacturer ID
      // MAC: AA:BB:CC:DD:EE:FF
      buffer[2] = 0xAA;
      buffer[3] = 0xBB;
      buffer[4] = 0xCC;
      buffer[5] = 0xDD;
      buffer[6] = 0xEE;
      buffer[7] = 0xFF;
      buffer.writeUInt16BE(26214, 8); // Temperature
      buffer.writeUInt16BE(39321, 10); // Humidity
      buffer[12] = 85; // Battery 85%

      const result = parseBLEData(
        { manufacturerData: buffer },
        DeviceType.F525_GATEWAY
      );

      expect(result).toBeDefined();
      expect(result?.temperature).toBeCloseTo(25, 1);
      expect(result?.humidity).toBeCloseTo(60, 1);
      expect(result?.batteryLevel).toBe(85);
      expect(result?.mac).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('should handle extreme temperature values', () => {
      // Test minimum temperature: -45°C
      const bufferMin = Buffer.alloc(13);
      bufferMin.writeUInt16LE(0xF525, 0);
      for (let i = 2; i < 8; i++) bufferMin[i] = 0x00;
      bufferMin.writeUInt16BE(0, 8); // tempRaw = 0 -> -45°C
      bufferMin.writeUInt16BE(0, 10);

      const resultMin = parseBLEData(
        { manufacturerData: bufferMin },
        DeviceType.F525_GATEWAY
      );
      expect(resultMin?.temperature).toBeCloseTo(-45, 1);

      // Test maximum temperature: 130°C
      const bufferMax = Buffer.alloc(13);
      bufferMax.writeUInt16LE(0xF525, 0);
      for (let i = 2; i < 8; i++) bufferMax[i] = 0x00;
      bufferMax.writeUInt16BE(65535, 8); // tempRaw = 65535 -> 130°C
      bufferMax.writeUInt16BE(0, 10);

      const resultMax = parseBLEData(
        { manufacturerData: bufferMax },
        DeviceType.F525_GATEWAY
      );
      expect(resultMax?.temperature).toBeCloseTo(130, 1);
    });
  });

  describe('parseBLEData - 39F5 Format', () => {
    it('should parse 39F5 with same formula as F525', () => {
      const buffer = Buffer.alloc(13);
      buffer.writeUInt16LE(0x39F5, 0);
      for (let i = 2; i < 8; i++) buffer[i] = 0x11;
      buffer.writeUInt16BE(26214, 8); // 25°C
      buffer.writeUInt16BE(39321, 10); // 60%
      buffer[12] = 90;

      const result = parseBLEData(
        { manufacturerData: buffer },
        DeviceType.JHT_UP_39F5
      );

      expect(result).toBeDefined();
      expect(result?.temperature).toBeCloseTo(25, 1);
      expect(result?.humidity).toBeCloseTo(60, 1);
      expect(result?.batteryLevel).toBe(90);
    });
  });

  describe('parseBLEData - 35F5 Format', () => {
    it('should parse 35F5 IEEE 754 float temperature', () => {
      const buffer = Buffer.alloc(13);
      buffer.writeUInt16LE(0x35F5, 0);
      // MAC
      for (let i = 2; i < 8; i++) buffer[i] = 0x22;
      buffer.writeFloatBE(23.45, 8); // Temperature as float
      buffer[12] = 75;

      const result = parseBLEData(
        { manufacturerData: buffer },
        DeviceType.WIFI_PT100_35F5
      );

      expect(result).toBeDefined();
      expect(result?.temperature).toBeCloseTo(23.45, 2);
      expect(result?.batteryLevel).toBe(75);
      expect(result?.humidity).toBeUndefined();
    });

    it('should handle negative temperatures', () => {
      const buffer = Buffer.alloc(13);
      buffer.writeUInt16LE(0x35F5, 0);
      for (let i = 2; i < 8; i++) buffer[i] = 0x00;
      buffer.writeFloatBE(-15.5, 8);
      buffer[12] = 80;

      const result = parseBLEData(
        { manufacturerData: buffer },
        DeviceType.WIFI_PT100_35F5
      );

      expect(result?.temperature).toBeCloseTo(-15.5, 2);
    });
  });

  describe('parseBLEData - JW-U Format', () => {
    it('should parse JW-U water level', () => {
      const buffer = Buffer.alloc(9);
      // MAC
      for (let i = 0; i < 6; i++) buffer[i] = 0x33;
      buffer.writeUInt16BE(32768, 6); // 50% water level
      buffer[8] = 95;

      const result = parseBLEData(
        {
          serviceData: {
            '0000fff0-0000-1000-8000-00805f9b34fb': buffer,
          },
        },
        DeviceType.JW_U_WATER
      );

      expect(result).toBeDefined();
      expect(result?.waterLevel).toBeCloseTo(50, 1);
      expect(result?.batteryLevel).toBe(95);
      expect(result?.temperature).toBeUndefined();
      expect(result?.humidity).toBeUndefined();
    });

    it('should handle empty and full water levels', () => {
      // Empty (0%)
      const bufferEmpty = Buffer.alloc(9);
      for (let i = 0; i < 6; i++) bufferEmpty[i] = 0x00;
      bufferEmpty.writeUInt16BE(0, 6);
      bufferEmpty[8] = 50;

      const resultEmpty = parseBLEData(
        {
          serviceData: {
            '0000fff0-0000-1000-8000-00805f9b34fb': bufferEmpty,
          },
        },
        DeviceType.JW_U_WATER
      );
      expect(resultEmpty?.waterLevel).toBeCloseTo(0, 1);

      // Full (100%)
      const bufferFull = Buffer.alloc(9);
      for (let i = 0; i < 6; i++) bufferFull[i] = 0x00;
      bufferFull.writeUInt16BE(65535, 6);
      bufferFull[8] = 50;

      const resultFull = parseBLEData(
        {
          serviceData: {
            '0000fff0-0000-1000-8000-00805f9b34fb': bufferFull,
          },
        },
        DeviceType.JW_U_WATER
      );
      expect(resultFull?.waterLevel).toBeCloseTo(100, 1);
    });
  });

  describe('Error Handling', () => {
    it('should return undefined for malformed data', () => {
      const shortBuffer = Buffer.from([0x25, 0xF5]); // Too short
      const result = parseBLEData(
        { manufacturerData: shortBuffer },
        DeviceType.F525_GATEWAY
      );
      expect(result).toBeUndefined();
    });

    it('should return undefined when no data buffer available', () => {
      const result = parseBLEData({}, DeviceType.F525_GATEWAY);
      expect(result).toBeUndefined();
    });

    it('should return undefined for unknown device type', () => {
      const buffer = Buffer.alloc(13);
      const result = parseBLEData({ manufacturerData: buffer });
      expect(result).toBeUndefined();
    });
  });

  describe('Round-trip encoding and parsing', () => {
    it('should encode and parse F525 data consistently', () => {
      const original: ParsedSensorData = {
        temperature: 22.5,
        humidity: 55.3,
        batteryLevel: 80,
        mac: 'AA:BB:CC:DD:EE:FF',
      };

      const encoded = encodeBLEData(DeviceType.F525_GATEWAY, original);
      const parsed = parseBLEData(
        { manufacturerData: encoded },
        DeviceType.F525_GATEWAY
      );

      expect(parsed).toBeDefined();
      expect(parsed?.temperature).toBeCloseTo(original.temperature!, 1);
      expect(parsed?.humidity).toBeCloseTo(original.humidity!, 1);
      expect(parsed?.batteryLevel).toBe(original.batteryLevel);
      expect(parsed?.mac).toBe(original.mac);
    });

    it('should encode and parse 35F5 data consistently', () => {
      const original: ParsedSensorData = {
        temperature: -10.75,
        batteryLevel: 65,
        mac: '11:22:33:44:55:66',
      };

      const encoded = encodeBLEData(DeviceType.WIFI_PT100_35F5, original);
      const parsed = parseBLEData(
        { manufacturerData: encoded },
        DeviceType.WIFI_PT100_35F5
      );

      expect(parsed).toBeDefined();
      expect(parsed?.temperature).toBeCloseTo(original.temperature!, 2);
      expect(parsed?.batteryLevel).toBe(original.batteryLevel);
    });

    it('should encode and parse JW-U data consistently', () => {
      const original: ParsedSensorData = {
        waterLevel: 75.5,
        batteryLevel: 90,
        mac: 'FF:EE:DD:CC:BB:AA',
      };

      const encoded = encodeBLEData(DeviceType.JW_U_WATER, original);
      const parsed = parseBLEData(
        {
          serviceData: {
            '0000fff0-0000-1000-8000-00805f9b34fb': encoded,
          },
        },
        DeviceType.JW_U_WATER
      );

      expect(parsed).toBeDefined();
      expect(parsed?.waterLevel).toBeCloseTo(original.waterLevel!, 1);
      expect(parsed?.batteryLevel).toBe(original.batteryLevel);
    });
  });

  describe('Precision Requirements', () => {
    it('should return values with 2 decimal precision', () => {
      const buffer = Buffer.alloc(13);
      buffer.writeUInt16LE(0xF525, 0);
      for (let i = 2; i < 8; i++) buffer[i] = 0x00;
      // Values that would produce more than 2 decimals
      buffer.writeUInt16BE(26215, 8); // Should round to 2 decimals
      buffer.writeUInt16BE(39322, 10);

      const result = parseBLEData(
        { manufacturerData: buffer },
        DeviceType.F525_GATEWAY
      );

      expect(result).toBeDefined();
      // Check that values have at most 2 decimal places
      const tempStr = result?.temperature?.toString() || '';
      const humStr = result?.humidity?.toString() || '';
      const tempDecimals = tempStr.includes('.')
        ? (tempStr.split('.')[1]?.length || 0)
        : 0;
      const humDecimals = humStr.includes('.')
        ? (humStr.split('.')[1]?.length || 0)
        : 0;

      expect(tempDecimals).toBeLessThanOrEqual(2);
      expect(humDecimals).toBeLessThanOrEqual(2);
    });
  });
});
