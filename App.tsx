
import React, { useState } from 'react';
import { AppScreen, SensorData } from './types';
import { DashboardScreen } from './screens/DashboardScreen';
import { ScanScreen } from './screens/ScanScreen';
import { DetailsScreen } from './screens/DetailsScreen';
import { ExportScreen } from './screens/ExportScreen';
import { AlertsScreen } from './screens/AlertsScreen';
import { RecipientsScreen } from './screens/RecipientsScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { LoginScreen } from './screens/LoginScreen';
import { ConnectionsScreen, CalibrationScreen, FirmwareScreen, HelpScreen, PrivacyScreen, AISettingsScreen } from './screens/SettingsSubScreens';
import { AiAssistantScreen } from './screens/AiAssistantScreen';

const App: React.FC = () => {
  // Start at LOGIN screen
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.LOGIN);
  const [navParams, setNavParams] = useState<any>(null);

  const navigate = (screen: AppScreen, params?: any) => {
    setNavParams(params);
    setCurrentScreen(screen);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case AppScreen.LOGIN:
        return <LoginScreen onNavigate={navigate} />;
      case AppScreen.DASHBOARD:
        return <DashboardScreen onNavigate={navigate} />;
      case AppScreen.SCAN:
        return <ScanScreen onNavigate={navigate} />;
      case AppScreen.DETAILS:
        return <DetailsScreen sensor={navParams?.sensor} onNavigate={navigate} />;
      case AppScreen.EXPORT:
        return <ExportScreen sensor={navParams?.sensor} onNavigate={navigate} />;
      case AppScreen.ALERTS:
        return <AlertsScreen sensor={navParams?.sensor} onNavigate={navigate} />;
      case AppScreen.RECIPIENTS:
        return <RecipientsScreen sensor={navParams?.sensor} onNavigate={navigate} />;
      case AppScreen.HISTORY:
        return <HistoryScreen onNavigate={navigate} />;
      case AppScreen.SETTINGS:
        return <SettingsScreen onNavigate={navigate} />;
      
      // AI Screens
      case AppScreen.AI_CHAT:
        return <AiAssistantScreen onNavigate={navigate} />;
      case AppScreen.SETTINGS_AI:
        return <AISettingsScreen onNavigate={navigate} />;

      // Sub-screens
      case AppScreen.SETTINGS_CONNECTIONS:
        return <ConnectionsScreen onNavigate={navigate} />;
      case AppScreen.SETTINGS_CALIBRATION:
        return <CalibrationScreen onNavigate={navigate} />;
      case AppScreen.SETTINGS_FIRMWARE:
        return <FirmwareScreen onNavigate={navigate} />;
      case AppScreen.SETTINGS_HELP:
        return <HelpScreen onNavigate={navigate} />;
      case AppScreen.SETTINGS_PRIVACY:
        return <PrivacyScreen onNavigate={navigate} />;
        
      default:
        return <LoginScreen onNavigate={navigate} />;
    }
  };

  return (
    <div className="antialiased text-slate-900 dark:text-slate-100 font-display flex justify-center bg-black h-[100dvh] w-full overflow-hidden">
       <div className="w-full max-w-md h-full flex flex-col relative shadow-2xl overflow-hidden bg-background-light dark:bg-background-dark sm:border-x sm:border-slate-800">
         {renderScreen()}
       </div>
    </div>
  );
};

export default App;
