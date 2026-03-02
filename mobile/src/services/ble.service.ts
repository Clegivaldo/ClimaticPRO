import { Platform, PermissionsAndroid } from 'react-native';
import * as Location from 'expo-location';
import { parseAdvertising } from '../utils/bleParser';
import { enqueueReading, startQueueWorker } from './offlineQueue';
import { api } from './api';
import { useSensorStore } from '../store/useSensorStore';

type DeviceCallback = (device: any) => void;

class BleService {
  private scanning = false;
  private stopFn: (() => void) | null = null;
  private recentAds: any[] = [];
  private backend: string = 'unknown';
  private lastState: string | null = null;

  async startScan(onDevice: DeviceCallback) {
    // Ensure location permission on Android (required for BLE scanning)
    if (Platform.OS === 'android') {
      // Try to request Android 12+ Bluetooth runtime permissions if available
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const perms = require('react-native-permissions');
        const { request, PERMISSIONS, RESULTS } = perms;
        const results: any[] = [];
        // BLUETOOTH_SCAN and BLUETOOTH_CONNECT available on Android S+
        try {
          const r1 = await request(PERMISSIONS.ANDROID.BLUETOOTH_SCAN);
          const r2 = await request(PERMISSIONS.ANDROID.BLUETOOTH_CONNECT);
          const r3 = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
          results.push(r1, r2, r3);
        } catch (e) {
          // Some devices or permission plugin versions may not expose those constants
        }
        if (results.some(r => r === RESULTS.DENIED || r === RESULTS.BLOCKED)) {
          throw new Error('Location permission denied');
        }
      } catch (e) {
        // Fallback: try PermissionsAndroid (no native permissions lib)
        try {
          const toRequest: string[] = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
          // Android S (31)+ requires BLUETOOTH_SCAN / BLUETOOTH_CONNECT runtime
          try {
            const sdkInt = (Platform as any).Version || 0;
            if (sdkInt >= 31) {
              toRequest.push('android.permission.BLUETOOTH_SCAN');
              toRequest.push('android.permission.BLUETOOTH_CONNECT');
            }
          } catch (e) {}

          const results = await PermissionsAndroid.requestMultiple(toRequest as any);
          const denied = Object.values(results).some(v => v !== PermissionsAndroid.RESULTS.GRANTED);
          if (denied) throw new Error('Location permission denied');
        } catch (e2) {
          // Fallback to expo-location request when PermissionsAndroid not available
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') throw new Error('Location permission denied');
        }
      }
    }

    this.scanning = true;

