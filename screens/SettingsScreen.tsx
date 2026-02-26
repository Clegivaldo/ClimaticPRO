
import React, { useState, useEffect } from 'react';
import { AppScreen } from '../types';
import { BottomNav } from '../components/BottomNav';
import { api } from '../services/api';

interface SettingsScreenProps {
  onNavigate: (screen: AppScreen, params?: any) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onNavigate }) => {
  const [darkMode, setDarkMode] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [unit, setUnit] = useState<'C' | 'F'>('C');
  const [debugToken, setDebugToken] = useState<string | null>(null);
  
  // API Tester State
  const [testEndpoint, setTestEndpoint] = useState('/data/all');
  const [testParams, setTestParams] = useState('page=0&size=100');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (document.documentElement.classList.contains('dark')) {
        setDarkMode(true);
    }
    setDebugToken(api.getToken());
  }, []);

  const toggleDarkMode = () => {
    const isDark = !darkMode;
    setDarkMode(isDark);
    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
  };

  const handleLogout = () => {
      api.logout();
      onNavigate(AppScreen.LOGIN);
  };

  const copyToken = () => {
      if (debugToken) {
          navigator.clipboard.writeText(debugToken);
          alert("Token copiado!");
      }
  };

  const executeApiTest = async () => {
      setIsTesting(true);
      setTestResult(null);
      try {
          const url = `${testEndpoint}?${testParams}`;
          // Use the raw request method to bypass our wrappers
          const data: any = await api.request(url);
          
          let count = 0;
          if (Array.isArray(data)) count = data.length;
          else if (data && data.list) count = data.list.length;
          else if (data && data.data) count = data.data.length;

          setTestResult({
              success: true,
              count,
              preview: JSON.stringify(data, null, 2).substring(0, 300) + '...'
          });
      } catch (e: any) {
          setTestResult({
              success: false,
              error: e.message
          });
      } finally {
          setIsTesting(false);
      }
  };

  const SectionTitle = ({ title }: { title: string }) => (
    <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 px-1 mt-6">
      {title}
    </h3>
  );

  const SettingsItem = ({ 
    icon, 
    color, 
    label, 
    value, 
    onClick, 
    toggle 
  }: { 
    icon: string; 
    color: string; 
    label: string; 
    value?: string; 
    onClick?: () => void;
    toggle?: { checked: boolean; onChange: () => void }
  }) => (
    <div 
        onClick={toggle ? toggle.onChange : onClick}
        className="flex items-center justify-between p-4 bg-white dark:bg-surface-dark border-b border-slate-50 dark:border-slate-700/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer active:bg-slate-100"
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
          <span className="material-icons-round text-white text-lg">{icon}</span>
        </div>
        <span className="text-sm font-medium text-slate-900 dark:text-white">{label}</span>
      </div>
      
      <div className="flex items-center gap-2">
        {value && <span className="text-sm text-slate-400">{value}</span>}
        
        {toggle ? (
            <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${toggle.checked ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${toggle.checked ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
        ) : (
            <span className="material-icons-round text-slate-400 text-xl">chevron_right</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">
        {/* Profile Header */}
        <div className="px-6 pt-12 pb-8 bg-background-light dark:bg-background-dark">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Ajustes</h1>
            <div className="flex items-center gap-4 bg-white dark:bg-surface-dark p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-400 to-primary flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-500/30">
                    <span className="material-icons-round text-3xl">person</span>
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Minha Conta</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Conectado via API</p>
                    <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase">
                        Online
                    </div>
                </div>
            </div>
        </div>

        <main className="flex-1 overflow-y-auto px-5 pb-6 no-scrollbar [&::-webkit-scrollbar]:hidden">
            <SectionTitle title="Inteligência Artificial" />
            <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
                <SettingsItem 
                    icon="auto_awesome" 
                    color="bg-indigo-500" 
                    label="Status da IA" 
                    onClick={() => onNavigate(AppScreen.SETTINGS_AI)}
                />
            </div>

            <SectionTitle title="Geral" />
            <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
                <SettingsItem 
                    icon="dark_mode" 
                    color="bg-slate-800" 
                    label="Modo Escuro" 
                    toggle={{ checked: darkMode, onChange: toggleDarkMode }}
                />
                <SettingsItem 
                    icon="notifications" 
                    color="bg-red-500" 
                    label="Notificações" 
                    toggle={{ checked: pushEnabled, onChange: () => setPushEnabled(!pushEnabled) }}
                />
                <SettingsItem 
                    icon="thermostat" 
                    color="bg-orange-500" 
                    label="Unidade" 
                    value={unit === 'C' ? 'Celsius (°C)' : 'Fahrenheit (°F)'}
                    onClick={() => setUnit(unit === 'C' ? 'F' : 'C')}
                />
            </div>

            <SectionTitle title="Desenvolvedor (Debug API)" />
            <div className="bg-white dark:bg-surface-dark p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                     <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Token</span>
                     <button onClick={copyToken} className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-primary font-bold">Copiar</button>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[10px] text-slate-400 uppercase">Endpoint</label>
                        <input 
                            type="text" 
                            value={testEndpoint}
                            onChange={(e) => setTestEndpoint(e.target.value)}
                            className="w-full text-xs p-2 rounded bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-400 uppercase">Params</label>
                        <input 
                            type="text" 
                            value={testParams}
                            onChange={(e) => setTestParams(e.target.value)}
                            className="w-full text-xs p-2 rounded bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700"
                        />
                    </div>
                </div>

                <button 
                    onClick={executeApiTest}
                    disabled={isTesting}
                    className="w-full py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-700 flex items-center justify-center gap-2"
                >
                    {isTesting && <span className="material-icons-round animate-spin text-xs">refresh</span>}
                    Testar Requisição
                </button>

                {testResult && (
                    <div className={`p-2 rounded text-xs font-mono border ${testResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                        {testResult.success ? (
                            <>
                                <p className="font-bold">Status: OK | Total: {testResult.count}</p>
                                <pre className="mt-1 opacity-70 whitespace-pre-wrap break-all">{testResult.preview}</pre>
                            </>
                        ) : (
                            <p className="font-bold">Error: {testResult.error}</p>
                        )}
                    </div>
                )}
            </div>

            <SectionTitle title="Sobre" />
            <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
                <SettingsItem 
                    icon="help" 
                    color="bg-teal-500" 
                    label="Ajuda e Suporte" 
                    onClick={() => onNavigate(AppScreen.SETTINGS_HELP)}
                />
                <SettingsItem 
                    icon="privacy_tip" 
                    color="bg-slate-500" 
                    label="Política de Privacidade" 
                    onClick={() => onNavigate(AppScreen.SETTINGS_PRIVACY)}
                />
                <div className="p-4 bg-white dark:bg-surface-dark flex justify-center">
                    <p className="text-xs text-slate-400">Versão 1.3.2 (Debug Mode)</p>
                </div>
            </div>
            
            <button onClick={handleLogout} className="w-full mt-6 py-3 text-red-500 font-medium bg-red-50 dark:bg-red-900/10 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors">
                Sair da Conta
            </button>
        </main>

        <BottomNav 
            activeTab="settings" 
            onChange={(tab) => {
                if (tab === 'sensors') onNavigate(AppScreen.DASHBOARD);
                if (tab === 'history') onNavigate(AppScreen.HISTORY);
                if (tab === 'ai') onNavigate(AppScreen.AI_CHAT);
            }} 
        />
    </div>
  );
};
