import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Shared sensor store
 * Requirement 10.4: Persistence for offline support
 */

export interface Sensor {
  id: string;
  mac: string;
  alias?: string;
  deviceType: string;
  batteryLevel?: number;
  lastSeenAt?: string;
  isActive: boolean;
  alertConfig?: any;
}

export interface SensorReading {
  id: string;
  sensorId: string;
  temperature?: number;
  humidity?: number;
  co2?: number;
  timestamp: string;
}

interface SensorState {
  sensors: Sensor[];
  currentReadings: Record<string, SensorReading>;
  lastUpdated: string | null;
  setSensors: (sensors: Sensor[]) => void;
  updateSensor: (sensorId: string, data: Partial<Sensor>) => void;
  setReading: (sensorId: string, reading: SensorReading) => void;
}

export const useSensorStore = create<SensorState>()(
  persist(
    (set) => ({
      sensors: [],
      currentReadings: {},
      lastUpdated: null,
      setSensors: (sensors) => set({ sensors, lastUpdated: new Date().toISOString() }),
      updateSensor: (sensorId, data) => set((state) => ({
        sensors: state.sensors.map(s => s.id === sensorId ? { ...s, ...data } : s)
      })),
      setReading: (sensorId, reading) => set((state) => ({
        currentReadings: { ...state.currentReadings, [sensorId]: reading }
      })),
    }),
    {
      name: 'sensor-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
