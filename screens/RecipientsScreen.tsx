
import React, { useState, useEffect } from 'react';
import { AppScreen, SensorData } from '../types';
import { Header } from '../components/Header';

interface RecipientsScreenProps {
  sensor: SensorData;
  onNavigate: (screen: AppScreen, params?: any) => void;
}

export const RecipientsScreen: React.FC<RecipientsScreenProps> = ({ sensor, onNavigate }) => {
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [smtpConfig, setSmtpConfig] = useState({
    server: '',
    user: '',
    pass: '',
    port: '587'
  });

  useEffect(() => {
    // Carregar e-mails e SMTP salvos
    const savedRecipients = localStorage.getItem(`recipients_${sensor.mac}`);
    if (savedRecipients) setEmails(JSON.parse(savedRecipients));

    const savedSmtp = localStorage.getItem('global_smtp_config');
    if (savedSmtp) setSmtpConfig(JSON.parse(savedSmtp));
  }, [sensor.mac]);

  const handleAddEmail = () => {
    if (newEmail && newEmail.includes('@') && !emails.includes(newEmail)) {
        const updated = [...emails, newEmail];
        setEmails(updated);
        localStorage.setItem(`recipients_${sensor.mac}`, JSON.stringify(updated));
        setNewEmail('');
    }
  };

  const handleRemoveEmail = (email: string) => {
    const updated = emails.filter(e => e !== email);
    setEmails(updated);
    localStorage.setItem(`recipients_${sensor.mac}`, JSON.stringify(updated));
  };

  const handleSaveSmtp = () => {
    localStorage.setItem('global_smtp_config', JSON.stringify(smtpConfig));
    alert('Configurações de servidor salvas!');
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">
        <Header 
            title="Envio de Alertas" 
            onBack={() => onNavigate(AppScreen.ALERTS, { sensor })} 
        />
        
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-8 no-scrollbar [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
            {/* Context Card */}
            <section>
                 <div className="bg-white dark:bg-card-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="material-icons-round text-primary text-2xl">mail_lock</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">Gestão de Envios</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Configure seu próprio e-mail para receber alertas de {sensor.alias || 'seu sensor'}.</p>
                    </div>
                </div>
            </section>

            {/* Email List Section */}
            <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Destinatários</h3>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">{emails.length} e-mails</span>
                </div>

                <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                    <div className="p-4 border-b border-slate-50 dark:border-slate-800/50 flex gap-2">
                        <input 
                            type="email" 
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="novo.contato@email.com"
                            className="flex-1 bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <button 
                            onClick={handleAddEmail}
                            className="bg-primary text-white px-4 rounded-xl font-bold text-xs shadow-lg shadow-primary/20 active:scale-95 transition-all"
                        >
                            Add
                        </button>
                    </div>

                    <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                        {emails.map(email => (
                            <div key={email} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                        <span className="material-icons-round text-slate-400 text-sm">person</span>
                                    </div>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{email}</span>
                                </div>
                                <button onClick={() => handleRemoveEmail(email)} className="text-red-400 hover:text-red-500 p-1">
                                    <span className="material-icons-round text-lg">delete_outline</span>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SMTP Server Section */}
            <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Configuração do Servidor</h3>
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">SMTP</span>
                </div>

                <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Servidor SMTP</label>
                        <input 
                            type="text" 
                            value={smtpConfig.server}
                            onChange={(e) => setSmtpConfig({...smtpConfig, server: e.target.value})}
                            placeholder="smtp.seu-email.com" 
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs" 
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Usuário/E-mail</label>
                            <input 
                                type="text" 
                                value={smtpConfig.user}
                                onChange={(e) => setSmtpConfig({...smtpConfig, user: e.target.value})}
                                placeholder="alerta@empresa.com" 
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs" 
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Senha</label>
                            <input 
                                type="password" 
                                value={smtpConfig.pass}
                                onChange={(e) => setSmtpConfig({...smtpConfig, pass: e.target.value})}
                                placeholder="••••••••" 
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs" 
                            />
                        </div>
                    </div>
                    <button 
                        onClick={handleSaveSmtp}
                        className="w-full py-2.5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-bold text-xs rounded-xl shadow-lg"
                    >
                        Salvar Configuração de Servidor
                    </button>
                    <p className="text-[10px] text-slate-500 italic text-center">
                        O sistema usará estas credenciais para enviar alertas e relatórios.
                    </p>
                </div>
            </section>
        </main>
        
        <footer className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-card-dark/80 backdrop-blur-md pb-10">
            <button 
                onClick={() => onNavigate(AppScreen.ALERTS, { sensor })}
                className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-xl transition-all active:scale-95"
            >
                Finalizar Ajustes
            </button>
        </footer>
    </div>
  );
};
