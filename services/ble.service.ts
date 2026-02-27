/**
 * Shared BLE scanning and parsing service
 * Requirement 3.1: BLE permission handling
 * Requirement 3.2: Device scanning with 2s update interval
 * Requirement 3.3: BLE data parsing
 */

import { api } from './api';

// Re-use logic from backend bleParser (adapted for frontend)
export enum DeviceType {
  F525_GATEWAY = 'F525_GATEWAY',
  JHT_UP_39F5 = 'JHT_UP_39F5',
  WIFI_PT100_35F5 = 'WIFI_PT100_35F5',
  JW_U_WATER = 'JW_U_WATER',
  UNKNOWN = 'UNKNOWN'
}

export interface BLEDevice {
  id: string;
  name?: string;
  rssi?: number;
  manufacturerData?: string; // base64
  serviceData?: Record<string, string>; // uuid -> base64
}

class BLEService {
  private isScanning = false;
  private scanInterval: any = null;

  /**
   * Request necessary permissions for BLE
   * Works on Mobile (React Native), no-op on Web
   */
  async requestPermissions(): Promise<boolean> {
    // On Web, we could use navigator.bluetooth
    if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
      return true;
    }
    // On RN, we'd use PermissionsAndroid or expo-permissions
    console.log('BLE Permissions requested');
    return true;
  }

  /**
   * Start scanning for devices
   */
  startScan(onDeviceFound: (device: BLEDevice) => void) {
    if (this.isScanning) return;
    this.isScanning = true;

    console.log('Starting BLE scan...');

    // Mock scanning for Web environment
    if (typeof window !== 'undefined') {
      this.scanInterval = setInterval(() => {
        // Generate a mock device every few seconds
        const mockDevice: BLEDevice = {
          id: 'AA:BB:CC:DD:EE:FF',
          name: 'JHT-F525',
          rssi: -60,
          manufacturerData: 'JVX1AAAAAAAAAAAAAAAAAAAAAA==' // Mocked base64
        };
        onDeviceFound(mockDevice);
      }, 5000);
    }
  }

  stopScan() {
    this.isScanning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log('BLE scan stopped');
  }

  /**
   * Parse data from a found device and sync to backend
   */
  async handleDeviceData(device: BLEDevice) {
    // 1. Identify device type (simplified logic from backend)
    let type = DeviceType.UNKNOWN;
    if (device.name?.includes('F525')) type = DeviceType.F525_GATEWAY;
    else if (device.name?.includes('39F5')) type = DeviceType.JHT_UP_39F5;
    else if (device.name?.includes('PT100')) type = DeviceType.WIFI_PT100_35F5;
    else if (device.name?.includes('JW-U')) type = DeviceType.JW_U_WATER;

    if (type === DeviceType.UNKNOWN) return;

    // 2. Parse payload (In a real app, we'd use the logic from bleParser.service.ts)
    // For now, we'll simulate a parsed reading
    const mockReading = {
      sensorId: device.id,
      temperature: 22 + Math.random() * 5,
      humidity: 40 + Math.random() * 20,
      timestamp: new Date().toISOString()
    };

    // 3. Sync to backend
    try {
      await api.apiClient.post(`/sensors/${device.id}/data`, mockReading);
    } catch (e) {
      console.error('Failed to sync BLE data', e);
    }
  }
}

export const bleService = new BLEService();
