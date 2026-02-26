
import React, { useState } from 'react';
import { AppScreen } from '../types';
import { api } from '../services/api';

interface LoginScreenProps {
  onNavigate: (screen: AppScreen, params?: any) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onNavigate }) => {
  const [account, setAccount] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'account' | 'code'>('account');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getCleanAccount = () => {
      const trimmed = account.trim();
      if (trimmed.includes('@')) return trimmed;
      return trimmed.replace(/[^\d+]/g, '');
  };

  const handleGetCode = async () => {
    const cleanAccount = getCleanAccount();
    if (!cleanAccount) {
        setError('Por favor, digite seu e-mail ou telefone.');
        return;
    }
    
    if (!cleanAccount.includes('@') && cleanAccount.length < 8) {
        setError('Número de telefone inválido. Inclua o código do país (ex: +55...)');
        return;
    }

    setLoading(true);
    setError('');
    
    try {
        await api.getVerificationCode(cleanAccount);
        setStep('code');
        setLoading(false);
    } catch (err: any) {
        setError(err.message || 'Erro ao enviar código. Tente novamente.');
        setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!code) {
        setError('Digite o código de verificação.');
        return;
    }
    const cleanAccount = getCleanAccount();
    setLoading(true);
    setError('');

    try {
        const response = await api.login(cleanAccount, code);
        if (response && response.token) {
            api.setToken(response.token);
            onNavigate(AppScreen.DASHBOARD);
        } else {
            onNavigate(AppScreen.DASHBOARD);
        }
    } catch (err: any) {
        setError(err.message || 'Código inválido ou expirado.');
        setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden relative">
      <div className="absolute top-0 left-0 right-0 h-1/2 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-primary/20 blur-3xl"></div>
          <div className="absolute top-12 -left-12 w-48 h-48 rounded-full bg-blue-500/10 blur-2xl"></div>
      </div>

      <div className="flex-1 flex flex-col justify-center px-8 z-10 pt-16">
        <div className="mb-10 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-primary/30 mb-6">
                <span className="material-icons-round text-3xl text-white">sensors</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Climatic Pro</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Monitoramento de Ativos</p>
        </div>

        <div className="space-y-6">
            <div className={`transition-all duration-300 ${step === 'account' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full hidden'}`}>
                <div className="space-y-4">
                    <div className="relative">
                        <span className="absolute left-3 top-3 material-icons-round text-slate-400">person_outline</span>
                        <input 
                            type="text" 
                            value={account}
                            onChange={(e) => setAccount(e.target.value)}
                            placeholder="E-mail ou Telefone (ex: +55...)"
                            className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-10 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                        />
                    </div>
                    <button 
                        onClick={handleGetCode}
                        disabled={loading}
                        className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl shadow-lg disabled:opacity-70 transition-all active:scale-[0.98]"
                    >
                        {loading ? 'Aguarde...' : 'Solicitar Código de Acesso'}
                    </button>
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg text-center mt-2">
                         <p className="text-[10px] text-slate-500 leading-tight">
                             <span className="font-bold text-primary">Dica:</span> Use um <span className="font-bold">E-mail</span> para criar conta automaticamente. 
                             Se usar Telefone, certifique-se que o número já está habilitado no sistema.
                         </p>
                    </div>
                </div>
            </div>

            <div className={`transition-all duration-300 ${step === 'code' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full hidden'}`}>
                 <div className="space-y-4">
                    <div className="relative">
                        <span className="absolute left-3 top-3 material-icons-round text-slate-400">lock_open</span>
                        <input 
                            type="text" 
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="Código"
                            maxLength={4}
                            className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-10 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all tracking-widest text-center text-lg"
                        />
                    </div>
                    <button 
                        onClick={handleLogin}
                        disabled={loading}
                        className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl shadow-lg disabled:opacity-70 transition-all active:scale-[0.98]"
                    >
                         {loading ? 'Validando...' : 'Entrar no Sistema'}
                    </button>
                    <button onClick={() => setStep('account')} className="w-full text-xs text-primary font-medium mt-2">Voltar e alterar conta</button>
                </div>
            </div>
        </div>

        <div className="mt-8 flex justify-center">
            <button 
                onClick={() => {
                    api.setToken('DEMO_TOKEN');
                    onNavigate(AppScreen.DASHBOARD);
                }}
                className="text-xs text-slate-400 hover:text-primary transition-colors flex items-center gap-1"
            >
                <span className="material-icons-round text-sm">visibility</span>
                Entrar em Modo Demo (Sem Login)
            </button>
        </div>

        {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-500 text-xs rounded-lg text-center border border-red-100">
                {error}
            </div>
        )}
      </div>

      <div className="p-6 text-center z-10">
          <p className="text-xs text-slate-400">
              Climatic Pro © 2024 • Termos e Privacidade
          </p>
      </div>
    </div>
  );
};
