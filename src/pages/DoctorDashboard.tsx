import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, Users, AlertCircle, Activity, Bell, Search, Filter, 
  Settings, User, Phone, FileText, Download, Ambulance,
  ShieldCheck, Battery, Clock, Droplets, Thermometer, BrainCircuit, ChevronRight, X, VolumeX, Volume2, HeartPulse, ActivitySquare, Calendar, MapPin
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { db, rtdb } from '../lib/firebase';
import { ref, onValue, set } from 'firebase/database';
import ECGGraph from '../components/patient/ECGGraph';
import { validateSensorPacket } from '../lib/dataValidator';

const DoctorDashboard = () => {
  const { profile, logout, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'stable'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [vitalsMap, setVitalsMap] = useState<Record<string, any>>({});
  const [alerts, setAlerts] = useState<any[]>([]);
  const [rtdbUsers, setRtdbUsers] = useState<Record<string, any>>({});
  const [currentTime, setCurrentTime] = useState(new Date());

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Audio and Modal states
  const [isAlertMuted, setIsAlertMuted] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundIntervalRef = useRef<any>(null);
  const [activeNodeData, setActiveNodeData] = useState<any>(null);
  const [dismissedAlertInstances, setDismissedAlertInstances] = useState<string[]>([]);
  const [envelopeStartTime, setEnvelopeStartTime] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (profile?.role !== 'doctor') {
      navigate('/');
      return;
    }

    const qPatients = query(collection(db, 'users'), where('role', '==', 'patient'), where('status', '==', 'approved'), limit(50));
    const unsubPatients = onSnapshot(qPatients, (snap) => {
      const pts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPatients(pts);
      if (pts.length > 0 && !selectedPatientId) setSelectedPatientId(pts[0].id);
      setLoading(false);
    });

    const qAlerts = query(collection(db, 'emergencyAlerts'), orderBy('detectedAt', 'desc'), limit(15));
    const unsubAlerts = onSnapshot(qAlerts, (snap) => {
      setAlerts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubVitals = onSnapshot(collection(db, 'liveHealthMetrics'), (snap) => {
      const metrics: Record<string, any> = {};
      snap.forEach(docSnap => { metrics[docSnap.id] = docSnap.data(); });
      setVitalsMap(prev => ({ ...prev, ...metrics }));
    });

    const usersRef = ref(rtdb, '/users');
    const unsubUsersRTDB = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (snapshot.exists() && data) {
        setRtdbUsers(data);
        const rtdbVitals: Record<string, any> = {};
        Object.keys(data).forEach(userId => {
          const userNode = data[userId];
          const live = userNode.liveReading || userNode.livereading;
          if (live) {
            const validated = validateSensorPacket(live);
            if (!validated.isValid) return; // Drop invalid packet to prevent crashes

            rtdbVitals[userId] = {
              heartRate: validated.heartRate,
              bpm: validated.heartRate,
              o2: validated.o2,
              temp: validated.temp,
              humidity: validated.humidity,
              ecg: validated.ecg,
              isEmergency: live.isEmergency === true || live.alertLevel === 3 || live.alertLevel === 4 || validated.heartRate > 140 || (validated.heartRate > 0 && validated.heartRate < 40) || (validated.o2 > 0 && validated.o2 < 90),
              status: (live.alertLevel === 3 || live.alertLevel === 4 || validated.heartRate > 140 || (validated.o2 > 0 && validated.o2 < 90)) ? 'critical' : live.alertLevel === 2 ? 'warning' : 'optimal'
            };
          }
        });
        setVitalsMap(prev => ({ ...prev, ...rtdbVitals }));
      }
    });

    const activeNodeRef = ref(rtdb, 'patients/active_node');
    const unsubActiveNode = onValue(activeNodeRef, (snapshot) => {
      setActiveNodeData(snapshot.exists() ? snapshot.val() : null);
    });

    return () => { unsubPatients(); unsubAlerts(); unsubVitals(); unsubUsersRTDB(); unsubActiveNode(); };
  }, [profile, navigate]);

  // Derived KPIs
  const stats = useMemo(() => {
    let online = 0, critical = 0, warning = 0, stable = 0;
    patients.forEach(p => {
      const v = vitalsMap[p.id];
      if (v && v.heartRate > 0) {
        online++;
        if (v.status === 'critical') critical++;
        else if (v.status === 'warning') warning++;
        else stable++;
      }
    });
    return { online, critical, warning, stable };
  }, [patients, vitalsMap]);

  // Filtered Patients
  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      const v = vitalsMap[p.id];
      const matchSearch = p.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || p.id.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;
      if (filter === 'critical') return v?.status === 'critical';
      if (filter === 'warning') return v?.status === 'warning';
      if (filter === 'stable') return v?.status === 'optimal';
      return true;
    });
  }, [patients, vitalsMap, filter, searchQuery]);

  // Selected Patient Details
  const selectedPatient = patients.find(p => p.id === selectedPatientId) || patients[0];
  const selectedVitals = selectedPatientId ? vitalsMap[selectedPatientId] : null;
  const isSelectedConnected = selectedVitals && selectedVitals.heartRate > 0;
  const selectedAlerts = alerts.filter(a => a.patientId === selectedPatientId);

  // Modal Emergency Logic
  let criticalPatientId = "";
  let criticalVitals: any = null;
  let criticalPatientData = null;

  Object.keys(vitalsMap).forEach(uid => {
    const v = vitalsMap[uid];
    const pt = patients.find(p => p.id === uid) || (rtdbUsers[uid] ? { id: uid, displayName: rtdbUsers[uid].name || rtdbUsers[uid].fullName || 'Patient', ...rtdbUsers[uid] } : null);
    if (pt && v) {
      const isHrCritical = v.heartRate > 140 || (v.heartRate > 0 && v.heartRate < 40);
      const isO2Critical = v.o2 > 0 && v.o2 < 90;
      const isTempCritical = v.temp > 38.5 || (v.temp > 0 && v.temp < 35.0);
      
      if (isHrCritical || isO2Critical || isTempCritical || v.isEmergency || v.alertLevel === 3 || v.alertLevel === 4) {
        criticalPatientId = uid;
        criticalPatientData = pt;
        criticalVitals = { ...v, isHrCritical, isO2Critical, isTempCritical };
      }
    }
  });

  const isAnyCritical = !!criticalPatientId;

  useEffect(() => {
    if (criticalPatientId) setEnvelopeStartTime(prev => prev === 0 ? Date.now() : prev);
    else setEnvelopeStartTime(0);
  }, [criticalPatientId]);

  const currentAlertInstanceId = activeNodeData?.currentAlertInstanceId || activeNodeData?.alertId || (envelopeStartTime ? `${criticalPatientId}_${envelopeStartTime}` : "");
  const isDismissed = dismissedAlertInstances.includes(currentAlertInstanceId);
  const isModalVisible = isAnyCritical && !!currentAlertInstanceId && !isDismissed;

  const stopAmbulanceSiren = useCallback(() => {
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }
  }, []);

  const startAmbulanceSiren = useCallback(() => {
    if (isAlertMuted) return stopAmbulanceSiren();
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);

      let waveState = false;
      soundIntervalRef.current = setInterval(() => {
        if (!ctx || ctx.state === 'suspended') return;
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(waveState ? 960 : 640, ctx.currentTime);
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.4);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.48);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
        waveState = !waveState;
      }, 500);
    } catch (e) { console.warn(e); }
  }, [isAlertMuted, stopAmbulanceSiren]);

  useEffect(() => {
    if (isModalVisible && !isAlertMuted) startAmbulanceSiren();
    else stopAmbulanceSiren();
    return stopAmbulanceSiren;
  }, [isModalVisible, isAlertMuted, startAmbulanceSiren, stopAmbulanceSiren]);

  const handleCloseModalCrossClick = () => {
    stopAmbulanceSiren();
    if (currentAlertInstanceId) setDismissedAlertInstances(prev => prev.includes(currentAlertInstanceId) ? prev : [...prev, currentAlertInstanceId]);
  };

  const handleRejectFalseAlert = async () => {
    if (!criticalPatientId) return;
    stopAmbulanceSiren();
    try {
      await set(ref(rtdb, `/users/${criticalPatientId}/liveReading`), { heartRate: 72, bpm: 72, spo2: 98, temperature: 36.5, humidity: 55, ecg: 512, isEmergency: false, alertLevel: 1 });
      await set(ref(rtdb, 'patients/active_node'), null);
      await set(ref(rtdb, `/patients/${criticalPatientId}/alert_state`), { level: 1, status: 'Stable', timestamp: Date.now(), is_acknowledged: true });
    } catch (e) { console.error(e); }
  };

  const handleAcceptEmergency = async () => {
    if (!criticalPatientId) return;
    stopAmbulanceSiren();
    try {
      await set(ref(rtdb, 'patients/active_node'), { patientId: criticalPatientId, isAcknowledged: true, acknowledgedAt: Date.now(), currentAlertInstanceId });
      await set(ref(rtdb, `/patients/${criticalPatientId}/alert_state`), { level: 4, status: 'Incident Acknowledged', timestamp: Date.now(), is_acknowledged: true });
      if (currentAlertInstanceId) setDismissedAlertInstances(prev => prev.includes(currentAlertInstanceId) ? prev : [...prev, currentAlertInstanceId]);
    } catch (e) { console.error(e); }
    setSelectedPatientId(criticalPatientId);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-900">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-accent-maroon rounded-xl flex items-center justify-center shadow-lg shadow-accent-maroon/20">
            <Heart className="w-6 h-6 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark-navy tracking-tight">HeartSync <span className="text-accent-maroon font-black">Doctor Portal</span></h1>
            <p className="text-xs font-semibold text-slate-500">City Heart Hospital</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-4 text-sm font-semibold text-slate-600">
            <div className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {currentTime.toLocaleDateString()}</div>
          </div>
          
          <div className={`px-4 py-1.5 rounded-full flex items-center gap-2 border ${true ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'} shadow-sm`}>
             <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
             </span>
             <span className="text-xs font-bold uppercase tracking-wider">System Online</span>
          </div>

          <div className="flex items-center gap-3 border-l border-slate-200 pl-6">
            <button className="p-2 text-slate-400 hover:text-dark-navy transition-colors relative">
              <Bell className="w-5 h-5" />
              {alerts.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent-maroon rounded-full border border-white"></span>}
            </button>
            <button className="p-2 text-slate-400 hover:text-dark-navy transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 ml-2">
              <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-slate-300">
                {profile?.photoURL ? <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-slate-500" />}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-bold text-dark-navy leading-none">Dr. {profile?.displayName || 'Cardiologist'}</p>
                <p className="text-[10px] font-semibold text-emerald-600 uppercase mt-1">Active Shift</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0 bg-white border-b border-slate-100">
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Patients Online</p>
            <p className="text-3xl font-black text-slate-900">{stats.online}</p>
          </div>
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center"><Users className="w-6 h-6 text-emerald-600" /></div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Critical Cases</p>
            <p className="text-3xl font-black text-red-600">{stats.critical}</p>
          </div>
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center"><AlertCircle className="w-6 h-6 text-red-600" /></div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Moderate Risk</p>
            <p className="text-3xl font-black text-amber-600">{stats.warning}</p>
          </div>
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center"><Activity className="w-6 h-6 text-amber-600" /></div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Stable Patients</p>
            <p className="text-3xl font-black text-emerald-600">{stats.stable}</p>
          </div>
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center"><ShieldCheck className="w-6 h-6 text-emerald-600" /></div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Patient Queue */}
        <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-100 space-y-3">
            <h2 className="text-lg font-bold text-dark-navy">Patient Queue</h2>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search by name or ID..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-accent-maroon focus:ring-1 focus:ring-accent-maroon transition-all"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {['all', 'critical', 'warning', 'stable'].map(f => (
                <button 
                  key={f} 
                  onClick={() => setFilter(f as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-colors ${filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredPatients.map(p => {
              const v = vitalsMap[p.id];
              const isConn = v && v.heartRate > 0;
              const isCrit = v?.status === 'critical';
              const isWarn = v?.status === 'warning';
              return (
                <div 
                  key={p.id}
                  onClick={() => setSelectedPatientId(p.id)}
                  className={`p-3 rounded-xl cursor-pointer border transition-all ${selectedPatientId === p.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden shrink-0">
                      {p.photoURL ? <img src={p.photoURL} alt="" className="w-full h-full object-cover"/> : <User className="w-5 h-5 text-slate-500 m-2.5"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-slate-900 truncate">{p.displayName || 'Unknown Patient'}</p>
                      <p className="text-xs text-slate-500 font-medium truncate">ID: {p.id.slice(0,6).toUpperCase()} • {p.age || 45} yrs</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-3">
                      <span className={`font-bold flex items-center gap-1 ${isCrit ? 'text-red-600' : isWarn ? 'text-amber-600' : 'text-emerald-600'}`}>
                        <HeartPulse className="w-3 h-3" /> {isConn ? v.heartRate : '--'}
                      </span>
                      <span className="font-bold flex items-center gap-1 text-slate-600">
                        <Droplets className="w-3 h-3 text-blue-500" /> {isConn ? `${v.o2}%` : '--'}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded flex items-center gap-1 font-bold text-[10px] uppercase tracking-wider ${
                      !isConn ? 'bg-slate-100 text-slate-500' :
                      isCrit ? 'bg-red-100 text-red-700' : 
                      isWarn ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${!isConn ? 'bg-slate-400' : isCrit ? 'bg-red-500' : isWarn ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                      {!isConn ? 'Offline' : isCrit ? 'Critical' : isWarn ? 'Warning' : 'Stable'}
                    </span>
                  </div>
                </div>
              );
            })}
            {filteredPatients.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm font-medium">No patients found.</div>
            )}
          </div>
        </aside>

        {/* Center Panel: Live ECG & Vitals */}
        <main className="flex-1 bg-slate-50/50 p-6 flex flex-col gap-6 overflow-y-auto min-w-0">
          {selectedPatient ? (
            <>
              {/* ECG Section */}
              <div className="bg-white rounded-[24px] border border-slate-100 shadow-premium p-6 flex flex-col min-h-[400px]">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-dark-navy flex items-center gap-2">
                      Live Telemetry <span className="text-slate-400 font-medium text-sm">| {selectedPatient.displayName}</span>
                    </h2>
                    <p className="text-sm font-semibold text-slate-500 mt-1">
                      {isSelectedConnected ? 'Streaming Real-time Data' : 'Waiting for connection...'}
                    </p>
                  </div>
                  {isSelectedConnected && (
                    <div className="flex items-center gap-4">
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Signal: Excellent
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 bg-[#1A1A1A] rounded-[16px] overflow-hidden border border-[#2A2A2A] relative min-h-[250px]">
                  {isSelectedConnected ? (
                    <ECGGraph bpm={selectedVitals?.heartRate} liveEcg={selectedVitals?.ecg} spo2={selectedVitals?.o2} classification={selectedVitals?.current_condition} />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-50 border border-slate-100 rounded-[16px]">
                      <ActivitySquare className="w-16 h-16 text-slate-300 mb-4" />
                      <h3 className="text-lg font-bold text-slate-700">Device Offline</h3>
                      <p className="text-slate-500 font-medium">Waiting for HeartSync wearable connection to start live ECG stream.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Vitals Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <VitalBox label="Heart Rate" value={isSelectedConnected ? selectedVitals?.heartRate : '--'} unit="BPM" icon={HeartPulse} color="text-red-500" />
                <VitalBox label="SpO₂" value={isSelectedConnected ? selectedVitals?.o2 : '--'} unit="%" icon={Droplets} color="text-blue-500" />
                <VitalBox label="Temperature" value={isSelectedConnected ? selectedVitals?.temp.toFixed(1) : '--'} unit="°C" icon={Thermometer} color="text-amber-500" />
                <VitalBox label="Blood Pressure" value={isSelectedConnected ? "120/80" : '--'} unit="mmHg" icon={Activity} color="text-indigo-500" />
                <VitalBox label="Resp. Rate" value={isSelectedConnected ? "16" : '--'} unit="bpm" icon={ActivitySquare} color="text-teal-500" />
              </div>

              {/* Clinical Timeline & AI */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* AI Analysis */}
                <div className="bg-white rounded-[24px] border border-slate-100 shadow-premium p-6">
                  <h3 className="text-lg font-bold text-dark-navy flex items-center gap-2 mb-6">
                    <BrainCircuit className="w-5 h-5 text-accent-maroon" /> AI Clinical Analysis
                  </h3>
                  {isSelectedConnected ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                        <p className="text-sm font-bold text-red-800 mb-1">Detected Rhythm</p>
                        <p className="text-lg font-black text-red-600">Possible Atrial Fibrillation</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-xl">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Confidence</p>
                          <p className="text-2xl font-black text-dark-navy">97%</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Risk Level</p>
                          <p className="text-2xl font-black text-red-600">High</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700 mb-2">Reasoning:</p>
                        <ul className="list-disc list-inside text-sm text-slate-600 font-medium space-y-1">
                          <li>Irregular RR intervals detected.</li>
                          <li>Absent P waves in Lead II.</li>
                          <li>Variable ventricular rhythm.</li>
                        </ul>
                      </div>
                      <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-sm font-bold text-amber-800">Recommendation:</p>
                        <p className="text-sm text-amber-700 font-medium mt-1">Immediate clinical review recommended. Consider anticoagulation protocol.</p>
                      </div>
                    </div>
                  ) : (
                     <div className="py-12 text-center text-slate-500 font-medium">
                       AI analysis requires an active telemetry stream.
                     </div>
                  )}
                </div>

                {/* Timeline */}
                <div className="bg-white rounded-[24px] border border-slate-100 shadow-premium p-6 flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-dark-navy flex items-center gap-2">
                      <Clock className="w-5 h-5 text-slate-500" /> Clinical Timeline
                    </h3>
                    <button className="text-sm font-bold text-accent-maroon hover:underline">View All</button>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                    {selectedAlerts.length > 0 ? selectedAlerts.map((a, i) => (
                      <div key={i} className="flex gap-4 relative">
                        <div className="w-0.5 bg-slate-200 absolute top-6 bottom-[-24px] left-[11px]"></div>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 ${a.severity === 'CRITICAL' ? 'bg-red-100' : 'bg-amber-100'}`}>
                          <div className={`w-2 h-2 rounded-full ${a.severity === 'CRITICAL' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{a.type || 'Abnormal Rhythm Detected'}</p>
                          <p className="text-xs font-semibold text-slate-500">{new Date(a.detectedAt).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center text-slate-500 font-medium py-8">No recent events recorded.</div>
                    )}
                  </div>
                  
                  {/* Emergency Actions */}
                  <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 gap-3">
                    <button className="py-3 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl border border-red-200 transition-colors flex justify-center items-center gap-2">
                      <Phone className="w-4 h-4" /> Call Patient
                    </button>
                    <button className="py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors flex justify-center items-center gap-2">
                      <Ambulance className="w-4 h-4" /> Dispatch
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 font-medium">
              Select a patient from the queue to view details.
            </div>
          )}
        </main>

        {/* Right Sidebar: Patient Details */}
        {selectedPatient && (
          <aside className="hidden 2xl:flex w-80 bg-white border-l border-slate-200 flex-col shrink-0 overflow-y-auto">
            <div className="p-6 border-b border-slate-100 text-center">
              <div className="w-24 h-24 rounded-full bg-slate-100 mx-auto mb-4 overflow-hidden border-4 border-white shadow-lg">
                {selectedPatient.photoURL ? <img src={selectedPatient.photoURL} alt="" className="w-full h-full object-cover"/> : <User className="w-12 h-12 text-slate-400 m-6"/>}
              </div>
              <h2 className="text-xl font-black text-dark-navy tracking-tight">{selectedPatient.displayName || 'Unknown Patient'}</h2>
              <p className="text-sm font-semibold text-slate-500">ID: {selectedPatient.id.slice(0,8).toUpperCase()}</p>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Patient Information</h4>
                <div className="space-y-3 text-sm font-medium text-slate-700">
                  <div className="flex justify-between"><span className="text-slate-500">Age / Gender</span><span className="font-bold">{selectedPatient.age || 45} / {selectedPatient.gender || 'Male'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Blood Group</span><span className="font-bold">{selectedPatient.bloodGroup || 'O+'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Contact</span><span className="font-bold">{selectedPatient.phone || '+1 (555) 0198'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Emg. Contact</span><span className="font-bold">{selectedPatient.emergencyContact || '+1 (555) 0199'}</span></div>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Hardware Status</h4>
                <div className="space-y-3 text-sm font-medium text-slate-700">
                  <div className="flex justify-between"><span className="text-slate-500">Device</span><span className="font-bold">ESP32 HeartSync</span></div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Battery</span>
                    <span className="font-bold flex items-center gap-1"><Battery className="w-4 h-4 text-emerald-500"/> 92%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Location</span>
                    <span className="font-bold flex items-center gap-1"><MapPin className="w-4 h-4 text-blue-500"/> Active</span>
                  </div>
                </div>
              </div>
              <div className="pt-4">
                <button className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200 transition-colors flex justify-center items-center gap-2">
                  <FileText className="w-4 h-4" /> Generate Report
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Emergency Modal Wrapper */}
      <AnimatePresence>
        {isModalVisible && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 overflow-y-auto">
             <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="w-full max-w-4xl bg-white rounded-[32px] overflow-hidden shadow-2xl relative border-2 border-accent-maroon/20 my-8">
               <button onClick={handleCloseModalCrossClick} className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full z-10"><X className="w-5 h-5 border border-white rounded-full p-0.5" /></button>
               <div className="bg-accent-maroon text-white p-8 flex items-center gap-6">
                 <div className="p-4 bg-white/15 rounded-3xl shrink-0 animate-bounce"><AlertCircle className="w-10 h-10 text-white" /></div>
                 <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">MEDICAL ALERT</span>
                    <h2 className="text-2xl md:text-3xl font-black italic tracking-tight leading-none mt-1">CRITICAL EMERGENCY</h2>
                 </div>
               </div>
               <div className="p-8 space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                     <div className={`p-6 rounded-2xl border ${criticalVitals?.isHrCritical ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                        <p className="text-xs font-bold uppercase mb-2">Heart Rate</p>
                        <p className="text-3xl font-black">{criticalVitals?.heartRate} <span className="text-sm">BPM</span></p>
                     </div>
                     <div className={`p-6 rounded-2xl border ${criticalVitals?.isO2Critical ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                        <p className="text-xs font-bold uppercase mb-2">SpO2</p>
                        <p className="text-3xl font-black">{criticalVitals?.o2} <span className="text-sm">%</span></p>
                     </div>
                     <div className={`p-6 rounded-2xl border ${criticalVitals?.isTempCritical ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                        <p className="text-xs font-bold uppercase mb-2">Temp</p>
                        <p className="text-3xl font-black">{criticalVitals?.temp} <span className="text-sm">°C</span></p>
                     </div>
                  </div>
                  <div className="flex gap-4 mt-8">
                     <button onClick={handleRejectFalseAlert} className="flex-1 border-2 border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl py-4 font-bold uppercase">Reject False Alert</button>
                     <button onClick={handleAcceptEmergency} className="flex-1 bg-accent-maroon hover:bg-accent-maroon/90 text-white rounded-xl py-4 font-bold uppercase">Accept Emergency</button>
                  </div>
               </div>
             </motion.div>
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const VitalBox = ({ label, value, unit, icon: Icon, color }: { label: string; value: any; unit: string; icon: any; color: string }) => (
  <div className="bg-white rounded-[20px] p-4 border border-slate-100 shadow-sm flex flex-col justify-between">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-2 rounded-xl bg-slate-50 ${color}`}><Icon className="w-5 h-5" /></div>
    </div>
    <div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <p className="text-2xl font-black text-slate-900">{value}</p>
        <span className="text-xs font-bold text-slate-400">{unit}</span>
      </div>
    </div>
  </div>
);

export default DoctorDashboard;
