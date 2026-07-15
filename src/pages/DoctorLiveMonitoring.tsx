import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity, Search, AlertCircle, ArrowRight,
  HeartPulse, Thermometer, Droplets, Menu, Zap,
  Wifi, WifiOff, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, rtdb } from '../lib/firebase';
import { ref, onValue } from 'firebase/database';
import { validateSensorPacket } from '../lib/dataValidator';
import DoctorSidebar from '../components/DoctorSidebar';

const getStatus = (v: any): 'critical' | 'warning' | 'stable' => {
  if (!v) return 'stable';
  const hr = v.heartRate || v.bpm || 0;
  const o2 = v.o2 || 0;
  if (v.isEmergency || hr > 140 || (hr > 0 && hr < 40) || (o2 > 0 && o2 < 90)) return 'critical';
  if (hr > 100 || hr < 55 || (o2 > 0 && o2 < 95)) return 'warning';
  return 'stable';
};

const DoctorLiveMonitoring = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<any[]>([]);
  const [vitalsMap, setVitalsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Clock to drive real-time connection timeout updates
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const isDemo = localStorage.getItem('demo_mode') === 'doctor' || !db.app.options.apiKey || db.app.options.apiKey.includes('mock-api-key');

    if (isDemo) {
      setIsDemoMode(true);
      const demoPatients = [
        {
          id: 'demo-patient-001',
          displayName: 'Sarah Jenkins',
          fullName: 'Sarah Jenkins',
          age: 38,
          gender: 'Female',
          bloodGroup: 'O-Positive',
          phone: '+1 (555) 048-1920',
          status: 'approved'
        },
        {
          id: 'demo-patient-002',
          displayName: 'Marcus Aurelius',
          fullName: 'Marcus Aurelius',
          age: 62,
          gender: 'Male',
          bloodGroup: 'A-Negative',
          phone: '+1 (555) 890-4821',
          status: 'approved'
        }
      ];
      setPatients(demoPatients);
      setLoading(false);

      // Sim updates
      const interval = setInterval(() => {
        const updatedVitals: Record<string, any> = {};
        demoPatients.forEach(p => {
          const isCritical = p.id === 'demo-patient-002' && Math.random() > 0.85;
          const isWarning = !isCritical && Math.random() > 0.7;
          const hr = isCritical ? 145 : isWarning ? 105 : Math.round(65 + Math.random() * 20);
          const spo2 = isCritical ? 88 : Math.round(96 + Math.random() * 4);
          const temp = Number((36.4 + Math.random() * 1.2).toFixed(1));
          
          updatedVitals[p.id] = {
            heartRate: hr,
            bpm: hr,
            o2: spo2,
            temp: temp,
            humidity: 50,
            isEmergency: isCritical,
            timestamp: Date.now(),
            _source: 'rtdb'
          };
        });
        setVitalsMap(prev => ({ ...prev, ...updatedVitals }));
      }, 1500);

      return () => clearInterval(interval);
    }

    // 1. Fetch approved patients from Firestore
    const q = query(collection(db, 'users'), where('role', '==', 'patient'), where('status', '==', 'approved'));
    const unsubP = onSnapshot(q, snap => {
      setPatients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    // 2. Firestore liveHealthMetrics (secondary, ~5s delay)
    const unsubFS = onSnapshot(collection(db, 'liveHealthMetrics'), snap => {
      const m: Record<string, any> = {};
      snap.forEach(d => { m[d.id] = { ...d.data(), _source: 'firestore' }; });
      setVitalsMap(prev => {
        const merged = { ...prev };
        Object.keys(m).forEach(uid => {
          // Only overwrite if RTDB hasn't already written a fresher value
          if (!merged[uid] || merged[uid]._source !== 'rtdb') merged[uid] = m[uid];
        });
        return merged;
      });
    });

    // 3. Firebase RTDB — real-time primary source
    const unsubRTDB = onValue(ref(rtdb, '/users'), snapshot => {
      if (!snapshot.exists()) return;
      const data = snapshot.val();
      const rtdbVitals: Record<string, any> = {};
      Object.keys(data).forEach(uid => {
        const node = data[uid];
        if (!node) return;
        const live = node.liveReading || node.livereading || node;
        const packet = {
          bpm: live.bpm || live.heartRate || live.BPM,
          spo2: live.spo2 || live.SpO2 || live.o2,
          temperature: live.temperature || live.temp || live.Temp,
          ecg: live.ecg || live.ECG,
          timestamp: live.timestamp || Date.now(),
        };
        const v = validateSensorPacket(packet);
        if (v.isValid && v.heartRate > 0) {
          rtdbVitals[uid] = {
            heartRate: v.heartRate,
            bpm: v.heartRate,
            o2: v.o2,
            temp: v.temp,
            timestamp: v.timestamp || Date.now(),
            isEmergency: v.heartRate > 140 || (v.o2 > 0 && v.o2 < 90),
            _source: 'rtdb',
          };
        }
      });
      setVitalsMap(prev => ({ ...prev, ...rtdbVitals }));
    });

    return () => { unsubP(); unsubFS(); unsubRTDB(); };
  }, []);

  const filtered = useMemo(() =>
    search ? patients.filter(p => (p.displayName || p.fullName || '').toLowerCase().includes(search.toLowerCase())) : patients,
    [patients, search]
  );

  const criticalList = useMemo(() => filtered.filter(p => getStatus(vitalsMap[p.id]) === 'critical'), [filtered, vitalsMap]);
  const warningList  = useMemo(() => filtered.filter(p => getStatus(vitalsMap[p.id]) === 'warning'), [filtered, vitalsMap]);
  const stableList   = useMemo(() => filtered.filter(p => getStatus(vitalsMap[p.id]) === 'stable'), [filtered, vitalsMap]);
  const alertCount   = criticalList.length + warningList.length;

  const VitalPill = ({ value, label, color }: { value: any; label: string; color: string }) => (
    <div className="text-center">
      <p className={`text-sm font-black ${value ? color : 'text-slate-700'}`}>{value ?? '--'}</p>
      <p className="text-[8px] font-black text-slate-600 uppercase">{label}</p>
    </div>
  );

  const PatientRow = ({ patient }: { patient: any }) => {
    const v = vitalsMap[patient.id];
    const isConnected = v && v.heartRate > 0 && (currentTime - (v.timestamp || 0) < 3000);
    const status = isConnected ? getStatus(v) : 'stable';
    const STATUS = isConnected ? {
      critical: { dot: 'bg-red-500', badge: 'text-red-400 bg-red-500/10 border border-red-500/20', label: 'Critical' },
      warning:  { dot: 'bg-orange-500', badge: 'text-orange-400 bg-orange-500/10 border border-orange-500/20', label: 'Moderate' },
      stable:   { dot: 'bg-green-500', badge: 'text-green-400 bg-green-500/10 border border-green-500/20', label: 'Stable' },
    }[status] : { dot: 'bg-slate-600', badge: 'text-slate-500 bg-slate-600/10 border border-slate-600/20', label: 'Offline' };

    return (
      <motion.div whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
        onClick={() => navigate(`/doctor/patient/${patient.id}`)}
        className="flex items-center gap-4 p-4 border-b border-white/[0.04] last:border-0 cursor-pointer group transition-colors">
        {/* Avatar + status dot */}
        <div className="relative shrink-0">
          <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-white font-black text-sm border border-white/10 overflow-hidden">
            {patient.photoURL
              ? <img src={patient.photoURL} alt="" className="w-full h-full object-cover" />
              : (patient.displayName || patient.fullName || 'P').charAt(0).toUpperCase()}
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#111827] ${STATUS.dot} ${status === 'critical' ? 'animate-pulse' : ''}`} />
        </div>

        {/* Name + ID */}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-black text-white truncate">{patient.displayName || patient.fullName || 'Patient'}</p>
          <p className="text-[9px] font-bold text-slate-600">HS-{patient.id.slice(-4).toUpperCase()} • {patient.age ? `${patient.age}y` : '--'} • {patient.gender || '--'}</p>
        </div>

        {/* Vitals */}
        <div className="hidden md:flex items-center gap-6">
          <VitalPill value={isConnected && v?.heartRate ? `${v.heartRate} BPM` : null} label="Heart Rate" color="text-red-400" />
          <VitalPill value={isConnected && v?.o2 ? `${v.o2}%` : null} label="SpO₂" color="text-blue-400" />
          <VitalPill value={isConnected && v?.temp ? `${Number(v.temp).toFixed(1)}°C` : null} label="Temp" color="text-orange-400" />
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg ${STATUS.badge}`}>{STATUS.label}</span>
          {isConnected
            ? <Wifi className="w-3.5 h-3.5 text-green-500" />
            : <WifiOff className="w-3.5 h-3.5 text-slate-700" />}
          <button className="p-1.5 bg-[#1E293B] border border-white/5 rounded-lg text-slate-600 group-hover:text-white group-hover:border-accent-maroon/20 transition-colors">
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex h-screen bg-[#0B1120] text-white overflow-hidden">
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] lg:hidden" />
        )}
      </AnimatePresence>

      <DoctorSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} alertCount={alertCount} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-[#111827] border-b border-white/[0.06] px-4 lg:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-400 hover:text-white">
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-black text-white tracking-tight leading-none">Live Telemetry</h1>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mt-0.5">Real-time biometric stream</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Demo Mode Warning Badge */}
            {isDemoMode && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse">
                <span className="text-sm">⚡</span> DEMO MODE
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-xl">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">Live Sync</span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
                className="pl-9 pr-4 py-2 bg-[#1E293B] border border-white/[0.06] rounded-xl text-[11px] text-white placeholder-slate-600 outline-none focus:border-accent-maroon/40 w-40 font-medium" />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Monitoring', value: patients.length, color: 'text-blue-400', icon: Activity, bg: 'bg-blue-500/10 border-blue-500/20' },
              { label: 'Critical', value: criticalList.length, color: 'text-red-400', icon: AlertCircle, bg: 'bg-red-500/10 border-red-500/20' },
              { label: 'Moderate', value: warningList.length, color: 'text-orange-400', icon: HeartPulse, bg: 'bg-orange-500/10 border-orange-500/20' },
              { label: 'Stable', value: stableList.length, color: 'text-green-400', icon: Zap, bg: 'bg-green-500/10 border-green-500/20' },
            ].map(s => (
              <div key={s.label} className="bg-[#111827] rounded-2xl border border-white/[0.06] p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${s.bg}`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider leading-none">{s.label}</p>
                  <p className={`text-xl font-black leading-tight ${s.color}`}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Critical alerts */}
          <AnimatePresence>
            {criticalList.length > 0 && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-red-500/5 border border-red-500/20 rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-red-500/10 flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">⚠ Immediate Action Required — {criticalList.length} Critical Patient{criticalList.length > 1 ? 's' : ''}</p>
                </div>
                <div className="divide-y divide-red-500/10">
                  {criticalList.map(p => <PatientRow key={p.id} patient={p} />)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Warning section */}
          {warningList.length > 0 && (
            <div className="bg-[#111827] rounded-2xl border border-orange-500/10 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full" />
                <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest">Moderate Risk Patients ({warningList.length})</p>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {warningList.map(p => <PatientRow key={p.id} patient={p} />)}
              </div>
            </div>
          )}

          {/* Stable stream */}
          <div className="bg-[#111827] rounded-2xl border border-white/[0.06] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-green-500" />
                <p className="text-[9px] font-black text-green-400 uppercase tracking-widest">Stable Patients ({stableList.length})</p>
              </div>
              <span className="text-[8px] font-black text-slate-600 uppercase">All vitals normal</span>
            </div>
            {loading ? (
              <div className="py-16 text-center">
                <Loader2 className="w-8 h-8 text-slate-700 animate-spin mx-auto mb-3" />
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Scanning nodes...</p>
              </div>
            ) : stableList.length === 0 && !loading ? (
              <div className="py-12 text-center">
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">No stable patients right now</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {stableList.map(p => <PatientRow key={p.id} patient={p} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorLiveMonitoring;
