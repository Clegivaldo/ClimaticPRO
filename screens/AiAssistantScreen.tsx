
import React, { useState, useEffect, useRef } from 'react';
import { AppScreen, SensorData } from '../types';
import { BottomNav } from '../components/BottomNav';
import { aiService } from '../services/ai';
import { api } from '../services/api';

interface AiAssistantScreenProps {
  onNavigate: (screen: AppScreen, params?: any) => void;
}

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
}

export const AiAssistantScreen: React.FC<AiAssistantScreenProps> = ({ onNavigate }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'assistant', text: 'Olá! Sou o Climatic AI. Analiso seus sensores em tempo real. Como posso ajudar hoje?' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sensors, setSensors] = useState<SensorData[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    fetchSensors();
  }, []);

  const fetchSensors = async () => {
    try {
        const data = await api.getAllDeviceData();
        if (Array.isArray(data)) {
            setSensors(data);
        } else {
            // @ts-ignore
            setSensors(data.list || []);
        }
    } catch (e: any) {
        // Suppress rate limit errors from console, as they are handled by cache/fallback
        if (!e.message?.includes('Muitas requisições')) {
             console.error("Failed to fetch sensors context", e);
        }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMsg: Message = { id: Date.now(), role: 'user', text: inputText };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
        const responseText = await aiService.sendMessage(inputText, sensors);
        const aiMsg: Message = { id: Date.now() + 1, role: 'assistant', text: responseText };
        setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
        const errorMsg: Message = { id: Date.now() + 1, role: 'assistant', text: 'Desculpe, tive um problema ao processar sua solicitação. Tente novamente mais tarde.' };
        setMessages(prev => [...prev, errorMsg]);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-12 pb-4 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <span className="material-icons-round text-white text-xl">auto_awesome</span>
             </div>
             <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Climatic AI</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    Powered by Gemini 3.0
                </p>
             </div>
        </div>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm ${
                        msg.role === 'user' 
                        ? 'bg-primary text-white rounded-tr-none' 
                        : 'bg-white dark:bg-surface-dark text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700/50 rounded-tl-none'
                    }`}>
                         {/* Simple Markdown-like rendering for bold text */}
                        {msg.text.split('\n').map((line, i) => (
                            <p key={i} className="mb-1 last:mb-0">
                                {line}
                            </p>
                        ))}
                    </div>
                </div>
            ))}
            {isLoading && (
                 <div className="flex justify-start">
                    <div className="bg-white dark:bg-surface-dark rounded-2xl rounded-tl-none p-4 border border-slate-100 dark:border-slate-700/50 flex items-center gap-2">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce delay-100"></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-200"></div>
                    </div>
                 </div>
            )}
            <div ref={messagesEndRef} />
        </main>

        {/* Input Area */}
        <div className="p-4 bg-white dark:bg-surface-dark border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-background-dark rounded-full px-4 py-2 border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-primary/50 transition-all">
                <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Pergunte sobre seus sensores..."
                    disabled={isLoading}
                    className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 dark:text-white placeholder-slate-400 py-2"
                />
                <button 
                    onClick={handleSend}
                    disabled={!inputText.trim() || isLoading}
                    className="p-2 bg-primary text-white rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors"
                >
                    <span className="material-icons-round text-lg">send</span>
                </button>
            </div>
        </div>

        <BottomNav 
            activeTab="ai" 
            onChange={(tab) => {
                if (tab === 'sensors') onNavigate(AppScreen.DASHBOARD);
                if (tab === 'history') onNavigate(AppScreen.HISTORY);
                if (tab === 'settings') onNavigate(AppScreen.SETTINGS);
            }} 
        />
    </div>
  );
};
