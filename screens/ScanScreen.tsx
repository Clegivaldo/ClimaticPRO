
import React, { useEffect, useState } from 'react';
import { AppScreen } from '../types';
import { Header } from '../components/Header';
import { parseBleData } from '../utils/bleParser';

interface ScanScreenProps {
  onNavigate: (screen: AppScreen, params?: any) => void;
}

export const ScanScreen: React.FC<ScanScreenProps> = ({ onNavigate }) => {
  const [devices, setDevices] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(true);

  // --- Real Web Bluetooth Scan Logic (Browser Limitations Apply) ---
  const requestBluetoothDevice = async () => {
    try {
        // Note: Browsers generally filter out RAW advertising data packets for privacy.
        // We can connect to devices, but parsing the "020106..." hex string usually requires
        // Android/iOS native code or specific whitelist flags.
        // This function demonstrates the Web Standard way to connect.
        const device = await (navigator as any).bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['battery_service'] // Example service
        });
        
        console.log('User selected:', device.name);
        // We add it to the list as a "Connected" device style
        setDevices(prev => [...prev, {
            name: device.name || 'Unknown Device',
            mac: device.id, // Browsers obfuscate MAC into a UUID
            rssi: -50,
            isNew: true,
            type: 'Generic BLE',
            rawData: 'Browser-Connected',
            temp: undefined,
            hum: undefined
        }]);
    } catch (error) {
        console.log('Bluetooth request failed or cancelled:', error);
    }
  };

  useEffect(() => {
    // --- Simulation of RAW Data Parsing (From Prompt) ---
    // Since we cannot get these exact raw strings from a standard browser scan easily,
    // we simulate the listener here to prove the parsing logic provided in the prompt works correctly.

    // 1. JHT Gateway format example
    const rawJht = "0201041BFF4C000215EBEFD08370A247C89837E7B5634DF52565823D1ACC64";
    const parsedJht = parseBleData(rawJht, 'F525');

    // 2. JHT-UP format example
    const rawJhtUp = "02010607094A41414C4545051206001000020106030339F5141639F568EC9EEAB35443B212ECD45443B212ECD60000000000000000000000000000000000";
    const parsedJhtUp = parseBleData(rawJhtUp, '39F5');

    // 3. Wifi-PT100 format example
    const rawPt100 = "02010607094A41414C4545051206001000020106030335F5141635F541FE0EC700E831CD807948E831CD80794A";
    const parsedPt100 = parseBleData(rawPt100, '35F5');

    const timer1 = setTimeout(() => {
        setDevices(prev => [...prev, {
            name: 'JHT Gateway Sensor',
            mac: 'C1:32:71:39:72:95',
            rssi: -63,
            isNew: true,
            type: 'F525',
            rawData: rawJht,
            temp: parsedJht.temperature, // Should be 24.39
            hum: parsedJht.humidity      // Should be 23.87
        }]);
    }, 1000);

    const timer2 = setTimeout(() => {
        setDevices(prev => [...prev, {
            name: 'JHT-UP Device',
            mac: 'B3:54:43:B2:12:EC',
            rssi: -58,
            isNew: true,
            type: '39F5',
            rawData: rawJhtUp,
            temp: parsedJhtUp.temperature, // Should be 26.73
            hum: parsedJhtUp.humidity      // Should be 62.08
        }]);
    }, 2500);

    const timer3 = setTimeout(() => {
        setDevices(prev => [...prev, {
            name: 'PT100 Thermometer',
            mac: '00:E8:31:CD:80:79',
            rssi: -72,
            isNew: true,
            type: '35F5',
            rawData: rawPt100,
            temp: parsedPt100.temperature, // Should be 31.76
            hum: parsedPt100.humidity      // Should be undefined
        }]);
        setIsScanning(false);
    }, 4000);

    return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">
      <Header 
        title="Parear Novo Sensor" 
        onBack={() => onNavigate(AppScreen.DASHBOARD)}
        rightAction={<button className="text-primary font-medium text-base hover:opacity-80 transition-opacity">Ajuda</button>}
      />
      
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Scanning Animation */}
        <div className="relative flex flex-col items-center justify-center py-6 shrink-0">
          <div className="relative w-48 h-48 flex items-center justify-center mb-6">
             {isScanning && (
                <>
                    <div className="absolute inset-0 rounded-full border border-primary/10 dark:border-primary/20 animate-pulse-slow"></div>
                    <div className="absolute inset-6 rounded-full border border-primary/20 dark:border-primary/30 animate-[pulse_2.5s_ease-in-out_infinite]"></div>
                    <div className="absolute inset-12 rounded-full border border-primary/30 dark:border-primary/40 animate-[pulse_2s_ease-in-out_infinite]"></div>
                    <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(25,127,230,0.15)_0%,rgba(25,127,230,0)_70%)] animate-spin-slow opacity-60"></div>
                </>
             )}
            
            <div className="relative z-10 w-20 h-20 bg-card-dark rounded-full flex items-center justify-center shadow-lg shadow-primary/20 ring-1 ring-primary/30">
              <span className={`material-icons-round text-4xl text-primary ${isScanning ? 'animate-pulse' : ''}`}>bluetooth_searching</span>
            </div>
          </div>
          
          <div className="text-center space-y-2 z-10 px-6">
            <h2 className="text-xl font-medium text-slate-900 dark:text-white">{isScanning ? 'Buscando Dispositivos' : 'Busca Finalizada'}</h2>
            
            <button 
                onClick={requestBluetoothDevice}
                className="mt-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2 px-4 rounded-full flex items-center justify-center gap-2 mx-auto hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
            >
                <span className="material-icons-round text-sm">bluetooth</span>
                Tentar Pareamento Real (Navegador)
            </button>
          </div>
        </div>

        {/* Found Devices List */}
        <div className="flex-1 bg-white dark:bg-card-dark rounded-t-3xl shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.3)] dark:shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col border-t border-slate-100 dark:border-slate-800">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between bg-white/50 dark:bg-card-dark/50 backdrop-blur-sm sticky top-0 z-10">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Dispositivos Encontrados ({devices.length})</h3>
            <div className="flex items-center gap-1.5">
              <span className={`relative flex h-2.5 w-2.5 ${!isScanning && 'hidden'}`}>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
              </span>
              <span className="text-xs font-medium text-primary">{isScanning ? 'Scanning...' : 'Idle'}</span>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 p-4 space-y-3 pb-10">
            {devices.map((device, idx) => (
                <div key={idx} className="group relative bg-slate-50 dark:bg-background-dark/80 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50 hover:border-primary/50 dark:hover:border-primary/50 transition-all duration-300 shadow-sm animate-[fadeIn_0.5s_ease-out]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm text-primary ring-1 ring-slate-200 dark:ring-slate-700`}>
                                <span className="material-icons-round text-2xl">
                                    {device.type === '35F5' ? 'thermostat' : 'sensors'}
                                </span>
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="text-base font-semibold text-slate-900 dark:text-white">{device.name}</h4>
                                    {device.isNew && <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">Parsed</span>}
                                </div>
                                <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">{device.mac}</p>
                                
                                {/* Parsed Data Display */}
                                <div className="flex items-center gap-3 mt-2">
                                    {device.temp !== undefined && (
                                        <div className="flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                                            <span className="material-icons-round text-[12px] text-orange-500">thermostat</span>
                                            {device.temp}°C
                                        </div>
                                    )}
                                    {device.hum !== undefined && (
                                        <div className="flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                                            <span className="material-icons-round text-[12px] text-blue-500">water_drop</span>
                                            {device.hum}%
                                        </div>
                                    )}
                                    <span className="text-[10px] text-slate-400">{device.rssi} dBm</span>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => onNavigate(AppScreen.DASHBOARD)}
                            className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 text-sm font-medium px-4 py-2 rounded-lg transition-all active:scale-95 h-10"
                        >
                            Add
                        </button>
                    </div>
                    {/* Debug Raw Data */}
                    {device.rawData && (
                        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/50">
                             <div className="flex items-center gap-1 mb-1">
                                 <span className="material-icons-round text-[10px] text-slate-400">code</span>
                                 <span className="text-[10px] font-bold text-slate-500 uppercase">Raw Bluetooth Packet</span>
                             </div>
                            <p className="text-[9px] font-mono text-slate-400 break-all bg-slate-100 dark:bg-black/20 p-1.5 rounded border border-slate-200 dark:border-slate-800">
                                {device.rawData}
                            </p>
                        </div>
                    )}
                </div>
            ))}
            {devices.length === 0 && !isScanning && (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                    <p>Nenhum dispositivo encontrado.</p>
                    <button onClick={() => setIsScanning(true)} className="text-primary text-sm font-medium mt-2">Tentar novamente</button>
                </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
