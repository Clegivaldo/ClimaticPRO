import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from './src/store/useAuthStore';

// Screens
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { DetailsScreen } from './src/screens/DetailsScreen';
import { AiAssistantScreen } from './src/screens/AiAssistantScreen';
import { ScanScreen } from './src/screens/ScanScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!isAuthenticated ? (
            <Stack.Screen name="Login" component={LoginScreen} />
          ) : (
            <>
              <Stack.Screen name="Dashboard" component={DashboardScreen} />
              <Stack.Screen name="Details" component={DetailsScreen} />
              <Stack.Screen name="AiAssistant" component={AiAssistantScreen} />
              <Stack.Screen name="Scan" component={ScanScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
