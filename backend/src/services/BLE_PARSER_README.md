# BLE Parser Service

## Overview

The BLE Parser Service provides functionality to parse Bluetooth Low Energy (BLE) advertising data from various environmental sensor types. It supports device type identification and data extraction for temperature, humidity, water level, and battery information.

## Supported Device Types

### 1. F525 Gateway (JHT Gateway)
- **Manufacturer ID**: `0xF525`
- **Data Format**: Temperature and humidity with formula conversion
- **Temperature Formula**: `(raw_value / 65535) * 175 - 45`
- **Humidity Formula**: `(raw_value / 65535) * 100`
- **Data Fields**: Temperature, Humidity, Battery Level, MAC Address

### 2. 39F5 (JHT-UP)
- **Manufacturer ID**: `0x39F5`
- **Data Format**: Same as F525 Gateway
- **Data Fields**: Temperature, Humidity, Battery Level, MAC Address

### 3. 35F5 (Wifi-PT100)
- **Manufacturer ID**: `0x35F5`
- **Data Format**: IEEE 754 32-bit float for temperature
- **Data Fields**: Temperature (float), Battery Level, MAC Address

### 4. JW-U Water Sensors
- **Service UUID**: `0000fff0-0000-1000-8000-00805f9b34fb`
- **Data Format**: Water level percentage
- **Water Level Formula**: `(raw_value / 65535) * 100`
- **Data Fields**: Water Level, Battery Level, MAC Address

## API Reference

### Device Type Identification

```typescript
function identifyDeviceType(
  advertisingData: BLEAdvertisingData
): DeviceType | null
```

Identifies the device type from BLE advertising data by checking:
1. Manufacturer ID in manufacturer data
2. Service UUIDs in service data
3. Device name patterns in local name

**Returns**: `DeviceType` enum value or `null` if unknown

### Data Parsing

```typescript
function parseBLEData(
  advertisingData: BLEAdvertisingData,
  deviceType?: DeviceType
): ParsedSensorData | undefined
```

Parses BLE advertising data and extracts sensor readings.

**Parameters**:
- `advertisingData`: BLE advertising data containing manufacturer data, service data, or local name
- `deviceType`: (Optional) Device type if already known

**Returns**: `ParsedSensorData` object or `undefined` if parsing fails

**ParsedSensorData Interface**:
```typescript
interface ParsedSensorData {
  temperature?: number;    // Temperature in Celsius (2 decimal precision)
  humidity?: number;       // Humidity percentage (2 decimal precision)
  batteryLevel?: number;   // Battery level (0-100)
  waterLevel?: number;     // Water level percentage (2 decimal precision)
  mac: string;            // MAC address (format: AA:BB:CC:DD:EE:FF)
}
```

### Data Encoding (for testing)

```typescript
function encodeBLEData(
  deviceType: DeviceType,
  sensorData: Partial<ParsedSensorData>
): Buffer
```

Encodes sensor data back into BLE advertising format. Primarily used for testing round-trip parsing.

## Usage Examples

### Example 1: Parse F525 Gateway Data

```typescript
import { parseBLEData, DeviceType } from './bleParser.service';

const advertisingData = {
  manufacturerData: Buffer.from([
    0x25, 0xF5,                    // Manufacturer ID (F525)
    0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF,  // MAC address
    0x66, 0x66,                    // Temperature raw value
    0x99, 0x99,                    // Humidity raw value
    0x55                           // Battery level (85%)
  ])
};

const result = parseBLEData(advertisingData);
console.log(result);
// Output: {
//   temperature: 25.0,
//   humidity: 60.0,
//   batteryLevel: 85,
//   mac: 'AA:BB:CC:DD:EE:FF'
// }
```

### Example 2: Identify Device Type First

```typescript
import { identifyDeviceType, parseBLEData } from './bleParser.service';

const advertisingData = {
  localName: 'JHT-Sensor-01',
  manufacturerData: Buffer.from([...])
};

const deviceType = identifyDeviceType(advertisingData);
if (deviceType) {
  const sensorData = parseBLEData(advertisingData, deviceType);
  console.log(`Device Type: ${deviceType}`, sensorData);
}
```

### Example 3: Parse JW-U Water Sensor

```typescript
const advertisingData = {
  serviceData: {
    '0000fff0-0000-1000-8000-00805f9b34fb': Buffer.from([
      0x11, 0x22, 0x33, 0x44, 0x55, 0x66,  // MAC address
      0x80, 0x00,                          // Water level (50%)
      0x5F                                 // Battery level (95%)
    ])
  }
};

const result = parseBLEData(advertisingData);
console.log(result);
// Output: {
//   waterLevel: 50.0,
//   batteryLevel: 95,
//   mac: '11:22:33:44:55:66'
// }
```

## Error Handling

The parser implements robust error handling:

1. **Malformed Data**: Returns `undefined` if data is too short or corrupted
2. **Unknown Device**: Returns `undefined` if device type cannot be identified
3. **Missing Data**: Returns `undefined` if required data buffers are not present
4. **Parsing Errors**: Catches exceptions and returns `undefined` with error logging

## Data Precision

All numeric values are returned with **2 decimal places** precision as per requirements:
- Temperature: `XX.XX` °C
- Humidity: `XX.XX` %
- Water Level: `XX.XX` %

## Testing

The module includes comprehensive unit tests covering:
- Device type identification for all supported types
- Data parsing for each device format
- Edge cases (min/max values, empty data)
- Error handling (malformed data, unknown devices)
- Round-trip encoding and parsing
- Precision requirements

Run tests:
```bash
npm test -- bleParser.service.test.ts
```

## Requirements Mapping

This implementation satisfies the following requirements:
- **Requirement 3.3**: Device type identification from advertising data
- **Requirement 3.4**: Parse temperature and humidity from advertising packet
- **Requirement 13.1**: F525 format with temperature and humidity formulas
- **Requirement 13.2**: 39F5 format (same as F525)
- **Requirement 13.3**: 35F5 format with IEEE 754 32-bit conversion
- **Requirement 13.4**: JW-U water sensor format
- **Requirement 13.5**: Return values with 2 decimal precision
- **Requirement 13.6**: Return undefined for unparseable values

## Integration

To use this parser in your application:

1. Import the necessary functions:
```typescript
import { parseBLEData, identifyDeviceType, DeviceType } from './services/bleParser.service';
```

2. When receiving BLE advertising data, pass it to the parser:
```typescript
const sensorData = parseBLEData(advertisingData);
if (sensorData) {
  // Process the parsed sensor data
  console.log(`Temperature: ${sensorData.temperature}°C`);
  console.log(`Humidity: ${sensorData.humidity}%`);
}
```

3. Store the parsed data in your database or forward to clients via API endpoints.
