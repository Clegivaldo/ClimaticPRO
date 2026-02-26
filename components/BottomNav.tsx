
import React from 'react';

interface BottomNavProps {
  activeTab: 'sensors' | 'history' | 'settings' | 'ai';
  onChange: (tab: 'sensors' | 'history' | 'settings' | 'ai') => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChange }) => {
  const getItemClass = (tab: string) => `flex flex-col items-center space-y-1 w-16 transition-colors ${activeTab === tab ? 'text-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`;

  return (
    <nav className="bg-white/90 dark:bg-card-dark/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 pt-2 pb-6 px-4 flex justify-between items-center z-50">
      <button onClick={() => onChange('sensors')} className={getItemClass('sensors')}>
        <span className="material-icons-round text-2xl">grid_view</span>
        <span className="text-[10px] font-medium">Sensores</span>
      </button>
      <button onClick={() => onChange('history')} className={getItemClass('history')}>
        <span className="material-icons-round text-2xl">insert_chart_outlined</span>
        <span className="text-[10px] font-medium">Histórico</span>
      </button>
      <button onClick={() => onChange('ai')} className={getItemClass('ai')}>
        <span className="material-icons-round text-2xl">auto_awesome</span>
        <span className="text-[10px] font-medium">IA</span>
      </button>
      <button onClick={() => onChange('settings')} className={getItemClass('settings')}>
        <span className="material-icons-round text-2xl">settings</span>
        <span className="text-[10px] font-medium">Ajustes</span>
      </button>
    </nav>
  );
};
