import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useSensorStore } from '../store/useSensorStore';

export const DashboardScreen = ({ navigation }: any) => {
  const { sensors, currentReadings } = useSensorStore();
  const [loading, setLoading] = useState(sensors.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const logout = useAuthStore(state => state.logout);

  const fetchLatestForSensors = async (sensorList: any[]) => {
    if (!Array.isArray(sensorList) || sensorList.length === 0) return;
    await Promise.all(sensorList.map((sensor: any) =>
      api.getLatestReading(sensor.id).catch(() => null)
    ));
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleString('pt-BR');
  };

  const fetchSensors = async (options?: { withSync?: boolean }) => {
    try {
      if (options?.withSync) {
        try {
          await api.syncJaaleeData();
        } catch (syncError) {
          console.log('Cloud sync skipped/failed:', syncError);
        }
      }
      const sensorList = await api.getAllDeviceData();
      await fetchLatestForSensors(sensorList || []);
    } catch (err) {
      console.error('Error fetching sensors', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSensors({ withSync: true });

    const interval = setInterval(async () => {
      try {
        await fetchSensors({ withSync: false });
      } catch (e) {
        // keep silent for background polling
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSensors({ withSync: true });
  };

  const handleDeleteSensor = (sensor: any) => {
    Alert.alert(
      'Remover sensor',
      `Deseja remover ${sensor.alias || sensor.mac || 'este sensor'}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(sensor.id);
              await api.deleteSensor(sensor.id);
            } catch (e: any) {
              Alert.alert('Erro', String(e?.response?.data?.message || e?.message || 'Não foi possível remover o sensor.'));
            } finally {
              setDeletingId(null);
            }
          }
        }
      ]
    );
  };

  const renderSensorItem = ({ item }: any) => {
    const reading = currentReadings[item.id];
    const identity = item.alias || item.mac || ((item as any).signature ? `SIG-${String((item as any).signature).slice(0, 8)}` : `Sensor-${String(item.id).slice(0, 6)}`);
    const lastSyncAt = reading?.timestamp || item.lastReadingAt || item.lastSeenAt || null;
    const dataPoints = typeof item?.readingCount === 'number' ? item.readingCount : 0;
    
    return (
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => navigation.navigate('Details', { sensor: item })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.sensorName}>{identity}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.statusBadge, { backgroundColor: item.isActive ? '#dcfce7' : '#fee2e2' }]}>
              <Text style={[styles.statusText, { color: item.isActive ? '#166534' : '#991b1b' }]}>
                {item.isActive ? 'Ativo' : 'Offline'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={(e) => { e.stopPropagation?.(); handleDeleteSensor(item); }}
              disabled={deletingId === item.id}
            >
              {deletingId === item.id ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <Text style={styles.deleteText}>Remover</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.sensorType}>{item.deviceType}</Text>
        <Text style={styles.metaText}>Última sincronização: {formatDateTime(lastSyncAt)}</Text>
        <Text style={[styles.metaText, { marginBottom: 12 }]}>Pontos salvos: {dataPoints}</Text>
        
        <View style={styles.dataRow}>
          <View style={styles.dataItem}>
            <Text style={styles.dataLabel}>Temperatura</Text>
            <Text style={styles.dataValue}>
              {typeof reading?.temperature === 'number' ? `${reading.temperature.toFixed(1)} °C` : '-- °C'}
            </Text>
          </View>
          <View style={styles.dataItem}>
            <Text style={styles.dataLabel}>Umidade</Text>
            <Text style={styles.dataValue}>{typeof reading?.humidity === 'number' ? `${reading.humidity.toFixed(1)} %` : '-- %'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meus Sensores</Text>
        <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => navigation.navigate('AiAssistant')} style={styles.aiButton}>
                <Text style={styles.aiButtonText}>AI</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={logout}>
                <Text style={styles.logoutText}>Sair</Text>
            </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#197fe6" />
        </View>
      ) : (
        <FlatList
          data={sensors}
          renderItem={renderSensorItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>Nenhum sensor encontrado.</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => navigation.navigate('Scan')}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20, 
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  aiButton: { 
    backgroundColor: '#eff6ff', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dbeafe'
  },
  aiButtonText: { color: '#197fe6', fontWeight: 'bold', fontSize: 12 },
  logoutText: { color: '#ef4444', fontWeight: 'bold' },
  list: { padding: 15 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  sensorName: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  sensorType: { fontSize: 12, color: '#64748b', marginBottom: 15 },
  metaText: { fontSize: 12, color: '#475569' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  deleteButton: { marginLeft: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#fee2e2' },
  deleteText: { color: '#991b1b', fontSize: 10, fontWeight: '700' },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dataItem: { flex: 1 },
  dataLabel: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' },
  dataValue: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginTop: 2 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#64748b' },
  fab: {
    position: 'absolute',
    right: 25,
    bottom: 40,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#197fe6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#197fe6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  fabIcon: { fontSize: 32, color: '#fff', fontWeight: '300' },
});
