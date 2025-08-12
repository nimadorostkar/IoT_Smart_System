/**
 * Dashboard Page - صفحه اصلی داشبورد
 * ===================================
 * 
 * این صفحه شامل:
 * - آمار کلی سیستم
 * - نمودارهای real-time
 * - لیست دستگاه‌های آنلاین
 * - آخرین اعلان‌ها
 * - کنترل سریع دستگاه‌ها
 * - نقشه موقعیت
 */

import React, { useState, useEffect, useContext } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Switch,
  Divider,
  Alert,
  LinearProgress,
  IconButton,
  Tooltip
} from '@mui/material';

import {
  Devices as DevicesIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  WifiOff as WifiOffIcon,
  Battery1Bar as BatteryIcon,
  Thermostat as ThermostatIcon,
  Opacity as OpacityIcon,
  Lightbulb as LightbulbIcon,
  DirectionsRun as MotionIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Power as PowerIcon
} from '@mui/icons-material';

import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from 'react-query';

// Contexts and Services
import { AppContext, SocketContext } from '../App';
import { ApiService } from '../services/apiService';
import { NotificationService } from '../services/notificationService';

// Components
import StatCard from '../components/Dashboard/StatCard';
import RealTimeChart from '../components/Dashboard/RealTimeChart';
import DeviceQuickControl from '../components/Dashboard/DeviceQuickControl';
import AlertsList from '../components/Dashboard/AlertsList';
import WeatherWidget from '../components/Dashboard/WeatherWidget';
import SystemHealthMonitor from '../components/Dashboard/SystemHealthMonitor';

// Hooks
import { useRealTimeData } from '../hooks/useRealTimeData';

// Utils
import { formatDate, formatNumber } from '../utils/formatters';

