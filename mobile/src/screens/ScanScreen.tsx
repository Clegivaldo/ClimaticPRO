import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Bluetooth, RefreshCw, Plus } from 'lucide-react-native';
import * as Location from 'expo-location';
import { api } from '../services/api';

export const ScanScreen = ({ navigation }: any) => {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [registering, setRegistering] = useState<string | null>(null);

  const startScan = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão Negada', 'O acesso à localização é necessário para buscar dispositivos Bluetooth próximos.');
      return;
    }

    setIsScanning(true);
    setDevices([]);

    // Simulação de descoberta de dispositivos BLE
    // Em um app real com build nativa, usaríamos react-native-ble-plx
    setTimeout(() => {
      setDevices([
        { id: '1', name: 'JHT-F525 Gateway', mac: 'C1:32:71:39:72:95', type: 'F525_GATEWAY', rssi: -65 },
        { id: '2', name: 'Wifi-PT100 Sensor', mac: '00:E8:31:CD:80:79', type: 'WIFI_PT100_35F5', rssi: -72 },
      ]);
      setIsScanning(false);
    }, 3000);
  };

  useEffect(() => {
    startScan();
  }, []);

  const handleAddDevice = async (device: any) => {
    setRegistering(device.mac);
    try {
      await api.registerSensor(device.mac, device.type, device.name);
      Alert.alert('Sucesso', 'Sensor adicionado com sucesso!');
      navigation.navigate('Dashboard');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível adicionar este sensor. Talvez ele já esteja cadastrado.');
    } finally {
      setRegistering(null);
    }
  };

  const renderDeviceItem = ({ item }: any) => (
    <View style={styles.deviceCard}>
      <View style={styles.deviceInfo}>
        <View style={styles.iconContainer}>
          <Bluetooth size={20} color="#197fe6" />
        </View>
        <View>
          <Text style={styles.deviceName}>{item.name}</Text>
          <Text style={styles.deviceMac}>{item.mac}</Text>
          <Text style={styles.deviceRssi}>Sinal: {item.rssi} dBm</Text>
        </View>
      </View>
      <TouchableOpacity 
        style={styles.addButton} 
        onPress={() => handleAddDevice(item)}
        disabled={!!registering}
      >
        {registering === item.mac ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Plus size={20} color="#fff" />
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buscar Sensores</Text>
        <TouchableOpacity onPress={startScan} disabled={isScanning} style={styles.refreshButton}>
          <RefreshCw size={20} color={isScanning ? "#cbd5e1" : "#197fe6"} />
        </TouchableOpacity>
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
  emptyText: { color: '#64748b', textAlign: 'center' },
  retryButton: { marginTop: 15, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#eff6ff', borderRadius: 10 },
  retryButtonText: { color: '#197fe6', fontWeight: 'bold', fontSize: 14 },
});
