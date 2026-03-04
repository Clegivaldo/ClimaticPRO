import { Platform, PermissionsAndroid } from 'react-native';
import * as Location from 'expo-location';
import { parseAdvertising } from '../utils/bleParser';
import { enqueueReading, startQueueWorker } from './offlineQueue';
import { api } from './api';
import { useSensorStore } from '../store/useSensorStore';
import { useAuthStore } from '../store/useAuthStore';

type DeviceCallback = (device: any) => void;

class BleService {
  private scanning = false;
  private stopFn: (() => void) | null = null;
  private recentAds: any[] = [];
  private rawAds: any[] = [];
  private diagnostics: any[] = [];
  private backend: string = 'unknown';
  private lastState: string | null = null;
  private lastPostTimes: Map<string, number> = new Map();

  private pushDiagnostic(kind: string, data: any = {}) {
    try {
      this.diagnostics.unshift({ ts: Date.now(), kind, ...data });
      if (this.diagnostics.length > 300) this.diagnostics.pop();
    } catch (e) { }
  }

  private pushRawAd(raw: any) {
    try {
      const base64ToHex = (b64?: string | null) => {
        if (!b64) return null;
        try {
          if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
            const buf = Buffer.from(b64, 'base64');
            return Array.from(buf).map((x: number) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
          }
          const atobFn = (global as any)?.atob || ((s: string) => { return Buffer.from(s, 'base64').toString('binary'); });
          const rawStr = atobFn(b64);
          return Array.from(rawStr).map((ch: any) => ch.charCodeAt(0).toString(16).padStart(2, '0')).join('').toUpperCase();
        } catch (e) {
          return null;
        }
      };

      const manufB64 = raw?.manufacturerData || null;
      let serviceData = raw?.serviceData || null;
      let serviceDataHex: any = null;
      if (serviceData && typeof serviceData === 'object') {
        serviceDataHex = {} as any;
        try {
          for (const k of Object.keys(serviceData)) {
            serviceDataHex[k] = base64ToHex(serviceData[k]);
          }
        } catch (e) { }
      } else if (typeof serviceData === 'string') {
        serviceDataHex = base64ToHex(serviceData);
      }

      const entry = {
        ts: Date.now(),
        raw: {
          id: raw?.id || raw?.deviceId || null,
          name: raw?.name || raw?.localName || raw?.deviceName || null,
          rssi: raw?.rssi ?? raw?.RSSI ?? null,
          manufacturerData: manufB64,
          manufacturerHex: base64ToHex(manufB64),
          serviceData: serviceData,
          serviceDataHex,
          serviceUUIDs: raw?.serviceUUIDs || raw?.serviceUuids || raw?.uuids || null,
        }
      };

      this.rawAds.unshift(entry);
      if (this.rawAds.length > 200) this.rawAds.pop();

      try {
        const MONITORED = ['FE94B4A4F6EF'];
        const norm = (s?: string | null) => (s || '').replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
        const revPairs = (hex: string) => (hex.match(/.{1,2}/g)||[]).reverse().join('').toUpperCase();
        const haystack = [entry.raw.manufacturerHex || '', entry.raw.serviceDataHex ? Object.values(entry.raw.serviceDataHex).join('') : ''].join('|').toUpperCase();
        for (const m of MONITORED) {
          const r = revPairs(m);
          if (haystack.includes(m) || haystack.includes(r)) {
            this.pushDiagnostic('monitored-mac-seen', { mac: m, macReversed: r, id: entry.raw.id, rssi: entry.raw.rssi });
            try { console.log('[BleService] MONITORED MAC SEEN in advert:', { mac: m, macReversed: r, id: entry.raw.id, rssi: entry.raw.rssi, manufacturerHex: entry.raw.manufacturerHex, serviceDataHex: entry.raw.serviceDataHex }); } catch (e) {}
          }
        }
      } catch (e) { }

      return entry;
    } catch (e) { return null; }
  }

  private hasMeasurement(parsed: any) {
    return ['temperature', 'humidity', 'co2', 'pm25', 'tvoc', 'pressure', 'waterLevel']
      .some(k => typeof parsed?.[k] === 'number');
  }

  private normalizeMac(value?: string | null) {
    const compact = String(value || '').replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    if (compact.length !== 12) return null;
    return compact.match(/.{1,2}/g)?.join(':') || null;
  }

