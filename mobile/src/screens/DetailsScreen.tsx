import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { api } from '../services/api';
import { useSensorStore } from '../store/useSensorStore';
import IconFallback from '../components/IconFallback';

const screenWidth = Dimensions.get('window').width;

export const DetailsScreen = ({ route, navigation }: any) => {
  const { sensor } = route.params;
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const currentReadings = useSensorStore(state => state.currentReadings);
  const latestReading = currentReadings[sensor.id];
  const identity = sensor.alias || sensor.mac || (sensor.signature ? `SIG-${String(sensor.signature).slice(0, 8)}` : `Sensor-${String(sensor.id).slice(0, 6)}`);

  const handleDeleteSensor = () => {
    Alert.alert(
      'Remover sensor',
      'Tem certeza que deseja remover este sensor?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await api.deleteSensor(sensor.id);
              Alert.alert('Sucesso', 'Sensor removido com sucesso.');
              navigation.navigate('Dashboard');
            } catch (e: any) {
              Alert.alert('Erro', String(e?.response?.data?.message || e?.message || 'Não foi possível remover o sensor.'));
            } finally {
              setDeleting(false);
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const now = new Date();
        const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const historyData = await api.getSensorHistory(
          sensor.id,
          start.toISOString(),
          now.toISOString()
        );

        if (historyData && Array.isArray(historyData)) {
          // The backend usually returns items in an object for pagination
          const items = Array.isArray(historyData) ? historyData : (historyData as any).items || [];
          // Sort by timestamp just in case
          const sorted = [...items].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          setHistory(sorted);
        }
      } catch (err) {
        console.error('Error fetching history', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [sensor.id]);

  const handleExportCSV = async () => {
    if (history.length === 0) {
      Alert.alert('Aviso', 'Não há dados históricos para exportar.');
      return;
    }
    setExporting(true);
    try {
      const header = 'Data/Hora,Temperatura (°C),Umidade (%)\n';
      const rows = history.map(h => {
        const d = new Date(h.timestamp);
        return `${d.toLocaleString()},${h.temperature || ''},${h.humidity || ''}`;
      }).join('\n');

      const csvString = header + rows;
      const fileUri = FileSystem.cacheDirectory + `sensor_${sensor.id.substring(0, 6)}_historico.csv`;

      await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { UTI: 'public.comma-separated-values-text', mimeType: 'text/csv' });
      } else {
        Alert.alert('Erro', 'O compartilhamento não está disponível neste dispositivo.');
      }
    } catch (e) {
      Alert.alert('Erro', 'Houve um problema ao exportar o CSV.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (history.length === 0) {
      Alert.alert('Aviso', 'Não há dados históricos para exportar.');
      return;
    }
    setExporting(true);
    try {
      const rowsHtml = history.map(h => {
        const d = new Date(h.timestamp);
        return `
          <tr>
            <td>${d.toLocaleString()}</td>
            <td>${h.temperature ? h.temperature.toFixed(1) : '--'}</td>
            <td>${h.humidity ? h.humidity.toFixed(0) : '--'}</td>
          </tr>
        `;
      }).join('');

      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
              h1 { color: #0f172a; text-align: center; }
              p { text-align: center; color: #64748b; }
              table { width: 100%; border-collapse: collapse; margin-top: 30px; }
              th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: center; }
              th { background-color: #f8fafc; color: #475569; font-weight: bold; }
              tr:nth-child(even) { background-color: #f1f5f9; }
            </style>
          </head>
          <body>
            <h1>Relatório do Sensor</h1>
            <p><strong>Identificação:</strong> ${identity}</p>
            <p><strong>Período:</strong> Últimas 24 horas</p>
            <table>
              <tr>
                <th>Data e Hora</th>
                <th>Temperatura (°C)</th>
                <th>Umidade (%)</th>
              </tr>
              ${rowsHtml}
            </table>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
      } else {
        Alert.alert('Erro', 'O compartilhamento não está disponível neste dispositivo.');
      }
    } catch (e) {
      Alert.alert('Erro', 'Houve um problema ao exportar o PDF.');
    } finally {
      setExporting(false);
    }
  };

  const chartData = {
    labels: history.length > 0
      ? history.filter((_, i) => {
        // Show about 6-8 labels max
        const step = Math.max(1, Math.floor(history.length / 6));
        return i % step === 0;
      }).map(h => {
        const d = new Date(h.timestamp);
        return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
      })
      : [],
    datasets: [
      {
        data: history.length > 0 ? history.map(h => h.temperature || 0) : [0],
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
        <Text style={styles.headerTitle}>{identity}</Text>
        <TouchableOpacity style={styles.settingsButton} onPress={handleDeleteSensor} disabled={deleting}>
          {deleting ? (
            <ActivityIndicator size="small" color="#ef4444" />
          ) : (
            <IconFallback name="Trash2" size={22} color="#ef4444" />
          )}
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
              <IconFallback name="Droplets" size={18} color="#3b82f6" />
              <Text style={styles.heroItemValue}>{latestReading?.humidity?.toFixed(0) || '--'}%</Text>
              <Text style={styles.heroItemLabel}>Umidade</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.heroItem}>
              <IconFallback name="Zap" size={18} color="#10b981" />
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exportar Dados</Text>
          <View style={styles.exportRow}>
            <TouchableOpacity style={styles.exportButton} onPress={handleExportCSV} disabled={exporting || history.length === 0}>
              <IconFallback name="FileText" size={20} color="#fff" />
              <Text style={styles.exportButtonText}>Baixar CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportButtonAlt} onPress={handleExportPDF} disabled={exporting || history.length === 0}>
              <IconFallback name="File" size={20} color="#197fe6" />
              <Text style={styles.exportButtonAltText}>Baixar PDF</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Tipo</Text>
            <Text style={styles.infoValue}>{sensor.deviceType}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>MAC Address</Text>
            <Text style={styles.infoValue}>{sensor.mac || '-- (sensor por assinatura)'}</Text>
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
  heroValue: { fontSize: 64, fontWeight: 'bold', color: '#0f172a', letterSpacing: -2 },
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
  exportRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  exportButton: { flex: 1, flexDirection: 'row', backgroundColor: '#197fe6', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, gap: 8 },
  exportButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  exportButtonAlt: { flex: 1, flexDirection: 'row', backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, gap: 8 },
  exportButtonAltText: { color: '#197fe6', fontSize: 14, fontWeight: 'bold' },
});
