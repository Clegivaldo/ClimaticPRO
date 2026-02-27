/**
 * Minimal advertising parser for JHT sensor family (F525, 39F5, 35F5)
 * This file should be expanded with exact parsing rules from the hardware docs.
 */

export function parseAdvertising(ad: any) {
  // ad may be a device object coming from different libs; normalize fields
  const localName = ad.localName || ad.name || ad.deviceName;
  const rssi = ad.rssi || ad.RSSI || ad.rssiValue;
  const mac = ad.id || ad.mac || ad.address;

  if (!localName && !mac) return null;

  // Heuristic: JHT F525 devices often include 'F525' or 'JHT' in the localName
  if (localName && /F525|JHT|39F5|35F5/i.test(localName)) {
    return {
      id: mac || localName,
      name: localName,
      mac,
      rssi,
      // deviceType guessed from localName
      type: /F525/i.test(localName) ? 'F525' : /39F5/i.test(localName) ? '39F5' : /35F5/i.test(localName) ? '35F5' : 'unknown',
      raw: ad
    };
  }

  // Optionally inspect manufacturerData or serviceData if available
  try {
    const manuf = ad.manufacturerData || ad.manufacturer || null;
    if (manuf && typeof manuf === 'string' && /JHT/i.test(manuf)) {
      return { id: mac || localName, name: localName || 'JHT Sensor', mac, rssi, type: 'F525', raw: ad };
    }
  } catch (e) {}

  return null;
}
