import * as fc from 'fast-check';
import { 
  identifyDeviceType, 
  parseBLEData, 
  encodeBLEData, 
  DeviceType,
  BLEAdvertisingData
} from '../bleParser.service';

describe('BLE Parser Service - Property Tests', () => {
  
  // Feature: cross-platform-mobile-app, Property 5: Device Type Identification
  // Validates: Requirements 3.3
  it('should correctly identify device type from manufacturer data', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          { type: DeviceType.F525_GATEWAY, id: 0xF525 },
          { type: DeviceType.JHT_UP_39F5, id: 0x39F5 },
          { type: DeviceType.WIFI_PT100_35F5, id: 0x35F5 }
        ),
        ({ type, id }) => {
          const buffer = Buffer.alloc(10);
          buffer.writeUInt16LE(id, 0);
          
          const advertisingData: BLEAdvertisingData = {
            manufacturerData: buffer
          };
          
          expect(identifyDeviceType(advertisingData)).toBe(type);
        }
      )
    );
  });

  it('should correctly identify JW-U water sensor from service data', () => {
    const jwuServiceUUID = '0000fff0-0000-1000-8000-00805f9b34fb';
    const advertisingData: BLEAdvertisingData = {
      serviceData: {
        [jwuServiceUUID]: Buffer.alloc(10)
      }
    };
    
    expect(identifyDeviceType(advertisingData)).toBe(DeviceType.JW_U_WATER);
  });

  it('should correctly identify device type from local name', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          { type: DeviceType.F525_GATEWAY, name: 'JHT-F525' },
          { type: DeviceType.JHT_UP_39F5, name: '39F5-Sensor' },
          { type: DeviceType.WIFI_PT100_35F5, name: 'PT100-Device' },
          { type: DeviceType.JW_U_WATER, name: 'JW-U-Water' }
        ),
        ({ type, name }) => {
          const advertisingData: BLEAdvertisingData = {
            localName: name
          };
          
          expect(identifyDeviceType(advertisingData)).toBe(type);
        }
      )
    );
  });

  // Feature: cross-platform-mobile-app, Property 6: BLE Data Parsing Round-Trip
  // Validates: Requirements 3.4, 13.1, 13.2, 13.3, 13.4, 13.5
  it('should perform correct round-trip parsing for F525/39F5 formats', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(DeviceType.F525_GATEWAY, DeviceType.JHT_UP_39F5),
        fc.float({ min: -40, max: 125, noNaN: true, noDefaultInfinity: true }), // Temperature range
        fc.float({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),   // Humidity range
        fc.integer({ min: 0, max: 100 }), // Battery range
        (type, temp, hum, batt) => {
          // Round to 2 decimal places as the parser does
          const originalTemp = parseFloat(temp.toFixed(2));
          const originalHum = parseFloat(hum.toFixed(2));
          
          const encoded = encodeBLEData(type, {
            temperature: originalTemp,
            humidity: originalHum,
            batteryLevel: batt,
            mac: 'AA:BB:CC:DD:EE:FF'
          });
          
          const parsed = parseBLEData({ manufacturerData: encoded }, type);
          
          expect(parsed).toBeDefined();
          if (parsed) {
            // Check temperature with 0.01 precision (due to rounding/formula conversion)
            expect(parsed.temperature).toBeCloseTo(originalTemp, 1);
            expect(parsed.humidity).toBeCloseTo(originalHum, 1);
            expect(parsed.batteryLevel).toBe(batt);
            expect(parsed.mac).toBe('AA:BB:CC:DD:EE:FF');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should perform correct round-trip parsing for 35F5 format', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -200, max: 800, noNaN: true, noDefaultInfinity: true }), // PT100 temperature range
        fc.integer({ min: 0, max: 100 }),  // Battery range
        (temp, batt) => {
          const originalTemp = parseFloat(temp.toFixed(2));
          
          const encoded = encodeBLEData(DeviceType.WIFI_PT100_35F5, {
            temperature: originalTemp,
            batteryLevel: batt,
            mac: '11:22:33:44:55:66'
          });
          
          const parsed = parseBLEData({ manufacturerData: encoded }, DeviceType.WIFI_PT100_35F5);
          
          expect(parsed).toBeDefined();
          if (parsed) {
            expect(parsed.temperature).toBeCloseTo(originalTemp, 2);
            expect(parsed.batteryLevel).toBe(batt);
            expect(parsed.mac).toBe('11:22:33:44:55:66');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should perform correct round-trip parsing for JW-U format', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),  // Water level range
        fc.integer({ min: 0, max: 100 }), // Battery range
        (level, batt) => {
          const originalLevel = parseFloat(level.toFixed(2));
          const jwuServiceUUID = '0000fff0-0000-1000-8000-00805f9b34fb';
          
          const encoded = encodeBLEData(DeviceType.JW_U_WATER, {
            waterLevel: originalLevel,
            batteryLevel: batt,
            mac: '00:11:22:33:44:55'
          });
          
          const parsed = parseBLEData({ 
            serviceData: { [jwuServiceUUID]: encoded } 
          }, DeviceType.JW_U_WATER);
          
          expect(parsed).toBeDefined();
          if (parsed) {
            expect(parsed.waterLevel).toBeCloseTo(originalLevel, 1);
            expect(parsed.batteryLevel).toBe(batt);
            expect(parsed.mac).toBe('00:11:22:33:44:55');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: cross-platform-mobile-app, Property: Error Handling for Malformed Data
  // Validates: Requirements 13.6
  it('should return undefined for malformed or insufficient data', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          DeviceType.F525_GATEWAY,
          DeviceType.JHT_UP_39F5,
          DeviceType.WIFI_PT100_35F5,
          DeviceType.JW_U_WATER
        ),
        fc.integer({ min: 0, max: 5 }), // Short buffers
        (type, length) => {
          const shortBuffer = Buffer.alloc(length);
          const advertisingData: BLEAdvertisingData = {
            manufacturerData: shortBuffer,
            serviceData: {
              '0000fff0-0000-1000-8000-00805f9b34fb': shortBuffer
            }
          };
          
          // Should not throw, should return undefined
          const parsed = parseBLEData(advertisingData, type);
          expect(parsed).toBeUndefined();
        }
      )
    );
  });
});
