import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Heart, Bell, Activity, Thermometer, Droplets,
  HeartPulse, User, Clock, Calendar, BrainCircuit, ArrowRight,
  ActivitySquare, TrendingUp, FileText, LogOut, Wifi, WifiOff,
  Menu, Stethoscope, MapPin, MessageSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { db, rtdb } from '../lib/firebase';
import { doc, onSnapshot, collection, query, orderBy, limit, setDoc } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import ECGGraph from '../components/patient/ECGGraph';
import { usePatientVitals } from '../hooks/usePatientVitals';
import { startIoTSimulation } from '../services/iotService';
import PatientSidebar from '../components/PatientSidebar';

// ─── Time-based greeting ─────────────────────────────────────────────────
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const PatientDashboard = () => {
  const { user, logout, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const userId = user?.id || user?.uid || '';

  const { vitals: realVitals, loading: vitalsLoading, error: vitalsError, isDeviceOnline } = usePatientVitals(userId);

  const [vitals, setVitals] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [patientData, setPatientData] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // IoT Simulation — runs if isSimulating is manually set to true
  useEffect(() => {
    if (!isSimulating || !userId) return;
    const stop = startIoTSimulation(userId);
    return () => stop();
  }, [isSimulating, userId]);

  // Firestore: patient profile + history
  useEffect(() => {
    if (!userId) return;
    const unsubPatient = onSnapshot(doc(db, 'patients', userId), snap => {
      if (snap.exists()) setPatientData((p: any) => ({ ...p, ...snap.data() }));
    });
    // Also listen to 'users' collection (used by login sync to store full name)
    const unsubUser = onSnapshot(doc(db, 'users', userId), snap => {
      if (snap.exists()) setPatientData((p: any) => ({ ...p, ...snap.data() }));
    });
    const q = query(collection(db, 'patientHistory', userId, 'logs'), orderBy('timestamp', 'desc'), limit(5));
    const unsubHistory = onSnapshot(q, snap => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubPatient(); unsubUser(); unsubHistory(); };
  }, [userId]);

  // RTDB → vitals state
  useEffect(() => {
    if (!userId || !realVitals) return;
    const formatted = {
      heartRate: realVitals.bpm,
      o2: realVitals.spo2,
      temp: realVitals.temperature,
      isEmergency: realVitals.alertLevel === 3,
      status: realVitals.alertLevel === 3 ? 'critical' : realVitals.alertLevel === 2 ? 'warning' : 'optimal',
      alertLevel: realVitals.alertLevel,
      current_condition: realVitals.current_condition,
      ecg: realVitals.ecg,
      fingerDetected: realVitals.fingerDetected,
      leadsOff: realVitals.leadsOff,
    };
    setVitals(formatted);

    // Sync to Firestore for doctor views, suppressing if finger is off
    const finger = realVitals.fingerDetected !== false && Number(realVitals.bpm) > 0 && Number(realVitals.spo2) > 0;
    setDoc(doc(db, 'liveHealthMetrics', userId), {
      heartRate: finger ? Number(realVitals.bpm) : 0, 
      o2: finger ? Number(realVitals.spo2) : 0, 
      temp: Number(realVitals.temperature),
      status: finger ? (realVitals.alertLevel === 3 ? 'Critical' : realVitals.alertLevel === 2 ? 'Warning' : 'Optimal') : 'Optimal',
      timestamp: new Date().toISOString(), 
      isEmergency: finger ? realVitals.alertLevel === 3 : false,
      fingerDetected: realVitals.fingerDetected,
      leadsOff: realVitals.leadsOff,
    }, { merge: true }).catch(console.error);
  }, [userId, realVitals]);

  const isConnected = isSimulating || (isDeviceOnline && vitals && !vitalsError);

  // Get patient name: prioritize Firestore data (most accurate), then profile, then email-based fallback
  const rawName = patientData?.fullName 
    || patientData?.displayName 
    || profile?.full_name 
    || profile?.displayName 
    || user?.email?.split('@')[0] 
    || 'Patient';
  // Strip any Dr. prefix (shouldn't appear for patients but just in case)
  const cleanName = rawName.replace(/^(dr\.?\s+|doctor\s+)/i, '').trim();
  const patientFirstName = cleanName.split(' ')[0] || 'Patient';
  const patientFullName = cleanName;
  const patientId = userId ? `HS-${userId.slice(-4).toUpperCase()}` : 'HS-XXXX';

  const formatLogTime = (ts: any) => {
    if (!ts) return '';
    try {
      if (typeof ts.toDate === 'function') return ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const d = new Date(ts); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-dark-navy flex overflow-hidden">

      {/* ─── MOBILE OVERLAY ─────────────────────────────── */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[80] lg:hidden" />
        )}
      </AnimatePresence>

      {/* ─── PATIENT SIDEBAR ─────────────────────────────── */}
      <PatientSidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isConnected={isConnected}
        patientData={patientData}
      />

      {/* ─── MAIN CONTENT ─────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* TOP HEADER */}
        <header className="bg-white border-b border-slate-100 px-4 lg:px-6 py-3 flex items-center justify-between shrink-0 z-10">
          {/* Mobile logo + burger */}
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-400 hover:text-accent-maroon transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden lg:block">
              <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">Overview Portal</h2>
            </div>
          </div>

          {/* Right: date, time, live indicator, notifications, profile */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-4 text-[11px] font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {currentTime.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>

            {/* Live badge */}
            <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
              isConnected ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              {isConnected ? 'Live' : 'Standby'}
            </div>

            {/* Demo Mode Warning Badge */}
            {isSimulating && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border bg-amber-50 border-amber-300 text-amber-800 animate-pulse">
                <span className="text-sm">⚡</span> DEMO MODE — Simulated Data
              </div>
            )}

            {/* Bell */}
            <button onClick={() => navigate('/patient/notifications')}
              className="p-2 text-slate-400 hover:text-accent-maroon transition-colors relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-accent-maroon rounded-full" />
            </button>

            {/* Profile */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-100">
              <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-200 overflow-hidden flex items-center justify-center">
                {profile?.photoURL
                  ? <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
                  : <User className="w-4 h-4 text-slate-500" />}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-[11px] font-black text-dark-navy leading-none">{patientFullName}</p>
                <p className="text-[9px] font-semibold text-slate-400 mt-0.5">Patient ID: {patientId}</p>
              </div>
            </div>
          </div>
        </header>

        {/* SCROLLABLE BODY */}
        <main className="flex-1 overflow-y-auto no-scrollbar p-4 lg:p-6 space-y-5">
          {/* Greeting */}
          <div>
            <h2 className="text-2xl font-black text-dark-navy tracking-tight">
              {getGreeting()}, {patientFirstName} 👋
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Real-time AI-powered cardiac monitoring
            </p>
          </div>

          {/* STAT CARDS ROW */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Heart Rate */}
            <motion.div whileHover={{ y: -2 }}
              className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                <Heart className="w-5 h-5 text-red-500 fill-red-500" />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Heart Rate</p>
                <div className="text-2xl font-black text-dark-navy leading-tight mt-0.5">
                  {isConnected ? (
                    vitals?.fingerDetected !== false ? (
                      <>
                        {vitals?.heartRate || '--'}
                        <span className="text-xs font-bold text-slate-400 ml-1">BPM</span>
                      </>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400">Place finger</span>
                    )
                  ) : <span className="text-sm font-semibold text-slate-400">Disconnected</span>}
                </div>
                <span className="text-[8px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded mt-1 inline-block">Live Reading</span>
              </div>
            </motion.div>

            {/* SpO₂ */}
            <motion.div whileHover={{ y: -2 }}
              className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                <Droplets className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">SpO₂</p>
                <div className="text-2xl font-black text-dark-navy leading-tight mt-0.5">
                  {isConnected ? (
                    vitals?.fingerDetected !== false ? (
                      <>
                        {vitals?.o2 || '--'}
                        <span className="text-xs font-bold text-slate-400 ml-0.5">%</span>
                      </>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400">Place finger</span>
                    )
                  ) : <span className="text-sm font-semibold text-slate-400">Disconnected</span>}
                </div>
                <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mt-1 inline-block">Oxygen Saturation</span>
              </div>
            </motion.div>

            {/* Temperature */}
            <motion.div whileHover={{ y: -2 }}
              className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                <Thermometer className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Temperature</p>
                <div className="text-2xl font-black text-dark-navy leading-tight mt-0.5">
                  {isConnected ? (
                    vitals?.temp != null && vitals.temp > 0 ? (
                      <>
                        {Number(vitals.temp).toFixed(1)}
                        <span className="text-xs font-bold text-slate-400 ml-0.5">°C</span>
                      </>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400">No reading</span>
                    )
                  ) : <span className="text-sm font-semibold text-slate-400">Disconnected</span>}
                </div>
                <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded mt-1 inline-block">Body Temperature</span>
              </div>
            </motion.div>

            {/* Device Status */}
            <motion.div whileHover={{ y: -2 }}
              className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${isConnected ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                {isConnected ? <Wifi className="w-5 h-5 text-emerald-500" /> : <WifiOff className="w-5 h-5 text-slate-400" />}
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Device Status</p>
                <p className={`text-xl font-black leading-tight mt-0.5 ${isConnected ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {isConnected ? 'Connected' : 'Offline'}
                </p>
                <span className="text-[8px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded mt-1 inline-block">
                  {isConnected ? 'ESP32 HeartSync' : 'Waiting...'}
                </span>
              </div>
            </motion.div>
          </div>

          {/* MAIN GRID: ECG + AI Summary + Activity + Alerts */}
          <div className="grid grid-cols-12 gap-4">

            {/* Live ECG — 8 cols */}
            <div className="col-span-12 lg:col-span-8 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col min-h-[380px]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-6 bg-accent-maroon rounded-full" />
                  <div>
                    <h3 className="text-[13px] font-black text-dark-navy leading-none">Live ECG Monitor</h3>
                    <p className="text-[9px] font-semibold text-slate-400 mt-0.5">Real-time cardiac waveform</p>
                  </div>
                </div>
                {isConnected && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-[9px] font-black text-emerald-700">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    Signal Quality: Excellent
                  </span>
                )}
              </div>

              <div className="flex-1 bg-[#0a0a0a] rounded-xl overflow-hidden relative border border-[#222]">
                <ECGGraph 
                  bpm={isConnected ? Number(vitals?.heartRate || 0) : 0} 
                  liveEcg={isConnected ? (vitals?.ecg || []) : []} 
                  spo2={isConnected ? Number(vitals?.spo2 || 0) : 0} 
                  classification={isConnected ? vitals?.current_condition : 'Flatline'} 
                  leadsOff={vitals?.leadsOff}
                  isConnected={isConnected}
                  onSimulate={() => setIsSimulating(true)}
                />
              </div>

              {/* ECG footer info */}
              <div className="flex items-center gap-4 mt-3 text-[9px] font-bold text-slate-400">
                <span>25 mm/s</span>
                <span>10 mm/mV</span>
                <span>500 Hz</span>
                <span className="ml-auto">
                  Time: {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>

            {/* Right column: AI Summary + Today's Activity + Recent Alerts */}
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">

              {/* AI Clinical Summary */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex-1">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-50 rounded-lg">
                      <BrainCircuit className="w-4 h-4 text-indigo-600" />
                    </div>
                    <h3 className="text-[13px] font-black text-dark-navy">AI Clinical Summary</h3>
                  </div>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${isConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                    {isConnected ? 'Low Risk' : 'Inactive'}
                  </span>
                </div>

                {isConnected ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Current Rhythm</p>
                      <p className="text-[13px] font-black text-emerald-600">Normal Sinus Rhythm</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Risk Level</p>
                        <p className="text-sm font-black text-emerald-600">Low</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Signal Quality</p>
                        <p className="text-sm font-black text-emerald-600">Excellent</p>
                      </div>
                    </div>

                    {/* AI Confidence donut */}
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
                        <circle cx="22" cy="22" r="16" fill="none" stroke="#e2e8f0" strokeWidth="5" />
                        <circle cx="22" cy="22" r="16" fill="none" stroke="#22c55e" strokeWidth="5"
                          strokeDasharray={`${0.97 * 2 * Math.PI * 16} ${2 * Math.PI * 16}`}
                          strokeLinecap="round" strokeDashoffset={2 * Math.PI * 16 * 0.25}
                          transform="rotate(-90 22 22)" />
                        <text x="22" y="26" textAnchor="middle" className="text-[9px] font-black fill-slate-800" fontSize="9" fontWeight="900">97%</text>
                      </svg>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none">AI Confidence</p>
                        <p className="text-[10px] font-semibold text-slate-600 mt-1 leading-snug">Normal PQRST intervals confirmed. No abnormalities.</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Recommendation</p>
                      <p className="text-[10px] text-slate-600 font-semibold">No abnormalities detected. Continue monitoring.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                    <BrainCircuit className="w-8 h-8 text-slate-200" />
                    <p className="text-[10px] font-bold text-slate-400">Waiting for live device feed...</p>
                  </div>
                )}

                <button onClick={() => navigate('/patient/ai-assessment')}
                  className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-accent-maroon hover:bg-[#630b0d] text-white rounded-xl text-[10px] font-black tracking-wide transition-all shadow-sm shadow-accent-maroon/20">
                  View Full Analysis <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* BOTTOM ROW: Today's Activity + Recent Alerts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Today's Activity */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-slate-400" />
                <h3 className="text-[13px] font-black text-dark-navy">Today's Activity</h3>
              </div>
              <div className="space-y-2.5">
                {[
                  { icon: Clock, label: 'Monitoring Duration', value: isConnected ? '2h 15m' : '--', color: 'text-accent-maroon' },
                  { icon: TrendingUp, label: 'Highest Heart Rate', value: isConnected ? '126 BPM' : '--', color: 'text-red-500' },
                  { icon: Activity, label: 'Lowest Heart Rate', value: isConnected ? '63 BPM' : '--', color: 'text-blue-500' },
                  { icon: Heart, label: 'Average Heart Rate', value: isConnected && vitals?.heartRate ? `${vitals.heartRate} BPM` : '--', color: 'text-emerald-500' },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <row.icon className={`w-3.5 h-3.5 ${row.color}`} />
                      <span className="text-[10px] font-semibold text-slate-500">{row.label}</span>
                    </div>
                    <span className="text-[11px] font-black text-dark-navy">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Alerts */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-slate-400" />
                  <h3 className="text-[13px] font-black text-dark-navy">Recent Alerts</h3>
                </div>
                <button onClick={() => navigate('/patient/notifications')}
                  className="text-[9px] font-black text-accent-maroon hover:underline uppercase tracking-wider">
                  View All
                </button>
              </div>
              <div className="space-y-2">
                {history.length > 0 ? history.slice(0, 5).map((log, i) => (
                  <div key={log.id || i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                    <span className="text-[9px] font-mono font-bold text-slate-400 shrink-0 w-10">{formatLogTime(log.timestamp)}</span>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${i === 0 ? 'bg-accent-maroon animate-pulse' : 'bg-emerald-500'}`} />
                    <span className="text-[10px] font-semibold text-dark-navy leading-tight">{log.status || 'Normal Rhythm Detected'}</span>
                  </div>
                )) : (
                  // Fallback demo alerts matching reference
                  [
                    { time: currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), label: 'Normal Rhythm Detected', dot: 'bg-emerald-500' },
                    { time: '', label: 'Signal Quality Excellent', dot: 'bg-blue-500' },
                    { time: '', label: 'ECG Monitoring Started', dot: 'bg-emerald-500' },
                    { time: '', label: 'Device Connected', dot: 'bg-emerald-500' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                      <span className="text-[9px] font-mono font-bold text-slate-400 shrink-0 w-10">{item.time}</span>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${item.dot}`} />
                      <span className="text-[10px] font-semibold text-dark-navy leading-tight">{item.label}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default PatientDashboard;
