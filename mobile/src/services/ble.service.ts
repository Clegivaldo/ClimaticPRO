import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { parseAdvertising } from '../utils/bleParser';

type DeviceCallback = (device: any) => void;

class BleService {
  private scanning = false;
  private stopFn: (() => void) | null = null;

  async startScan(onDevice: DeviceCallback) {
    // Ensure location permission on Android (required for BLE scanning)
    if (Platform.OS === 'android') {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('Location permission denied');
    }

    this.scanning = true;

    // Try dynamic import of a native BLE library. If not available, fall back to simulation.
    try {
      // Prefer react-native-ble-plx when available
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const BleManager = require('react-native-ble-plx').BleManager;
      const manager = new BleManager();

      // Check Bluetooth state before starting scan
      const stateNow = await manager.state();
      if (stateNow !== 'PoweredOn') {
        // wait briefly for state to change, otherwise reject with specific error
        let resolved = false;
        const sub = manager.onStateChange((s: string) => {
          if (s === 'PoweredOn' && !resolved) {
            resolved = true;
            sub.remove();
            manager.startDeviceScan(null, { allowDuplicates: false }, (error: any, device: any) => {
              if (error) return;
              const parsed = parseAdvertising(device);
              if (parsed) onDevice(parsed);
            });
          }
        }, true);

        // if not powered on after short timeout, fail so UI can prompt user
        await new Promise((resolve, _reject) => setTimeout(resolve, 1200));
        if (!resolved) {
          try { sub.remove(); } catch (e) {}
          throw new Error('BluetoothDisabled');
        }
      } else {
        manager.startDeviceScan(null, { allowDuplicates: false }, (error: any, device: any) => {
          if (error) return;
          const parsed = parseAdvertising(device);
          if (parsed) onDevice(parsed);
        });
      }

      this.stopFn = async () => {
        try { await manager.stopDeviceScan(); } catch (e) {}
        try { subscription.remove(); } catch (e) {}
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
      const listener = addListener('onScanResult', (result: any) => {
        const parsed = parseAdvertising(result);
        if (parsed) onDevice(parsed);
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

    const timer = setTimeout(() => {
      mockedDevices.forEach(d => onDevice(d));
      this.scanning = false;
    }, 1500);

    this.stopFn = () => {
      clearTimeout(timer);
      this.scanning = false;
    };
  }

  stopScan() {
    if (this.stopFn) this.stopFn();
    this.scanning = false;
  }

  isScanning() { return this.scanning; }
}

export const bleService = new BleService();
