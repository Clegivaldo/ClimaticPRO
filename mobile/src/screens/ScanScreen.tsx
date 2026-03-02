import React, { useEffect, useState, useRef } from 'react';
import { Modal, ScrollView } from 'react-native';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IconFallback from '../components/IconFallback';
import * as Location from 'expo-location';
import { api } from '../services/api';
import { bleService } from '../services/ble.service';
import { Linking } from 'react-native';

export const ScanScreen = ({ navigation }: any) => {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [registering, setRegistering] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [recentAds, setRecentAds] = useState<any[]>([]);
  const [backendInfo, setBackendInfo] = useState({ backend: 'unknown', state: null as string | null });
  const scanTimeoutRef = useRef<number | null>(null);

  const startScan = async () => {
    setIsScanning(true);
    setDevices([]);

    // If possible, check Bluetooth state first and prompt user
    try {
      const on = await bleService.isBluetoothOn();
      if (!on) {
        Alert.alert(
          'Bluetooth Desligado',
          'O Bluetooth do dispositivo está desligado. Por favor ative o Bluetooth para buscar sensores.',
          [
            { text: 'Abrir Configurações', onPress: () => { try { Linking.openSettings(); } catch (e) {} } },
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
        // Avoid duplicates by mac/id
        setDevices(prev => {
          const exists = prev.find(d => d.mac === device.mac || d.id === device.id);
          if (exists) return prev.map(d => d.mac === device.mac || d.id === device.id ? { ...d, ...device } : d);
          return [...prev, device];
        });
        // stop showing spinner once we have at least one device
        setIsScanning(false);
      });

      // Stop scan after a reasonable timeout to avoid infinite searching
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = setTimeout(() => {
        try { bleService.stopScan(); } catch (e) {}
        setIsScanning(false);
      }, 12000);
    } catch (err) {
      const msg = String(err || '');
      if (msg.includes('BluetoothDisabled') || msg.toLowerCase().includes('bluetooth')) {
        Alert.alert(
          'Bluetooth Desligado',
          'O Bluetooth do dispositivo está desligado. Por favor ative o Bluetooth para buscar sensores.',
          [
            { text: 'Ligar Bluetooth', onPress: async () => {
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
                      try { await IntentLauncher.startActivityAsync(action); return; } catch (e) {}
                    }
                  } catch (e) {}
                  try {
                    await Linking.openURL('intent:#Intent;action=android.settings.BLUETOOTH_SETTINGS;end');
                    return;
                  } catch (e) {}
                  try { await Linking.openSettings(); } catch (e) {}
                } catch (e) {
                  try { await Linking.openSettings(); } catch (e) {}
                }
              }
            },
            { text: 'Cancelar', style: 'cancel' }
          ]
        );
      } else {
        Alert.alert('Erro', 'Não foi possível iniciar a varredura BLE: ' + String(err));
      }
      // fallback to simulation for dev
      setTimeout(() => {
        setDevices([
          { id: '1', name: 'JHT-F525 Gateway', mac: 'C1:32:71:39:72:95', type: 'F525_GATEWAY', rssi: -65 },
          { id: '2', name: 'Wifi-PT100 Sensor', mac: '00:E8:31:CD:80:79', type: 'WIFI_PT100_35F5', rssi: -72 },
        ]);
        setIsScanning(false);
      }, 1500);
    }
  };

  const mapDeviceType = (t: string | undefined | null) => {
    if (!t) return 'F525_GATEWAY';
    const s = String(t).toUpperCase();
    if (s.includes('F525') || s.includes('GATEWAY')) return 'F525_GATEWAY';
    if (s.includes('JHT') || s.includes('JAALEE') || s.includes('UP') || s.includes('39F5')) return 'JHT_UP_39F5';
    if (s.includes('PT100') || s.includes('WIFI')) return 'WIFI_PT100_35F5';
    if (s.includes('WATER')) return 'JW_U_WATER';
    return 'F525_GATEWAY';
  };

  useEffect(() => {
    startScan();
    return () => {
      try { bleService.stopScan(); } catch (e) {}
      try { if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current); } catch (e) {}
    };
  }, []);

  const refreshRecentAds = () => {
    try { setRecentAds(bleService.getRecentAds()); } catch (e) { setRecentAds([]); }
  };

  const decodeToHex = (val: any) => {
    if (!val) return null;
    // string base64 or hex
    if (typeof val === 'string') {
      const s = val.trim();
      const isBase64 = /^[A-Za-z0-9+/=\r\n]+$/.test(s) && s.length % 4 === 0;
      if (isBase64) {
        try {
          // try Buffer first
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const Buf = require('buffer').Buffer;
          if (Buf && typeof Buf.from === 'function') {
            const bytes: number[] = Array.from(Buf.from(s, 'base64'));
            return bytes.map(b => (b < 16 ? '0' : '') + b.toString(16)).join('').toUpperCase();
          }
        } catch (e) {}
        try {
          const atobFn = typeof atob !== 'undefined' ? atob : (globalThis as any).atob;
          if (typeof atobFn === 'function') {
            const bin = atobFn(s);
            const bytes: number[] = [];
            for (let i = 0; i < bin.length; i++) bytes.push(bin.charCodeAt(i));
            return bytes.map(b => (b < 16 ? '0' : '') + b.toString(16)).join('').toUpperCase();
          }
        } catch (e) {}
      }
      // looks like hex already
      if (/^[0-9a-fA-F]+$/.test(s)) return s.toUpperCase();
    }
    return null;
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
    } catch (e) {}
    try {
      // try react-native Clipboard or community clipboard
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const RN = require('react-native');
      const maybe = RN.Clipboard || (RN as any).Clipboard;
      if (maybe && typeof maybe.setString === 'function') {
        maybe.setString(String(text));
        return true;
      }
    } catch (e) {}
    try {
      // try community package
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Clip2 = require('@react-native-clipboard/clipboard');
      if (Clip2 && typeof Clip2.setString === 'function') {
        Clip2.setString(String(text));
        return true;
      }
    } catch (e) {}
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
    setRegistering(device.mac);
    try {
      // Ensure Bluetooth is enabled before attempting to add a BLE device
      try {
        const on = await bleService.isBluetoothOn();
        if (!on) {
          Alert.alert(
            'Bluetooth Desligado',
            'Por favor ative o Bluetooth antes de adicionar este dispositivo.',
            [
              { text: 'Abrir Configurações', onPress: () => { try { Linking.openSettings(); } catch (e) {} } },
              { text: 'Cancelar', style: 'cancel' }
            ]
          );
          setRegistering(null);
          return;
        }
      } catch (e) {
        // If we can't determine Bluetooth state, continue (simulation/dev)
      }

      const deviceType = mapDeviceType(device.type);
      await api.registerSensor(device.mac, deviceType, device.name);
      Alert.alert('Sucesso', 'Sensor adicionado com sucesso!');
      navigation.navigate('Dashboard');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível adicionar este sensor. Talvez ele já esteja cadastrado.');
    } finally {
      setRegistering(null);
    }
  };

  const handleConnectDevice = async (device: any) => {
    setConnectingId(device.id || device.mac);
    try {
      // Ensure bluetooth on
      try { const on = await bleService.isBluetoothOn(); if (!on) throw new Error('Bluetooth desligado'); } catch (e) { throw new Error('Bluetooth desligado'); }

      // pass full device object so service can match by rawHex if needed
      const res = await bleService.connectToDevice(device);
      const services = res?.device?.services || [];
      const summary = services.map((s: any) => `${s.uuid} (${s.characteristics.length} ch)`).join('\n');
      Alert.alert('Conectado', `Conectado a ${device.name || device.id}\nServiços:\n${summary || 'nenhum serviço encontrado'}`);
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
          <Text style={styles.deviceMac}>{item.mac}</Text>
          <Text style={styles.deviceRssi}>Sinal: {item.rssi} dBm</Text>
        </View>
      </View>
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.connectButton}
          onPress={() => handleConnectDevice(item)}
          disabled={!!connectingId}
        >
          {connectingId === (item.id || item.mac) ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.connectText}>Conectar</Text>
          )}
        </TouchableOpacity>
        {item.realMac ? (
          <TouchableOpacity
            style={[styles.connectButton, { backgroundColor: '#1e40af', marginLeft: 8 }]}
            onPress={async () => {
              setConnectingId(item.realMac);
              try {
                const res = await bleService.connectToDevice({ ...item, id: item.realMac, mac: item.realMac });
                const services = res?.device?.services || [];
                const summary = services.map((s: any) => `${s.uuid} (${s.characteristics.length} ch)`).join('\n');
                Alert.alert('Conectado', `Conectado a ${item.realMac}\nServiços:\n${summary || 'nenhum serviço encontrado'}`);
              } catch (err: any) {
                Alert.alert('Erro', 'Não foi possível conectar por realMac: ' + String(err?.message || err));
              } finally { setConnectingId(null); }
            }}
            disabled={!!connectingId}
          >
            <Text style={styles.connectText}>Conectar (realMac)</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={() => handleAddDevice(item)}
          disabled={!!registering}
        >
          {registering === item.mac ? (
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
          <TouchableOpacity onPress={() => { refreshRecentAds(); refreshBackendInfo(); setDebugOpen(true); }} style={[styles.refreshButton, { marginRight: 8 }]}> 
            <IconFallback name="Activity" size={20} color="#64748b" />
          </TouchableOpacity>
          <TouchableOpacity onPress={startScan} disabled={isScanning} style={styles.refreshButton}>
            <IconFallback name="RefreshCw" size={20} color={isScanning ? "#cbd5e1" : "#197fe6"} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e6eef9' }}>
        <Text style={{ fontSize: 12, color: '#475569' }}>BLE backend: {backendInfo.backend} — state: {backendInfo.state || 'unknown'}</Text>
      </View>

      <View style={styles.content}>
        {isScanning ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#197fe6" />
            <Text style={styles.scanningText}>Buscando dispositivos próximos...</Text>
          </View>
        ) : (
          <FlatList
            data={devices}
            renderItem={renderDeviceItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.centered}>
                <Text style={styles.emptyText}>Nenhum dispositivo encontrado.</Text>
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
            <TouchableOpacity onPress={() => { setDebugOpen(false); }} style={{ padding: 8 }}>
              <IconFallback name="X" size={20} color="#111827" />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ marginTop: 12 }}>
            {recentAds.length === 0 ? (
              <Text style={{ color: '#64748b' }}>Nenhum anúncio detectado ainda.</Text>
            ) : (
              recentAds.map((a, i) => (
                <View key={i} style={{ padding: 12, marginBottom: 8, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e6eef9' }}>
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
                      try { await Clipboard.setStringAsync(String(candidate)); Alert.alert('Copiado', 'Dados brutos copiados para a área de transferência.'); } catch (e) { Alert.alert('Erro', 'Não foi possível copiar.'); }
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
                        Alert.alert('Adicionar por assinatura', `Registrar sensor com assinatura: ${sig.slice(0,24)}... ?`, [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Confirmar', onPress: async () => {
                              try {
                                const type = mapDeviceType(a.parsed?.type);
                                await api.registerSensor(undefined, type, a.parsed?.name || 'Assinado', sig);
                                Alert.alert('Sucesso', 'Sensor registrado por assinatura.');
                                setDebugOpen(false);
                              } catch (err:any) {
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
