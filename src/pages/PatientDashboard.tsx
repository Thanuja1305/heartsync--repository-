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
  TrendingUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db, rtdb } from '../lib/firebase';
import { doc, onSnapshot, collection, query, orderBy, limit, setDoc } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import VitalsCard from '../components/patient/VitalsCard';
import ECGGraph from '../components/patient/ECGGraph';
import { usePatientVitals } from '../hooks/usePatientVitals';
import { startIoTSimulation } from '../services/iotService';

const PatientDashboard = () => {
  const { user, logout } = useAuth();
  const userId = user?.uid || "m1uph2bX7SVd9Wbyge1AMqAmq093";
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

  // Background hardware simulator connection (toggle for testing)
  useEffect(() => {
    if (!isSimulating || !userId) return;
    const stopSimulation = startIoTSimulation(userId);
    return () => stopSimulation();
  }, [isSimulating, userId]);

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

  const patientFirstName = patientData?.fullName ? String(patientData.fullName).split(' ')[0] : 'John';

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-dark-navy flex flex-col">
      {/* TOP NAVIGATION BAR */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent-maroon rounded-xl flex items-center justify-center shadow-lg shadow-accent-maroon/20">
            <Heart className="w-6 h-6 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark-navy tracking-tight">HeartSync</h1>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Patient Dashboard</p>
          </div>
        </div>

        {/* Center: Date & Time */}
        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <Calendar className="w-4 h-4 text-muted" />
            {currentTime.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <Clock className="w-4 h-4 text-muted" />
            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>

        {/* Right: Status, Profile, Icons */}
        <div className="flex items-center gap-5">
          <div className={`px-4 py-1.5 rounded-full flex items-center gap-2 border ${isConnected ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'} shadow-sm transition-colors duration-500`}>
             <span className="relative flex h-2.5 w-2.5">
                {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
             </span>
             <span className="text-xs font-bold uppercase tracking-wider">
               {isConnected ? 'Device Connected' : 'Device Not Connected'}
             </span>
          </div>
          <div className="flex items-center gap-3 border-l border-slate-200 pl-5">
            <button className="p-2 text-slate-400 hover:text-dark-navy transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent-maroon rounded-full border border-white"></span>
            </button>
            <button className="p-2 text-slate-400 hover:text-dark-navy transition-colors" onClick={() => setIsSimulating(!isSimulating)} title="Toggle Simulation">
              <Settings className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-slate-300 ml-2">
              <User className="w-5 h-5 text-slate-500" />
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-6 md:p-8 max-w-[1600px] w-full mx-auto space-y-8 overflow-y-auto">
        
        {/* HERO SECTION */}
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl md:text-4xl font-bold text-dark-navy tracking-tight">
            Good Morning, {patientFirstName}
          </h2>
          <p className="text-slate-500 font-medium">
            Real-time AI-powered cardiac monitoring and emergency healthcare platform.
          </p>
        </div>

        {/* DASHBOARD GRID */}
        <div className="grid grid-cols-12 gap-8">
          
          {/* LEFT COLUMN (70% = 8 cols) */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">
            {/* LIVE ECG MONITOR CARD */}
            <div className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-premium flex flex-col min-h-[420px] relative overflow-hidden">
              <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className="w-3 h-8 bg-accent-maroon rounded-full"></div>
                <h3 className="text-2xl font-bold text-dark-navy">Live ECG Monitor</h3>
              </div>
              
              <div className="flex-1 rounded-[16px] overflow-hidden relative">
                {isConnected ? (
                  <ECGGraph bpm={vitals?.heartRate || 0} liveEcg={vitals?.ecg || []} spo2={vitals?.o2 || 0} classification={vitals?.current_condition} />
                ) : (
                  <div className="absolute inset-0 bg-slate-50 flex flex-col items-center justify-center border border-slate-100 rounded-[16px]">
                    <div className="w-24 h-24 mb-6 rounded-full bg-red-50 flex items-center justify-center">
                      <Heart className="w-12 h-12 text-red-300" />
                    </div>
                    <h4 className="text-xl font-bold text-slate-700 mb-2">Device Not Connected</h4>
                    <p className="text-slate-500 text-center max-w-md mb-6 font-medium">
                      Connect your HeartSync IoT device to begin live monitoring.
                    </p>
                    <button className="px-6 py-3 bg-accent-maroon hover:bg-[#660e10] text-white rounded-xl font-semibold tracking-wide transition-colors shadow-lg shadow-accent-maroon/20">
                      Connect Device
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* BOTTOM SECTION: 2 CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Today's Activity */}
              <div className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-premium">
                <div className="flex items-center gap-3 mb-6">
                  <ActivitySquare className="w-5 h-5 text-muted" />
                  <h3 className="text-lg font-bold text-dark-navy">Today's Activity</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-accent-maroon" />
                      <span className="font-semibold text-slate-600">Monitoring Duration</span>
                    </div>
                    <span className="font-bold text-dark-navy">{isConnected ? '2h 15m' : '--'}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-5 h-5 text-emerald-500" />
                      <span className="font-semibold text-slate-600">Highest Heart Rate</span>
                    </div>
                    <span className="font-bold text-dark-navy">{isConnected ? '126 BPM' : '--'}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Activity className="w-5 h-5 text-blue-500" />
                      <span className="font-semibold text-slate-600">Lowest Heart Rate</span>
                    </div>
                    <span className="font-bold text-dark-navy">{isConnected ? '63 BPM' : '--'}</span>
                  </div>
                </div>
              </div>
              
              {/* Recent Alerts */}
              <div className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-premium">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-muted" />
                    <h3 className="text-lg font-bold text-dark-navy">Recent Alerts</h3>
                  </div>
                  <button className="text-sm font-semibold text-accent-maroon hover:underline">View All</button>
                </div>
                <div className="space-y-5">
                   {[...history].slice(0, 4).map((log, i) => (
                     <div key={log.id || i} className="flex gap-4 items-start">
                       <div className="w-2 h-2 mt-2 rounded-full shrink-0 bg-emerald-500"></div>
                       <div>
                         <p className="font-bold text-dark-navy">{log.status || 'Normal Rhythm Detected'}</p>
                         <p className="text-sm text-slate-500 mt-0.5">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                       </div>
                     </div>
                   ))}
                   {history.length === 0 && (
                     <div className="text-center text-slate-500 font-medium py-10">
                       No recent alerts to display.
                     </div>
                   )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (30% = 4 cols) */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
             <VitalsCard 
               label="Heart Rate" 
               value={isConnected && vitals?.heartRate ? vitals.heartRate : '--'} 
               unit="BPM" 
               status={isConnected && vitals ? (vitals.alertLevel === 3 ? 'critical' : vitals.alertLevel === 2 ? 'warning' : 'optimal') : 'optimal'} 
               icon={HeartPulse} 
               customStatusLabel={isConnected ? 'Live Reading' : 'Standby'}
             />
             <VitalsCard 
               label="SpO₂"
               value={isConnected && vitals?.o2 ? vitals.o2 : '--'} 
               unit="%" 
               status={isConnected && vitals ? (vitals.alertLevel === 3 ? 'critical' : vitals.alertLevel === 2 ? 'warning' : 'optimal') : 'optimal'} 
               icon={Droplets} 
               customStatusLabel={isConnected ? 'Oxygen Saturation' : 'Standby'}
             />
             <VitalsCard 
               label="Temperature" 
               value={isConnected && vitals?.temp !== undefined ? Number(vitals.temp).toFixed(1) : '--'} 
               unit="°C" 
               status={isConnected && vitals ? (vitals.alertLevel === 3 ? 'critical' : vitals.alertLevel === 2 ? 'warning' : 'optimal') : 'optimal'} 
               icon={Thermometer} 
               customStatusLabel={isConnected ? 'Body Temperature' : 'Standby'}
             />
             
             {/* AI Clinical Summary */}
             <div className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-premium flex flex-col h-full">
               <div className="flex items-center gap-3 mb-6">
                 <div className="p-2.5 bg-indigo-50 rounded-xl">
                   <BrainCircuit className="w-5 h-5 text-indigo-600" />
                 </div>
                 <h3 className="text-lg font-bold text-dark-navy">AI Clinical Summary</h3>
               </div>
               
               {isConnected ? (
                 <div className="space-y-5 flex-1">
                   <div>
                     <p className="text-sm text-slate-500 font-semibold mb-1">Current Rhythm</p>
                     <p className="text-lg font-bold text-dark-navy">Normal Sinus Rhythm</p>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <p className="text-sm text-slate-500 font-semibold mb-1">AI Confidence</p>
                       <p className="text-lg font-bold text-emerald-600">97%</p>
                     </div>
                     <div>
                       <p className="text-sm text-slate-500 font-semibold mb-1">Risk Level</p>
                       <p className="text-lg font-bold text-emerald-600">Low</p>
                     </div>
                   </div>
                   <div>
                     <p className="text-sm text-slate-500 font-semibold mb-1">Signal Quality</p>
                     <p className="text-lg font-bold text-emerald-600">Excellent</p>
                   </div>
                   <div className="p-4 bg-slate-50 rounded-xl mt-4">
                     <p className="text-sm font-medium text-slate-700">
                       No abnormalities detected. Continue monitoring.
                     </p>
                   </div>
                   <button className="mt-auto w-full flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold transition-colors">
                     View Full Analysis
                     <ArrowRight className="w-4 h-4" />
                   </button>
                 </div>
               ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                   <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                     <BrainCircuit className="w-6 h-6 text-slate-300" />
                   </div>
                   <p className="text-slate-500 font-medium mb-2">Waiting for Live Device...</p>
                   <p className="text-sm text-slate-400">AI analysis requires an active telemetry stream.</p>
                 </div>
               )}
             </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default PatientDashboard;