const Dashboard = () => {
  const { user, deviceStats } = useContext(AppContext);
  const { socket, connected } = useContext(SocketContext);
  const queryClient = useQueryClient();

  // Local state
  const [timeRange, setTimeRange] = useState('24h');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);

  // Real-time data hook
  const { 
    sensorData, 
    deviceStatuses, 
    systemHealth,
    isLoading: rtDataLoading 
  } = useRealTimeData();

  // Queries
  const { data: dashboardStats, isLoading: statsLoading } = useQuery(
    'dashboard-stats',
    ApiService.getDashboardStats,
    {
      refetchInterval: 30000, // 30 seconds
      staleTime: 25000
    }
  );

  const { data: recentAlerts, isLoading: alertsLoading } = useQuery(
    'recent-alerts',
    () => ApiService.getAlerts({ limit: 5, status: 'active' }),
    {
      refetchInterval: 10000 // 10 seconds
    }
  );

  const { data: onlineDevices, isLoading: devicesLoading } = useQuery(
    'online-devices',
    () => ApiService.getDevices({ status: 'online', limit: 10 }),
    {
      refetchInterval: 20000 // 20 seconds
    }
  );

  // Mutations
  const controlDeviceMutation = useMutation(
    ({ deviceId, command }) => ApiService.sendDeviceCommand(deviceId, command),
    {
      onSuccess: (data, variables) => {
        NotificationService.success(
          `دستور ${variables.command} برای دستگاه ${variables.deviceId} ارسال شد`
        );
        queryClient.invalidateQueries('online-devices');
      },
      onError: (error, variables) => {
        NotificationService.error(
          `خطا در ارسال دستور ${variables.command} به دستگاه ${variables.deviceId}`
        );
      }
    }
  );

  // Handle manual refresh
  const handleRefresh = async () => {
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
  };

  // Handle device control
  const handleDeviceControl = (deviceId, command) => {
    controlDeviceMutation.mutate({ deviceId, command });
  };

  // Calculate stats for display
  const stats = {
    totalDevices: dashboardStats?.devices.total || 0,
    onlineDevices: dashboardStats?.devices.online || 0,
    offlineDevices: dashboardStats?.devices.offline || 0,
    activeAlerts: recentAlerts?.filter(alert => alert.status === 'active').length || 0,
    systemUptime: dashboardStats?.system.uptime || 0,
    avgTemperature: sensorData?.temperature?.avg || 0,
    avgHumidity: sensorData?.humidity?.avg || 0,
    totalEnergy: dashboardStats?.energy?.total || 0
  };

  // Chart colors
  const chartColors = {
    primary: '#1976d2',
    secondary: '#dc004e',
    success: '#2e7d32',
    warning: '#ed6c02',
    error: '#d32f2f',
    info: '#0288d1'
  };

  // Prepare chart data
  const deviceTypesData = dashboardStats?.devices.byType?.map((item, index) => ({
    ...item,
    fill: Object.values(chartColors)[index % Object.values(chartColors).length]
  })) || [];

  const temperatureData = sensorData?.temperature?.history || [];
  const humidityData = sensorData?.humidity?.history || [];

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          📊 داشبورد مدیریت
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="به‌روزرسانی">
            <IconButton 
              onClick={handleRefresh} 
              disabled={refreshing}
              size="small"
            >
              <RefreshIcon sx={{ 
                animation: refreshing ? 'spin 1s linear infinite' : 'none' 
              }} />
            </IconButton>
          </Tooltip>
          
          <Chip
            icon={connected ? <CheckCircleIcon /> : <WifiOffIcon />}
            label={connected ? 'متصل' : 'قطع شده'}
            color={connected ? 'success' : 'error'}
            variant="outlined"
          />
        </Box>
      </Box>

      {/* Welcome Message */}
      <Alert 
        severity="info" 
        sx={{ mb: 3 }}
        action={
          <Button color="inherit" size="small">
            تنظیمات
          </Button>
        }
      >
        خوش آمدید {user?.name}! سیستم IoT شما با {stats.onlineDevices} دستگاه آنلاین در حال کار است.
      </Alert>

      {/* Main Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <StatCard
              title="کل دستگاه‌ها"
              value={stats.totalDevices}
              icon={<DevicesIcon />}
              color="primary"
              isLoading={statsLoading}
              trend={{ value: 12, isPositive: true }}
            />
          </motion.div>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <StatCard
              title="دستگاه‌های آنلاین"
              value={stats.onlineDevices}
              icon={<CheckCircleIcon />}
              color="success"
              isLoading={statsLoading}
              subtitle={`${((stats.onlineDevices / stats.totalDevices) * 100).toFixed(1)}% فعال`}
            />
          </motion.div>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <StatCard
              title="هشدارهای فعال"
              value={stats.activeAlerts}
              icon={<WarningIcon />}
              color={stats.activeAlerts > 0 ? "error" : "success"}
              isLoading={alertsLoading}
              actionButton={
                <Button size="small" color="inherit">
                  مشاهده همه
                </Button>
              }
            />
          </motion.div>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <StatCard
              title="زمان کارکرد سیستم"
              value={`${Math.floor(stats.systemUptime / 24)}d ${stats.systemUptime % 24}h`}
              icon={<TrendingUpIcon />}
              color="info"
              isLoading={statsLoading}
              subtitle="آپتایم سیستم"
            />
          </motion.div>
        </Grid>
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Paper sx={{ p: 3, height: 400 }}>
              <Typography variant="h6" gutterBottom>
                📈 نمودار دما و رطوبت (24 ساعت گذشته)
              </Typography>
              
              {rtDataLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                  <LinearProgress sx={{ width: '100%' }} />
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={temperatureData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time" 
                      tickFormatter={(time) => formatDate(time, 'HH:mm')}
                    />
                    <YAxis yAxisId="temp" orientation="left" />
                    <YAxis yAxisId="humidity" orientation="right" />
                    <RechartsTooltip 
                      labelFormatter={(time) => formatDate(time)}
                      formatter={(value, name) => [
                        `${formatNumber(value)}${name === 'temperature' ? '°C' : '%'}`,
                        name === 'temperature' ? 'دما' : 'رطوبت'
                      ]}
                    />
                    <Legend />
                    <Line 
                      yAxisId="temp"
                      type="monotone" 
                      dataKey="temperature" 
                      stroke={chartColors.error}
                      strokeWidth={2}
                      name="دما"
                      dot={false}
                    />
                    <Line 
                      yAxisId="humidity"
                      type="monotone" 
                      dataKey="humidity" 
                      stroke={chartColors.info}
                      strokeWidth={2}
                      name="رطوبت"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </motion.div>
        </Grid>

        <Grid item xs={12} md={4}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
          >
            <Paper sx={{ p: 3, height: 400 }}>
              <Typography variant="h6" gutterBottom>
                📊 انواع دستگاه‌ها
              </Typography>
              
              {statsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                  <LinearProgress sx={{ width: '100%' }} />
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={deviceTypesData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="count"
                      nameKey="type"
                    >
                      {deviceTypesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(value, name) => [`${value} دستگاه`, name]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </motion.div>
        </Grid>
      </Grid>

      {/* Devices and Alerts */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Paper sx={{ p: 3, height: 500 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  🔌 دستگاه‌های آنلاین
                </Typography>
                <Chip 
                  label={`${stats.onlineDevices} فعال`} 
                  color="success" 
                  size="small"
                />
              </Box>
              
              {devicesLoading ? (
                <LinearProgress />
              ) : (
                <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                  {onlineDevices?.map((device, index) => (
                    <React.Fragment key={device.deviceId}>
                      <ListItem
                        sx={{ 
                          bgcolor: 'background.default',
                          borderRadius: 1,
                          mb: 1
                        }}
                        secondaryAction={
                          <DeviceQuickControl
                            device={device}
                            onControl={handleDeviceControl}
                            isLoading={controlDeviceMutation.isLoading}
                          />
                        }
                      >
                        <ListItemIcon>
                          <Avatar 
                            sx={{ 
                              bgcolor: device.status?.batteryLevel > 20 ? 'success.main' : 'warning.main',
                              width: 32,
                              height: 32
                            }}
                          >
                            {device.type === 'sensor' ? <ThermostatIcon fontSize="small" /> : <PowerIcon fontSize="small" />}
                          </Avatar>
                        </ListItemIcon>
                        
                        <ListItemText
                          primary={device.name}
                          secondary={
                            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                              <Chip 
                                label={`🔋 ${device.status?.batteryLevel || 0}%`} 
                                size="small"
                                color={device.status?.batteryLevel > 20 ? 'success' : 'warning'}
                              />
                              <Chip 
                                label={`📶 ${device.status?.signalStrength || 0}dBm`} 
                                size="small"
                                variant="outlined"
                              />
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < onlineDevices.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Paper>
          </motion.div>
        </Grid>

        <Grid item xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
          >
            <Paper sx={{ p: 3, height: 500 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  🚨 آخرین هشدارها
                </Typography>
                <Chip 
                  label={`${stats.activeAlerts} فعال`} 
                  color={stats.activeAlerts > 0 ? "error" : "success"}
                  size="small"
                />
              </Box>
              
              <AlertsList 
                alerts={recentAlerts} 
                isLoading={alertsLoading}
                maxHeight={400}
              />
            </Paper>
          </motion.div>
        </Grid>
      </Grid>

      {/* System Health */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            <SystemHealthMonitor 
              systemHealth={systemHealth}
              isLoading={rtDataLoading}
            />
          </motion.div>
        </Grid>

        <Grid item xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
          >
            <WeatherWidget />
          </motion.div>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
