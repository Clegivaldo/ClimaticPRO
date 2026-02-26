
import React, { useState, useEffect } from 'react';
import { AppScreen, SensorData } from '../types';
import { Header } from '../components/Header';
import { DualRangeSlider } from '../components/DualRangeSlider';

interface AlertsScreenProps {
  sensor: SensorData;
  onNavigate: (screen: AppScreen, params?: any) => void;
}

const METRIC_LABELS: Record<string, string> = {
    temperature: 'Temperatura',
    humidity: 'Umidade',
    co2: 'CO2',
    tvocPpm: 'TVOC',
    pm25: 'PM2.5',
    pm10: 'PM10',
    light: 'Luz',
    pressure: 'Pressão',
    uv: 'UV',
    vocIndex: 'VOC Index'
};

const METRIC_META: Record<string, { icon: string, unit: string }> = {
    temperature: { icon: 'thermostat', unit: '°C' },
    humidity: { icon: 'water_drop', unit: '%' },
    co2: { icon: 'co2', unit: 'ppm' },
    tvocPpm: { icon: 'grain', unit: 'ppm' },
    pm25: { icon: 'blur_on', unit: 'µg/m³' },
    pm10: { icon: 'blur_circular', unit: 'µg/m³' },
    light: { icon: 'light_mode', unit: 'Lx' },
    pressure: { icon: 'speed', unit: 'hPa' },
    uv: { icon: 'wb_sunny', unit: '' },
    vocIndex: { icon: 'filter_drama', unit: '' }
};

const DEFAULT_RANGES: Record<string, {min: number, max: number, absMin: number, absMax: number}> = {
    temperature: { min: 18, max: 26, absMin: -40, absMax: 60 },
    humidity: { min: 40, max: 60, absMin: 0, absMax: 100 },
    co2: { min: 400, max: 1000, absMin: 0, absMax: 5000 },
    tvocPpm: { min: 0, max: 0.5, absMin: 0, absMax: 10 },
    pm25: { min: 0, max: 35, absMin: 0, absMax: 500 },
    pm10: { min: 0, max: 50, absMin: 0, absMax: 500 },
    light: { min: 100, max: 1000, absMin: 0, absMax: 10000 },
    pressure: { min: 980, max: 1020, absMin: 800, absMax: 1200 },
    uv: { min: 0, max: 3, absMin: 0, absMax: 15 },
    vocIndex: { min: 0, max: 100, absMin: 0, absMax: 500 }
};

