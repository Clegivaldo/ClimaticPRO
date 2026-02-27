
import React, { useState, useEffect } from 'react';
import { AppScreen } from '../types';
import { BottomNav } from '../components/BottomNav';
import { api } from '../services/api';

interface HistoryScreenProps {
  onNavigate: (screen: AppScreen, params?: any) => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ onNavigate }) => {
  const [filter, setFilter] = useState<'all' | 'alarm' | 'warning'>('all');
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
        setLoading(true);
        try {
            const data = await api.getGlobalAlertHistory();
            if (data && data.items) {
                setEvents(data.items);
            }
        } catch (error) {
            console.error('Failed to fetch alert history:', error);
        } finally {
            setLoading(false);
        }
    };
    fetchEvents();
  }, []);

  const filteredEvents = filter === 'all' 
    ? events 
    : events.filter(e => {
        if (filter === 'alarm') return e.severity === 'CRITICAL';
        if (filter === 'warning') return e.severity === 'WARNING';
        return true;
    });

  const handleAcknowledge = async (alertId: string) => {
      try {
          await api.acknowledgeAlert(alertId);
          setEvents(prev => prev.map(e => e.id === alertId ? { ...e, isAcknowledged: true } : e));
      } catch (e) {
          console.error('Failed to acknowledge alert');
      }
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-12 pb-4 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Eventos</h1>
        
        {/* Filter Chips */}
        <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar [&::-webkit-scrollbar]:hidden">
          <button 
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${filter === 'all' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'}`}
          >
            Todos
          </button>
          <button 
            onClick={() => setFilter('alarm')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1 ${filter === 'alarm' ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'}`}
          >
            <span className="material-icons-round text-[14px]">notifications_active</span> Críticos
          </button>
          <button 
            onClick={() => setFilter('warning')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1 ${filter === 'warning' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'}`}
          >
            <span className="material-icons-round text-[14px]">warning</span> Alertas
          </button>
        </div>
      </div>

      <main 
        className="flex-1 overflow-y-auto px-5 py-2 space-y-4 no-scrollbar [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <span className="material-icons-round text-4xl mb-2 opacity-50">history_toggle_off</span>
            <p>Nenhum evento encontrado.</p>
          </div>
        ) : (
          <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 my-4 space-y-8">
            {filteredEvents.map((event) => (
              <div key={event.id} className="relative pl-6 group">
                {/* Timeline Dot */}
                <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white dark:border-background-dark ${event.type === 'alarm' ? 'bg-red-500' : event.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'} z-10`}></div>
                
                <div className={`bg-white dark:bg-card-dark p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm transition-transform active:scale-[0.99] ${!event.read ? 'ring-1 ring-primary/30' : ''}`}>
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                       <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${event.type === 'alarm' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : event.type === 'warning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                          {event.type === 'alarm' ? 'Alarme' : event.type === 'warning' ? 'Atenção' : 'Info'}
                       </span>
                       {!event.read && <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>}
                    </div>
                    <span className="text-xs text-slate-400 font-medium">{event.time}</span>
                  </div>
                  
                  <h3 className="font-semibold text-slate-900 dark:text-white">{event.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{event.sensor}</p>
                  
                  {event.value && (
                    <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
                            Valor: <strong>{event.value}</strong>
                        </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav 
        activeTab="history" 
        onChange={(tab) => {
            if (tab === 'sensors') onNavigate(AppScreen.DASHBOARD);
            if (tab === 'settings') onNavigate(AppScreen.SETTINGS);
        }} 
      />
    </div>
  );
};
