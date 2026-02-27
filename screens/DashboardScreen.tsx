import React, { useEffect, useState, useRef } from 'react';
import { AppScreen } from '../types';
import { api } from '../services/api';
import { BottomNav } from '../components/BottomNav';
import { useSensorStore, Sensor } from '../store/useSensorStore';

interface DashboardScreenProps {
  onNavigate: (screen: AppScreen, params?: any) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigate }) => {
  const { sensors, setSensors, lastUpdated } = useSensorStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');
  const pollingInterval = useRef<any>(null);

  const fetchData = async (isBackground = false) => {
    if (!isBackground && sensors.length === 0) setLoading(true);
    try {
        const list = await api.getAllDeviceData();
        setSensors(list);
        setError('');
    } catch (err: any) {
        if (!isBackground) {
            setError(err.message || 'Falha ao carregar sensores.');
        }
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll every 60 seconds
    pollingInterval.current = setInterval(() => fetchData(true), 60000);
    return () => { if (pollingInterval.current) clearInterval(pollingInterval.current); };
  }, []);

  const filteredSensors = sensors.filter(s => {
      if (filterStatus === 'all') return true;
      return (s.isActive ? 'online' : 'offline') === filterStatus;
  });

  const onlineCount = sensors.filter(s => s.isActive).length;
  const offlineCount = sensors.filter(s => !s.isActive).length;

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">
      {/* Status Bar */}
      <div className="h-8 w-full flex items-end justify-between px-6 pb-2 text-xs font-medium text-slate-900 dark:text-slate-100 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <span>{lastUpdated ? new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
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
                  {loading ? 'Atualizando...' : (error ? 'Erro de conexão' : 'Ao Vivo')}
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

        {/* Summary Widgets (Requirement 13.1) */}
        <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-card-dark p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Ativos</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{onlineCount}</p>
            </div>
            <div className="bg-white dark:bg-card-dark p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alertas</p>
                <p className="text-xl font-bold text-red-500">0</p>
            </div>
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
                Ativos ({onlineCount})
             </button>
             <button 
                onClick={() => setFilterStatus('offline')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${filterStatus === 'offline' ? 'bg-white dark:bg-surface-dark text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
             >
                Inativos ({offlineCount})
             </button>
        </div>
      </header>

      {/* Main content */}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSensors.map((sensor) => (
               <SensorCard key={sensor.id} sensor={sensor} onClick={() => onNavigate(AppScreen.DETAILS, { sensor })} />
            ))}
        </div>

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

const SensorCard: React.FC<{ sensor: Sensor; onClick: () => void }> = ({ sensor, onClick }) => {
  const isOnline = sensor.isActive;
  
  // Get latest reading from store
  const currentReadings = useSensorStore(state => state.currentReadings);
  const latestReading = currentReadings[sensor.id];

  const temp = latestReading?.temperature || 0;
  const hum = latestReading?.humidity || 0;
  
  // Choose icon based on Type
  let icon = "sensors";
  let iconBg = "bg-blue-50 dark:bg-blue-500/10";
  let iconColor = "text-primary dark:text-blue-400";

  const type = sensor.deviceType.toLowerCase();

  if (type.includes("pt100")) {
      icon = "thermostat";
      iconBg = "bg-orange-50 dark:bg-orange-500/10";
      iconColor = "text-orange-500 dark:text-orange-400";
  } else if (type.includes("water")) {
      icon = "water_drop";
      iconBg = "bg-cyan-50 dark:bg-cyan-500/10";
      iconColor = "text-cyan-500 dark:text-cyan-400";
  }

  return (
    <div onClick={onClick} className={`bg-white dark:bg-card-dark rounded-2xl p-5 shadow-sm border relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all border-slate-200 dark:border-slate-800 ${!isOnline ? 'opacity-70 grayscale-[0.5]' : ''}`}>
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center ${iconColor}`}>
            <span className="material-icons-round">{icon}</span>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white leading-tight">{sensor.alias || sensor.mac}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{sensor.deviceType} • {sensor.lastSeenAt ? new Date(sensor.lastSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</p>
          </div>
        </div>
        {sensor.batteryLevel !== undefined && (
            <div className={`flex items-center space-x-1 px-2 py-1 rounded-lg ${sensor.batteryLevel < 30 ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500' : 'bg-green-500/10 text-green-600 dark:text-green-400'}`}>
            <span className={`material-icons-round text-sm rotate-90`}>{sensor.batteryLevel < 30 ? 'battery_alert' : 'battery_full'}</span>
            <span className="text-xs font-bold">{sensor.batteryLevel}%</span>
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
                    <span className="material-icons-round text-sm text-blue-400">water_drop</span>
                    <span className="text-xl font-semibold text-slate-700 dark:text-slate-200">{hum ? `${hum.toFixed(1).replace('.', ',')}%` : '--'}</span>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