export const AlertsScreen: React.FC<AlertsScreenProps> = ({ sensor, onNavigate }) => {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [visibleMetrics, setVisibleMetrics] = useState<Record<string, boolean>>({});
  const [thresholds, setThresholds] = useState<Record<string, {min: number, max: number}>>({});
  const [metricAlertsEnabled, setMetricAlertsEnabled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const savedVisConfig = localStorage.getItem(`sensor_config_${sensor.mac}`);
    if (savedVisConfig) {
        try {
            const list = JSON.parse(savedVisConfig);
            const map: any = {};
            list.forEach((key: string) => map[key] = true);
            setVisibleMetrics(map);
        } catch(e) {}
    } else {
        const map: any = {};
        Object.keys(METRIC_LABELS).forEach(key => {
            if ((sensor as any)[key] !== undefined && (sensor as any)[key] !== null) {
                map[key] = true;
            }
        });
        setVisibleMetrics(map);
    }

    const savedAlertsConfig = localStorage.getItem(`sensor_alerts_${sensor.mac}`);
    if (savedAlertsConfig) {
        try {
            const data = JSON.parse(savedAlertsConfig);
            setPushEnabled(data.pushEnabled ?? true);
            setEmailEnabled(data.emailEnabled ?? false);
            setThresholds(data.thresholds || {});
            setMetricAlertsEnabled(data.metricAlertsEnabled || {});
        } catch(e) {}
    } else {
        const initialThresholds: any = {};
        const initialMetricEnabled: any = {};
        Object.keys(DEFAULT_RANGES).forEach(key => {
            initialThresholds[key] = { min: DEFAULT_RANGES[key].min, max: DEFAULT_RANGES[key].max };
            initialMetricEnabled[key] = true; 
        });
        setThresholds(initialThresholds);
        setMetricAlertsEnabled(initialMetricEnabled);
    }
  }, [sensor.mac]);

  const handleSave = () => {
      const listToSave = Object.keys(visibleMetrics).filter(key => visibleMetrics[key]);
      localStorage.setItem(`sensor_config_${sensor.mac}`, JSON.stringify(listToSave));
      const alertsData = { pushEnabled, emailEnabled, thresholds, metricAlertsEnabled };
      localStorage.setItem(`sensor_alerts_${sensor.mac}`, JSON.stringify(alertsData));
      alert(`Configurações salvas!`);
      onNavigate(AppScreen.DETAILS, { sensor });
  };

  const toggleMetric = (key: string) => { setVisibleMetrics(prev => ({ ...prev, [key]: !prev[key] })); };
  const toggleMetricAlert = (key: string) => { setMetricAlertsEnabled(prev => ({ ...prev, [key]: !prev[key] })); };
  const updateThreshold = (key: string, min: number, max: number) => { setThresholds(prev => ({ ...prev, [key]: { min, max } })); };

  const renderMetricConfig = (key: string) => {
    if (!DEFAULT_RANGES[key] || !visibleMetrics[key]) return null;
    const defaults = DEFAULT_RANGES[key];
    const currentSettings = thresholds[key] || { min: defaults.min, max: defaults.max };
    const meta = METRIC_META[key] || { icon: 'sensors', unit: '' };
    const isAlertEnabled = metricAlertsEnabled[key] !== false; 

    return (
        <section className="space-y-3" key={key}>
            <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <span className="material-icons-round text-lg text-primary">{meta.icon}</span>
                    Limites de {METRIC_LABELS[key]}
                </h3>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={isAlertEnabled} onChange={() => toggleMetricAlert(key)} className="sr-only peer" />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                </label>
            </div>
            
            <div className={`bg-white dark:bg-card-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 transition-opacity ${!isAlertEnabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                <DualRangeSlider 
                    min={defaults.absMin} 
                    max={defaults.absMax} 
                    initialMin={currentSettings.min} 
                    initialMax={currentSettings.max} 
                    unit={meta.unit === '°C' ? '°' : ''}
                    onChange={(min, max) => updateThreshold(key, min, max)} 
                />
                <div className="mt-4 flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <p>Mín: <span className="text-primary">{currentSettings.min.toFixed(1)}{meta.unit}</span></p>
                    <p>Máx: <span className="text-primary">{currentSettings.max.toFixed(1)}{meta.unit}</span></p>
                </div>
            </div>
        </section>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">
      <Header 
        title="Alertas e Limites" 
        onBack={() => onNavigate(AppScreen.DETAILS, { sensor })}
        rightAction={<button onClick={handleSave} className="text-sm font-bold text-primary px-2">Salvar</button>}
      />
      
      <main className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-8 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
        
        {/* Master Notifications */}
        <section className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Canais de Notificação</h3>
            <div className="bg-white dark:bg-card-dark rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800/50">
                <div className="p-4 flex items-center justify-between" onClick={() => setPushEnabled(!pushEnabled)}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-500 flex items-center justify-center">
                            <span className="material-icons-round">notifications_active</span>
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Push Notifications</h4>
                            <p className="text-[10px] text-slate-500">Alertas em tempo real no app</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer pointer-events-none">
                        <input type="checkbox" checked={pushEnabled} readOnly className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                    </label>
                </div>

                <div className="p-4 flex items-center justify-between" onClick={() => setEmailEnabled(!emailEnabled)}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                            <span className="material-icons-round">alternate_email</span>
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Notificações por E-mail</h4>
                            <p className="text-[10px] text-slate-500">Enviado via seu servidor configurado</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer pointer-events-none">
                        <input type="checkbox" checked={emailEnabled} readOnly className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                    </label>
                </div>
            </div>
            
            {emailEnabled && (
                <button 
                    onClick={() => onNavigate(AppScreen.RECIPIENTS, { sensor })}
                    className="w-full py-3 bg-white dark:bg-card-dark border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center gap-2 shadow-sm animate-[fadeIn_0.3s_ease-out]"
                >
                    <span className="material-icons-round text-primary text-base">settings</span>
                    Configurar Servidor e Destinatários
                </button>
            )}
        </section>

        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1 -mb-4">Configuração por Métrica</h3>
        {Object.keys(DEFAULT_RANGES).map(key => renderMetricConfig(key))}

        <section className="space-y-4">
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Visibilidade no Painel</h3>
            <div className="bg-white dark:bg-card-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-2 gap-2">
                    {Object.keys(METRIC_LABELS).map(key => (
                        <div 
                            key={key}
                            onClick={() => toggleMetric(key)}
                            className={`p-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-tight cursor-pointer transition-all flex items-center justify-between ${visibleMetrics[key] ? 'bg-primary/10 border-primary text-primary' : 'bg-slate-50 dark:bg-background-dark border-slate-200 dark:border-slate-800 text-slate-400'}`}
                        >
                            <span>{METRIC_LABELS[key]}</span>
                            {visibleMetrics[key] && <span className="material-icons-round text-sm">check_circle</span>}
                        </div>
                    ))}
                </div>
            </div>
        </section>

      </main>
    </div>
  );
};
