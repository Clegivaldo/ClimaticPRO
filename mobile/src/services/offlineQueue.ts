import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

const QUEUE_KEY = 'sensor_reading_queue_v1';

export async function enqueueReading(item: any) {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push(item);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(arr));
  } catch (e) {
    console.warn('enqueueReading failed', e);
  }
}

export async function flushQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!arr.length) return;

    const remaining: any[] = [];
    for (const item of arr) {
      try {
        // item should have sensorId and payload
        await api.postSensorReading(item.sensorId, item.payload);
      } catch (err) {
        // keep for retry
        remaining.push(item);
      }
    }

    if (remaining.length) {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    } else {
      await AsyncStorage.removeItem(QUEUE_KEY);
    }
  } catch (e) {
    console.warn('flushQueue failed', e);
  }
}

let intervalId: any = null;
export function startQueueWorker(intervalMs = 15000) {
  if (intervalId) return;
  intervalId = setInterval(() => { flushQueue(); }, intervalMs);
  // flush immediately
  flushQueue();
}

export function stopQueueWorker() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
}