    // Try dynamic import of a native BLE library. If not available, fall back to simulation.
    try {
      // Prefer react-native-ble-plx when available
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const BleManager = require('react-native-ble-plx').BleManager;
      this.backend = 'react-native-ble-plx';
      const manager = new BleManager();
      // Check Bluetooth state before starting scan
      const stateNow = await manager.state();
      this.lastState = stateNow;
      console.log('[BleService] initial bluetooth state:', stateNow);
      let sub: any = null;
      if (stateNow !== 'PoweredOn') {
        // wait briefly for state to change, otherwise reject with specific error
        let resolved = false;
        sub = manager.onStateChange((s: string) => {
          console.log('[BleService] onStateChange ->', s);
          if (s === 'PoweredOn' && !resolved) {
            resolved = true;
            sub.remove();
            manager.startDeviceScan(null, { allowDuplicates: true, scanMode: 2 }, async (error: any, device: any) => {
              if (error) return;
              try {
                console.log('[BleService] raw advert (onStateChange):', { id: device?.id, name: device?.name || device?.localName, rssi: device?.rssi, manufacturerData: device?.manufacturerData, serviceData: device?.serviceData, serviceUUIDs: device?.serviceUUIDs });
              } catch (e) {}
              const parsed = parseAdvertising(device);
              if (parsed) {
                  try { this.recentAds.unshift({ ts: Date.now(), parsed }); if (this.recentAds.length > 100) this.recentAds.pop(); } catch (e) {}
                  onDevice(parsed);
                  try {
                    const found = this.findMatchingSensor(parsed);
                    if (found) {
                      const payload = { timestamp: new Date().toISOString(), rssi: parsed.rssi, raw: parsed.raw };
                      try {
                        await api.postSensorReading(found.id, payload);
                      } catch (err) {
                        await enqueueReading({ sensorId: found.id, payload });
                      }
                    }
                  } catch (e) {}
                }
            });
          }
        }, true);

        // if not powered on after short timeout, fail so UI can prompt user
        // increase timeout to allow slower devices to report state changes
        await new Promise((resolve, _reject) => setTimeout(resolve, 3000));
        if (!resolved) {
          try { sub.remove(); } catch (e) {}
          throw new Error('BluetoothDisabled');
        }
      } else {
        manager.startDeviceScan(null, { allowDuplicates: true, scanMode: 2 }, async (error: any, device: any) => {
          if (error) return;
          try {
            console.log('[BleService] raw advert:', { id: device?.id, name: device?.name || device?.localName, rssi: device?.rssi, manufacturerData: device?.manufacturerData, serviceData: device?.serviceData, serviceUUIDs: device?.serviceUUIDs });
          } catch (e) {}
          const parsed = parseAdvertising(device);
          if (parsed) {
            try { this.recentAds.unshift({ ts: Date.now(), parsed }); if (this.recentAds.length > 100) this.recentAds.pop(); } catch (e) {}
            console.log('[BleService] device discovered:', parsed.mac || parsed.id, parsed.name || '');
            onDevice(parsed);
            try {
              const found = this.findMatchingSensor(parsed);
              if (found) {
                const payload = { timestamp: new Date().toISOString(), rssi: parsed.rssi, raw: parsed.raw };
                try {
                  await api.postSensorReading(found.id, payload);
                } catch (err) {
                  await enqueueReading({ sensorId: found.id, payload });
                }
              }
            } catch (e) {}
          }
        });
      }

      this.stopFn = async () => {
        try { await manager.stopDeviceScan(); } catch (e) {}
        try { if (sub) sub.remove(); } catch (e) {}
        this.scanning = false;
      };
      return;
    } catch (e) {
      // react-native-ble-plx not available
    }

    try {
      // Try expo-ble-scanner (managed expo BLE plugin)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { startDeviceScan, stopDeviceScan, addListener } = require('expo-ble-scanner');
      this.backend = 'expo-ble-scanner';
      const listener = addListener('onScanResult', async (result: any) => {
        const parsed = parseAdvertising(result);
        if (parsed) {
          try { this.recentAds.unshift({ ts: Date.now(), parsed }); if (this.recentAds.length > 100) this.recentAds.pop(); } catch (e) {}
          onDevice(parsed);
          try {
            const found = this.findMatchingSensor(parsed);
            if (found) {
              const payload = { timestamp: new Date().toISOString(), rssi: parsed.rssi, raw: parsed.raw };
              try {
                await api.postSensorReading(found.id, payload);
              } catch (err) {
                await enqueueReading({ sensorId: found.id, payload });
              }
            }
          } catch (e) {}
        }
      });
      startDeviceScan();

      this.stopFn = () => {
        try { stopDeviceScan(); } catch (e) {}
        try { listener.remove(); } catch (e) {}
        this.scanning = false;
      };
      return;
    } catch (e) {
      // expo-ble-scanner not available
    }

    // Fallback: simulated discovery (keeps app runnable in Expo without native BLE)
    const mockedDevices = [
      { id: '1', name: 'JHT-F525 Gateway', mac: 'C1:32:71:39:72:95', type: 'F525_GATEWAY', rssi: -65 },
      { id: '2', name: 'Wifi-PT100 Sensor', mac: '00:E8:31:CD:80:79', type: 'WIFI_PT100_35F5', rssi: -72 },
    ];

    const timer = setTimeout(async () => {
      for (const d of mockedDevices) {
        try { this.recentAds.unshift({ ts: Date.now(), parsed: d }); if (this.recentAds.length > 100) this.recentAds.pop(); } catch (e) {}
        onDevice(d);
        try {
          const found = this.findMatchingSensor(d);
          if (found) {
            const payload = { timestamp: new Date().toISOString(), rssi: d.rssi, raw: d };
            try {
              await api.postSensorReading(found.id, payload);
            } catch (err) {
              await enqueueReading({ sensorId: found.id, payload });
            }
          }
        } catch (e) {}
      }
      this.scanning = false;
    }, 1500);

