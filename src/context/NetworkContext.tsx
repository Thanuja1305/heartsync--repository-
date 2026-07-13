import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

export type ConnectionState = 'connected' | 'reconnecting' | 'offline';

interface NetworkContextType {
  isOnline: boolean;
  isWsConnected: boolean;
  connectionStatus: ConnectionState;
}

const NetworkContext = createContext<NetworkContextType>({
  isOnline: true,
  isWsConnected: true,
  connectionStatus: 'connected',
});

export const useNetworkStatus = () => useContext(NetworkContext);

// Keep useNetwork for backward compatibility
export const useNetwork = () => {
  const status = useNetworkStatus();
  return {
    isOnline: status.isOnline,
    connectionState: status.connectionStatus,
  };
};

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>('reconnecting');
  const [showIndicator, setShowIndicator] = useState<boolean>(false);
  
  const isInitialMount = useRef(true);
  const previousStatus = useRef<ConnectionState>('connected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const reconnectAttemptsRef = useRef(0);
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [nextRetrySeconds, setNextRetrySeconds] = useState(0);
  const retryCountdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connectWebSocket = () => {
    // Clean up existing WebSocket if any
    if (wsRef.current) {
      try {
        // Remove event listeners to prevent extra closed events triggering
        wsRef.current.onopen = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
      } catch (err) {
        console.error("Error closing WebSocket:", err);
      }
      wsRef.current = null;
    }

    if (!navigator.onLine) {
      setIsWsConnected(false);
      setConnectionStatus('offline');
      return;
    }

    setConnectionStatus('reconnecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/`;

    try {
      console.info(`[NetworkContext] Connecting to ESP32 WebSocket server at ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.info('[NetworkContext] WebSocket telemetry connection established.');
        setIsWsConnected(true);
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        setCurrentAttempt(0);
        setNextRetrySeconds(0);
        
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        if (retryCountdownIntervalRef.current) {
          clearInterval(retryCountdownIntervalRef.current);
          retryCountdownIntervalRef.current = null;
        }
      };

      ws.onclose = (event) => {
        console.warn(`[NetworkContext] WebSocket connection closed. code=${event.code}`);
        setIsWsConnected(false);
        
        if (navigator.onLine) {
          setConnectionStatus('reconnecting');
          scheduleReconnect();
        } else {
          setConnectionStatus('offline');
        }
      };

      ws.onerror = (error) => {
        console.error('[NetworkContext] WebSocket connection error:', error);
        // let onclose handle reconnection to avoid duplicate calls
      };
    } catch (err) {
      console.error('[NetworkContext] Gracefully handled WebSocket creation crash:', err);
      setIsWsConnected(false);
      if (navigator.onLine) {
        setConnectionStatus('reconnecting');
        scheduleReconnect();
      } else {
        setConnectionStatus('offline');
      }
    }
  };

  const scheduleReconnect = () => {
    if (reconnectTimeoutRef.current) return;

    // Exponential Backoff: base = 1.5s, multiplier = 2. Max = 30s.
    const attempt = reconnectAttemptsRef.current;
    const baseDelay = 1500;
    const maxDelay = 30000;
    const delay = Math.min(maxDelay, baseDelay * Math.pow(2, attempt));
    const delaySeconds = Math.round(delay / 1000);

    reconnectAttemptsRef.current = attempt + 1;
    setCurrentAttempt(attempt + 1);
    setNextRetrySeconds(delaySeconds);

    console.info(`[NetworkContext] Reconnection scheduled in ${delaySeconds}s (Attempt #${attempt + 1})`);

    // Setup active countdown timer for the non-intrusive UI notification
    if (retryCountdownIntervalRef.current) {
      clearInterval(retryCountdownIntervalRef.current);
    }
    let secondsLeft = delaySeconds;
    retryCountdownIntervalRef.current = setInterval(() => {
      secondsLeft -= 1;
      setNextRetrySeconds(Math.max(0, secondsLeft));
    }, 1000);

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      if (retryCountdownIntervalRef.current) {
        clearInterval(retryCountdownIntervalRef.current);
        retryCountdownIntervalRef.current = null;
      }
      connectWebSocket();
    }, delay);
  };

  useEffect(() => {
    // 1. Initial connection check & delay initial startup warnings
    const startupTimer = setTimeout(() => {
      connectWebSocket();
      isInitialMount.current = false;
    }, 1500);

    // 2. Browser network events
    const handleOnline = () => {
      setIsOnline(true);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      connectWebSocket();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsWsConnected(false);
      setConnectionStatus('offline');
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {}
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearTimeout(startupTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {}
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      if (retryCountdownIntervalRef.current) {
        clearInterval(retryCountdownIntervalRef.current);
      }
    };
  }, []);

  // 3. Monitor state changes and display/auto-hide indicator
  useEffect(() => {
    if (isInitialMount.current) return;

    if (connectionStatus !== previousStatus.current) {
      if (connectionStatus === 'offline') {
        console.warn('Network connectivity lost. Platform running in local offline-cache mode.');
      } else if (connectionStatus === 'connected') {
        console.info('Network connectivity restored. Synchronizing clinical data with cloud nodes...');
      }

      setShowIndicator(true);

      if (connectionStatus === 'connected') {
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
        }
        hideTimeoutRef.current = setTimeout(() => {
          setShowIndicator(false);
        }, 3000); // Hide after 3 seconds of stability
      } else {
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
          hideTimeoutRef.current = null;
        }
      }

      previousStatus.current = connectionStatus;
    }
  }, [connectionStatus]);

  return (
    <NetworkContext.Provider value={{ isOnline, isWsConnected, connectionStatus }}>
      {children}
      
      {/* Floating Network Status Indicator UI */}
      <AnimatePresence>
        {showIndicator && (
          <motion.div
            id="network-status-badge"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed bottom-6 left-6 z-[9999] pointer-events-none"
          >
            <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full border shadow-lg backdrop-blur-md font-sans text-xs font-semibold ${
              connectionStatus === 'connected'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                : connectionStatus === 'reconnecting'
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-600'
                : 'bg-red-500/10 border-red-500/20 text-red-600'
            }`}>
              {connectionStatus === 'connected' && (
                <>
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </div>
                  <Wifi className="w-4 h-4" />
                  <span>Clinical Server Connected</span>
                </>
              )}
              {connectionStatus === 'reconnecting' && (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500 animate-duration-1000" />
                  <span>
                    {currentAttempt > 0 
                      ? `Reconnecting to Telemetry... (Attempt #${currentAttempt} in ${nextRetrySeconds}s)` 
                      : 'Connecting to Telemetry...'}
                  </span>
                </>
              )}
              {connectionStatus === 'offline' && (
                <>
                  <div className="relative flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 animate-pulse"></span>
                  </div>
                  <WifiOff className="w-4 h-4" />
                  <span>Offline Mode Active</span>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </NetworkContext.Provider>
  );
};
