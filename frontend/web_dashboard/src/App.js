/**
 * IoT Smart Dashboard - Main App Component
 * ========================================
 * 
 * این کامپوننت اصلی dashboard است که شامل:
 * - مدیریت routing
 * - Real-time connection با WebSocket
 * - Theme management
 * - Authentication
 * - Global state management
 * 
 * نویسنده: تیم توسعه IoT
 * نسخه: 1.0.0
 */

import React, { useState, useEffect, useContext, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, Snackbar, Alert, CircularProgress } from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';

// Services
import { SocketService } from './services/socketService';
import { ApiService } from './services/apiService';
import { AuthService } from './services/authService';
import { NotificationService } from './services/notificationService';

// Components
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import LoadingScreen from './components/Common/LoadingScreen';
import ErrorBoundary from './components/Common/ErrorBoundary';

// Pages
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import DeviceDetails from './pages/DeviceDetails';
import Analytics from './pages/Analytics';
import Alerts from './pages/Alerts';
import Settings from './pages/Settings';
import Users from './pages/Users';
import Login from './pages/Login';
import NotFound from './pages/NotFound';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';
import { useNotification } from './hooks/useNotification';

// Utils
import { isRTL } from './utils/language';

// Styles
import './styles/global.css';
import './styles/rtl.css';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Create contexts
const AppContext = createContext();
const SocketContext = createContext();

// Custom theme
const createAppTheme = (mode, direction) => createTheme({
  direction,
  palette: {
    mode,
    primary: {
      main: mode === 'dark' ? '#90caf9' : '#1976d2',
      light: mode === 'dark' ? '#bbdefb' : '#42a5f5',
      dark: mode === 'dark' ? '#64b5f6' : '#1565c0',
    },
    secondary: {
      main: mode === 'dark' ? '#f48fb1' : '#dc004e',
    },
    background: {
      default: mode === 'dark' ? '#121212' : '#f5f5f5',
      paper: mode === 'dark' ? '#1e1e1e' : '#ffffff',
    },
    success: {
      main: mode === 'dark' ? '#81c784' : '#2e7d32',
    },
    warning: {
      main: mode === 'dark' ? '#ffb74d' : '#ed6c02',
    },
    error: {
      main: mode === 'dark' ? '#e57373' : '#d32f2f',
    },
    info: {
      main: mode === 'dark' ? '#64b5f6' : '#0288d1',
    },
  },
  typography: {
    fontFamily: [
      'Vazir',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif'
    ].join(','),
    h1: {
      fontSize: '2rem',
      fontWeight: 600,
    },
    h2: {
      fontSize: '1.75rem',
      fontWeight: 600,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 500,
    },
    body1: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: mode === 'dark' 
            ? '0 2px 8px rgba(0,0,0,0.4)' 
            : '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          borderBottom: `1px solid ${mode === 'dark' ? '#333' : '#e0e0e0'}`,
        },
      },
    },
  },
});

