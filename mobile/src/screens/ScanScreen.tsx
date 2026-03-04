import React, { useEffect, useState, useRef } from 'react';
import { Modal, ScrollView } from 'react-native';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IconFallback from '../components/IconFallback';
import * as Location from 'expo-location';
import { api } from '../services/api';
import { bleService } from '../services/ble.service';
import { Linking } from 'react-native';
import { useSensorStore } from '../store/useSensorStore';

export const ScanScreen = ({ navigation }: any) => {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [registering, setRegistering] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [recentAds, setRecentAds] = useState<any[]>([]);
  const [rawAds, setRawAds] = useState<any[]>([]);
  const [diagnostics, setDiagnostics] = useState<any[]>([]);
  const [debugMacQuery, setDebugMacQuery] = useState('FE94B4A4F6EF');
  const [backendInfo, setBackendInfo] = useState({ backend: 'unknown', state: null as string | null });
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPostedReadingRef = useRef<Record<string, number>>({});
  const setReading = useSensorStore(state => state.setReading);
  const sensors = useSensorStore(state => state.sensors);
  const getCollectionIntervalMs = useSensorStore(state => state.getCollectionIntervalMs);

  const normalizeMac = (value?: string | null) => {
    if (!value) return null;
    const compact = String(value).replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    if (compact.length !== 12) return null;
    return compact.match(/.{1,2}/g)?.join(':') || null;
  };

  const stableDeviceKey = (device: any) => {
    // 1. Prioritize normalized 12-char MAC address (the most stable identifier)
    const preferred = normalizeMac(device?.realMac) || normalizeMac(device?.mac);
    if (preferred) return preferred;

    // 2. Try normalized 12-char version of ID
    const normalizedId = String(device?.id || '').replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    if (normalizedId.length === 12) {
      const asMac = normalizedId.match(/.{1,2}/g)?.join(':');
      if (asMac) return asMac;
    }

    // 3. Fallback to candidate tail matching for near-field noise
    const type = String(device?.type || '').toUpperCase();
    if (type.includes('BLE_NEAR_CANDIDATE')) {
      const tail = normalizedId.length >= 4 ? normalizedId.slice(-4) : normalizedId;
      if (tail) return `near-tail-${tail}`;
      return `near-name-${String(device?.name || 'BLE').trim().toUpperCase()}`;
    }

    if (type.includes('CANDIDATE')) {
      const tail = normalizedId.length >= 4 ? normalizedId.slice(-4) : normalizedId;
      if (tail) return `candidate-tail-${tail}`;
    }

    // 4. Fallback to advertisement signature or raw ID
    if (device?.advSignature) return String(device.advSignature).toLowerCase();
    return String(device?.id || device?.name || '').toLowerCase();
  };

  const sortDevices = (list: any[]) => {
    const normalizedMac = (v?: string | null) => {
      if (!v) return null;
      const c = String(v).replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
      return c.length === 12 ? c : null;
    };
    const score = (d: any) => {
      let s = 0;
      if (typeof d?.temperature === 'number') s += 4;
      if (typeof d?.humidity === 'number') s += 4;
      if (d?.realMac) s += 3;
      if (d?.mac) s += 2;
      if (normalizedMac(d?.realMac || d?.mac || d?.id)) s += 3;
      if (d?.type && /F525|JHT|39F5|35F5|WIFI/i.test(String(d.type))) s += 2;
      if (typeof d?.rssi === 'number') s += Math.max(0, 100 + Number(d.rssi)) / 100;
      return s;
    };
    return [...list].sort((a, b) => score(b) - score(a));
  };

  const registrationMacFor = (device: any) => {
    const preferred = normalizeMac(device?.realMac) || normalizeMac(device?.mac);
    if (preferred) return preferred;
    return normalizeMac(device?.id);
  };

  const shouldShowInMainList = (device: any) => {
    if (isAlreadyAdded(device)) return false;
    const type = String(device?.type || '').toUpperCase();
    if (type.includes('BLE_NEAR_CANDIDATE')) return false;
    if (typeof device?.temperature === 'number' || typeof device?.humidity === 'number') return true;
    if (/JHT|JAALEE|F525|39F5|35F5|PT100|THERMO/.test(type)) return true;
    const n = String(device?.name || '').toUpperCase();
    if (/JHT|JAALEE|THERMO|F525|39F5|35F5|PT100/.test(n)) return true;
    return false;
  };

  const hasThermoHints = (device: any) => {
    const type = String(device?.type || '').toUpperCase();
    const name = String(device?.name || '').toUpperCase();
    if (/JHT|JAALEE|THERMO|F525|39F5|35F5|PT100/.test(type)) return true;
    if (/JHT|JAALEE|THERMO|BEACON|F525|39F5|35F5|PT100/.test(name)) return true;

    const uuidSource = (() => {
      const uuids = device?.raw?.serviceUUIDs || device?.raw?.serviceUuids || device?.raw?.uuids || [];
      if (Array.isArray(uuids)) return uuids.join(',');
      try { return JSON.stringify(uuids || ''); } catch (e) { return String(uuids || ''); }
    })();

    if (/d0611e78-bbb4-4591-a5f8-487910ae4366|9fa480e0-4967-4542-9390-d343dc5d04ae/i.test(uuidSource)) return true;
    const rawHex = String(device?.rawHex || '').toUpperCase();
    if (/4C000215|F525|39F5|35F5|4A41414C4545/.test(rawHex)) return true;
    return false;
  };

  const isAlreadyAdded = (device: any) => {
    const registrationMac = registrationMacFor(device);
    const type = String(device?.type || '').toUpperCase();
    const advSignature = String(device?.advSignature || '').trim();
    const rawSignature = String(device?.rawHex || '').replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    const signatureToUse = advSignature || (rawSignature.length >= 12 ? rawSignature : '');
    const shouldUseSignature = type.includes('CANDIDATE') && signatureToUse.length >= 8;

    const existsByMac = !!registrationMac && sensors.some((s: any) => String(s?.mac || '').toUpperCase() === String(registrationMac).toUpperCase());
    const existsBySig = shouldUseSignature && sensors.some((s: any) => String((s as any)?.signature || '') === signatureToUse);
    return existsByMac || existsBySig;
  };

  const findExistingSensorForDevice = (device: any) => {
    const registrationMac = registrationMacFor(device);
    if (registrationMac) {
      const byMac = sensors.find((s: any) => String(s?.mac || '').toUpperCase() === String(registrationMac).toUpperCase());
      if (byMac) return byMac;
    }

    const type = String(device?.type || '').toUpperCase();
    const advSignature = String(device?.advSignature || '').trim();
    const rawSignature = String(device?.rawHex || '').replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    const signatureToUse = advSignature || (rawSignature.length >= 12 ? rawSignature : '');
    const shouldUseSignature = type.includes('CANDIDATE') && signatureToUse.length >= 8;

    if (shouldUseSignature) {
      const bySignature = sensors.find((s: any) => String((s as any)?.signature || '') === signatureToUse);
      if (bySignature) return bySignature;
    }

    return null;
  };

  const maybePersistDiscoveredReading = async (device: any) => {
    const hasTemp = typeof device?.temperature === 'number';
    const hasHum = typeof device?.humidity === 'number';
    if (!hasTemp && !hasHum) return;

    const sensor = findExistingSensorForDevice(device);
    if (!sensor?.id) return;

    const lastTs = lastPostedReadingRef.current[sensor.id] || 0;
    const now = Date.now();
    const intervalMs = getCollectionIntervalMs(sensor.id);
    if (now - lastTs < intervalMs) return;

    lastPostedReadingRef.current[sensor.id] = now;

    const timestamp = new Date(now).toISOString();
    const payload: any = { timestamp };
    if (hasTemp) payload.temperature = Number(device.temperature);
    if (hasHum) payload.humidity = Number(device.humidity);

    try {
      await api.postSensorReading(sensor.id, payload);
      setReading(sensor.id, {
        id: `scan-${sensor.id}-${now}`,
        sensorId: sensor.id,
        temperature: hasTemp ? Number(device.temperature) : undefined,
        humidity: hasHum ? Number(device.humidity) : undefined,
        timestamp,
      } as any);
    } catch (e) {
      lastPostedReadingRef.current[sensor.id] = 0;
    }
  };

  function decodeToHex(val: any) {
    if (!val) return null;
    if (typeof val === 'string') {
      const s = val.trim();
      const isBase64 = /^[A-Za-z0-9+/=\r\n]+$/.test(s) && s.length % 4 === 0;
      if (isBase64) {
        try {
          const Buf = require('buffer').Buffer;
          if (Buf && typeof Buf.from === 'function') {
            const bytes: number[] = Array.from(Buf.from(s, 'base64'));
            return bytes.map(b => (b < 16 ? '0' : '') + b.toString(16)).join('').toUpperCase();
          }
        } catch (e) { }
        try {
          const atobFn = typeof atob !== 'undefined' ? atob : (globalThis as any).atob;
          if (typeof atobFn === 'function') {
            const bin = atobFn(s);
            const bytes: number[] = [];
            for (let i = 0; i < bin.length; i++) bytes.push(bin.charCodeAt(i));
            return bytes.map(b => (b < 16 ? '0' : '') + b.toString(16)).join('').toUpperCase();
          }
        } catch (e) { }
      }
      if (/^[0-9a-fA-F]+$/.test(s)) return s.toUpperCase();
    }
    return null;
  }

  const strictDevices = devices.filter(shouldShowInMainList);
  const nearbyCandidates = devices
    .filter((d: any) => {
      const isNearCandidate = String(d?.type || '').toUpperCase().includes('BLE_NEAR_CANDIDATE');
      if (!isNearCandidate) return false;
      if (isAlreadyAdded(d)) return false;
      const strongSignal = typeof d?.rssi === 'number' && d.rssi >= -85;
      return hasThermoHints(d) || strongSignal;
    })
    .sort((a: any, b: any) => Number(b?.rssi ?? -999) - Number(a?.rssi ?? -999))
    .slice(0, 12);
  const strictKeys = new Set(strictDevices.map((d) => stableDeviceKey(d)));
  const visibleDevices = [...strictDevices, ...nearbyCandidates.filter((d) => !strictKeys.has(stableDeviceKey(d)))];

  const normalizeMacQuery = (value?: string | null) => String(value || '').replace(/[^0-9A-Fa-f]/g, '').toUpperCase();

  const debugMatchesQuery = (entry: any) => {
    const query = normalizeMacQuery(debugMacQuery);
    if (!query) return true;

    const raw = decodeToHex(entry?.parsed?.raw?.manufacturerData)
      || decodeToHex(entry?.parsed?.raw?.serviceData)
      || String(entry?.parsed?.rawHex || '');

    const fields = [
      entry?.parsed?.realMac,
      entry?.parsed?.mac,
      entry?.parsed?.id,
      raw,
      JSON.stringify(entry?.parsed || {}),
    ].map((v) => normalizeMacQuery(String(v || ''))).join('|');

    return fields.includes(query);
  };

  const rawMatchesQuery = (entry: any) => {
    const query = normalizeMacQuery(debugMacQuery);
    if (!query) return true;

    const raw = entry?.raw || {};
    const fields = [
      raw?.id,
      raw?.name,
      decodeToHex(raw?.manufacturerData),
      decodeToHex(raw?.serviceData),
      JSON.stringify(raw || {}),
    ].map((v) => normalizeMacQuery(String(v || ''))).join('|');

    return fields.includes(query);
  };

  const filteredRecentAds = recentAds.filter((a) => debugMatchesQuery(a));
  const filteredRawAds = rawAds.filter((a) => rawMatchesQuery(a));
  const filteredDiagnostics = diagnostics.filter((d) => {
    const query = normalizeMacQuery(debugMacQuery);
    if (!query) return true;
    const fields = [d?.parsedRealMac, d?.realMac, d?.parsedMac, d?.mac, d?.sensorMac, JSON.stringify(d || {})]
      .map((v) => normalizeMacQuery(String(v || '')))
      .join('|');
    return fields.includes(query);
  });

  const startScan = async () => {
    setIsScanning(true);
    setDevices([]);
    refreshBackendInfo();

    // If possible, check Bluetooth state first and prompt user
    try {
      const on = await bleService.isBluetoothOn();
      if (!on) {
        Alert.alert(
          'Bluetooth Desligado',
          'O Bluetooth do dispositivo está desligado. Por favor ative o Bluetooth para buscar sensores.',
          [
            { text: 'Abrir Configurações', onPress: () => { try { Linking.openSettings(); } catch (e) { } } },
            { text: 'Cancelar', style: 'cancel' }
          ]
        );
        setIsScanning(false);
        return;
      }
    } catch (e) {
      // ignore; proceed with scan and let native module decide
    }


    try {
      await bleService.startScan((device: any) => {
        refreshBackendInfo();
        // Avoid duplicates by mac/id
        setDevices(prev => {
          const incomingKey = stableDeviceKey(device);
          const exists = prev.find(d => stableDeviceKey(d) === incomingKey);
          const next = exists
            ? prev.map(d => {
              if (stableDeviceKey(d) !== incomingKey) return d;
              const prevRssi = typeof d?.rssi === 'number' ? d.rssi : -999;
              const nextRssi = typeof device?.rssi === 'number' ? device.rssi : -999;
              const stronger = nextRssi >= prevRssi;
              return {
                ...(stronger ? d : device),
                ...(stronger ? device : d),
                id: device?.id || d?.id,
                mac: device?.mac || d?.mac,
                realMac: device?.realMac || d?.realMac,
                rssi: stronger ? nextRssi : prevRssi,
                temperature: typeof device?.temperature === 'number' ? device.temperature : d?.temperature,
                humidity: typeof device?.humidity === 'number' ? device.humidity : d?.humidity,
              };
            })
            : [...prev, device];
          return sortDevices(next);
        });
        // stop showing spinner once we have at least one device
        setIsScanning(false);

        void maybePersistDiscoveredReading(device);
      });

      // Stop scan after a reasonable timeout to avoid infinite searching
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = setTimeout(() => {
        try { bleService.stopScan(); } catch (e) { }
        refreshBackendInfo();
        setIsScanning(false);
      }, 12000);
    } catch (err) {
      const msg = String(err || '');
      if (msg.includes('BluetoothDisabled') || msg.toLowerCase().includes('bluetooth')) {
        Alert.alert(
          'Bluetooth Desligado',
          'O Bluetooth do dispositivo está desligado. Por favor ative o Bluetooth para buscar sensores.',
          [
            {
              text: 'Ligar Bluetooth', onPress: async () => {
                try {
                  const ok = await bleService.enableBluetooth();
                  if (ok) {
                    startScan();
                    return;
                  }
                  // If enableBluetooth couldn't programmatically enable, try opening Bluetooth settings directly
                  try {
                    // try expo-intent-launcher first
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    const IntentLauncher = require('expo-intent-launcher');
                    if (IntentLauncher && typeof IntentLauncher.startActivityAsync === 'function') {
                      const action = IntentLauncher.ACTION_BLUETOOTH_SETTINGS || 'android.settings.BLUETOOTH_SETTINGS';
                      try { await IntentLauncher.startActivityAsync(action); return; } catch (e) { }
                    }
                  } catch (e) { }
                  try {
                    await Linking.openURL('intent:#Intent;action=android.settings.BLUETOOTH_SETTINGS;end');
                    return;
                  } catch (e) { }
                  try { await Linking.openSettings(); } catch (e) { }
                } catch (e) {
                  try { await Linking.openSettings(); } catch (e) { }
                }
              }
            },
            { text: 'Cancelar', style: 'cancel' }
          ]
        );
      } else {
        Alert.alert('Erro', 'Não foi possível iniciar a varredura BLE real: ' + String(err));
      }
      setDevices([]);
      setIsScanning(false);
    }
  };

  const mapDeviceType = (t: string | undefined | null) => {
    if (!t) return 'F525_GATEWAY';
    const s = String(t).toUpperCase();
    if (s.includes('F525') || s.includes('GATEWAY')) return 'F525_GATEWAY';
    if (s.includes('JHT') || s.includes('JAALEE') || s.includes('UP') || s.includes('39F5')) return 'JHT_UP_39F5';
    if (s.includes('PT100') || s.includes('WIFI')) return 'WIFI_PT100_35F5';
    if (s.includes('BLE_NEAR_CANDIDATE')) return 'JHT_UP_39F5';
    if (s.includes('WATER')) return 'JW_U_WATER';
    return 'F525_GATEWAY';
  };

  useEffect(() => {
    startScan();
    return () => {
      try { bleService.stopScan(); } catch (e) { }
      try { if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current); } catch (e) { }
    };
  }, []);

  const refreshRecentAds = () => {
    try { setRecentAds(bleService.getRecentAds()); } catch (e) { setRecentAds([]); }
  };

  const refreshRawAds = () => {
    try { setRawAds(bleService.getRawAds()); } catch (e) { setRawAds([]); }
  };

  const refreshDiagnostics = () => {
    try { setDiagnostics(bleService.getDiagnostics()); } catch (e) { setDiagnostics([]); }
  };

  const copyToClipboard = async (text: string) => {
    try {
      // try expo-clipboard first
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Clip = require('expo-clipboard');
      if (Clip && typeof Clip.setStringAsync === 'function') {
        await Clip.setStringAsync(String(text));
        return true;
      }
    } catch (e) { }
    try {
      // try react-native Clipboard or community clipboard
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const RN = require('react-native');
      const maybe = RN.Clipboard || (RN as any).Clipboard;
      if (maybe && typeof maybe.setString === 'function') {
        maybe.setString(String(text));
        return true;
      }
    } catch (e) { }
    try {
      // try community package
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Clip2 = require('@react-native-clipboard/clipboard');
      if (Clip2 && typeof Clip2.setString === 'function') {
        Clip2.setString(String(text));
        return true;
      }
    } catch (e) { }
    return false;
  };

  const refreshBackendInfo = () => {
    try {
      const b = bleService.getBackend();
      const s = bleService.getBluetoothState();
      setBackendInfo({ backend: b, state: s });
    } catch (e) { setBackendInfo({ backend: 'unknown', state: null }); }
  };

  const handleAddDevice = async (device: any) => {
    const registrationMac = registrationMacFor(device);
    setRegistering(registrationMac || device.id);
    try {
      // Ensure Bluetooth is enabled before attempting to add a BLE device
      try {
        const on = await bleService.isBluetoothOn();
        if (!on) {
          Alert.alert(
            'Bluetooth Desligado',
            'Por favor ative o Bluetooth antes de adicionar este dispositivo.',
            [
              { text: 'Abrir Configurações', onPress: () => { try { Linking.openSettings(); } catch (e) { } } },
              { text: 'Cancelar', style: 'cancel' }
            ]
          );
          setRegistering(null);
          return;
        }
      } catch (e) {
        // If we can't determine Bluetooth state here, proceed and let native scan flow validate it.
      }

      const deviceType = mapDeviceType(device.type);
      const type = String(device?.type || '').toUpperCase();
      const advSignature = String(device?.advSignature || '').trim();
      const rawSignature = String(device?.rawHex || '').replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
      const signatureToUse = advSignature || (rawSignature.length >= 12 ? rawSignature : '');
      const shouldUseSignature = type.includes('CANDIDATE') && signatureToUse.length >= 8;

      const existsByMac = !!registrationMac && sensors.some((s: any) => String(s?.mac || '').toUpperCase() === String(registrationMac).toUpperCase());
      const existsBySig = shouldUseSignature && sensors.some((s: any) => String((s as any)?.signature || '') === signatureToUse);
      if (isAlreadyAdded(device)) {
        Alert.alert('Aviso', 'Esse sensor já está cadastrado nesta conta.');
        return;
      }

      if (!shouldUseSignature && !registrationMac) {
        Alert.alert('Erro', 'Não foi possível identificar um MAC válido deste sensor. Abra o Debug BLE e use “Adicionar por assinatura”.');
        return;
      }

      const createdSensor = shouldUseSignature
        ? await api.registerSensor(undefined, deviceType, device.name, signatureToUse)
        : await api.registerSensor(registrationMac!, deviceType, device.name);

      const hasTemp = typeof device?.temperature === 'number';
      const hasHum = typeof device?.humidity === 'number';
      if (createdSensor?.id && (hasTemp || hasHum)) {
        const timestamp = new Date().toISOString();
        const payload: any = { timestamp };
        if (hasTemp) payload.temperature = Number(device.temperature);
        if (hasHum) payload.humidity = Number(device.humidity);

        try { await api.postSensorReading(createdSensor.id, payload); } catch (e) { }
        try {
          setReading(createdSensor.id, {
            id: `local-${createdSensor.id}-${Date.now()}`,
            sensorId: createdSensor.id,
            temperature: hasTemp ? Number(device.temperature) : undefined,
            humidity: hasHum ? Number(device.humidity) : undefined,
            timestamp,
          } as any);
        } catch (e) { }
      }

      if (shouldUseSignature) {
        Alert.alert('Sucesso', 'Sensor adicionado por assinatura. Aguarde alguns anúncios para popular as leituras.');
      } else {
        Alert.alert('Sucesso', 'Sensor adicionado com sucesso!');
      }
      navigation.navigate('Dashboard');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível adicionar este sensor. Talvez ele já esteja cadastrado.');
    } finally {
      setRegistering(null);
    }
  };

  const handleConnectDevice = async (device: any) => {
    const targetId = device.id || device.mac;
    setConnectingId(device.id); // Use device.id as strictly unique instance key for the spinner
    try {
      // Ensure bluetooth on
      try { const on = await bleService.isBluetoothOn(); if (!on) throw new Error('Bluetooth desligado'); } catch (e) { throw new Error('Bluetooth desligado'); }

      // pass full device object so service can match by rawHex if needed
      const res = await bleService.connectToDevice(device);
      const services = res?.device?.services || [];
      const summary = services.map((s: any) => `${s.uuid} (${s.characteristics.length} ch)`).join('\n');
      Alert.alert('Conectado', `Conectado a ${device.name || device.id}\nServiços:\n${summary || 'nenhum serviço encontrado'}`);
      try {
        const connectedId = res?.device?.id || targetId;
        if (connectedId) await bleService.disconnectDevice(String(connectedId));
      } catch (e) { }
    } catch (err: any) {
      Alert.alert('Erro', 'Não foi possível conectar: ' + String(err?.message || err));
    } finally {
      setConnectingId(null);
    }
  };

  const renderDeviceItem = ({ item }: any) => (
    <View style={styles.deviceCard}>
      <View style={styles.deviceInfo}>
        <View style={styles.iconContainer}>
          <IconFallback name="Bluetooth" size={20} color="#197fe6" />
        </View>
        <View>
          <Text style={styles.deviceName}>{item.name}</Text>
          <Text style={styles.deviceMac}>{item.realMac || item.mac || item.id}</Text>
          <Text style={styles.deviceRssi}>Sinal: {item.rssi} dBm</Text>
          <Text style={styles.deviceRssi}>
            Temp: {typeof item.temperature === 'number' ? `${item.temperature.toFixed(2)} °C` : '--'}
            {'  '}Umid: {typeof item.humidity === 'number' ? `${item.humidity.toFixed(2)} %` : '--'}
          </Text>
        </View>
      </View>
      <View style={styles.actionsContainer}>
        {String(item?.type || '').toUpperCase().includes('CANDIDATE') ? null : (
          <TouchableOpacity
            style={styles.connectButton}
            onPress={() => handleConnectDevice(item)}
            disabled={!!connectingId}
          >
            {connectingId === item.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.connectText}>Conectar</Text>
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => handleAddDevice(item)}
          disabled={!!registering}
        >
          {registering === (registrationMacFor(item) || item.id) ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <IconFallback name="Plus" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <IconFallback name="ChevronLeft" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Buscar Sensores</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => { refreshRecentAds(); refreshRawAds(); refreshDiagnostics(); refreshBackendInfo(); setDebugOpen(true); }} style={[styles.refreshButton, { marginRight: 8 }]}>
              <IconFallback name="Activity" size={20} color="#64748b" />
            </TouchableOpacity>
            <TouchableOpacity onPress={startScan} disabled={isScanning} style={styles.refreshButton}>
              <IconFallback name="RefreshCw" size={20} color={isScanning ? "#cbd5e1" : "#197fe6"} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e6eef9' }}>
          <Text style={{ fontSize: 12, color: '#475569' }}>BLE backend: {backendInfo.backend} — state: {backendInfo.state || 'unknown'}</Text>
          {nearbyCandidates.length > 0 ? (
            <Text style={{ fontSize: 12, color: '#92400e', marginTop: 4 }}>
              Encontrados {nearbyCandidates.length} candidatos BLE próximos além dos sensores identificados.
            </Text>
          ) : null}
        </View>

        <View style={styles.content}>
          {isScanning ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#197fe6" />
              <Text style={styles.scanningText}>Buscando dispositivos próximos...</Text>
            </View>
          ) : (
            <FlatList
              data={visibleDevices}
              renderItem={renderDeviceItem}
              keyExtractor={item => stableDeviceKey(item)}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <View style={styles.centered}>
                  <Text style={styles.emptyText}>Nenhum sensor próximo identificado.</Text>
                  <TouchableOpacity style={styles.retryButton} onPress={startScan}>
                    <Text style={styles.retryButtonText}>Tentar Novamente</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          )}
        </View>
      </SafeAreaView>

      <Modal visible={debugOpen} animationType="slide" onRequestClose={() => setDebugOpen(false)}>
        <SafeAreaView style={{ flex: 1, padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Debug BLE — anúncios recentes</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => { refreshRecentAds(); refreshRawAds(); refreshDiagnostics(); }}
                style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#eef2ff', borderRadius: 8, marginRight: 8 }}
              >
                <Text style={{ color: '#1e3a8a', fontWeight: '700', fontSize: 12 }}>Atualizar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { try { bleService.clearDiagnostics(); bleService.clearRecentAds(); bleService.clearRawAds(); } catch (e) { } refreshRecentAds(); refreshRawAds(); refreshDiagnostics(); }}
                style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fee2e2', borderRadius: 8, marginRight: 8 }}
              >
                <Text style={{ color: '#991b1b', fontWeight: '700', fontSize: 12 }}>Limpar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setDebugOpen(false); }} style={{ padding: 8 }}>
                <IconFallback name="X" size={20} color="#111827" />
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView style={{ marginTop: 12 }}>
            <View style={{ marginBottom: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 10 }}>
              <Text style={{ fontSize: 12, color: '#334155', fontWeight: '700', marginBottom: 6 }}>Filtro por MAC (Debug)</Text>
              <TextInput
                value={debugMacQuery}
                onChangeText={setDebugMacQuery}
                autoCapitalize="characters"
                autoCorrect={false}
                style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#0f172a', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}
                placeholder="FE:94:B4:A1:F6:EF"
                placeholderTextColor="#94a3b8"
              />
              <Text style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>Filtrando por: {debugMacQuery || 'todos'}</Text>
            </View>

            <Text style={{ fontSize: 15, fontWeight: '700', marginBottom: 8 }}>Diagnóstico de fluxo</Text>
            {filteredDiagnostics.length === 0 ? (
              <Text style={{ color: '#64748b', marginBottom: 12 }}>Sem eventos de diagnóstico ainda.</Text>
            ) : (
              filteredDiagnostics.map((d, i) => (
                <View key={`diag-${i}`} style={{ padding: 10, marginBottom: 8, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <Text style={{ fontSize: 11, color: '#334155' }}>{new Date(d.ts).toLocaleTimeString()} • {String(d.kind || '').toUpperCase()}</Text>
                  <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 4 }}>
                    sensorId={d.sensorId || '--'} mac={d.parsedRealMac || d.realMac || d.parsedMac || d.mac || '--'} temp={typeof d.temperature === 'number' ? d.temperature : '--'} hum={typeof d.humidity === 'number' ? d.humidity : '--'}
                  </Text>
                </View>
              ))
            )}

            <Text style={{ fontSize: 15, fontWeight: '700', marginBottom: 8, marginTop: 6 }}>Anúncios parseados</Text>
            {filteredRecentAds.length === 0 ? (
              <Text style={{ color: '#64748b' }}>Nenhum anúncio detectado ainda.</Text>
            ) : (
              filteredRecentAds.map((a, i) => (
                <View key={i} style={{ padding: 12, marginBottom: 8, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#197fe6' }}>
                  <Text style={{ fontSize: 12, color: '#333' }}>{new Date(a.ts).toLocaleString()}</Text>
                  <Text style={{ fontWeight: '600', marginTop: 6 }}>{a.parsed?.name || a.parsed?.id || 'unknown'}</Text>
                  <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 6 }}>{JSON.stringify(a.parsed)}</Text>
                  {/* show decoded manufacturer/service data if available */}
                  {a.parsed?.raw?.manufacturerData ? (
                    <View style={{ marginTop: 8 }}>
                      <Text style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>manufacturerData (decoded hex):</Text>
                      <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>{decodeToHex(a.parsed.raw.manufacturerData) || String(a.parsed.raw.manufacturerData)}</Text>
                    </View>
                  ) : null}
                  {a.parsed?.raw?.serviceData ? (
                    <View style={{ marginTop: 8 }}>
                      <Text style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>serviceData (decoded hex):</Text>
                      <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>{decodeToHex(a.parsed.raw.serviceData) || JSON.stringify(a.parsed.raw.serviceData)}</Text>
                    </View>
                  ) : null}
                  <View style={{ flexDirection: 'row', marginTop: 8, justifyContent: 'flex-end' }}>
                    <TouchableOpacity onPress={async () => {
                      const candidate = decodeToHex(a.parsed?.raw?.manufacturerData) || decodeToHex(a.parsed?.raw?.serviceData) || JSON.stringify(a.parsed?.raw || a.parsed || {});
                      try {
                        const ok = await copyToClipboard(String(candidate));
                        if (ok) Alert.alert('Copiado', 'Dados brutos copiados para a área de transferência.');
                        else Alert.alert('Erro', 'Não foi possível copiar.');
                      } catch (e) { Alert.alert('Erro', 'Não foi possível copiar.'); }
                    }} style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#eef2ff', borderRadius: 8 }}>
                      <Text style={{ color: '#1e3a8a', fontWeight: '600' }}>Copiar bruto</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={async () => {
                      // register by signature: generate deterministic pseudo-mac from rawHex
                      try {
                        const hex = decodeToHex(a.parsed?.raw?.manufacturerData) || decodeToHex(a.parsed?.raw?.serviceData) || a.parsed?.rawHex || '';
                        if (!hex || hex.length < 6) { Alert.alert('Erro', 'Assinatura insuficiente para gerar MAC'); return; }
                        // take first 12 hex chars, pad if necessary
                        const sig = hex.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
                        Alert.alert('Adicionar por assinatura', `Registrar sensor com assinatura: ${sig.slice(0, 24)}... ?`, [
                          { text: 'Cancelar', style: 'cancel' },
                          {
                            text: 'Confirmar', onPress: async () => {
                              try {
                                const type = mapDeviceType(a.parsed?.type);
                                await api.registerSensor(undefined, type, a.parsed?.name || 'Assinado', sig);
                                Alert.alert('Sucesso', 'Sensor registrado por assinatura.');
                                setDebugOpen(false);
                              } catch (err: any) {
                                Alert.alert('Erro', String(err?.response?.data?.message || err.message || err));
                              }
                            }
                          }
                        ]);
                      } catch (e) { Alert.alert('Erro', 'Falha ao gerar MAC'); }
                    }} style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#ecfdf5', borderRadius: 8, marginLeft: 8 }}>
                      <Text style={{ color: '#064e3b', fontWeight: '600' }}>Adicionar por assinatura</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            <Text style={{ fontSize: 15, fontWeight: '700', marginBottom: 8, marginTop: 10 }}>Anúncios brutos (sem parser)</Text>
            {filteredRawAds.length === 0 ? (
              <Text style={{ color: '#64748b' }}>Nenhum anúncio bruto correspondente ao filtro.</Text>
            ) : (
              filteredRawAds.slice(0, 60).map((a, i) => (
                <View key={`raw-${i}`} style={{ padding: 12, marginBottom: 8, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#f59e0b' }}>
                  <Text style={{ fontSize: 12, color: '#333' }}>{new Date(a.ts).toLocaleString()}</Text>
                  <Text style={{ fontWeight: '600', marginTop: 4 }}>{a.raw?.name || a.raw?.id || 'unknown'}</Text>
                  <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 4 }}>id={String(a.raw?.id || '--')} rssi={String(a.raw?.rssi ?? '--')}</Text>
                  <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 4 }}>mfgHex={decodeToHex(a.raw?.manufacturerData) || '--'}</Text>
                  <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 4 }}>svcHex={decodeToHex(a.raw?.serviceData) || '--'}</Text>
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  backButton: { padding: 5 },
  refreshButton: { padding: 5 },
  content: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  scanningText: { marginTop: 20, color: '#64748b', textAlign: 'center' },
  list: { padding: 20 },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  deviceInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  deviceName: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  deviceMac: { fontSize: 11, color: '#64748b', marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  deviceRssi: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#197fe6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsContainer: { flexDirection: 'row', alignItems: 'center' },
  connectButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#059669', marginRight: 8 },
  connectText: { color: '#fff', fontWeight: '600' },
  emptyText: { color: '#64748b', textAlign: 'center' },
  retryButton: { marginTop: 15, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#eff6ff', borderRadius: 10 },
  retryButtonText: { color: '#197fe6', fontWeight: 'bold', fontSize: 14 },
});
