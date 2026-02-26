
import React, { useState, useEffect } from 'react';
import { AppScreen } from '../types';
import { Header } from '../components/Header';
import { aiService } from '../services/ai';

interface SubScreenProps {
  onNavigate: (screen: AppScreen, params?: any) => void;
}

export const ConnectionsScreen: React.FC<SubScreenProps> = ({ onNavigate }) => (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
        <Header title="Gerenciar Conexões" onBack={() => onNavigate(AppScreen.SETTINGS)} />
        <main className="flex-1 p-5 overflow-y-auto no-scrollbar">
            <p className="text-sm text-slate-500 mb-4">Dispositivos conectados recentemente:</p>
            <div className="space-y-3">
                <div className="bg-white dark:bg-surface-dark p-4 rounded-xl flex items-center justify-between border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <span className="material-icons-round text-green-500">bluetooth_connected</span>
                        <div>
                            <p className="font-semibold text-slate-900 dark:text-white">JHT Gateway</p>
                            <p className="text-xs text-slate-500">MAC: C1:32:71:39:72:95</p>
                        </div>
                    </div>
                    <button className="text-red-500 text-sm font-medium">Desconectar</button>
                </div>
                <div className="bg-white dark:bg-surface-dark p-4 rounded-xl flex items-center justify-between border border-slate-100 dark:border-slate-800 opacity-60">
                     <div className="flex items-center gap-3">
                        <span className="material-icons-round text-slate-400">bluetooth_disabled</span>
                        <div>
                            <p className="font-semibold text-slate-900 dark:text-white">PT100 Thermo</p>
                            <p className="text-xs text-slate-500">MAC: B3:54:43:B2:12:EC</p>
                        </div>
                    </div>
                    <button className="text-slate-400 text-sm font-medium">Esquecer</button>
                </div>
            </div>
            <button onClick={() => onNavigate(AppScreen.SCAN)} className="w-full mt-6 bg-primary/10 text-primary py-3 rounded-xl font-semibold">Adicionar Novo Dispositivo</button>
        </main>
    </div>
);

export const CalibrationScreen: React.FC<SubScreenProps> = ({ onNavigate }) => (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
        <Header title="Calibração Global" onBack={() => onNavigate(AppScreen.SETTINGS)} />
        <main className="flex-1 p-5 overflow-y-auto no-scrollbar space-y-6">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl text-yellow-800 dark:text-yellow-200 text-sm">
                Ajustes feitos aqui serão aplicados como "offset" em todos os sensores compatíveis.
            </div>
            
            <div className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Offset Temperatura (°C)</label>
                    <input type="range" min="-5" max="5" step="0.1" className="w-full mt-2" />
                    <div className="flex justify-between text-xs text-slate-400">
                        <span>-5°C</span>
                        <span className="font-bold text-slate-900 dark:text-white">0.0°C</span>
                        <span>+5°C</span>
                    </div>
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Offset Umidade (%)</label>
                    <input type="range" min="-10" max="10" step="1" className="w-full mt-2" />
                    <div className="flex justify-between text-xs text-slate-400">
                        <span>-10%</span>
                        <span className="font-bold text-slate-900 dark:text-white">0%</span>
                        <span>+10%</span>
                    </div>
                </div>
            </div>
            <button className="w-full bg-primary text-white py-3 rounded-xl font-semibold shadow-lg shadow-primary/20">Aplicar Calibração</button>
        </main>
    </div>
);

export const FirmwareScreen: React.FC<SubScreenProps> = ({ onNavigate }) => (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
        <Header title="Atualizar Firmware" onBack={() => onNavigate(AppScreen.SETTINGS)} />
        <main className="flex-1 p-8 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-6">
                <span className="material-icons-round text-4xl text-green-500">check_circle</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Sistema Atualizado</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8">Sua versão atual v2.4.1 é a mais recente disponível.</p>
            
            <button className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-6 py-3 rounded-xl font-semibold">Verificar Novamente</button>
        </main>
    </div>
);

export const HelpScreen: React.FC<SubScreenProps> = ({ onNavigate }) => (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
        <Header title="Ajuda e Suporte" onBack={() => onNavigate(AppScreen.SETTINGS)} />
        <main className="flex-1 p-5 overflow-y-auto no-scrollbar space-y-4">
             <div className="bg-white dark:bg-surface-dark p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                 <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Como parear um sensor?</h3>
                 <p className="text-sm text-slate-500 leading-relaxed">Vá até a aba Sensores, clique no botão "+" e selecione "Buscar Dispositivos". Certifique-se de que o Bluetooth está ligado.</p>
             </div>
             <div className="bg-white dark:bg-surface-dark p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                 <h3 className="font-semibold text-slate-900 dark:text-white mb-2">O sensor aparece Offline?</h3>
                 <p className="text-sm text-slate-500 leading-relaxed">Isso ocorre se o sensor não enviar dados por mais de 1 hora. Verifique a bateria ou a conexão do Gateway.</p>
             </div>
             <button className="w-full mt-4 bg-primary text-white py-3 rounded-xl font-semibold">Contatar Suporte Técnico</button>
        </main>
    </div>
);

export const PrivacyScreen: React.FC<SubScreenProps> = ({ onNavigate }) => (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
        <Header title="Política de Privacidade" onBack={() => onNavigate(AppScreen.SETTINGS)} />
        <main className="flex-1 p-6 overflow-y-auto no-scrollbar text-sm text-slate-600 dark:text-slate-400 leading-relaxed space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white">1. Coleta de Dados</h3>
            <p>Coletamos dados de telemetria dos sensores (temperatura, umidade, etc.) apenas para fins de exibição e histórico no aplicativo.</p>
            
            <h3 className="font-bold text-slate-900 dark:text-white">2. Uso de Localização</h3>
            <p>A permissão de localização é necessária pelo sistema Android/iOS para escanear dispositivos Bluetooth Low Energy (BLE).</p>

            <h3 className="font-bold text-slate-900 dark:text-white">3. Compartilhamento</h3>
            <p>Não compartilhamos seus dados pessoais com terceiros. Todos os dados são armazenados de forma criptografada.</p>
            
            <div className="pt-8 text-center text-xs text-slate-400">
                <p>Climatic Pro &copy; 2024</p>
            </div>
        </main>
    </div>
);

export const AISettingsScreen: React.FC<SubScreenProps> = ({ onNavigate }) => {
    return (
        <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
            <Header title="Configuração de IA" onBack={() => onNavigate(AppScreen.SETTINGS)} />
            <main className="flex-1 p-6 overflow-y-auto no-scrollbar space-y-6">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-2xl text-white shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                         <span className="material-icons-round text-2xl">auto_awesome</span>
                         <h2 className="text-lg font-bold">Gemini 3.0 Flash</h2>
                    </div>
                    <p className="text-white/80 text-sm">
                        A inteligência artificial está ativa e monitorando seus sensores para fornecer insights em tempo real.
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="bg-white dark:bg-surface-dark p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Status do Sistema</h3>
                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                            <span className="material-icons-round text-base">check_circle</span>
                            <span>Conectado ao Google AI Studio</span>
                        </div>
                    </div>
                    
                    <div className="bg-white dark:bg-surface-dark p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Capacidades</h3>
                        <ul className="text-sm text-slate-500 dark:text-slate-400 space-y-2">
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                                Análise de tendências de temperatura
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                                Alertas de qualidade do ar (CO2, PM2.5)
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                                Recomendações de conforto térmico
                            </li>
                        </ul>
                    </div>
                </div>
            </main>
        </div>
    );
};
