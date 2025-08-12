/**
 * IoT Smart System - Mobile App
 * ==============================
 * 
 * اپلیکیشن موبایل برای کنترل و مانیتورینگ سیستم IoT
 * 
 * ویژگی‌ها:
 * - کنترل real-time دستگاه‌ها
 * - مانیتورینگ سنسورها
 * - دریافت اعلان‌ها
 * - نقشه دستگاه‌ها
 * - اسکن QR Code
 * - کنترل صوتی
 * 
 * نویسنده: تیم توسعه IoT
 * نسخه: 1.0.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { 
  StyleSheet, 
  View, 
  Platform,
  AppState,
  Alert,
  Linking
} from 'react-native';
import { 
  Provider as PaperProvider,
  DefaultTheme,
  DarkTheme,
  configureFonts
} from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from 'react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import NetInfo from '@react-native-community/netinfo';

// Navigation
import AppNavigator from './src/navigation/AppNavigator';

// Services
import { AuthService } from './src/services/AuthService';
import { SocketService } from './src/services/SocketService';
import { NotificationService } from './src/services/NotificationService';
import { StorageService } from './src/services/StorageService';
import { ApiService } from './src/services/ApiService';

// Stores
import { useAuthStore } from './src/stores/authStore';
import { useSettingsStore } from './src/stores/settingsStore';
import { useDeviceStore } from './src/stores/deviceStore';

// Utils
import { initializeAppSettings } from './src/utils/appInit';
import { registerBackgroundTasks } from './src/utils/backgroundTasks';

// Fonts configuration
const fontConfig = {
  default: {
    regular: {
      fontFamily: Platform.select({
        ios: 'System',
        android: 'Roboto',
      }),
      fontWeight: 'normal',
    },
    medium: {
      fontFamily: Platform.select({
        ios: 'System',
        android: 'Roboto',
      }),
      fontWeight: '500',
    },
    light: {
      fontFamily: Platform.select({
        ios: 'System',
        android: 'Roboto',
      }),
      fontWeight: '300',
    },
    thin: {
      fontFamily: Platform.select({
        ios: 'System',
        android: 'Roboto',
      }),
      fontWeight: '100',
    },
  },
};

// Custom themes
const lightTheme = {
  ...DefaultTheme,
  fonts: configureFonts(fontConfig),
  colors: {
    ...DefaultTheme.colors,
    primary: '#1976d2',
    accent: '#dc004e',
    background: '#f5f5f5',
    surface: '#ffffff',
    text: '#000000',
    disabled: '#bdbdbd',
    placeholder: '#757575',
    backdrop: 'rgba(0, 0, 0, 0.5)',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
    info: '#2196f3',
  },
};

const darkTheme = {
  ...DarkTheme,
  fonts: configureFonts(fontConfig),
  colors: {
    ...DarkTheme.colors,
    primary: '#90caf9',
    accent: '#f48fb1',
    background: '#121212',
    surface: '#1e1e1e',
    text: '#ffffff',
    disabled: '#666666',
    placeholder: '#999999',
    backdrop: 'rgba(255, 255, 255, 0.1)',
    success: '#81c784',
    warning: '#ffb74d',
    error: '#e57373',
    info: '#64b5f6',
  },
};

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

export default function App() {
  // States
  const [isReady, setIsReady] = useState(false);
  const [networkStatus, setNetworkStatus] = useState(null);
  const appState = useRef(AppState.currentState);

  // Stores
  const { isAuthenticated, user } = useAuthStore();
  const { isDarkMode, language } = useSettingsStore();
  const { setConnectionStatus } = useDeviceStore();

  // Notification refs
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    initializeApp();
    
    // Cleanup
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  // Initialize the app
  const initializeApp = async () => {
    try {
      // Initialize app settings
      await initializeAppSettings();
      
      // Setup network monitoring
      setupNetworkMonitoring();
      
      // Setup notifications
      await setupNotifications();
      
      // Setup app state monitoring
      setupAppStateMonitoring();
      
      // Register background tasks
      await registerBackgroundTasks();
      
      // Initialize services
      await initializeServices();
      
      setIsReady(true);
    } catch (error) {
      console.error('App initialization failed:', error);
      Alert.alert(
        'خطا در راه‌اندازی',
        'مشکلی در راه‌اندازی اپلیکیشن رخ داده است.',
        [
          { text: 'تلاش مجدد', onPress: initializeApp },
          { text: 'خروج', onPress: () => {} }
        ]
      );
    }
  };

  // Setup network monitoring
  const setupNetworkMonitoring = () => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetworkStatus(state);
      setConnectionStatus(state.isConnected);
      
      if (!state.isConnected) {
        NotificationService.showLocal(
          'اتصال اینترنت قطع شد',
          'لطفاً اتصال اینترنت خود را بررسی کنید'
        );
      }
    });

    return unsubscribe;
  };

  // Setup notifications
  const setupNotifications = async () => {
    if (!Device.isDevice) {
      Alert.alert('Must use physical device for Push Notifications');
      return;
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      Alert.alert('Failed to get push token for push notification!');
      return;
    }

    // Get push token
    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig.extra.eas.projectId,
    })).data;

    console.log('Push token:', token);

    // Configure notification channel for Android
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: true,
      });
    }

    // Set up notification listeners
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      handleNotificationResponse(response);
    });
  };

  // Handle notification response
  const handleNotificationResponse = (response) => {
    const { notification } = response;
    const data = notification.request.content.data;

    if (data.type === 'device_alert') {
      // Navigate to device details
      // This will be handled by navigation
    } else if (data.type === 'system_update') {
      // Show system update dialog
    }
  };

  // Setup app state monitoring
  const setupAppStateMonitoring = () => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('App has come to the foreground!');
        // Refresh data when app comes to foreground
        queryClient.invalidateQueries();
      }

      appState.current = nextAppState;
    });

    return subscription;
  };

  // Initialize services
  const initializeServices = async () => {
    try {
      // Initialize API service
      await ApiService.initialize();
      
      // Initialize authentication
      await AuthService.initialize();
      
      // Initialize socket connection if authenticated
      if (isAuthenticated) {
        await SocketService.initialize();
      }
      
      // Initialize notification service
      await NotificationService.initialize();
      
    } catch (error) {
      console.error('Service initialization failed:', error);
      throw error;
    }
  };

  // Show loading screen while app is initializing
  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        {/* You can add a custom loading screen here */}
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <PaperProvider theme={isDarkMode ? darkTheme : lightTheme}>
            <NavigationContainer>
              <StatusBar 
                style={isDarkMode ? 'light' : 'dark'} 
                backgroundColor={isDarkMode ? '#121212' : '#ffffff'}
              />
              <AppNavigator />
              
              {/* Network status indicator */}
              {networkStatus && !networkStatus.isConnected && (
                <View style={styles.offlineIndicator}>
                  {/* Offline indicator component */}
                </View>
              )}
            </NavigationContainer>
          </PaperProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  offlineIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});
