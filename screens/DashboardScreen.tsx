
import React, { useEffect, useState, useRef } from 'react';
import { AppScreen, SensorData } from '../types';
import { api } from '../services/api';
import { BottomNav } from '../components/BottomNav';

interface DashboardScreenProps {
  onNavigate: (screen: AppScreen, params?: any) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigate }) => {
  const [sensors, setSensors] = useState<SensorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');
  const pollingInterval = useRef<any>(null);

  const fetchData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
        const list: any = await api.getAllDeviceData();
        
        // Ensure list is an array before mapping
        const safeList = Array.isArray(list) ? list : [];

        const now = Date.now();
        const processedList = safeList.map((s: any) => {
            const time = s.createTime || s.time || 0;
            // time from API is typically ms timestamp. If > 60min, offline.
            const isRecent = (now - time) < (60 * 60 * 1000); 
            return {
                ...s,
                status: isRecent ? 'online' : 'offline'
            } as SensorData;
        });

        setSensors(processedList);
        setLastUpdated(new Date());
        setError('');
    } catch (err: any) {
        if (!isBackground) {
             if (err.message && err.message.includes('Muitas requisições')) {
                 // Suppress rate limit UI error if background, just keep old data
             } else {
                 setError('Falha ao carregar sensores.');
             }
        }
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // API DOC says: "one account can only access the API once in one minute"
    // We set interval to 65 seconds to be safe.
    pollingInterval.current = setInterval(() => fetchData(true), 65000);
    return () => { if (pollingInterval.current) clearInterval(pollingInterval.current); };
  }, []);

  const filteredSensors = sensors.filter(s => {
      if (filterStatus === 'all') return true;
      return s.status === filterStatus;
  });

  const onlineCount = sensors.filter(s => s.status === 'online').length;
  const offlineCount = sensors.filter(s => s.status === 'offline').length;

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">
      {/* Status Bar */}
      <div className="h-8 w-full flex items-end justify-between px-6 pb-2 text-xs font-medium text-slate-900 dark:text-slate-100 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <span>{lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <div className="flex items-center space-x-1.5">
           <span className="text-[10px] text-slate-400 mr-2">{sensors.length} Disp.</span>
          <span className="material-icons-round text-base">signal_cellular_alt</span>
          <span className="material-icons-round text-base">wifi</span>
          <span className="material-icons-round text-base rotate-90">battery_full</span>
        </div>
      </div>

      <header className="px-5 pt-6 pb-2 flex flex-col space-y-4 shrink-0 bg-background-light dark:bg-background-dark z-40">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Meus Sensores</h1>
            <div className="flex items-center space-x-2 mt-1">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${error ? 'bg-red-500' : 'bg-green-500'}`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${error ? 'bg-red-500' : 'bg-green-500'}`}></span>
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {loading ? 'Atualizando...' : (error ? 'Off-line' : 'Ao Vivo (60s)')}
              </span>
            </div>
          </div>
          <button 
            onClick={() => onNavigate(AppScreen.SCAN)}
            className="bg-primary hover:bg-blue-600 text-white p-2 rounded-full shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center justify-center"
          >
            <span className="material-icons-round text-xl">add</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex p-1 bg-slate-200 dark:bg-slate-800 rounded-xl">
             <button 
                onClick={() => setFilterStatus('all')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${filterStatus === 'all' ? 'bg-white dark:bg-surface-dark text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
             >
                Todos ({sensors.length})
             </button>
             <button 
                onClick={() => setFilterStatus('online')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${filterStatus === 'online' ? 'bg-white dark:bg-surface-dark text-green-600 dark:text-green-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
             >
                Online ({onlineCount})
             </button>
             <button 
                onClick={() => setFilterStatus('offline')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${filterStatus === 'offline' ? 'bg-white dark:bg-surface-dark text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
             >
                Offline ({offlineCount})
             </button>
        </div>
      </header>

      {/* Main content with inline styles to strictly remove scrollbar while keeping scroll functionality */}
      <main 
        className="flex-1 px-5 pb-4 overflow-y-auto space-y-4 no-scrollbar"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {loading && sensors.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 space-y-3">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                <p className="text-sm text-slate-400">Carregando dados...</p>
            </div>
        )}

        {error && sensors.length === 0 && (
            <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl text-center">
                <p className="text-sm text-red-500 mb-2">{error}</p>
                <button onClick={() => fetchData()} className="text-xs font-bold text-red-600 dark:text-red-400 underline">Tentar Novamente</button>
            </div>
        )}

        {filteredSensors.map((sensor, index) => (
           <SensorCard key={sensor.mac || index} sensor={sensor} onClick={() => onNavigate(AppScreen.DETAILS, { sensor })} />
        ))}

        {!loading && !error && filteredSensors.length === 0 && (
            <div className="text-center py-10">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                    <span className="material-icons-round text-2xl">filter_list_off</span>
                </div>
                <p className="text-slate-500 dark:text-slate-400">Nenhum sensor nesta categoria.</p>
            </div>
        )}
      </main>

      <BottomNav 
        activeTab="sensors" 
        onChange={(tab) => {
            if (tab === 'history') onNavigate(AppScreen.HISTORY);
            if (tab === 'settings') onNavigate(AppScreen.SETTINGS);
        }} 
      />
    </div>
  );
};

const SensorCard: React.FC<{ sensor: SensorData; onClick: () => void }> = ({ sensor, onClick }) => {
  const isOnline = sensor.status === 'online';
  const hum = sensor.humidity || 0;
  const temp = sensor.temperature || 0;
  const isHighHumidity = hum > 60;
  
  // Check Alerts based on saved config
  const savedAlertsConfig = localStorage.getItem(`sensor_alerts_${sensor.mac}`);
  let hasAlert = false;
  if (savedAlertsConfig) {
      try {
          const config = JSON.parse(savedAlertsConfig);
          const thresholds = config.thresholds || {};
          
          // Generic check for any threshold key present in sensor data
          for (const [key, range] of Object.entries(thresholds)) {
              // @ts-ignore
              const val = sensor[key];
              const r = range as { min: number, max: number };
              if (val !== undefined && val !== null && (val < r.min || val > r.max)) {
                  hasAlert = true;
                  break;
              }
          }
      } catch (e) {}
  }

  // Choose icon based on Type or Name
  let icon = "sensors";
  let iconBg = "bg-blue-50 dark:bg-blue-500/10";
  let iconColor = "text-primary dark:text-blue-400";

  // Heuristic for icons based on alias or type
  const name = (sensor.alias || "").toLowerCase();
  const type = (sensor.type || "").toLowerCase();

  if (name.includes("baby") || name.includes("bebê")) {
      icon = "child_friendly";
      iconBg = "bg-purple-50 dark:bg-purple-500/10";
      iconColor = "text-purple-500 dark:text-purple-400";
  } else if (name.includes("wine") || name.includes("adega")) {
      icon = "wine_bar";
      iconBg = "bg-red-50 dark:bg-red-500/10";
      iconColor = "text-red-500 dark:text-red-400";
  } else if (type.includes("pt100")) {
      icon = "thermostat";
      iconBg = "bg-orange-50 dark:bg-orange-500/10";
      iconColor = "text-orange-500 dark:text-orange-400";
  }

  // Format Time
  let timeDisplay = "N/A";
  if (sensor.time || sensor.createTime) {
      const t = sensor.createTime || sensor.time;
      if (t && t > 1000000000) {
        const date = new Date(t);
        timeDisplay = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
  }

  return (
    <div onClick={onClick} className={`bg-white dark:bg-card-dark rounded-2xl p-5 shadow-sm border relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all ${hasAlert ? 'border-red-500 ring-2 ring-red-500/20' : 'border-slate-200 dark:border-slate-800'} ${!isOnline ? 'opacity-70 grayscale-[0.5]' : ''}`}>
      {!isOnline && (
          <div className="absolute top-2 right-2 bg-slate-200 dark:bg-slate-700 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase z-20">Offline</div>
      )}
      
      {hasAlert && (
          <div className="absolute top-2 right-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase z-20 flex items-center gap-1 animate-pulse">
              <span className="material-icons-round text-[10px]">warning</span> Alerta
          </div>
      )}
      
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center ${iconColor}`}>
            <span className="material-icons-round">{icon}</span>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white leading-tight">{sensor.alias || sensor.mac}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{sensor.type || "Sensor"} • {timeDisplay}</p>
          </div>
        </div>
        {sensor.power !== undefined && (
            <div className={`flex items-center space-x-1 px-2 py-1 rounded-lg ${sensor.power < 30 ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500' : 'bg-green-500/10 text-green-600 dark:text-green-400'}`}>
            <span className={`material-icons-round text-sm rotate-90 ${sensor.power < 30 ? 'text-yellow-600 dark:text-yellow-500' : 'text-green-500 dark:text-green-400'}`}>{sensor.power < 30 ? 'battery_alert' : 'battery_full'}</span>
            <span className="text-xs font-bold">{sensor.power}%</span>
            </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 relative z-10">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Temp</span>
          <div className="flex items-baseline space-x-1">
            <span className="text-4xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
                {temp ? temp.toFixed(1).replace('.', ',') : '--'}
            </span>
            <span className="text-lg font-medium text-slate-400 dark:text-slate-500">°C</span>
          </div>
        </div>
        {hum !== undefined && (
            <div className="flex flex-col border-l border-slate-100 dark:border-slate-700 pl-4">
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Umidade</span>
            <div className="flex items-center space-x-1 mt-1">
                <span className={`material-icons-round text-sm ${isHighHumidity ? 'text-red-400 dark:text-red-400' : 'text-blue-400 dark:text-blue-400'}`}>water_drop</span>
                <span className="text-xl font-semibold text-slate-700 dark:text-slate-200">{hum.toFixed(1).replace('.', ',')}%</span>
            </div>
            <span className={`text-xs mt-1 ${isHighHumidity ? 'text-red-400 dark:text-red-400' : (hum > 30 ? 'text-green-500 dark:text-green-400' : 'text-slate-400 dark:text-slate-500')}`}>
                {isHighHumidity ? 'Alta' : (hum > 30 ? 'Ideal' : 'Seco')}
            </span>
            </div>
        )}
        {hum === undefined && sensor.pm25 !== undefined && (
             <div className="flex flex-col border-l border-slate-100 dark:border-slate-700 pl-4">
             <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">PM2.5</span>
             <div className="flex items-center space-x-1 mt-1">
                 <span className="material-icons-round text-sm text-purple-400">blur_on</span>
                 <span className="text-xl font-semibold text-slate-700 dark:text-slate-200">{sensor.pm25}</span>
             </div>
             </div>
        )}
      </div>
    </div>
  );
};