  private buildReadingPayload(parsed: any) {
    const payload: any = {
      timestamp: new Date().toISOString(),
      rssi: parsed?.rssi,
      raw: parsed?.raw,
      rawHex: parsed?.rawHex,
    };

    if (typeof parsed?.temperature === 'number') payload.temperature = parsed.temperature;
    if (typeof parsed?.humidity === 'number') payload.humidity = parsed.humidity;
    if (typeof parsed?.co2 === 'number') payload.co2 = parsed.co2;
    if (typeof parsed?.pm25 === 'number') payload.pm25 = parsed.pm25;
    if (typeof parsed?.tvoc === 'number') payload.tvoc = parsed.tvoc;
    if (typeof parsed?.pressure === 'number') payload.pressure = parsed.pressure;
    if (typeof parsed?.waterLevel === 'number') payload.waterLevel = parsed.waterLevel;

    return payload;
  }

  private setLocalReading(sensorId: string, payload: any) {
    if (!this.hasMeasurement(payload)) return;
    try {
      useSensorStore.getState().setReading(sensorId, {
        id: `live-${sensorId}-${Date.now()}`,
        sensorId,
        temperature: payload.temperature,
        humidity: payload.humidity,
        co2: payload.co2,
        timestamp: payload.timestamp || new Date().toISOString(),
      } as any);
    } catch (e) { }
  }

