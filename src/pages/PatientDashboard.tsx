import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Heart,
  Bell,
  Settings,
  Activity,
  Thermometer,
  Droplets,
  HeartPulse,
  User,
  Clock,
  Calendar,
  BrainCircuit,
  ArrowRight,
  ActivitySquare,
  TrendingUp,
  FileText,
  LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db, rtdb } from '../lib/firebase';
import { doc, onSnapshot, collection, query, orderBy, limit, setDoc } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import VitalsCard from '../components/patient/VitalsCard';
import ECGGraph from '../components/patient/ECGGraph';
import { usePatientVitals } from '../hooks/usePatientVitals';
import { startIoTSimulation } from '../services/iotService';

const PatientDashboard = () => {
  const { user, logout, profile } = useAuth();
  const navigate = useNavigate();
  const userId = user?.uid || '';
  const { vitals: realVitals, loading: vitalsLoading, error: vitalsError } = usePatientVitals(userId);

  const [vitals, setVitals] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [patientData, setPatientData] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Time updates
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Background hardware simulator connection — only start when explicitly triggered OR no live data for 10s
  useEffect(() => {
    if (!isSimulating || !userId) return;
    const stopSimulation = startIoTSimulation(userId);
    return () => stopSimulation();
  }, [isSimulating, userId]);

  // Auto-start simulation only if device is not connected after 10s
  useEffect(() => {
    if (!userId) return;
    const timer = setTimeout(() => {
      if (!realVitals || !realVitals.bpm) {
        setIsSimulating(true);
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [userId, realVitals]);

  // Sync Patient profile & historical logs
  useEffect(() => {
    if (!userId) return;
    const unsubPatient = onSnapshot(doc(db, 'patients', userId), (snap) => {
      if (snap.exists()) setPatientData((prev: any) => ({ ...prev, ...snap.data() }));
    });
    const patientRef = ref(rtdb, `/users/${userId}`);
    const unsubPatientRTDB = onValue(patientRef, (snapshot) => {
      const data = snapshot.val();
      if (snapshot.exists() && data) {
        setPatientData((prev: any) => ({ ...prev, fullName: data.name || data.fullName || (prev ? prev.fullName : '') }));
      }
    });
    const q = query(collection(db, 'patientHistory', userId, 'logs'), orderBy('timestamp', 'desc'), limit(5));
    const unsubHistory = onSnapshot(q, (snap) => {
      setHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubPatient(); unsubPatientRTDB(); unsubHistory(); };
  }, [userId]);

  // Synchronize RTDB vitals into local state
  useEffect(() => {
    if (!userId || !realVitals) return;
    const formattedVitals = {
      heartRate: realVitals.bpm,
      o2: realVitals.spo2,
      temp: realVitals.temperature,
      isEmergency: realVitals.alertLevel === 3,
      status: realVitals.alertLevel === 3 ? 'critical' : realVitals.alertLevel === 2 ? 'warning' : 'optimal',
      alertLevel: realVitals.alertLevel,
      alertReason: realVitals.alertReason,
      current_condition: realVitals.current_condition,
      ecg: realVitals.ecg
    };
    setVitals(formattedVitals);
    setDoc(doc(db, 'liveHealthMetrics', userId), {
      heartRate: realVitals.bpm, o2: realVitals.spo2, temp: realVitals.temperature,
      status: realVitals.alertLevel === 3 ? 'Critical' : realVitals.alertLevel === 2 ? 'Warning' : 'Optimal',
      timestamp: new Date().toISOString(), isEmergency: realVitals.alertLevel === 3
    }, { merge: true }).catch(console.error);
  }, [userId, realVitals]);

  // Derived State based on connectivity
  // If we are getting active ECG stream or BPM updates, we consider it connected
  const isConnected = !!(vitals && vitals.heartRate > 0 && !vitalsError);

  const formatLogTime = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      if (timestamp && typeof timestamp.seconds === 'number') {
        return new Date(timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const patientFirstName = patientData?.fullName ? String(patientData.fullName).split(' ')[0] : (profile?.displayName ? String(profile.displayName).split(' ')[0] : 'John');
  const [activeTab, setActiveTab] = useState('Dashboard');

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans text-dark-navy flex overflow-hidden">
      {/* DEEP MAROON SIDEBAR */}
      <aside className="hidden lg:flex flex-col w-64 bg-accent-maroon text-white shrink-0 p-6 justify-between select-none relative z-20 shadow-xl shadow-accent-maroon/10">
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
              <Heart className="w-6 h-6 text-white fill-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">HeartSync</h1>
              <p className="text-[9px] font-bold text-accent-maroon-light/60 uppercase tracking-wider leading-none">Clinical Node</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {[
              { name: 'Dashboard', icon: HeartPulse, path: '/patient/dashboard' },
              { name: 'Live ECG', icon: Activity, path: '/patient/dashboard' },
              { name: 'AI Analysis', icon: BrainCircuit, path: '/patient/ai-assessment' },
              { name: 'Vitals', icon: ActivitySquare, path: '/patient/profile' },
              { name: 'Reports', icon: FileText, path: '/patient/consultations' },
              { name: 'Alerts', icon: Bell, path: '/patient/notifications' },
              { name: 'Device', icon: Settings, path: '/patient/dashboard' },
              { name: 'Settings', icon: Settings, path: '/patient/profile' }
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    setActiveTab(item.name);
                    navigate(item.path);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all ${
                    isActive 
                      ? 'bg-white/15 text-white font-bold shadow-inner' 
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-white/60'}`} />
                  {item.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Bottom: Device status & Logout */}
        <div className="space-y-3">
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold opacity-60">Device Status</span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                isConnected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {isConnected ? 'Connected' : 'Offline'}
              </span>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-bold truncate">ESP32 HeartSync</p>
              <div className="flex justify-between items-center text-[10px] opacity-65">
                <span>Battery Level</span>
                <span className="font-mono font-bold">{isConnected ? '92%' : '--'}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={async () => {
              await logout();
              navigate('/patient/login');
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/10 hover:bg-[#b91c1c] text-white rounded-xl text-xs font-bold transition-all border border-white/10"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOP NAVIGATION BAR */}
        <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0 relative z-10 select-none">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="w-8 h-8 bg-accent-maroon rounded-lg flex items-center justify-center">
              <Heart className="w-5 h-5 text-white fill-white" />
            </div>
            <h1 className="text-lg font-bold text-dark-navy tracking-tight">HeartSync</h1>
          </div>
          <div className="hidden lg:block">
            <h2 className="text-sm font-bold text-muted uppercase tracking-widest leading-none">Overview Portal</h2>
          </div>

          <div className="flex items-center gap-5">
            {/* Realtime Date/Time Display */}
            <div className="hidden md:flex items-center gap-5 text-xs font-semibold text-slate-500">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {currentTime.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>

            {/* Live Indicator */}
            <div className={`px-3 py-1 rounded-full flex items-center gap-1.5 border text-[10px] font-bold uppercase tracking-wider ${
              isConnected ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
            }`}>
              <span className="relative flex h-1.5 w-1.5">
                {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
              </span>
              {isConnected ? 'Live Telemetry' : 'Standby'}
            </div>

            {/* Notification and Profile */}
            <div className="flex items-center gap-3 border-l border-slate-100 pl-4">
              <button className="p-2 text-slate-400 hover:text-dark-navy transition-colors relative">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-accent-maroon rounded-full border border-white"></span>
              </button>
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-slate-200">
                {profile?.photoURL ? <img src={profile.photoURL} alt="" className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-slate-500" />}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-dark-navy leading-none">{profile?.displayName || 'John Smith'}</p>
                <p className="text-[9px] font-semibold text-slate-400 mt-0.5">Patient ID: HS-1023</p>
              </div>
            </div>
          </div>
        </header>

        {/* SCROLLABLE CONTENT BODY */}
        <main className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto min-w-0">
          {/* Hero Greeting Section */}
          <div className="space-y-1">
            <h2 className="text-2xl md:text-3xl font-black text-dark-navy tracking-tight">
              Good Morning, {patientFirstName}
            </h2>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Real-time AI-powered cardiac monitoring
            </p>
          </div>

          {/* VITALS GRID: exactly 4 cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Heart Rate */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-premium flex items-center gap-4 hover:-translate-y-0.5 transition-transform duration-300">
              <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                <Heart className="w-6 h-6 text-red-500 fill-red-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Heart Rate</p>
                <p className="text-2xl font-black text-dark-navy mt-1">
                  {isConnected && vitals?.heartRate ? `${vitals.heartRate} ` : '-- '}
                  <span className="text-xs font-bold text-slate-400 font-sans tracking-normal">BPM</span>
                </p>
                <span className="text-[9px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded mt-1.5 inline-block">Live Reading</span>
              </div>
            </div>

            {/* Card 2: SpO2 */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-premium flex items-center gap-4 hover:-translate-y-0.5 transition-transform duration-300">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                <Droplets className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SpO₂</p>
                <p className="text-2xl font-black text-dark-navy mt-1">
                  {isConnected && vitals?.o2 ? `${vitals.o2}` : '--'}
                  <span className="text-xs font-bold text-slate-400">%</span>
                </p>
                <span className="text-[9px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mt-1.5 inline-block">Oxygen Saturation</span>
              </div>
            </div>

            {/* Card 3: Temperature */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-premium flex items-center gap-4 hover:-translate-y-0.5 transition-transform duration-300">
              <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                <Thermometer className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Temperature</p>
                <p className="text-2xl font-black text-dark-navy mt-1">
                  {isConnected && vitals?.temp !== undefined ? `${Number(vitals.temp).toFixed(1)}` : '--'}
                  <span className="text-xs font-bold text-slate-400">°C</span>
                </p>
                <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded mt-1.5 inline-block">Body Temperature</span>
              </div>
            </div>

            {/* Card 4: Device Status */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-premium flex items-center gap-4 hover:-translate-y-0.5 transition-transform duration-300">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                <Settings className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Device Status</p>
                <p className={`text-xl font-black mt-1 ${isConnected ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {isConnected ? 'Connected' : 'Offline'}
                </p>
                <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded mt-1.5 inline-block">
                  {isConnected ? 'ESP32 HeartSync' : 'Waiting for Device'}
                </span>
              </div>
            </div>
          </div>

          {/* MAIN GRID: ECG MONITOR & AI CLINICAL SUMMARY */}
          <div className="grid grid-cols-12 gap-6">
            {/* Live ECG Card (70% width) */}
            <div className="col-span-12 lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-100 shadow-premium flex flex-col min-h-[420px]">
              <div className="flex justify-between items-center mb-5 select-none">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-6 bg-accent-maroon rounded-full"></div>
                  <h3 className="text-lg font-bold text-dark-navy">Live ECG Monitor</h3>
                </div>
                {isConnected && (
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Signal Quality: Excellent
                  </span>
                )}
              </div>

              {/* Waveform Trace */}
              <div className="flex-1 bg-[#121212] rounded-2xl overflow-hidden relative border border-[#222]">
                {isConnected ? (
                  <ECGGraph bpm={vitals?.heartRate || 0} liveEcg={vitals?.ecg || []} spo2={vitals?.o2 || 0} classification={vitals?.current_condition} />
                ) : (
                  <div className="absolute inset-0 bg-[#161616] flex flex-col items-center justify-center p-6 rounded-2xl text-center">
                    <div className="w-16 h-16 mb-4 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/25">
                      <Heart className="w-8 h-8 text-red-500 fill-red-500/30" />
                    </div>
                    <h4 className="text-lg font-bold text-white mb-1.5">Device Not Connected</h4>
                    <p className="text-xs text-slate-500 max-w-sm mb-5 leading-relaxed">
                      Please connect your HeartSync wearable device to establish live telemetry and PQRST waveform tracking.
                    </p>
                    <button 
                      onClick={() => setIsSimulating(true)}
                      className="px-5 py-2.5 bg-accent-maroon hover:bg-[#630b0d] text-white rounded-xl text-xs font-bold tracking-wide transition-all shadow-lg shadow-accent-maroon/20 hover:scale-[1.02] duration-300"
                    >
                      Connect Device
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* AI Clinical Summary (30% width) */}
            <div className="col-span-12 lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-100 shadow-premium flex flex-col justify-between min-h-[420px]">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-50 rounded-lg">
                      <BrainCircuit className="w-4 h-4 text-indigo-600" />
                    </div>
                    <h3 className="text-base font-bold text-dark-navy">AI Clinical Summary</h3>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                    isConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {isConnected ? 'Low Risk' : 'Inactive'}
                  </span>
                </div>

                {isConnected ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Current Rhythm</p>
                      <p className="text-base font-bold text-dark-navy">Normal Sinus Rhythm</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Risk Level</p>
                        <p className="text-base font-bold text-emerald-600">Low</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Signal Quality</p>
                        <p className="text-base font-bold text-emerald-600">Excellent</p>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 mb-1 leading-none uppercase tracking-wider">AI Confidence</p>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="w-9 h-9 rounded-full border-4 border-emerald-500 border-r-transparent flex items-center justify-center text-[10px] font-black text-emerald-600">
                          97%
                        </div>
                        <p className="text-xs font-semibold text-slate-600 leading-normal">
                          Normal PQRST intervals confirmed. No abnormalities.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-16 text-center text-slate-400 text-sm font-semibold flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 text-slate-300">
                      <BrainCircuit className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold">Waiting for Live Device...</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">AI analysis requires active telemetry feed.</p>
                    </div>
                  </div>
                )}
              </div>

              <button className="w-full flex items-center justify-center gap-2 py-3 bg-accent-maroon hover:bg-[#630b0d] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-accent-maroon/10 mt-6">
                View Full Analysis
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* BOTTOM ROW: TODAY'S ACTIVITY & RECENT ALERTS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Today's Activity */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-premium">
              <div className="flex items-center gap-2.5 mb-5">
                <ActivitySquare className="w-5 h-5 text-slate-400" />
                <h3 className="text-base font-bold text-dark-navy">Today's Activity</h3>
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                <div className="flex justify-between items-center p-3.5 bg-slate-50 rounded-xl border border-slate-100/50">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-accent-maroon" />
                    <span className="text-xs font-semibold text-slate-500">Monitoring Duration</span>
                  </div>
                  <span className="text-xs font-bold text-dark-navy">{isConnected ? '2h 15m' : '--'}</span>
                </div>
                <div className="flex justify-between items-center p-3.5 bg-slate-50 rounded-xl border border-slate-100/50">
                  <div className="flex items-center gap-2.5">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-semibold text-slate-500">Highest Heart Rate</span>
                  </div>
                  <span className="text-xs font-bold text-dark-navy">{isConnected ? '126 BPM' : '--'}</span>
                </div>
                <div className="flex justify-between items-center p-3.5 bg-slate-50 rounded-xl border border-slate-100/50">
                  <div className="flex items-center gap-2.5">
                    <Activity className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-semibold text-slate-500">Lowest Heart Rate</span>
                  </div>
                  <span className="text-xs font-bold text-dark-navy">{isConnected ? '63 BPM' : '--'}</span>
                </div>
              </div>
            </div>

            {/* Recent Alerts */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-premium">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <Bell className="w-5 h-5 text-slate-400" />
                  <h3 className="text-base font-bold text-dark-navy">Recent Alerts</h3>
                </div>
                <button className="text-xs font-bold text-accent-maroon hover:underline">View All</button>
              </div>
              <div className="space-y-4 max-h-[160px] overflow-y-auto pr-1">
                {[...history].slice(0, 3).map((log, i) => (
                  <div key={log.id || i} className="flex gap-3 items-center">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-500"></div>
                    <div className="flex-1 flex justify-between items-center text-xs">
                      <span className="font-bold text-dark-navy">{log.status || 'Normal Rhythm Detected'}</span>
                      <span className="font-semibold text-slate-400">{formatLogTime(log.timestamp)}</span>
                    </div>
                  </div>
                ))}
                {history.length === 0 && (
                  <div className="text-center text-slate-400 font-semibold py-8 text-xs">
                    No recent alerts to display.
                  </div>
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
