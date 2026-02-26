
/**
 * Utility to parse JHT Bluetooth Advertising Data
 * Based on specific device documentation.
 */

// Helper: Convert Hex string to Decimal integer
export const hex2dec = (hex: string): number => {
  return parseInt(hex, 16);
};

// Helper: IEEE 754 Converter for 32-bit Hex (e.g., "41FE0EC7")
export const ieee754 = (hex: string): number => {
  const int = parseInt(hex, 16);
  if (int === 0) return 0;
  
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, int, false); // Big-endian
  return view.getFloat32(0, false);
};

export const parseBleData = (rawData: string, type: 'F525' | '39F5' | '35F5' | 'UNKNOWN') => {
  // Remove formatting
  const hex = rawData.replace(/^0x/i, '').replace(/[,\s"\[\]]/g, '').toUpperCase();
  
  let temperature: number | undefined;
  let humidity: number | undefined;

  try {
    if (type === 'F525') {
      // 1. JHT Gateway format (F525)
      // Example Raw: ...F525 6582 3D1A...
      // Logic: Search for 'F525', next 4 chars are Temp, next 4 are Hum.
      const pattern = "F525";
      const index = hex.indexOf(pattern);
      
      if (index !== -1 && hex.length >= index + 12) {
         const tempHex = hex.substr(index + 4, 4); // e.g. 6582
         const humHex = hex.substr(index + 8, 4);  // e.g. 3D1A
         
         const tempDec = hex2dec(tempHex);
         const humDec = hex2dec(humHex);

         // Formula: (hex2dec(TEMP)/65535)*175-45
         temperature = (tempDec / 65535) * 175 - 45;
         
         // Formula: (hex2dec(HUM)/65535)*100 (Assumed based on typical scaling, prompt said /65535 = %)
         // Correction based on prompt: (hex2dec(3D1A)/65535) = 0.2386... -> The prompt result is 23.87%.
         // So the formula is (dec / 65535) * 100.
         humidity = (humDec / 65535) * 100;
      }

    } else if (type === '39F5') {
      // 2. JHT-UP (39F5)
      // Example Raw: ...39F5 68EC 9EEA...
      // Logic: Search for '39F5', next 4 chars Temp, next 4 chars Hum.
      const pattern = "39F5";
      const index = hex.indexOf(pattern);

      if (index !== -1 && hex.length >= index + 12) {
        const tempHex = hex.substr(index + 4, 4); // e.g. 68EC
        const humHex = hex.substr(index + 8, 4);  // e.g. 9EEA
        
        const tempDec = hex2dec(tempHex);
        const humDec = hex2dec(humHex);

        // Formula: (hex2dec(TEMP)/65535)*175-45
        temperature = (tempDec / 65535) * 175 - 45;
        
        // Formula: (hex2dec(HUM)/65535)*100
        humidity = (humDec / 65535) * 100;
      }

    } else if (type === '35F5') {
      // 3. Wifi-PT100 (35F5)
      // Example Raw: ...35F5 41FE0EC7...
      // Logic: Search for '35F5', next 8 chars are IEEE754 Float Temp.
      const pattern = "35F5";
      const index = hex.indexOf(pattern);
      
      if (index !== -1 && hex.length >= index + 12) {
          const tempHex = hex.substr(index + 4, 8); // e.g. 41FE0EC7
          temperature = ieee754(tempHex);
          // PT100 does not have humidity
          humidity = undefined;
      }
    }
  } catch (e) {
    console.error("Parse error", e);
  }

  return {
    temperature: temperature ? parseFloat(temperature.toFixed(2)) : undefined,
    humidity: humidity ? parseFloat(humidity.toFixed(2)) : undefined
  };
};
