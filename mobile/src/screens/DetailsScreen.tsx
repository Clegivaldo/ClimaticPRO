import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';
import { api } from '../services/api';
import { useSensorStore } from '../store/useSensorStore';
import IconFallback from '../components/IconFallback';

const screenWidth = Dimensions.get('window').width;

export const DetailsScreen = ({ route, navigation }: any) => {
  const { sensor } = route.params;
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const currentReadings = useSensorStore(state => state.currentReadings);
  const latestReading = currentReadings[sensor.id];

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        // Implementar getSensorHistory no api.ts se não existir
        // Por agora vamos simular ou usar dados reais se o endpoint estiver pronto
        const now = new Date();
        const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        // Mocking history for now to show the chart
        const mockHistory = Array.from({ length: 12 }, (_, i) => ({
          temperature: 20 + Math.random() * 5,
          humidity: 40 + Math.random() * 20,
          timestamp: new Date(start.getTime() + i * 2 * 60 * 60 * 1000).toISOString()
        }));
        
        setHistory(mockHistory);
      } catch (err) {
        console.error('Error fetching history', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [sensor.id]);

  const chartData = {
    labels: history.map((h, i) => i % 3 === 0 ? new Date(h.timestamp).getHours() + 'h' : ''),
    datasets: [
      {
        data: history.map(h => h.temperature || 0),
        color: (opacity = 1) => `rgba(25, 127, 230, ${opacity})`,
        strokeWidth: 2
      }
    ],
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <IconFallback name="ChevronLeft" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{sensor.alias || sensor.mac}</Text>
        <TouchableOpacity style={styles.settingsButton}>
          <Settings size={22} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroCard}>
          <View style={styles.heroValueContainer}>
            <Text style={styles.heroValue}>
              {latestReading?.temperature?.toFixed(1) || '--'}
            </Text>
            <Text style={styles.heroUnit}>°C</Text>
          </View>
          <Text style={styles.heroLabel}>Temperatura Atual</Text>
          
          <View style={styles.heroRow}>
            <View style={styles.heroItem}>
              <Droplets size={18} color="#3b82f6" />
              <Text style={styles.heroItemValue}>{latestReading?.humidity?.toFixed(0) || '--'}%</Text>
              <Text style={styles.heroItemLabel}>Umidade</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.heroItem}>
              <Zap size={18} color="#10b981" />
              <Text style={styles.heroItemValue}>{sensor.batteryLevel || '--'}%</Text>
              <Text style={styles.heroItemLabel}>Bateria</Text>
            </View>
          </View>
        </View>

        {/* Chart Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Histórico (24h)</Text>
          {loading ? (
            <ActivityIndicator size="large" color="#197fe6" style={{ marginVertical: 40 }} />
          ) : (
            <View style={styles.chartContainer}>
              <LineChart
                data={chartData}
                width={screenWidth - 40}
                height={220}
                chartConfig={{
                  backgroundColor: '#fff',
                  backgroundGradientFrom: '#fff',
                  backgroundGradientTo: '#fff',
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(25, 127, 230, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
                  style: { borderRadius: 16 },
                  propsForDots: { r: '4', strokeWidth: '2', stroke: '#197fe6' }
                }}
                bezier
                style={styles.chart}
              />
            </View>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Tipo</Text>
            <Text style={styles.infoValue}>{sensor.deviceType}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>MAC Address</Text>
            <Text style={styles.infoValue}>{sensor.mac}</Text>
          </View>
        </View>
      </ScrollView>
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
  settingsButton: { padding: 5 },
  content: { flex: 1, padding: 20 },
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  heroValueContainer: { flexDirection: 'row', alignItems: 'flex-start' },
  heroValue: { fontSize: 64, fontWeight: 'bold', color: '#0f172a', tracking: -2 },
  heroUnit: { fontSize: 24, fontWeight: '600', color: '#94a3b8', marginTop: 12, marginLeft: 5 },
  heroLabel: { fontSize: 14, color: '#64748b', fontWeight: '500', marginBottom: 25 },
  heroRow: { flexDirection: 'row', width: '100%', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 25 },
  heroItem: { flex: 1, alignItems: 'center' },
  heroItemValue: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginTop: 5 },
  heroItemLabel: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold', marginTop: 2 },
  divider: { width: 1, backgroundColor: '#f1f5f9', height: '100%' },
  section: { marginBottom: 25 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#334155', marginBottom: 15 },
  chartContainer: { backgroundColor: '#fff', borderRadius: 20, padding: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  chart: { marginVertical: 8, borderRadius: 16 },
  infoGrid: { flexDirection: 'row', gap: 15, marginBottom: 40 },
  infoCard: { flex: 1, backgroundColor: '#fff', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  infoLabel: { fontSize: 10, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 5 },
  infoValue: { fontSize: 12, color: '#475569', fontWeight: '500' },
});
