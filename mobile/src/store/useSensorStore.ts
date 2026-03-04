import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Shared sensor store for Mobile
 */

export interface Sensor {
  id: string;
  mac: string;
  alias?: string;
  deviceType: string;
  batteryLevel?: number;
  lastSeenAt?: string;
  lastReadingAt?: string | null;
  readingCount?: number;
  isActive: boolean;
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
  collectionIntervalsSec: Record<string, number>;
  lastUpdated: string | null;
  setSensors: (sensors: Sensor[]) => void;
  updateSensor: (sensorId: string, data: Partial<Sensor>) => void;
  setReading: (sensorId: string, reading: SensorReading) => void;
  getCollectionIntervalMs: (sensorId: string) => number;
  setCollectionIntervalSec: (sensorId: string, seconds: number) => void;
}

const DEFAULT_COLLECTION_SEC = 60;
const MIN_COLLECTION_SEC = 10;
const MAX_COLLECTION_SEC = 1800;

const clampCollectionSec = (seconds: number) => {
  if (!Number.isFinite(seconds)) return DEFAULT_COLLECTION_SEC;
  return Math.min(MAX_COLLECTION_SEC, Math.max(MIN_COLLECTION_SEC, Math.round(seconds)));
};

export const useSensorStore = create<SensorState>()(
  persist(
    (set) => ({
      sensors: [],
      currentReadings: {},
      collectionIntervalsSec: {},
      lastUpdated: null,
      setSensors: (sensors) => set({ sensors, lastUpdated: new Date().toISOString() }),
      updateSensor: (sensorId, data) => set((state) => ({
        sensors: state.sensors.map(s => s.id === sensorId ? { ...s, ...data } : s)
      })),
      setReading: (sensorId, reading) => set((state) => ({
        currentReadings: { ...state.currentReadings, [sensorId]: reading }
      })),
      getCollectionIntervalMs: (sensorId) => {
        const sec = useSensorStore.getState().collectionIntervalsSec[sensorId] ?? DEFAULT_COLLECTION_SEC;
        return clampCollectionSec(sec) * 1000;
      },
      setCollectionIntervalSec: (sensorId, seconds) => set((state) => ({
        collectionIntervalsSec: {
          ...state.collectionIntervalsSec,
          [sensorId]: clampCollectionSec(seconds),
        }
      })),
    }),
    {
      name: 'sensor-storage',
      storage: createJSONStorage(() => ({
        getItem: (name) => AsyncStorage.getItem(name),
        setItem: (name, value) => AsyncStorage.setItem(name, value),
        removeItem: (name) => AsyncStorage.removeItem(name),
      })),
    }
  )
);