// Main App Component
function App() {
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('fa');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [deviceStats, setDeviceStats] = useState({
    total: 0,
    online: 0,
    offline: 0,
    alerts: 0
  });

  // Hooks
  const { user, isAuthenticated, login, logout, loading: authLoading } = useAuth();
  const { socket, connected: socketConnected } = useSocket();
  const { showNotification } = useNotification();

  // Theme and direction
  const direction = isRTL(language) ? 'rtl' : 'ltr';
  const theme = createAppTheme(darkMode ? 'dark' : 'light', direction);

  // Effects
  useEffect(() => {
    initializeApp();
  }, []);

  useEffect(() => {
    if (socket && isAuthenticated) {
      setupSocketListeners();
    }
  }, [socket, isAuthenticated]);

  // Load theme preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('iot_theme');
    const savedLanguage = localStorage.getItem('iot_language');
    
    if (savedTheme) setDarkMode(savedTheme === 'dark');
    if (savedLanguage) setLanguage(savedLanguage);
  }, []);

  // Initialize app
  const initializeApp = async () => {
    try {
      setIsLoading(true);
      
      // Check authentication status
      await AuthService.checkAuth();
      
      // Initialize notification service
      NotificationService.initialize();
      
      setIsLoading(false);
    } catch (error) {
      console.error('App initialization failed:', error);
      setIsLoading(false);
    }
  };

  // Setup socket event listeners
  const setupSocketListeners = () => {
    if (!socket) return;

    // Device data updates
    socket.on('sensorData', (data) => {
      // Update real-time data
      queryClient.invalidateQueries(['devices', data.deviceId]);
      
      // Show notification for important events
      if (data.data.motion) {
        showNotification('حرکت تشخیص داده شد', `دستگاه: ${data.deviceId}`, 'warning');
      }
    });

    // Device status changes
    socket.on('deviceHeartbeat', (data) => {
      queryClient.invalidateQueries(['device-status']);
    });

    // System alerts
    socket.on('alert', (alert) => {
      showNotification(
        'هشدار سیستم',
        alert.message,
        alert.severity || 'info'
      );
      queryClient.invalidateQueries(['alerts']);
    });

    // Connection status
    socket.on('connect', () => {
      showNotification('اتصال برقرار شد', 'اتصال به سرور برقرار شد', 'success');
    });

    socket.on('disconnect', () => {
      showNotification('اتصال قطع شد', 'اتصال به سرور قطع شد', 'error');
    });

    // Cleanup
    return () => {
      socket.off('sensorData');
      socket.off('deviceHeartbeat');
      socket.off('alert');
      socket.off('connect');
      socket.off('disconnect');
    };
  };

  // Theme toggle
  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('iot_theme', newMode ? 'dark' : 'light');
  };

  // Language toggle
  const toggleLanguage = () => {
    const newLang = language === 'fa' ? 'en' : 'fa';
    setLanguage(newLang);
    localStorage.setItem('iot_language', newLang);
    
    // Update document direction
    document.dir = isRTL(newLang) ? 'rtl' : 'ltr';
  };

  // Context values
  const appContextValue = {
    darkMode,
    toggleTheme,
    language,
    toggleLanguage,
    sidebarOpen,
    setSidebarOpen,
    deviceStats,
    setDeviceStats,
    user,
    isAuthenticated,
    logout
  };

  const socketContextValue = {
    socket,
    connected: socketConnected
  };

  // Show loading screen
  if (isLoading || authLoading) {
    return <LoadingScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppContext.Provider value={appContextValue}>
          <SocketContext.Provider value={socketContextValue}>
            <ErrorBoundary>
              <Router>
                <Box 
                  sx={{ 
                    display: 'flex',
                    minHeight: '100vh',
                    direction: direction
                  }}
                >
                  <AnimatePresence>
                    {isAuthenticated ? (
                      <AuthenticatedApp />
                    ) : (
                      <UnauthenticatedApp />
                    )}
                  </AnimatePresence>
                </Box>
              </Router>
            </ErrorBoundary>
          </SocketContext.Provider>
        </AppContext.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// Authenticated app layout
function AuthenticatedApp() {
  const { sidebarOpen } = useContext(AppContext);

  return (
    <>
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          transition: 'margin 0.3s ease',
          marginLeft: sidebarOpen ? '240px' : '60px',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <Header />
        
        {/* Page content */}
        <Box sx={{ flexGrow: 1, p: 3 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/devices" element={<Devices />} />
              <Route path="/devices/:deviceId" element={<DeviceDetails />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/users" element={<Users />} />
              <Route path="/login" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </motion.div>
        </Box>
      </Box>
    </>
  );
}

// Unauthenticated app layout
function UnauthenticatedApp() {
  return (
    <Box sx={{ width: '100%', height: '100vh' }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Box>
  );
}

// Export contexts for use in other components
export { AppContext, SocketContext };

// Connection status indicator component
export function ConnectionIndicator() {
  const { connected } = useContext(SocketContext);
  
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        bgcolor: connected ? 'success.main' : 'error.main',
        color: 'white',
        px: 2,
        py: 1,
        borderRadius: 1,
        fontSize: '0.75rem'
      }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: 'currentColor',
          animation: connected ? 'pulse 2s infinite' : 'none'
        }}
      />
      {connected ? 'متصل' : 'قطع شده'}
    </Box>
  );
}

// Loading component for route transitions
export function PageLoader() {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '200px'
      }}
    >
      <CircularProgress />
    </Box>
  );
}

export default App;
