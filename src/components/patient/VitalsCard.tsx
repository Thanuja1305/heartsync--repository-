import React, { useEffect, useState, useRef } from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';

interface VitalsCardProps {
  label: string;
  value: string | number;
  unit: string;
  status: 'optimal' | 'warning' | 'critical' | 'Normal' | 'Warning' | 'Critical';
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'stable';
  customStatusLabel?: string;
}

const VitalsCard: React.FC<VitalsCardProps> = ({ 
  label, 
  value, 
  unit, 
  status: rawStatus, 
  icon: Icon, 
  trend, 
  customStatusLabel 
}) => {
  const [justUpdated, setJustUpdated] = useState(false);
  const prevValueRef = useRef<string | number>(value);

  // Normalize status to lowercase
  const status = (rawStatus || 'optimal').toLowerCase() as 'optimal' | 'normal' | 'warning' | 'critical';

  // Highlight card when value changes (Real-time active feedback!)
  useEffect(() => {
    if (value !== prevValueRef.current && value !== '--' && value !== 0 && value !== '0') {
      setJustUpdated(true);
      const timer = setTimeout(() => setJustUpdated(false), 800);
      prevValueRef.current = value;
      return () => clearTimeout(timer);
    }
  }, [value]);

  // Determine styles for ICU theme
  const isCritical = status === 'critical';
  const isWarning = status === 'warning';
  const isNormal = status === 'optimal' || status === 'normal';

  // Base state color config
  let alertStyle = '';
  let badgeStyle = '';
  let iconBgColor = '';
  let iconColor = '';

  if (isCritical) {
    alertStyle = 'border-red-200 bg-red-50/10 shadow-[0_4px_20px_rgba(239,68,68,0.08)] ring-1 ring-red-500/20';
    badgeStyle = 'bg-red-50 text-red-600 border-red-200';
    iconBgColor = 'bg-red-100';
    iconColor = 'text-red-600';
  } else if (isWarning) {
    alertStyle = 'border-amber-200 bg-amber-50/10 shadow-[0_4px_20px_rgba(245,158,11,0.05)]';
    badgeStyle = 'bg-amber-50 text-amber-600 border-amber-200';
    iconBgColor = 'bg-amber-100';
    iconColor = 'text-amber-600';
  } else {
    alertStyle = 'border-slate-100 bg-white shadow-premium hover:border-slate-200';
    badgeStyle = 'bg-emerald-50 text-emerald-600 border-emerald-100';
    iconBgColor = 'bg-slate-50';
    iconColor = 'text-accent-maroon'; // Deep Medical Maroon for primary icons
  }

  // Active flicker if just updated
  const updatePulseStyle = justUpdated 
    ? 'scale-[1.01] duration-75' 
    : 'transition-all duration-300';

  return (
    <div className={`p-5 md:p-6 rounded-[24px] border ${alertStyle} ${updatePulseStyle} relative group overflow-hidden flex flex-col justify-between h-full bg-white`}>
      {/* Header section with icon and status */}
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-full relative flex items-center justify-center ${iconBgColor} group-hover:scale-105 transition-transform duration-300`}>
            {/* Animated pulse around icon */}
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-20 ${iconColor.replace('text', 'bg')}`}></span>
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-semibold text-dark-navy tracking-tight">{label}</p>
            <span className={`mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase border w-max flex items-center gap-1.5 ${badgeStyle}`}>
              {/* Status Indicator Dot */}
              <span className={`w-1.5 h-1.5 rounded-full ${isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
              {customStatusLabel || (isCritical ? 'CRITICAL' : isWarning ? 'WARNING' : 'NORMAL')}
            </span>
          </div>
        </div>
      </div>

      {/* Main live metrics */}
      <div className="relative z-10 mt-auto pt-2">
        <div className="flex items-baseline gap-1">
          <motion.h3 
            className={`text-4xl font-bold tracking-tight ${isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-dark-navy'}`}
            animate={justUpdated ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            {value}
          </motion.h3>
          <span className="text-sm font-medium text-muted ml-1">{unit}</span>
        </div>
      </div>
    </div>
  );
};

export default VitalsCard;
