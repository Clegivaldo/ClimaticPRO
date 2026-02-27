import React, { useState, useEffect } from 'react';
import { AppScreen, SensorData } from '../types';
import { Header } from '../components/Header';
import { DualRangeSlider } from '../components/DualRangeSlider';
import { api } from '../services/api';

interface AlertsScreenProps {
  sensor: SensorData;
  onNavigate: (screen: AppScreen, params?: any) => void;
}

const METRIC_LABELS: Record<string, string> = {
    temperature: 'Temperatura',
    humidity: 'Umidade',
    co2: 'CO2',
    tvoc: 'TVOC',
    pm25: 'PM2.5',
    pressure: 'Pressão',
};

const METRIC_META: Record<string, { icon: string, unit: string }> = {
    temperature: { icon: 'thermostat', unit: '°C' },
    humidity: { icon: 'water_drop', unit: '%' },
    co2: { icon: 'co2', unit: 'ppm' },
    tvoc: { icon: 'grain', unit: 'ppm' },
    pm25: { icon: 'blur_on', unit: 'µg/m³' },
    pressure: { icon: 'speed', unit: 'hPa' },
};

const DEFAULT_RANGES: Record<string, {min: number, max: number, absMin: number, absMax: number}> = {
    temperature: { min: 18, max: 26, absMin: -40, absMax: 60 },
    humidity: { min: 40, max: 60, absMin: 0, absMax: 100 },
    co2: { min: 400, max: 1000, absMin: 0, absMax: 5000 },
    tvoc: { min: 0, max: 0.5, absMin: 0, absMax: 10 },
    pm25: { min: 0, max: 35, absMin: 0, absMax: 500 },
    pressure: { min: 980, max: 1020, absMin: 800, absMax: 1200 },
};

export const AlertsScreen: React.FC<AlertsScreenProps> = ({ sensor, onNavigate }) => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [thresholds, setThresholds] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
        try {
            const config = await api.getSensorHistory(sensor.id, { limit: 1 }); // Just to check if we can reach the sensor
            // Actually use the config endpoint
            // @ts-ignore - using the new structure
            const response = await api.apiClient.get(`/alerts/sensors/${sensor.id}/config`);
            const data = response.data.data;
            
            if (data) {
                setIsEnabled(data.isEnabled);
                setThresholds(data);
            }
        } catch (e) {
            console.error("Failed to fetch alert config", e);
        } finally {
            setLoading(false);
        }
    };
    fetchConfig();
  }, [sensor.id]);

  const handleSave = async () => {
      setSaving(true);
      try {
          const payload = {
              isEnabled,
              tempMin: thresholds.tempMin,
              tempMax: thresholds.tempMax,
              humidityMin: thresholds.humidityMin,
              humidityMax: thresholds.humidityMax,
              co2Max: thresholds.co2Max,
              pm25Max: thresholds.pm25Max,
              tvocMax: thresholds.tvocMax,
          };
          
          // @ts-ignore
          await api.apiClient.patch(`/alerts/sensors/${sensor.id}/config`, payload);
          onNavigate(AppScreen.DETAILS, { sensor });
      } catch(e) {
          alert('Erro ao salvar configurações.');
      } finally {
          setSaving(false);
      }
  };

  const updateThreshold = (key: string, min: number, max: number) => { 
      if (key === 'temperature') {
          setThresholds((prev: any) => ({ ...prev, tempMin: min, tempMax: max }));
      } else if (key === 'humidity') {
          setThresholds((prev: any) => ({ ...prev, humidityMin: min, humidityMax: max }));
      } else {
          setThresholds((prev: any) => ({ ...prev, [`${key}Max`]: max }));
      }
  };

  const renderMetricConfig = (key: string) => {
    if (!DEFAULT_RANGES[key]) return null;
    const defaults = DEFAULT_RANGES[key];
    
    let currentMin = defaults.min;
    let currentMax = defaults.max;

    if (key === 'temperature') {
        currentMin = thresholds.tempMin ?? defaults.min;
        currentMax = thresholds.tempMax ?? defaults.max;
    } else if (key === 'humidity') {
        currentMin = thresholds.humidityMin ?? defaults.min;
        currentMax = thresholds.humidityMax ?? defaults.max;
    } else {
        currentMax = thresholds[`${key}Max`] ?? defaults.max;
        currentMin = defaults.absMin;
    }

    const meta = METRIC_META[key] || { icon: 'sensors', unit: '' };

    return (
        <section className="space-y-3" key={key}>
            <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <span className="material-icons-round text-lg text-primary">{meta.icon}</span>
                    Limites de {METRIC_LABELS[key]}
                </h3>
            </div>
            
            <div className={`bg-white dark:bg-card-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 transition-opacity ${!isEnabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                <DualRangeSlider 
                    min={defaults.absMin} 
                    max={defaults.absMax} 
                    initialMin={currentMin} 
                    initialMax={currentMax} 
                    unit={meta.unit === '°C' ? '°' : ''}
                    onChange={(min, max) => updateThreshold(key, min, max)} 
                />
                <div className="mt-4 flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <p>Mín: <span className="text-primary">{currentMin.toFixed(1)}{meta.unit}</span></p>
                    <p>Máx: <span className="text-primary">{currentMax.toFixed(1)}{meta.unit}</span></p>
                </div>
            </div>
        </section>
    );
  };

  if (loading) {
      return (
          <div className="flex flex-col h-full bg-background-light dark:bg-background-dark items-center justify-center">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">
      <Header 
        title="Alertas e Limites" 
        onBack={() => onNavigate(AppScreen.DETAILS, { sensor })}
        rightAction={
            <button 
                onClick={handleSave} 
                disabled={saving}
                className="text-sm font-bold text-primary px-2 disabled:opacity-50"
            >
                {saving ? '...' : 'Salvar'}
            </button>
        }
      />
      
      <main className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-8 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
        
        {/* Master Toggle */}
        <section className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Geral</h3>
            <div className="bg-white dark:bg-card-dark rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="p-4 flex items-center justify-between" onClick={() => setIsEnabled(!isEnabled)}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-500 flex items-center justify-center">
                            <span className="material-icons-round">notifications_active</span>
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Notificações Ativas</h4>
                            <p className="text-[10px] text-slate-500">Habilitar todos os alertas para este sensor</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer pointer-events-none">
                        <input type="checkbox" checked={isEnabled} readOnly className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                    </label>
                </div>
            </div>
        </section>

        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1 -mb-4">Configuração por Métrica</h3>
        {Object.keys(DEFAULT_RANGES).map(key => renderMetricConfig(key))}

      </main>
    </div>
  );
};
