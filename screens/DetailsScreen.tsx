import React, { useEffect, useState, useRef } from 'react';
import { AppScreen } from '../types';
import { Header } from '../components/Header';
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip, XAxis, ReferenceLine, CartesianGrid } from 'recharts';
import { api } from '../services/api';
import { useSensorStore, Sensor } from '../store/useSensorStore';

interface DetailsScreenProps {
  sensor: Sensor;
  onNavigate: (screen: AppScreen, params?: any) => void;
}

const METRIC_CONFIG: Record<string, { label: string, unit: string, icon: string, color: string, bg: string }> = {
  temperature: { label: 'Temperatura', unit: '°C', icon: 'thermostat', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10' },
  humidity: { label: 'Umidade', unit: '%', icon: 'water_drop', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
  co2: { label: 'CO2', unit: 'ppm', icon: 'co2', color: 'text-teal-500', bg: 'bg-teal-50 dark:bg-teal-500/10' },
  tvoc: { label: 'TVOC', unit: 'ppm', icon: 'grain', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-500/10' },
  pm25: { label: 'PM2.5', unit: 'µg/m³', icon: 'blur_on', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' },
  pressure: { label: 'Pressão', unit: 'hPa', icon: 'speed', color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
  waterLevel: { label: 'Nível Água', unit: '%', icon: 'water_drop', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-600/10' },
};

type TimeRange = '1h' | '24h' | '7d' | '30d';

export const DetailsScreen: React.FC<DetailsScreenProps> = ({ sensor, onNavigate }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const currentReadings = useSensorStore(state => state.currentReadings);
  const latestReading = currentReadings[sensor.id];
  
  // Zoom State
  const [zoomFactor, setZoomFactor] = useState(1); 
  const touchStartDist = useRef<number | null>(null);

  useEffect(() => {
    const loadHistory = async () => {
        setLoadingHistory(true);
        setHistoryError('');
        try {
            const now = new Date();
            let startDate = new Date();
            switch(timeRange) {
                case '1h': startDate = new Date(now.getTime() - 60 * 60 * 1000); break;
                case '24h': startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
                case '7d': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
                case '30d': startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
            }
            
            const response = await api.getSensorHistory(sensor.id, { 
                startDate: startDate.toISOString(),
                endDate: now.toISOString(),
                limit: 100
            });
            
            if (response && response.items) {
                setHistory(response.items); 
            }
        } catch (error: any) {
            setHistoryError('Falha ao carregar histórico.');
        } finally {
            setLoadingHistory(false);
        }
    };
    loadHistory();
  }, [sensor.id, timeRange]);

  const activeMetrics = Object.keys(METRIC_CONFIG).filter(key => 
    (latestReading as any)?.[key] !== undefined && (latestReading as any)?.[key] !== null
  );

  const totalItems = history.length;
  const itemsToShow = Math.max(5, Math.floor(totalItems / zoomFactor));
  const zoomedHistory = history.slice(0, itemsToShow);
  const chartData = [...zoomedHistory].reverse();

  // Gesture handling
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      touchStartDist.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDist.current !== null) {
      const currentDist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      const ratio = currentDist / touchStartDist.current;
      setZoomFactor(prev => Math.max(1, Math.min(prev * (1 + (ratio - 1) * 0.1), 10)));
      touchStartDist.current = currentDist;
    }
  };

  const handleTouchEnd = () => { touchStartDist.current = null; };

  const formatXAxis = (tickItem: any) => {
    if (!tickItem) return '';
    const date = new Date(tickItem);
    return timeRange === '1h' || timeRange === '24h' 
        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString([], { day: '2-digit', month: 'short' });
  };

  const formatTooltipLabel = (label: any) => {
    if (!label) return '';
    return new Date(label).toLocaleString([], { 
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
    });
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">
      <Header 
        title={sensor.alias || sensor.mac} 
        onBack={() => onNavigate(AppScreen.DASHBOARD)} 
        rightAction={
            <button 
                onClick={() => onNavigate(AppScreen.ALERTS, { sensor })}
                className="p-2 -mr-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300"
            >
                <span className="material-icons-round text-[20px]">settings</span>
            </button>
        }
      />
      
      <div className="flex flex-col items-center mt-0.5 mb-2">
        <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Ao Vivo</span>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto no-scrollbar pb-10 px-6 space-y-8 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
        
        {/* Gauge Section (Hero) */}
        <section className="flex flex-col items-center justify-center pt-4">
            <div className="relative w-60 h-60 flex items-center justify-center">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl opacity-30"></div>
                <div className="absolute w-60 h-60 rounded-full border-[14px] border-slate-200 dark:border-slate-800"></div>
                <div 
                    className="absolute w-60 h-60 rounded-full" 
                    style={{
                        background: 'conic-gradient(from 180deg, #197fe6 0%, #197fe6 70%, transparent 70%, transparent 100%)',
                        maskImage: 'radial-gradient(transparent 63%, black 64%)',
                        WebkitMaskImage: 'radial-gradient(transparent 63%, black 64%)',
                        transform: 'rotate(-126deg)'
                    }}
                ></div>
                
                <div className="flex flex-col items-center justify-center z-10 text-center">
                    <span className="text-6xl font-bold tracking-tighter text-slate-900 dark:text-white">
                        {latestReading?.temperature?.toFixed(1).replace('.', ',') || '--'}
                        <span className="text-3xl text-slate-400 dark:text-slate-500 align-top mt-2 inline-block">°C</span>
                    </span>
                    {latestReading?.humidity !== undefined && (
                        <div className="mt-2 flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                            <span className="material-icons-round text-primary text-[16px]">water_drop</span>
                            <span className="text-sm font-semibold text-primary">{latestReading.humidity?.toFixed(0)}% Umidade</span>
                        </div>
                    )}
                </div>
            </div>
            <p className="mt-6 text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500 text-center">
                ID: {sensor.mac.slice(-5)} • Bateria: {sensor.batteryLevel || '--'}%
            </p>
        </section>

        {/* Detailed Metrics Grid */}
        <section className="grid grid-cols-2 gap-3">
            {activeMetrics.map(key => {
                const config = METRIC_CONFIG[key];
                const val = (latestReading as any)[key];
                if (!config || val === undefined) return null;
                return (
                    <div key={key} className="bg-white dark:bg-surface-dark p-3.5 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg ${config.bg} ${config.color} flex items-center justify-center shrink-0`}>
                            <span className="material-icons-round text-lg">{config.icon}</span>
                            </div>
                            <div className="min-w-0">
                            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight truncate">{config.label}</p>
                            <p className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                                {typeof val === 'number' ? val.toFixed(1) : val} <span className="text-[10px] font-medium text-slate-400">{config.unit}</span>
                            </p>
                            </div>
                    </div>
                );
            })}
        </section>

        {/* Time Range Selector */}
        <div className="flex flex-col gap-2">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl sticky top-0 z-10 shadow-sm">
                {(['1h', '24h', '7d', '30d'] as TimeRange[]).map((range) => (
                    <button
                        key={range}
                        onClick={() => { setTimeRange(range); setZoomFactor(1); }}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all uppercase ${
                            timeRange === range 
                            ? 'bg-white dark:bg-surface-dark text-primary shadow-sm' 
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                    >
                        {range}
                    </button>
                ))}
            </div>
        </div>

        {/* Charts Section */}
        {activeMetrics.map(key => {
            const config = METRIC_CONFIG[key];
            if (!config) return null;
            return (
                <section 
                    key={`chart-${key}`}
                    className="bg-white dark:bg-surface-dark rounded-2xl p-5 border border-slate-100 dark:border-slate-700/50 shadow-sm transition-transform touch-none"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <span className={`material-icons-round ${config.color}`}>{config.icon}</span>
                            Histórico de {config.label}
                        </h3>
                    </div>
                    
                    <div className="h-64 w-full relative">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id={`color-${key}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={config.color.includes('orange') ? '#f97316' : '#3b82f6'} stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor={config.color.includes('orange') ? '#f97316' : '#3b82f6'} stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b833" />
                                    <XAxis 
                                        dataKey="timestamp" 
                                        tickFormatter={formatXAxis}
                                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                                        axisLine={false}
                                        tickLine={false}
                                        minTickGap={30}
                                    />
                                    <YAxis 
                                        orientation="left"
                                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                                        axisLine={false}
                                        tickLine={false}
                                        domain={['auto', 'auto']}
                                        width={35}
                                    />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#1e2936', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                                        itemStyle={{ color: '#fff', fontWeight: 'bold', padding: 0 }}
                                        labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                                        labelFormatter={formatTooltipLabel}
                                        formatter={(value: number) => [`${value.toFixed(1)}${config.unit}`]}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey={key} 
                                        stroke={config.color.includes('orange') ? '#f97316' : '#3b82f6'} 
                                        strokeWidth={2.5}
                                        fillOpacity={1} 
                                        fill={`url(#color-${key})`} 
                                        animationDuration={500}
                                        isAnimationActive={zoomFactor === 1}
                                    />
                                    {sensor.alertConfig?.[`${key}Max`] && (
                                        <ReferenceLine 
                                            y={sensor.alertConfig[`${key}Max`]} 
                                            stroke="#ef4444" 
                                            strokeDasharray="4 4" 
                                            label={{ position: 'right', value: `${sensor.alertConfig[`${key}Max`]}`, fill: '#ef4444', fontSize: 8, fontWeight: 'bold' }} 
                                        />
                                    )}
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-400 text-xs italic">
                                {loadingHistory ? 'Buscando dados...' : (historyError || 'Sem dados')}
                            </div>
                        )}
                    </div>
                </section>
            );
        })}

      </main>
        
      <div className="p-6 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md border-t border-slate-100 dark:border-slate-800">
        <button 
            onClick={() => onNavigate(AppScreen.EXPORT, { sensor })}
            className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-primary/25 flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
            <span className="material-icons-round">file_download</span>
            Exportar Dados Históricos
        </button>
      </div>
    </div>
  );
};
