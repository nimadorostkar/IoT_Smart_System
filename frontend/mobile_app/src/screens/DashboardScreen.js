/**
 * Dashboard Screen - صفحه اصلی موبایل
 * ====================================
 * 
 * این صفحه شامل:
 * - آمار کلی سیستم
 * - دسترسی سریع به دستگاه‌ها
 * - نمودارهای کوچک
 * - اعلان‌های مهم
 * - کنترل سریع
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  Alert,
  Platform,
  Vibration
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
  FAB,
  Portal,
  Modal,
  List,
  Avatar,
  ProgressBar,
  Snackbar,
  Surface,
  IconButton,
  useTheme
} from 'react-native-paper';
import { LineChart, PieChart } from 'react-native-chart-kit';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import moment from 'moment';
import HapticFeedback from 'react-native-haptic-feedback';

// Services
import { ApiService } from '../services/ApiService';
import { SocketService } from '../services/SocketService';
import { NotificationService } from '../services/NotificationService';

// Stores
import { useDeviceStore } from '../stores/deviceStore';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';

// Components
import StatCard from '../components/Dashboard/StatCard';
import QuickActionButton from '../components/Dashboard/QuickActionButton';
import DeviceStatusCard from '../components/Dashboard/DeviceStatusCard';
import AlertCard from '../components/Dashboard/AlertCard';
import LoadingSpinner from '../components/Common/LoadingSpinner';

// Utils
import { formatNumber, formatDate } from '../utils/formatters';
import { generateHaptic } from '../utils/haptics';

const { width: screenWidth } = Dimensions.get('window');

const DashboardScreen = ({ navigation }) => {
  const theme = useTheme();
  const queryClient = useQueryClient();

  // States
  const [refreshing, setRefreshing] = useState(false);
  const [quickActionVisible, setQuickActionVisible] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Stores
  const { devices, connectionStatus } = useDeviceStore();
  const { user } = useAuthStore();
  const { isDarkMode } = useSettingsStore();

  // Queries
  const { 
    data: dashboardStats, 
    isLoading: statsLoading, 
    error: statsError 
  } = useQuery(
    'dashboard-stats',
    ApiService.getDashboardStats,
    {
      refetchInterval: 30000, // 30 seconds
      refetchOnFocus: true,
    }
  );

  const { 
    data: recentAlerts, 
    isLoading: alertsLoading 
  } = useQuery(
    'recent-alerts',
    () => ApiService.getAlerts({ limit: 5, status: 'active' }),
    {
      refetchInterval: 15000, // 15 seconds
    }
  );

  const { 
    data: onlineDevices, 
    isLoading: devicesLoading 
  } = useQuery(
    'online-devices',
    () => ApiService.getDevices({ status: 'online', limit: 8 }),
    {
      refetchInterval: 20000, // 20 seconds
    }
  );

  // Mutations
  const deviceControlMutation = useMutation(
    ({ deviceId, command }) => ApiService.sendDeviceCommand(deviceId, command),
    {
      onSuccess: (data, variables) => {
        generateHaptic('success');
        showSnackbar(`دستور ${variables.command} ارسال شد`);
        queryClient.invalidateQueries('online-devices');
      },
      onError: (error, variables) => {
        generateHaptic('error');
        showSnackbar(`خطا در ارسال دستور: ${error.message}`);
      }
    }
  );

  // Effects
  useFocusEffect(
    useCallback(() => {
      // Setup socket listeners
      const unsubscribe = setupSocketListeners();
      return unsubscribe;
    }, [])
  );

  // Setup socket event listeners
  const setupSocketListeners = () => {
    if (!SocketService.socket) return () => {};

    const socket = SocketService.socket;

    const handleSensorData = (data) => {
      queryClient.setQueryData(['device', data.deviceId], oldData => ({
        ...oldData,
        lastData: data.data,
        lastSeen: new Date().toISOString()
      }));
    };

    const handleDeviceEvent = (event) => {
      if (event.event === 'motion_detected') {
        NotificationService.showLocal(
          'حرکت تشخیص داده شد',
          `دستگاه: ${event.deviceId}`
        );
        generateHaptic('warning');
      }
    };

    const handleAlert = (alert) => {
      NotificationService.showLocal(
        'هشدار جدید',
        alert.message
      );
      queryClient.invalidateQueries('recent-alerts');
      generateHaptic('error');
    };

    socket.on('sensorData', handleSensorData);
    socket.on('deviceEvent', handleDeviceEvent);
    socket.on('alert', handleAlert);

    return () => {
      socket.off('sensorData', handleSensorData);
      socket.off('deviceEvent', handleDeviceEvent);
      socket.off('alert', handleAlert);
    };
  };

  // Handle pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries('dashboard-stats'),
        queryClient.invalidateQueries('recent-alerts'),
        queryClient.invalidateQueries('online-devices')
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  // Show snackbar message
  const showSnackbar = (message) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  // Handle device control
  const handleDeviceControl = (deviceId, command) => {
    deviceControlMutation.mutate({ deviceId, command });
  };

  // Handle quick action
  const handleQuickAction = (action) => {
    generateHaptic('light');
    setQuickActionVisible(false);
    
    switch (action) {
      case 'scan_qr':
        navigation.navigate('QRScanner');
        break;
      case 'add_device':
        navigation.navigate('AddDevice');
        break;
      case 'emergency':
        handleEmergencyMode();
        break;
      case 'all_off':
        handleAllDevicesOff();
        break;
    }
  };

  // Handle emergency mode
  const handleEmergencyMode = () => {
    Alert.alert(
      'حالت اضطراری',
      'آیا می‌خواهید تمام دستگاه‌ها را خاموش کنید؟',
      [
        { text: 'انصراف', style: 'cancel' },
        { 
          text: 'خاموش کردن', 
          style: 'destructive',
          onPress: () => {
            // Send emergency command to all devices
            onlineDevices?.forEach(device => {
              handleDeviceControl(device.deviceId, 'emergency_off');
            });
            generateHaptic('heavy');
          }
        }
      ]
    );
  };

  // Handle all devices off
  const handleAllDevicesOff = () => {
    Alert.alert(
      'خاموش کردن همه',
      'آیا می‌خواهید تمام دستگاه‌ها را خاموش کنید؟',
      [
        { text: 'انصراف', style: 'cancel' },
        { 
          text: 'تأیید', 
          onPress: () => {
            onlineDevices?.forEach(device => {
              if (device.capabilities?.actuators?.length > 0) {
                handleDeviceControl(device.deviceId, 'turn_off');
              }
            });
          }
        }
      ]
    );
  };

  // Calculate stats
  const stats = {
    totalDevices: dashboardStats?.devices?.total || 0,
    onlineDevices: dashboardStats?.devices?.online || 0,
    offlineDevices: dashboardStats?.devices?.offline || 0,
    activeAlerts: recentAlerts?.filter(alert => alert.status === 'active').length || 0,
    avgTemperature: dashboardStats?.sensors?.temperature?.avg || 0,
    avgHumidity: dashboardStats?.sensors?.humidity?.avg || 0,
    energyConsumption: dashboardStats?.energy?.today || 0
  };

  // Chart data
  const temperatureChartData = {
    labels: ['12:00', '15:00', '18:00', '21:00', '00:00', '03:00'],
    datasets: [{
      data: dashboardStats?.charts?.temperature || [22, 24, 26, 23, 21, 20],
      strokeWidth: 2,
      color: (opacity = 1) => `rgba(255, 99, 132, ${opacity})`,
    }]
  };

  const deviceTypesData = dashboardStats?.devices?.byType?.map((item, index) => ({
    name: item.type,
    population: item.count,
    color: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'][index % 5],
    legendFontColor: theme.colors.text,
    legendFontSize: 12
  })) || [];

  const chartConfig = {
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    color: (opacity = 1) => theme.colors.primary,
    labelColor: (opacity = 1) => theme.colors.text,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 1,
  };

  if (statsLoading && !dashboardStats) {
    return <LoadingSpinner />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Header */}
        <Surface style={[styles.welcomeCard, { backgroundColor: theme.colors.primary }]}>
          <View style={styles.welcomeContent}>
            <View>
              <Title style={[styles.welcomeTitle, { color: '#fff' }]}>
                سلام {user?.name || 'کاربر'} 👋
              </Title>
              <Paragraph style={[styles.welcomeText, { color: '#fff' }]}>
                {stats.onlineDevices} دستگاه آنلاین • {stats.activeAlerts} هشدار فعال
              </Paragraph>
            </View>
            <Avatar.Icon 
              size={50} 
              icon="account" 
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
            />
          </View>
        </Surface>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <StatCard
              title="دستگاه‌ها"
              value={stats.totalDevices}
              icon="devices"
              color={theme.colors.primary}
              style={styles.statCard}
            />
            <StatCard
              title="آنلاین"
              value={stats.onlineDevices}
              icon="check-circle"
              color="#4CAF50"
              style={styles.statCard}
            />
          </View>
          
          <View style={styles.statsRow}>
            <StatCard
              title="هشدارها"
              value={stats.activeAlerts}
              icon="alert"
              color={stats.activeAlerts > 0 ? "#F44336" : "#4CAF50"}
              style={styles.statCard}
            />
            <StatCard
              title="دما میانگین"
              value={`${stats.avgTemperature.toFixed(1)}°C`}
              icon="thermometer"
              color="#FF9800"
              style={styles.statCard}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <Card style={styles.card}>
          <Card.Content>
            <Title>دسترسی سریع</Title>
            <View style={styles.quickActions}>
              <QuickActionButton
                icon="qrcode-scan"
                label="اسکن QR"
                onPress={() => handleQuickAction('scan_qr')}
              />
              <QuickActionButton
                icon="plus"
                label="افزودن دستگاه"
                onPress={() => handleQuickAction('add_device')}
              />
              <QuickActionButton
                icon="power"
                label="همه خاموش"
                onPress={() => handleQuickAction('all_off')}
              />
              <QuickActionButton
                icon="alert"
                label="اضطراری"
                onPress={() => handleQuickAction('emergency')}
                color="#F44336"
              />
            </View>
          </Card.Content>
        </Card>

        {/* Temperature Chart */}
        <Card style={styles.card}>
          <Card.Content>
            <Title>نمودار دما (6 ساعت گذشته)</Title>
            <LineChart
              data={temperatureChartData}
              width={screenWidth - 80}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          </Card.Content>
        </Card>

        {/* Device Types Chart */}
        {deviceTypesData.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Title>انواع دستگاه‌ها</Title>
              <PieChart
                data={deviceTypesData}
                width={screenWidth - 80}
                height={220}
                chartConfig={chartConfig}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                style={styles.chart}
              />
            </Card.Content>
          </Card>
        )}

        {/* Online Devices */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <Title>دستگاه‌های آنلاین</Title>
              <Button 
                mode="outlined" 
                compact 
                onPress={() => navigation.navigate('Devices')}
              >
                همه
              </Button>
            </View>
            
            {devicesLoading ? (
              <ProgressBar indeterminate />
            ) : (
              <View style={styles.devicesList}>
                {onlineDevices?.slice(0, 4).map((device) => (
                  <DeviceStatusCard
                    key={device.deviceId}
                    device={device}
                    onPress={() => navigation.navigate('DeviceDetails', { deviceId: device.deviceId })}
                    onControl={handleDeviceControl}
                    isLoading={deviceControlMutation.isLoading}
                  />
                ))}
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Recent Alerts */}
        {recentAlerts?.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <Title>آخرین هشدارها</Title>
                <Button 
                  mode="outlined" 
                  compact 
                  onPress={() => navigation.navigate('Alerts')}
                >
                  همه
                </Button>
              </View>
              
              {recentAlerts.slice(0, 3).map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onPress={() => {
                    // Handle alert press
                  }}
                />
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Connection Status */}
        {!connectionStatus && (
          <Card style={[styles.card, { backgroundColor: theme.colors.error }]}>
            <Card.Content>
              <View style={styles.offlineCard}>
                <Icon name="wifi-off" size={24} color="#fff" />
                <Title style={{ color: '#fff', marginLeft: 10 }}>
                  اتصال اینترنت قطع است
                </Title>
              </View>
            </Card.Content>
          </Card>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Button */}
      <Portal>
        <FAB.Group
          open={quickActionVisible}
          icon={quickActionVisible ? 'close' : 'plus'}
          actions={[
            {
              icon: 'qrcode-scan',
              label: 'اسکن QR Code',
              onPress: () => handleQuickAction('scan_qr'),
            },
            {
              icon: 'devices',
              label: 'افزودن دستگاه',
              onPress: () => handleQuickAction('add_device'),
            },
            {
              icon: 'power',
              label: 'کنترل همگانی',
              onPress: () => handleQuickAction('all_off'),
            },
          ]}
          onStateChange={({ open }) => setQuickActionVisible(open)}
          style={styles.fab}
        />
      </Portal>

      {/* Snackbar */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={styles.snackbar}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  welcomeCard: {
    margin: 16,
    borderRadius: 12,
    elevation: 4,
  },
  welcomeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  welcomeText: {
    fontSize: 14,
    opacity: 0.9,
  },
  statsContainer: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 5,
  },
  card: {
    margin: 16,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  devicesList: {
    marginTop: 10,
  },
  offlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  snackbar: {
    position: 'absolute',
    bottom: 0,
  },
});

export default DashboardScreen;