    this.stopFn = () => {
      clearTimeout(timer);
      this.scanning = false;
    };
    this.backend = 'simulation';
  }

  getRecentAds() { return [...this.recentAds]; }

  clearRecentAds() { this.recentAds = []; }

  /**
   * Try to find a matching sensor from the store using tolerant heuristics.
   * Matches by exact mac, by normalized mac within parsed.rawHex, or by id fragments.
   */
  private findMatchingSensor(parsed: any) {
    try {
      const sensors = useSensorStore.getState().sensors || [];
      if (!sensors || sensors.length === 0) return null;
      const norm = (s: string) => (s || '').replace(/[^0-9A-Fa-f]/g, '').toLowerCase();
      for (const s of sensors) {
        if (!s || !s.mac) continue;
        const sensorMac = (s.mac || '').toLowerCase();
        const sensorSig = (s.signature || '').toLowerCase();
        if (parsed.mac && parsed.mac.toLowerCase() === sensorMac) return s;
        if (sensorSig && parsed.rawHex && parsed.rawHex.replace(/[^0-9A-Fa-f]/g, '').toLowerCase().includes(sensorSig.replace(/[^0-9A-Fa-f]/g, '').toLowerCase())) return s;
        // compare normalized forms inside rawHex if available
        if (parsed.rawHex) {
          const rawNorm = (parsed.rawHex || '').replace(/[^0-9A-Fa-f]/g, '').toLowerCase();
          if (rawNorm && norm(s.mac) && rawNorm.includes(norm(s.mac))) return s;
        }
        // some backends put the mac inside id without colons
        if (parsed.id && parsed.id.replace(/:/g, '').toLowerCase().includes(sensorMac.replace(/:/g, ''))) return s;
        // fallback: check if stored mac (no colons) is contained in stringified raw manufacturerData
        try {
          const m = String(parsed.raw?.manufacturerData || parsed.raw?.serviceData || '').replace(/[^0-9A-Fa-f]/g, '').toLowerCase();
          if (m && norm(s.mac) && m.includes(norm(s.mac))) return s;
        } catch (e) {}
      }
    } catch (e) {}
    return null;
  }

  /**
   * Returns true if Bluetooth is powered on (for supported native libs).
   * Falls back to true in simulation mode.
   */
  async isBluetoothOn(): Promise<boolean> {
    try {
      const BleManager = require('react-native-ble-plx').BleManager;
      const manager = new BleManager();
      const stateNow = await manager.state();
      this.lastState = stateNow;
      return stateNow === 'PoweredOn';
    } catch (e) {
      // If native lib not present, assume true (expo simulation)
      return true;
    }
  }

  /**
   * Try to request enabling Bluetooth. Returns true if enabled or request started.
   */
  async enableBluetooth(): Promise<boolean> {
    // First try expo-intent-launcher if available (opens Bluetooth settings or request enable)
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const IntentLauncher = require('expo-intent-launcher');
      if (IntentLauncher && typeof IntentLauncher.startActivityAsync === 'function') {
        try {
          // Prefer action constant if available
          const action = IntentLauncher.ACTION_BLUETOOTH_SETTINGS || 'android.bluetooth.adapter.action.REQUEST_ENABLE';
          await IntentLauncher.startActivityAsync(action);
        } catch (e) {
          try { await IntentLauncher.startActivityAsync('android.settings.BLUETOOTH_SETTINGS'); } catch (e) {}
        }
        // give system a moment
        await new Promise(r => setTimeout(r, 1000));
        return await this.isBluetoothOn();
      }
    } catch (e) {
      // expo-intent-launcher not available
    }

    // Try BleManager enable (some libs expose an enable method)
    try {
      const BleManager = require('react-native-ble-plx').BleManager;
      const manager = new BleManager();
      if (typeof manager.enable === 'function') {
        await manager.enable();
        await new Promise(r => setTimeout(r, 1000));
        const on = await this.isBluetoothOn();
        this.lastState = on ? 'PoweredOn' : this.lastState;
        return on;
      }
    } catch (e) {}

    // Try to open Bluetooth settings via Linking intent URL (fallback)
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Linking } = require('react-native');
      try {
        await Linking.openURL('android.settings.BLUETOOTH_SETTINGS');
      } catch (e) {
        try { await Linking.openURL('intent:#Intent;action=android.settings.BLUETOOTH_SETTINGS;end'); } catch (e) {}
      }
      await new Promise(r => setTimeout(r, 1000));
      return await this.isBluetoothOn();
    } catch (e) {}

    return false;
  }

  getBackend() { return this.backend; }
  getBluetoothState() { return this.lastState; }

  stopScan() {
    if (this.stopFn) this.stopFn();
    this.scanning = false;
  }

  isScanning() { return this.scanning; }

  /**
   * Connect to a device by id (or mac). Returns connected device info or throws.
   */
  async connectToDevice(deviceOrId: any) {
    try {
      // prefer react-native-ble-plx
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const BleManager = require('react-native-ble-plx').BleManager;
      const manager = new BleManager();

      // Resolve target identifiers
      let targetId: string | null = null;
      let targetMac: string | null = null;
      let targetRawHex: string | null = null;
      if (typeof deviceOrId === 'string') {
        targetId = deviceOrId;
        targetMac = deviceOrId;
      } else if (deviceOrId && typeof deviceOrId === 'object') {
        targetId = deviceOrId.id || null;
        targetMac = deviceOrId.mac || null;
        targetRawHex = deviceOrId.rawHex || deviceOrId.parsed?.rawHex || null;
      }

      // Try direct connect by id first when available
      let device = null;
      if (targetId) {
        try {
          device = await manager.connectToDevice(targetId, { requestMTU: 256, autoConnect: false });
        } catch (e) {
          device = null;
        }
      }

      // If we were passed a parsed object with a realMac (embedded in payload), try connecting with that
      if (!device && deviceOrId && typeof deviceOrId === 'object') {
        const candidate = deviceOrId.realMac || deviceOrId.parsed?.realMac || deviceOrId.mac;
        if (candidate) {
          try {
            device = await manager.connectToDevice(candidate, { requestMTU: 256, autoConnect: false });
          } catch (e) {
            device = null;
          }
        }
      }

      // If direct connect failed, attempt to discover the live advertising device by matching rawHex / mac
      if (!device) {
        const foundDevices: any[] = [];
        const scanPromise = new Promise<void>((resolve) => {
          manager.startDeviceScan(null, { allowDuplicates: true }, (error: any, d: any) => {
            if (error) return;
            if (!d) return;
            // parse advert and check rawHex or mac match
            try {
              const parsed = parseAdvertising(d);
              if (parsed) {
                // normalize compare
                const norm = (s: string | null) => (s || '').replace(/[^0-9A-Fa-f]/g, '').toLowerCase();
                if (targetRawHex && parsed.rawHex && norm(parsed.rawHex).includes(norm(targetRawHex))) {
                  foundDevices.push(d);
                  resolve();
                } else if (targetMac && parsed.mac && parsed.mac.replace(/:/g, '').toLowerCase() === targetMac.replace(/:/g, '').toLowerCase()) {
                  foundDevices.push(d);
                  resolve();
                }
              }
            } catch (e) {}
            // also allow id match
            try {
              if (targetId && d.id && d.id.toLowerCase() === String(targetId).toLowerCase()) { foundDevices.push(d); resolve(); }
            } catch (e) {}
          });
          // timeout after short window
          setTimeout(() => resolve(), 2000);
        });
        await scanPromise;
        try { await manager.stopDeviceScan(); } catch (e) {}
        if (foundDevices.length > 0) {
          const d = foundDevices[0];
          try { device = await manager.connectToDevice(d.id, { requestMTU: 256, autoConnect: false }); } catch (e) { device = null; }
        }
      }

      if (!device) throw new Error('Could not connect to device');
      await device.discoverAllServicesAndCharacteristics();

      const services = await device.services();
      const full: any = { id: device.id, name: device.name, services: [] };
      for (const s of services) {
        try {
          const characteristics = await s.characteristics();
          full.services.push({ uuid: s.uuid, characteristics: characteristics.map((c: any) => ({ uuid: c.uuid, isReadable: c.isReadable, isWritableWithResponse: c.isWritableWithResponse })) });
        } catch (e) {}
      }

      return { device: full, raw: device };
    } catch (e) {
      throw e;
    }
  }

  async disconnectDevice(deviceId: string) {
    try {
      const BleManager = require('react-native-ble-plx').BleManager;
      const manager = new BleManager();
      try { await manager.cancelDeviceConnection(deviceId); } catch (e) {}
    } catch (e) {
      // ignore when native not available
    }
  }
}

export const bleService = new BleService();
// Start offline queue worker
try { startQueueWorker(); } catch (e) {}
