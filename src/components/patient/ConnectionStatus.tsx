import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { useNetworkStatus } from '../../context/NetworkContext';

interface ConnectionStatusProps {
  latency?: number;
  // Kept for backward compatibility but not required
  vitals?: any;
  loading?: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ latency = 25 }) => {
  const { connectionStatus } = useNetworkStatus();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={connectionStatus}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2"
      >
        <div className="relative flex items-center justify-center">
          {connectionStatus === 'connected' && (
            <>
              <span className="absolute w-2 h-2 bg-emerald-500 rounded-full animate-ping opacity-75" />
              <span className="relative w-2 h-2 bg-emerald-500 rounded-full" />
            </>
          )}
          {connectionStatus === 'reconnecting' && (
            <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />
          )}
          {connectionStatus === 'offline' && (
            <span className="relative w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          )}
        </div>

        <div className="flex flex-col items-start leading-none">
          <span className="text-[8px] font-mono font-black text-slate-400 uppercase tracking-widest">
            ESP32 TELEMETRY
          </span>
          <span className={`text-[10px] font-mono font-black uppercase mt-0.5 tracking-wider ${
            connectionStatus === 'connected' ? 'text-emerald-600' :
            connectionStatus === 'reconnecting' ? 'text-amber-600' : 'text-red-500'
          }`}>
            {connectionStatus === 'connected' && `CONNECTED (${latency}ms)`}
            {connectionStatus === 'reconnecting' && 'RECONNECTING...'}
            {connectionStatus === 'offline' && 'OFFLINE'}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ConnectionStatus;
