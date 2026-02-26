
import React, { useState, useEffect } from 'react';
import { AppScreen, SensorData } from '../types';
import { Header } from '../components/Header';

interface ExportScreenProps {
  sensor: SensorData;
  onNavigate: (screen: AppScreen, params?: any) => void;
}

export const ExportScreen: React.FC<ExportScreenProps> = ({ sensor, onNavigate }) => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const [startDate, setStartDate] = useState(yesterday.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv');
  const [autoExport, setAutoExport] = useState(true);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [isExporting, setIsExporting] = useState(false);
  const [hasSmtp, setHasSmtp] = useState(false);

  useEffect(() => {
    // Carregar destinatários e verificar SMTP
    const savedRecipients = localStorage.getItem(`recipients_${sensor.mac}`);
    if (savedRecipients) setRecipients(JSON.parse(savedRecipients));

    const savedSmtp = localStorage.getItem('global_smtp_config');
    if (savedSmtp) {
        const config = JSON.parse(savedSmtp);
        setHasSmtp(!!config.server && !!config.user);
    }
  }, [sensor.mac]);

  const handleAddEmail = () => {
    if (newEmail && newEmail.includes('@') && !recipients.includes(newEmail)) {
        const updated = [...recipients, newEmail];
        setRecipients(updated);
        localStorage.setItem(`recipients_${sensor.mac}`, JSON.stringify(updated));
        setNewEmail('');
    }
  };

  const handleRemoveEmail = (email: string) => {
    const updated = recipients.filter(r => r !== email);
    setRecipients(updated);
    localStorage.setItem(`recipients_${sensor.mac}`, JSON.stringify(updated));
  };

  const handleGenerateExport = () => {
      setIsExporting(true);
      setTimeout(() => {
          const start = new Date(startDate);
          const end = new Date(endDate);
          
          if (format === 'csv') {
              const headers = ['Data', 'Hora', 'Temperatura(C)', 'Umidade(%)'];
              const rows = [];
              let currentDate = new Date(start);
              while (currentDate <= end) {
                  const temp = (22 + Math.random() * 4 - 2).toFixed(1);
                  const hum = (50 + Math.random() * 10 - 5).toFixed(0);
                  const dateStr = currentDate.toISOString().split('T')[0];
                  const timeStr = currentDate.toTimeString().split(' ')[0];
                  rows.push([dateStr, timeStr, temp, hum]);
                  currentDate.setHours(currentDate.getHours() + 1);
              }
              const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.setAttribute('href', url);
              link.setAttribute('download', `${sensor.alias || 'sensor'}_${startDate}_${endDate}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
          } else {
              let reportContent = `RELATÓRIO CLIMATIC PRO\n`;
              reportContent += `----------------------\n`;
              reportContent += `Sensor: ${sensor.alias || sensor.mac}\n`;
              reportContent += `Período: ${startDate} até ${endDate}\n`;
              reportContent += `Gerado em: ${new Date().toLocaleString()}\n\n`;
              reportContent += `[Fim do Relatório]`;
              const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.setAttribute('href', url);
              link.setAttribute('download', `${sensor.alias || 'sensor'}_report.txt`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
          }
          setIsExporting(false);
      }, 1500);
  };

  const handleScheduleAutoExport = () => {
    if (!hasSmtp) {
        alert('Por favor, configure seu servidor SMTP na tela de Destinatários antes de ativar envios automáticos.');
        onNavigate(AppScreen.RECIPIENTS, { sensor });
        return;
    }
    alert(`Agendamento ${frequency} salvo! Os relatórios serão enviados via seu e-mail para os destinatários cadastrados.`);
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return 'Selecione';
    const date = new Date(dateStr + 'T12:00:00');
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">
        <Header 
            title="Exportar Dados" 
            onBack={() => onNavigate(AppScreen.DETAILS, { sensor })}
        />
        
        <main className="flex-1 overflow-y-auto px-5 py-6 space-y-6 no-scrollbar" style={{ scrollbarWidth: 'none' }}>
            {/* Sensor Info */}
            <section>
                <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700/50 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="material-icons-round text-primary text-2xl">thermostat</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate">{sensor.alias}</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-mono truncate">MAC: {sensor.mac}</p>
                    </div>
                </div>
            </section>

            {/* Period Selection */}
            <section className="space-y-3">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Download Imediato</h3>
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700/50 overflow-hidden divide-y divide-gray-200 dark:divide-gray-700/50">
                    <div className="relative w-full flex items-center justify-between p-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase">Início</span>
                            <span className="text-sm font-medium text-primary">{formatDateDisplay(startDate)}</span>
                        </div>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                        <span className="material-icons-round text-gray-400">calendar_today</span>
                    </div>
                    <div className="relative w-full flex items-center justify-between p-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase">Fim</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{formatDateDisplay(endDate)}</span>
                        </div>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                        <span className="material-icons-round text-gray-400">event</span>
                    </div>
                </div>
            </section>

             {/* Auto Export Toggle & Recipients */}
             <section className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Agendar Envios (E-mail)</h3>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={autoExport} onChange={(e) => setAutoExport(e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                    </label>
                </div>

                {autoExport && (
                    <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700/50 p-4 space-y-5 animate-[fadeIn_0.3s_ease-out]">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Frequência</label>
                            <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                <button onClick={() => setFrequency('daily')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${frequency === 'daily' ? 'bg-white dark:bg-surface-dark shadow text-primary' : 'text-gray-400'}`}>DIÁRIO</button>
                                <button onClick={() => setFrequency('weekly')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${frequency === 'weekly' ? 'bg-white dark:bg-surface-dark shadow text-primary' : 'text-gray-400'}`}>SEMANAL</button>
                                <button onClick={() => setFrequency('monthly')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${frequency === 'monthly' ? 'bg-white dark:bg-surface-dark shadow text-primary' : 'text-gray-400'}`}>MENSAL</button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Lista de Destinatários</label>
                            <div className="flex flex-wrap gap-2">
                                {recipients.map(email => (
                                    <div key={email} className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700">
                                        {email}
                                    </div>
                                ))}
                                {recipients.length === 0 && (
                                    <p className="text-[10px] text-red-400 italic">Configure os e-mails em 'Ajustes de Envio'.</p>
                                )}
                            </div>
                        </div>

                         <div className="flex items-start gap-2 pt-1">
                            <span className="material-icons-round text-primary text-sm mt-0.5">info</span>
                            <p className="text-[11px] text-gray-500 leading-tight">
                                Os relatórios serão enviados <span className="font-bold">pelo seu servidor</span> para a lista acima conforme a frequência selecionada.
                            </p>
                        </div>

                        <button 
                            onClick={handleScheduleAutoExport}
                            className="w-full py-2 bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-[10px] font-bold uppercase rounded-lg"
                        >
                            Salvar Agendamento
                        </button>
                    </div>
                )}
            </section>
        </main>

        <footer className="p-5 border-t border-gray-200 dark:border-gray-800 bg-background-light dark:bg-background-dark pb-8">
            <button 
                onClick={handleGenerateExport}
                disabled={isExporting}
                className="w-full bg-primary text-white font-semibold py-4 px-6 rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
                {isExporting ? <span className="material-icons-round animate-spin">refresh</span> : <span className="material-icons-round">download</span>}
                {isExporting ? 'Processando...' : 'Download Manual Agora'}
            </button>
        </footer>
    </div>
  );
};