  private async forwardParsedReading(parsed: any) {
    // Only forward readings if the user is authenticated
    if (!useAuthStore.getState().isAuthenticated) return;
    try {
      const found = this.findMatchingSensor(parsed);
      if (!found) {
        this.pushDiagnostic('no-match', {
          parsedId: parsed?.id,
          parsedMac: parsed?.mac,
          parsedRealMac: parsed?.realMac,
          name: parsed?.name,
          type: parsed?.type,
          hasTemp: typeof parsed?.temperature === 'number',
          hasHum: typeof parsed?.humidity === 'number',
        });
        return;
      }

      const payload = this.buildReadingPayload(parsed);
      this.setLocalReading(found.id, payload);

      const discoveredMac = this.normalizeMac(parsed?.realMac || parsed?.mac || parsed?.id);
      if (!found?.mac && discoveredMac) {
        try {
          await api.updateSensor(found.id, { mac: discoveredMac });
          useSensorStore.getState().updateSensor(found.id, { mac: discoveredMac } as any);
          this.pushDiagnostic('mac-promoted', { sensorId: found.id, mac: discoveredMac });
        } catch (e) {
          this.pushDiagnostic('mac-promote-failed', { sensorId: found.id, mac: discoveredMac, error: String((e as any)?.message || e) });
        }
      }

      this.pushDiagnostic('match-found', {
        sensorId: found.id,
        sensorMac: found.mac,
        parsedId: parsed?.id,
        parsedMac: parsed?.mac,
        parsedRealMac: parsed?.realMac,
        type: parsed?.type,
        temperature: payload?.temperature,
        humidity: payload?.humidity,
      });

      if (!this.hasMeasurement(payload)) {
        this.pushDiagnostic('no-measurement', {
          sensorId: found.id,
          parsedId: parsed?.id,
          parsedMac: parsed?.mac,
          parsedRealMac: parsed?.realMac,
          type: parsed?.type,
        });
        return;
      }

      const sensorId = found.id;
      const now = Date.now();
      const lastPost = this.lastPostTimes.get(sensorId) || 0;
      const THROTTLE_MS = useSensorStore.getState().getCollectionIntervalMs(sensorId);

      if (now - lastPost < THROTTLE_MS) {
        this.pushDiagnostic('throttled', {
          sensorId,
          remaining: THROTTLE_MS - (now - lastPost)
        });
        return;
      }

      try {
        await api.postSensorReading(sensorId, payload);
        this.lastPostTimes.set(sensorId, now);
        this.pushDiagnostic('posted', {
          sensorId: found.id,
          temperature: payload?.temperature,
          humidity: payload?.humidity,
          timestamp: payload?.timestamp,
        });
      } catch (err) {
        await enqueueReading({ sensorId: found.id, payload });
        this.pushDiagnostic('queued', {
          sensorId: found.id,
          temperature: payload?.temperature,
          humidity: payload?.humidity,
          timestamp: payload?.timestamp,
          error: String((err as any)?.message || err || 'unknown'),
        });
      }
    } catch (e) { }
  }

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
          } catch (e) { }

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

    // Try dynamic import of a native BLE library. No simulation fallback is allowed.
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
              const ent = this.pushRawAd(device);
              try {
                console.log('[BleService] raw advert (onStateChange):', ent?.raw || { id: device?.id, name: device?.name || device?.localName, rssi: device?.rssi });
              } catch (e) { }
              const parsed = parseAdvertising(device);
              if (parsed) {
                try { this.recentAds.unshift({ ts: Date.now(), parsed }); if (this.recentAds.length > 100) this.recentAds.pop(); } catch (e) { }
                this.pushDiagnostic('parsed', {
                  id: parsed?.id,
                  mac: parsed?.mac,
                  realMac: parsed?.realMac,
                  name: parsed?.name,
                  type: parsed?.type,
                  temperature: parsed?.temperature,
                  humidity: parsed?.humidity,
                  rssi: parsed?.rssi,
                });
                onDevice(parsed);
                await this.forwardParsedReading(parsed);
              }
            });
          }
        }, true);

        // if not powered on after short timeout, fail so UI can prompt user
        // increase timeout to allow slower devices to report state changes
        await new Promise((resolve, _reject) => setTimeout(resolve, 3000));
        if (!resolved) {
          try { sub.remove(); } catch (e) { }
          throw new Error('BluetoothDisabled');
        }
      } else {
        manager.startDeviceScan(null, { allowDuplicates: true, scanMode: 2 }, async (error: any, device: any) => {
          if (error) return;
          const ent = this.pushRawAd(device);
          try {
            console.log('[BleService] raw advert:', ent?.raw || { id: device?.id, name: device?.name || device?.localName, rssi: device?.rssi });
          } catch (e) { }
          const parsed = parseAdvertising(device);
          if (parsed) {
            try { this.recentAds.unshift({ ts: Date.now(), parsed }); if (this.recentAds.length > 100) this.recentAds.pop(); } catch (e) { }
            this.pushDiagnostic('parsed', {
              id: parsed?.id,
              mac: parsed?.mac,
              realMac: parsed?.realMac,
              name: parsed?.name,
              type: parsed?.type,
              temperature: parsed?.temperature,
              humidity: parsed?.humidity,
              rssi: parsed?.rssi,
            });
            console.log('[BleService] device discovered:', parsed.mac || parsed.id, parsed.name || '');
            onDevice(parsed);
            await this.forwardParsedReading(parsed);
          }
        });
      }

      this.stopFn = async () => {
        try { await manager.stopDeviceScan(); } catch (e) { }
        try { if (sub) sub.remove(); } catch (e) { }
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
        const ent = this.pushRawAd(result);
        try { console.log('[BleService] raw advert (expo):', ent?.raw || { id: result?.id, name: result?.name, rssi: result?.rssi }); } catch (e) {}
        const parsed = parseAdvertising(result);
        if (parsed) {
          try { this.recentAds.unshift({ ts: Date.now(), parsed }); if (this.recentAds.length > 100) this.recentAds.pop(); } catch (e) { }
          this.pushDiagnostic('parsed', {
            id: parsed?.id,
            mac: parsed?.mac,
            realMac: parsed?.realMac,
            name: parsed?.name,
            type: parsed?.type,
            temperature: parsed?.temperature,
            humidity: parsed?.humidity,
            rssi: parsed?.rssi,
          });
          onDevice(parsed);
          await this.forwardParsedReading(parsed);
        }
      });
      startDeviceScan();

      this.stopFn = () => {
        try { stopDeviceScan(); } catch (e) { }
        try { listener.remove(); } catch (e) { }
        this.scanning = false;
      };
      return;
    } catch (e) {
      // expo-ble-scanner not available
    }

    this.scanning = false;
    this.backend = 'none';
    throw new Error('Real BLE backend unavailable (react-native-ble-plx/expo-ble-scanner not loaded)');
  }

  getRecentAds() { return [...this.recentAds]; }

  getRawAds() { return [...this.rawAds]; }

  getDiagnostics() { return [...this.diagnostics]; }

  clearRecentAds() { this.recentAds = []; }

  clearRawAds() { this.rawAds = []; }

  clearDiagnostics() { this.diagnostics = []; }

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
        if (!s) continue;
        const sensorMac = (s.mac || '').toLowerCase();
        const sensorSig = (((s as any).signature) || '').toLowerCase();
        const parsedMac = (parsed.realMac || parsed.mac || '').toLowerCase();
        const parsedSig = (parsed.advSignature || '').toLowerCase();

        if (sensorSig) {
          if (parsedSig && (parsedSig === sensorSig || parsedSig.includes(sensorSig) || sensorSig.includes(parsedSig))) return s;
          if (parsed.rawHex && parsed.rawHex.replace(/[^0-9A-Fa-f]/g, '').toLowerCase().includes(sensorSig.replace(/[^0-9A-Fa-f]/g, '').toLowerCase())) return s;
        }

        if (sensorMac && parsedMac && norm(sensorMac) === norm(parsedMac)) return s;
        // compare normalized forms inside rawHex if available
        if (sensorMac && parsed.rawHex) {
          const rawNorm = (parsed.rawHex || '').replace(/[^0-9A-Fa-f]/g, '').toLowerCase();
          if (rawNorm && norm(s.mac) && rawNorm.includes(norm(s.mac))) return s;
        }
        // some backends put the mac inside id without colons
        if (sensorMac && parsed.id && parsed.id.replace(/:/g, '').toLowerCase().includes(sensorMac.replace(/:/g, ''))) return s;
        // fallback: check if stored mac (no colons) is contained in stringified raw manufacturerData
        try {
          const m = String(parsed.raw?.manufacturerData || parsed.raw?.serviceData || '').replace(/[^0-9A-Fa-f]/g, '').toLowerCase();
          if (sensorMac && m && norm(s.mac) && m.includes(norm(s.mac))) return s;
        } catch (e) { }
      }
    } catch (e) { }
    return null;
  }

  /** Returns true if Bluetooth is powered on (for supported native libs). */
  async isBluetoothOn(): Promise<boolean> {
    try {
      const BleManager = require('react-native-ble-plx').BleManager;
      const manager = new BleManager();
      const stateNow = await manager.state();
      this.lastState = stateNow;
      return stateNow === 'PoweredOn';
    } catch (e) {
      return false;
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
          try { await IntentLauncher.startActivityAsync('android.settings.BLUETOOTH_SETTINGS'); } catch (e) { }
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
    } catch (e) { }

    // Try to open Bluetooth settings via Linking intent URL (fallback)
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Linking } = require('react-native');
      try {
        await Linking.openURL('android.settings.BLUETOOTH_SETTINGS');
      } catch (e) {
        try { await Linking.openURL('intent:#Intent;action=android.settings.BLUETOOTH_SETTINGS;end'); } catch (e) { }
      }
      await new Promise(r => setTimeout(r, 1000));
      return await this.isBluetoothOn();
    } catch (e) { }

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
        targetMac = deviceOrId.realMac || deviceOrId.mac || null;
        targetRawHex = deviceOrId.rawHex || deviceOrId.parsed?.rawHex || null;
      }

      this.pushDiagnostic('connect-start', { targetId, targetMac, hasRaw: !!targetRawHex });

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
        this.pushDiagnostic('connect-fallback-scan', { targetMac });
        const foundDevices: any[] = [];
        const scanPromise = new Promise<void>((resolve) => {
          manager.startDeviceScan(null, { allowDuplicates: true, scanMode: 2 }, (error: any, d: any) => {
            if (error) return;
            if (!d) return;
            try {
              const parsed = parseAdvertising(d);
              if (parsed) {
                const norm = (s: string | null) => (s || '').replace(/[^0-9A-Fa-f]/g, '').toLowerCase();
                const targetMacNorm = norm(targetMac);
                const parsedMacNorm = norm(parsed.realMac || parsed.mac);

                let match = false;
                if (targetMacNorm && parsedMacNorm && targetMacNorm === parsedMacNorm) match = true;
                else if (targetRawHex && parsed.rawHex && norm(parsed.rawHex).includes(norm(targetRawHex))) match = true;
                else if (targetId && d.id && d.id.toLowerCase() === String(targetId).toLowerCase()) match = true;

                if (match) {
                  foundDevices.push(d);
                  resolve();
                }
              }
            } catch (e) { }
          });
          setTimeout(() => resolve(), 3000); // 3 seconds scan for rotating addresses
        });
        await scanPromise;
        try { await manager.stopDeviceScan(); } catch (e) { }
        if (foundDevices.length > 0) {
          const d = foundDevices[0];
          this.pushDiagnostic('connect-found-live', { id: d.id, rssi: d.rssi });
          try { device = await manager.connectToDevice(d.id, { requestMTU: 256, autoConnect: false }); } catch (e) {
            this.pushDiagnostic('connect-live-err', { error: String(e) });
            device = null;
          }
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
        } catch (e) { }
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
      try { await manager.cancelDeviceConnection(deviceId); } catch (e) { }
    } catch (e) {
      // ignore when native not available
    }
  }
}

export const bleService = new BleService();
// Start offline queue worker
try { startQueueWorker(); } catch (e) { }
