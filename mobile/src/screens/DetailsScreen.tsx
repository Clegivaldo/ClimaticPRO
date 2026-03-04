import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Alert, Platform, TextInput, Vibration } from 'react-native';
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
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingAlias, setSavingAlias] = useState(false);
  const [savingLimits, setSavingLimits] = useState(false);
  const [savingCollection, setSavingCollection] = useState(false);
  const [aliasInput, setAliasInput] = useState(String(sensor.alias || ''));
  const [tempMinInput, setTempMinInput] = useState('');
  const [tempMaxInput, setTempMaxInput] = useState('');
  const [humidityMinInput, setHumidityMinInput] = useState('');
  const [humidityMaxInput, setHumidityMaxInput] = useState('');
  const [cooldownInput, setCooldownInput] = useState('15');
  const [collectionIntervalInput, setCollectionIntervalInput] = useState('60');
  const [limitsEnabled, setLimitsEnabled] = useState(true);
  const [appliedLimits, setAppliedLimits] = useState({
    isEnabled: true,
    tempMin: null as number | null,
    tempMax: null as number | null,
    humidityMin: null as number | null,
    humidityMax: null as number | null,
    cooldownMinutes: 15,
  });
  const lastLocalAlertAtRef = useRef<Record<string, number>>({});
  const sensors = useSensorStore(state => state.sensors);
  const collectionIntervalsSec = useSensorStore(state => state.collectionIntervalsSec);
  const setCollectionIntervalSec = useSensorStore(state => state.setCollectionIntervalSec);
  const currentReadings = useSensorStore(state => state.currentReadings);
  const latestReading = currentReadings[sensor.id];
  const sensorLive = sensors.find((s: any) => s.id === sensor.id) || sensor;
  const identity = sensorLive.alias || sensorLive.mac || (sensorLive.signature ? `SIG-${String(sensorLive.signature).slice(0, 8)}` : `Sensor-${String(sensorLive.id).slice(0, 6)}`);

  const parseInput = (value: string): number | null => {
    const normalized = String(value || '').trim().replace(',', '.');
    if (!normalized) return null;
    const num = Number(normalized);
    return Number.isFinite(num) ? num : null;
  };

  const parseCollectionSec = (value: string): number => {
    const parsed = Number(String(value || '').trim().replace(',', '.'));
    if (!Number.isFinite(parsed)) return 60;
    return Math.min(1800, Math.max(10, Math.round(parsed)));
  };

  const triggerLocalOutOfRangeAlert = (parameter: string, value: number, threshold: number, mode: 'min' | 'max') => {
    const key = `${sensor.id}:${parameter}:${mode}`;
    const now = Date.now();
    const cooldownMs = Math.max(1, Number(appliedLimits.cooldownMinutes || 15)) * 60 * 1000;
    const lastTs = lastLocalAlertAtRef.current[key] || 0;
    if (now - lastTs < cooldownMs) return;

    lastLocalAlertAtRef.current[key] = now;
    Vibration.vibrate([0, 200, 150, 200]);
    Alert.alert(
      'Fora da faixa',
      `${identity}\n${parameter}: ${value.toFixed(1)} (${mode === 'min' ? 'mín' : 'máx'} ${threshold.toFixed(1)})`
    );
  };

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
        await api.getLatestReading(sensor.id).catch(() => null);
        const now = new Date();
        const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const historyData = await api.getSensorHistory(
          sensor.id,
          start.toISOString(),
          now.toISOString()
        );

        const items = Array.isArray(historyData)
          ? historyData
          : (historyData as any)?.items || [];

        if (Array.isArray(items)) {
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

  useEffect(() => {
    const fetchAlertConfig = async () => {
      try {
        const config = await api.getAlertConfig(sensor.id);
        if (!config) return;
        setLimitsEnabled(Boolean(config.isEnabled));
        setTempMinInput(config.tempMin === null || typeof config.tempMin === 'undefined' ? '' : String(config.tempMin));
        setTempMaxInput(config.tempMax === null || typeof config.tempMax === 'undefined' ? '' : String(config.tempMax));
        setHumidityMinInput(config.humidityMin === null || typeof config.humidityMin === 'undefined' ? '' : String(config.humidityMin));
        setHumidityMaxInput(config.humidityMax === null || typeof config.humidityMax === 'undefined' ? '' : String(config.humidityMax));
        setCooldownInput(config.cooldownMinutes ? String(config.cooldownMinutes) : '15');
        setAppliedLimits({
          isEnabled: Boolean(config.isEnabled),
          tempMin: config.tempMin ?? null,
          tempMax: config.tempMax ?? null,
          humidityMin: config.humidityMin ?? null,
          humidityMax: config.humidityMax ?? null,
          cooldownMinutes: Number(config.cooldownMinutes || 15),
        });
      } catch (e) {
        // keep defaults when config is not available yet
      }
    };

    fetchAlertConfig();
  }, [sensor.id]);

  useEffect(() => {
    const sec = collectionIntervalsSec[sensor.id] ?? 60;
    setCollectionIntervalInput(String(sec));
  }, [sensor.id, collectionIntervalsSec]);

  useEffect(() => {
    if (!appliedLimits.isEnabled || !latestReading) return;

    const t = latestReading.temperature;
    const h = latestReading.humidity;
    const tMin = appliedLimits.tempMin;
    const tMax = appliedLimits.tempMax;
    const hMin = appliedLimits.humidityMin;
    const hMax = appliedLimits.humidityMax;

    if (typeof t === 'number' && tMin !== null && t < tMin) triggerLocalOutOfRangeAlert('Temperatura', t, tMin, 'min');
    if (typeof t === 'number' && tMax !== null && t > tMax) triggerLocalOutOfRangeAlert('Temperatura', t, tMax, 'max');
    if (typeof h === 'number' && hMin !== null && h < hMin) triggerLocalOutOfRangeAlert('Umidade', h, hMin, 'min');
    if (typeof h === 'number' && hMax !== null && h > hMax) triggerLocalOutOfRangeAlert('Umidade', h, hMax, 'max');
  }, [latestReading, appliedLimits]);

  const handleSaveAlias = async () => {
    const alias = String(aliasInput || '').trim();
    if (!alias) {
      Alert.alert('Aviso', 'Informe um nome para o sensor.');
      return;
    }

    try {
      setSavingAlias(true);
      await api.updateSensor(sensor.id, { alias });
      Alert.alert('Sucesso', 'Nome do sensor atualizado.');
    } catch (e: any) {
      Alert.alert('Erro', String(e?.response?.data?.message || e?.message || 'Falha ao salvar nome do sensor.'));
    } finally {
      setSavingAlias(false);
    }
  };

  const handleSaveLimits = async () => {
    try {
      setSavingLimits(true);
      await api.updateAlertConfig(sensor.id, {
        isEnabled: limitsEnabled,
        tempMin: parseInput(tempMinInput),
        tempMax: parseInput(tempMaxInput),
        humidityMin: parseInput(humidityMinInput),
        humidityMax: parseInput(humidityMaxInput),
        cooldownMinutes: Math.max(1, Number(cooldownInput || '15')),
      });
      setAppliedLimits({
        isEnabled: limitsEnabled,
        tempMin: parseInput(tempMinInput),
        tempMax: parseInput(tempMaxInput),
        humidityMin: parseInput(humidityMinInput),
        humidityMax: parseInput(humidityMaxInput),
        cooldownMinutes: Math.max(1, Number(cooldownInput || '15')),
      });
      Alert.alert('Sucesso', 'Limites de alerta atualizados.');
    } catch (e: any) {
      Alert.alert('Erro', String(e?.response?.data?.message || e?.message || 'Falha ao atualizar limites.'));
    } finally {
      setSavingLimits(false);
    }
  };

  const handleSaveCollectionInterval = async () => {
    try {
      setSavingCollection(true);
      const seconds = parseCollectionSec(collectionIntervalInput);
      setCollectionIntervalSec(sensor.id, seconds);
      setCollectionIntervalInput(String(seconds));
      Alert.alert('Sucesso', `Frequência de coleta definida para ${seconds}s.`);
    } catch (e: any) {
      Alert.alert('Erro', String(e?.message || 'Falha ao salvar frequência de coleta.'));
    } finally {
      setSavingCollection(false);
    }
  };

  const handleExportCSV = async () => {
    if (history.length === 0) {
      Alert.alert('Aviso', 'Não há dados históricos para exportar.');
      return;
    }
    setExporting(true);
    try {
      const FileSystemModule: any = await import('expo-file-system');
      const SharingModule: any = await import('expo-sharing');
      const FileSystem = FileSystemModule?.default ?? FileSystemModule;
      const Sharing = SharingModule?.default ?? SharingModule;

      const header = 'Data/Hora,Temperatura (°C),Umidade (%)\n';
      const rows = history.map(h => {
        const d = new Date(h.timestamp);
        return `${d.toLocaleString()},${h.temperature || ''},${h.humidity || ''}`;
      }).join('\n');

      const csvString = `\uFEFF${header}${rows}`;
      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      if (!baseDir) throw new Error('File system directory unavailable');
      const fileUri = `${baseDir}sensor_${sensor.id.substring(0, 6)}_historico.csv`;

      await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        if (Platform.OS === 'ios') {
          await Sharing.shareAsync(fileUri, { UTI: 'public.comma-separated-values-text', mimeType: 'text/csv' });
        } else {
          await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Compartilhar CSV' });
        }
      } else {
        Alert.alert('Erro', 'O compartilhamento não está disponível neste dispositivo.');
      }
    } catch (e) {
      Alert.alert('Erro', `Houve um problema ao exportar o CSV: ${String((e as any)?.message || e)}`);
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
      const PrintModule: any = await import('expo-print');
      const SharingModule: any = await import('expo-sharing');
      const Print = PrintModule?.default ?? PrintModule;
      const Sharing = SharingModule?.default ?? SharingModule;

      const buildSvgChart = (data: number[], color: string, width = 520, height = 180) => {
        if (!data.length) return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"></svg>`;
        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min || 1;
        const points = data.map((value, idx) => {
          const x = (idx / Math.max(1, data.length - 1)) * (width - 20) + 10;
          const y = height - 10 - ((value - min) / range) * (height - 20);
          return `${x},${y}`;
        }).join(' ');

        return `
          <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" stroke="#e2e8f0" />
            <polyline fill="none" stroke="${color}" stroke-width="2" points="${points}" />
            <text x="12" y="16" fill="#64748b" font-size="10">min ${min.toFixed(1)}</text>
            <text x="12" y="${height - 8}" fill="#64748b" font-size="10">max ${max.toFixed(1)}</text>
          </svg>
        `;
      };

      const tempSeries = history.map((h) => Number(h.temperature)).filter((v) => Number.isFinite(v));
      const humiditySeries = history.map((h) => Number(h.humidity)).filter((v) => Number.isFinite(v));
      const tempChartSvg = buildSvgChart(tempSeries as number[], '#197fe6');
      const humidityChartSvg = buildSvgChart(humiditySeries as number[], '#10b981');

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
            <h2 style="margin-top:28px; color:#334155;">Gráfico de Temperatura</h2>
            ${tempChartSvg}
            <h2 style="margin-top:20px; color:#334155;">Gráfico de Umidade</h2>
            ${humidityChartSvg}
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

  const chartSeries = [...history].sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return ta - tb;
  });

  const chartData = {
    labels: chartSeries.length > 0
      ? chartSeries.map((h, i) => {
        const step = Math.max(1, Math.floor(chartSeries.length / 6));
        if (i % step !== 0 && i !== chartSeries.length - 1) return '';
        const d = new Date(h.timestamp);
        return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
      })
      : [],
    datasets: [
      {
        data: chartSeries.length > 0 ? chartSeries.map(h => h.temperature || 0) : [0],
        color: (opacity = 1) => `rgba(25, 127, 230, ${opacity})`,
        strokeWidth: 2
      }
    ],
  };

  const chartWidth = Math.max(screenWidth - 80, chartSeries.length * 32);
  const tempMinValue = chartSeries.length ? Math.min(...chartSeries.map(h => Number(h.temperature)).filter((v) => Number.isFinite(v))) : null;
  const tempMaxValue = chartSeries.length ? Math.max(...chartSeries.map(h => Number(h.temperature)).filter((v) => Number.isFinite(v))) : null;
  const tempLatestValue = chartSeries.length ? Number(chartSeries[chartSeries.length - 1]?.temperature) : null;

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
              <Text style={styles.heroItemValue}>{sensorLive.batteryLevel || '--'}%</Text>
              <Text style={styles.heroItemLabel}>Bateria</Text>
            </View>
          </View>
        </View>

        {/* Chart Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Histórico (24h)</Text>
          {loading ? (
            <ActivityIndicator size="large" color="#197fe6" style={{ marginVertical: 40 }} />
          ) : history.length === 0 ? (
            <View style={styles.chartEmptyContainer}>
              <Text style={styles.chartEmptyText}>Sem dados coletados nas últimas 24h.</Text>
            </View>
          ) : (
            <View style={styles.chartContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ paddingRight: 12 }}>
                <LineChart
                  data={chartData}
                  width={chartWidth}
                  height={220}
                  withVerticalLabels={false}
                  chartConfig={{
                    backgroundColor: '#fff',
                    backgroundGradientFrom: '#fff',
                    backgroundGradientTo: '#fff',
                    decimalPlaces: 1,
                    color: (opacity = 1) => `rgba(25, 127, 230, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
                    style: { borderRadius: 16 },
                    propsForDots: { r: '0', strokeWidth: '0', stroke: 'transparent' }
                  }}
                  style={styles.chart}
                />
              </ScrollView>
              <View style={styles.chartLegendRow}>
                <Text style={styles.chartLegendItem}>Mín: {Number.isFinite(tempMinValue as number) ? (tempMinValue as number).toFixed(1) : '--'}°C</Text>
                <Text style={styles.chartLegendItem}>Máx: {Number.isFinite(tempMaxValue as number) ? (tempMaxValue as number).toFixed(1) : '--'}°C</Text>
                <Text style={styles.chartLegendItem}>Atual: {Number.isFinite(tempLatestValue) ? tempLatestValue.toFixed(1) : '--'}°C</Text>
              </View>
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identificação do Equipamento</Text>
          <View style={styles.formCard}>
            <Text style={styles.inputLabel}>Nome do sensor</Text>
            <TextInput
              value={aliasInput}
              onChangeText={setAliasInput}
              style={styles.input}
              placeholder="Ex.: Câmara fria 01"
              placeholderTextColor="#94a3b8"
            />
            <TouchableOpacity style={styles.primaryAction} onPress={handleSaveAlias} disabled={savingAlias}>
              {savingAlias ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryActionText}>Salvar nome</Text>}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Limites e Alertas</Text>
          <View style={styles.formCard}>
            <View style={styles.toggleRow}>
              <Text style={styles.inputLabel}>Alertas habilitados</Text>
              <TouchableOpacity
                onPress={() => setLimitsEnabled((v) => !v)}
                style={[styles.toggleButton, { backgroundColor: limitsEnabled ? '#dcfce7' : '#fee2e2' }]}
              >
                <Text style={[styles.toggleText, { color: limitsEnabled ? '#166534' : '#991b1b' }]}>
                  {limitsEnabled ? 'Ativo' : 'Inativo'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Temperatura mínima (°C)</Text>
            <TextInput value={tempMinInput} onChangeText={setTempMinInput} style={styles.input} keyboardType="numeric" placeholder="Opcional" placeholderTextColor="#94a3b8" />
            <Text style={styles.inputLabel}>Temperatura máxima (°C)</Text>
            <TextInput value={tempMaxInput} onChangeText={setTempMaxInput} style={styles.input} keyboardType="numeric" placeholder="Opcional" placeholderTextColor="#94a3b8" />
            <Text style={styles.inputLabel}>Umidade mínima (%)</Text>
            <TextInput value={humidityMinInput} onChangeText={setHumidityMinInput} style={styles.input} keyboardType="numeric" placeholder="Opcional" placeholderTextColor="#94a3b8" />
            <Text style={styles.inputLabel}>Umidade máxima (%)</Text>
            <TextInput value={humidityMaxInput} onChangeText={setHumidityMaxInput} style={styles.input} keyboardType="numeric" placeholder="Opcional" placeholderTextColor="#94a3b8" />
            <Text style={styles.inputLabel}>Cooldown do alerta (min)</Text>
            <TextInput value={cooldownInput} onChangeText={setCooldownInput} style={styles.input} keyboardType="numeric" placeholder="15" placeholderTextColor="#94a3b8" />

            <TouchableOpacity style={styles.primaryAction} onPress={handleSaveLimits} disabled={savingLimits}>
              {savingLimits ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryActionText}>Salvar limites</Text>}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequência de Coleta</Text>
          <View style={styles.formCard}>
            <Text style={styles.inputLabel}>Intervalo por sensor (segundos)</Text>
            <TextInput
              value={collectionIntervalInput}
              onChangeText={setCollectionIntervalInput}
              style={styles.input}
              keyboardType="numeric"
              placeholder="60"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.helperText}>Mínimo 10s • Máximo 1800s (30 minutos) • Padrão 60s</Text>
            <TouchableOpacity style={styles.primaryAction} onPress={handleSaveCollectionInterval} disabled={savingCollection}>
              {savingCollection ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryActionText}>Salvar frequência</Text>}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Tipo</Text>
            <Text style={styles.infoValue}>{sensorLive.deviceType}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>MAC Address</Text>
            <Text style={styles.infoValue}>{sensorLive.mac || 'Aguardando MAC real (sensor por assinatura)'}</Text>
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
  chartContainer: { backgroundColor: '#fff', borderRadius: 20, padding: 10, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  chartEmptyContainer: { backgroundColor: '#fff', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  chartEmptyText: { color: '#64748b', fontSize: 13 },
  chart: { marginVertical: 8, borderRadius: 16 },
  chartLegendRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, marginTop: 4 },
  chartLegendItem: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  infoGrid: { flexDirection: 'row', gap: 15, marginBottom: 40 },
  infoCard: { flex: 1, backgroundColor: '#fff', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  infoLabel: { fontSize: 10, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 5 },
  infoValue: { fontSize: 12, color: '#475569', fontWeight: '500' },
  exportRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  exportButton: { flex: 1, flexDirection: 'row', backgroundColor: '#197fe6', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, gap: 8 },
  exportButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  exportButtonAlt: { flex: 1, flexDirection: 'row', backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, gap: 8 },
  exportButtonAltText: { color: '#197fe6', fontSize: 14, fontWeight: 'bold' },
  formCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  inputLabel: { fontSize: 12, color: '#475569', fontWeight: '600', marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#0f172a', backgroundColor: '#fff' },
  helperText: { fontSize: 11, color: '#64748b', marginTop: 8 },
  primaryAction: { marginTop: 14, backgroundColor: '#197fe6', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  primaryActionText: { color: '#fff', fontWeight: '700' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  toggleButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  toggleText: { fontSize: 12, fontWeight: '700' },
});
