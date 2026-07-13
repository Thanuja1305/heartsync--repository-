import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, Users, AlertCircle, Activity, Bell, Search, Filter, 
  Settings, User, Phone, FileText, Download, Ambulance,
  ShieldCheck, Battery, Clock, Droplets, Thermometer, BrainCircuit, ChevronRight, X, VolumeX, Volume2, HeartPulse, ActivitySquare, Calendar, MapPin, MessageSquare, LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { db, rtdb } from '../lib/firebase';
import { ref, onValue, set } from 'firebase/database';
import ECGGraph from '../components/patient/ECGGraph';
import { validateSensorPacket } from '../lib/dataValidator';
import { startIoTSimulation } from '../services/iotService';

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
    if (profile !== null && profile?.role !== 'doctor') {
      navigate('/');
      return;
    }
    if (!user?.uid) return;

    const qPatients = query(collection(db, 'users'), where('role', '==', 'patient'), where('status', '==', 'approved'), where('doctorId', '==', user.uid), limit(50));
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
  }, [profile, navigate, user]);

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
      
      const { data: pRec } = await supabase.from('patients').select('id').eq('user_id', criticalPatientId).maybeSingle();
      if (pRec) {
        await supabase.from('alerts').update({ status: 'cancelled' }).eq('patient_id', pRec.id).eq('status', 'active');
      }
    } catch (e) { console.error("Error rejecting alert:", e); }
  };

  const handleAcceptEmergency = async () => {
    if (!criticalPatientId) return;
    stopAmbulanceSiren();
    try {
      await set(ref(rtdb, 'patients/active_node'), { patientId: criticalPatientId, isAcknowledged: true, acknowledgedAt: Date.now(), currentAlertInstanceId });
      await set(ref(rtdb, `/patients/${criticalPatientId}/alert_state`), { level: 4, status: 'Incident Acknowledged', timestamp: Date.now(), is_acknowledged: true });
      if (currentAlertInstanceId) setDismissedAlertInstances(prev => prev.includes(currentAlertInstanceId) ? prev : [...prev, currentAlertInstanceId]);
      
      const { data: pRec } = await supabase.from('patients').select('id').eq('user_id', criticalPatientId).maybeSingle();
      if (pRec) {
        await supabase.from('alerts').update({ status: 'resolved' }).eq('patient_id', pRec.id).eq('status', 'active');
      }
    } catch (e) { console.error("Error accepting emergency:", e); }
    setSelectedPatientId(criticalPatientId);
  };

  const [activeTab, setActiveTab] = useState('Overview');

  return (
    <div className="min-h-screen bg-[#0B0F19] font-sans text-white flex overflow-hidden">
      {/* 1. FAR-LEFT NAVIGATION SIDEBAR */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#111625] border-r border-[#1e2640] shrink-0 p-6 justify-between select-none relative z-20">
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-maroon rounded-xl flex items-center justify-center shadow-lg shadow-accent-maroon/20 border border-accent-maroon/30">
              <Heart className="w-6 h-6 text-white fill-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">HeartSync</h1>
              <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest leading-none">Doctor Portal</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {[
              { name: 'Overview', icon: HeartPulse, path: '/doctor/dashboard' },
              { name: 'Patients', icon: Users, path: '/doctor/patients' },
              { name: 'Live Monitoring', icon: Activity, path: '/doctor/live-monitoring' },
              { name: 'Alerts', icon: AlertCircle, count: alerts.length, path: '/doctor/alerts' },
              { name: 'Reports', icon: FileText, path: '/doctor/profile' },
              { name: 'Messages', icon: MessageSquare, path: '/doctor/dashboard' },
              { name: 'Settings', icon: Settings, path: '/doctor/profile' }
            ].map((item) => {
              const Icon = item.icon;
              const isActive = item.name === 'Overview';
              return (
                <button
                  key={item.name}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all ${
                    isActive 
                      ? 'bg-accent-maroon text-white font-bold shadow-lg shadow-accent-maroon/20' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    {item.name}
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="px-1.5 py-0.5 bg-rose-600 text-white text-[10px] font-black rounded-full leading-none">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Bottom: Doctor profile & Logout */}
        <div className="space-y-3">
          <div className="p-4 bg-[#151B2C] rounded-2xl border border-[#1e2640] flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border border-[#2d3a5f]">
              {profile?.photoURL ? <img src={profile.photoURL} alt="" className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-slate-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-white truncate leading-none">Dr. {profile?.displayName || 'Sharma'}</p>
              <p className="text-[9px] font-semibold text-slate-400 truncate mt-1">Cardiologist</p>
              <div className="flex items-center gap-1 mt-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Online</span>
              </div>
            </div>
          </div>
          <button 
            onClick={async () => {
              await logout();
              navigate('/doctor/login');
            }}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#1e2640] hover:bg-[#b91c1c] hover:text-white text-slate-300 rounded-xl text-xs font-bold transition-all border border-[#252f4e]"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* RIGHT SIDE STRUCTURE */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOP NAVIGATION BAR */}
        <header className="bg-[#151B2C] border-b border-[#1e2640] px-6 py-4 flex items-center justify-between shrink-0 sticky top-0 z-10 select-none">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Doctor Dashboard
              <span className="text-slate-500 font-semibold text-xs hidden sm:inline">| Monitor patients in real-time</span>
            </h1>
          </div>

          <div className="flex items-center gap-6">
            {/* Realtime Date/Time Display */}
            <div className="hidden md:flex items-center gap-4 text-xs font-semibold text-slate-400">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                {currentTime.toLocaleDateString()}
              </div>
            </div>

            {/* Hospital Selector */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#1a2236] border border-[#2d3a5f] rounded-xl text-xs font-semibold text-slate-300">
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              City Heart Hospital
            </div>

            {/* Notification and Profile */}
            <div className="flex items-center gap-3 border-l border-[#1e2640] pl-6">
              <button className="p-2 text-slate-400 hover:text-white transition-colors relative">
                <Bell className="w-5 h-5" />
                {alerts.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-600 rounded-full border border-[#151B2C]"></span>
                )}
              </button>
              <button className="p-2 text-slate-400 hover:text-white transition-colors">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* KPI CARDS BAR */}
        <div className="px-6 py-4 bg-[#111625] border-b border-[#1e2640] grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0 select-none">
          <div className="p-4 rounded-2xl bg-[#151B2C] border border-[#1e2640] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Patients Online</p>
              <p className="text-2xl font-black text-white">{stats.online}</p>
            </div>
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/25">
              <Users className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-[#151B2C] border border-[#1e2640] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Critical Cases</p>
              <p className="text-2xl font-black text-rose-500">{stats.critical}</p>
            </div>
            <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center border border-rose-500/25 animate-pulse">
              <AlertCircle className="w-5 h-5 text-rose-500" />
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-[#151B2C] border border-[#1e2640] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Moderate Risk</p>
              <p className="text-2xl font-black text-amber-500">{stats.warning}</p>
            </div>
            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/25">
              <Activity className="w-5 h-5 text-amber-500" />
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-[#151B2C] border border-[#1e2640] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Stable Patients</p>
              <p className="text-2xl font-black text-emerald-500">{stats.stable}</p>
            </div>
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/25">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: 3-COLUMNS GIGANTIC DASHBOARD PANEL */}
        <div className="flex-1 flex overflow-hidden">
          {/* 2. PATIENT QUEUE (COLUMN 1) */}
          <aside className="w-80 bg-[#111625] border-r border-[#1e2640] flex flex-col shrink-0 select-none">
            <div className="p-4 border-b border-[#1e2640] space-y-3">
              <h2 className="text-base font-bold text-white uppercase tracking-wider">Patient Queue ({patients.length})</h2>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search patient..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[#151B2C] border border-[#1e2640] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent-maroon focus:ring-1 focus:ring-accent-maroon transition-all"
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {['all', 'critical', 'warning', 'stable'].map(f => (
                  <button 
                    key={f} 
                    onClick={() => setFilter(f as any)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold capitalize whitespace-nowrap transition-colors ${
                      filter === f ? 'bg-accent-maroon text-white' : 'bg-[#151B2C] text-slate-400 hover:text-white border border-[#1e2640]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {filteredPatients.map(p => {
                const v = vitalsMap[p.id];
                const isConn = v && v.heartRate > 0;
                const isCrit = v?.status === 'critical';
                const isWarn = v?.status === 'warning';
                const isSelected = selectedPatientId === p.id;
                
                return (
                  <div 
                    key={p.id}
                    onClick={() => setSelectedPatientId(p.id)}
                    className={`p-3 rounded-xl cursor-pointer border transition-all ${
                      isSelected 
                        ? 'bg-[#1c2238] border-accent-maroon shadow-lg shadow-accent-maroon/5' 
                        : 'bg-[#151B2C]/40 border-[#151B2C] hover:bg-[#151B2C] hover:border-[#1e2640]'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-full bg-slate-700 overflow-hidden shrink-0 border border-[#2d3a5f]">
                        {p.photoURL ? <img src={p.photoURL} alt="" className="w-full h-full object-cover"/> : <User className="w-5 h-5 text-slate-400 m-2"/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs text-white truncate">{p.displayName || 'Unknown Patient'}</p>
                        <p className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">ID: {p.id.slice(0,6).toUpperCase()} • {p.age || 45} yrs</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px]">
                      <div className="flex items-center gap-3">
                        <span className={`font-bold flex items-center gap-0.5 ${isCrit ? 'text-rose-500' : isWarn ? 'text-amber-500' : 'text-emerald-500'}`}>
                          <HeartPulse className="w-3 h-3" /> {isConn ? v.heartRate : '--'} BPM
                        </span>
                        <span className="font-bold flex items-center gap-0.5 text-blue-400">
                          <Droplets className="w-3 h-3" /> {isConn ? `${v.o2}%` : '--'}
                        </span>
                      </div>
                      
                      <span className={`px-1.5 py-0.5 rounded flex items-center gap-1 font-black text-[9px] uppercase tracking-wider ${
                        !isConn ? 'bg-[#1a2236] text-slate-500' :
                        isCrit ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 
                        isWarn ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        <span className={`w-1 h-1 rounded-full ${!isConn ? 'bg-slate-500' : isCrit ? 'bg-rose-500' : isWarn ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                        {!isConn ? 'Offline' : isCrit ? 'Critical' : isWarn ? 'Warning' : 'Stable'}
                      </span>
                    </div>
                  </div>
                );
              })}
              {filteredPatients.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-xs font-semibold">No patients matching filters.</div>
              )}
            </div>
          </aside>

          {/* 3. CENTER PANEL & DETAILS (COLUMN 2) */}
          <main className="flex-1 bg-[#0B0F19] p-6 flex flex-col gap-6 overflow-y-auto min-w-0">
            {selectedPatient ? (
              <>
                {/* Center Panel Content Wrapper */}
                <div className="grid grid-cols-12 gap-6">
                  {/* ECG Panel: 8 cols on large screens */}
                  <div className="col-span-12 xl:col-span-8 flex flex-col gap-6">
                    {/* ECG GRAPH */}
                    <div className="bg-[#151B2C] rounded-[24px] border border-[#1e2640] p-6 flex flex-col min-h-[400px]">
                      <div className="flex justify-between items-center mb-4 select-none">
                        <div>
                          <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            Live ECG Monitor <span className="text-slate-500 font-semibold text-xs">| {selectedPatient.displayName}</span>
                          </h2>
                          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                            {isSelectedConnected ? 'Continuous realtime clinical waveform streaming' : 'Waiting for connection...'}
                          </p>
                        </div>
                        {isSelectedConnected && (
                          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-bold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Signal: Excellent
                          </span>
                        )}
                      </div>

                      {/* Canvas area */}
                      <div className="flex-1 bg-[#121212] rounded-[16px] overflow-hidden border border-[#1e2640] relative min-h-[220px]">
                        {isSelectedConnected ? (
                          <ECGGraph bpm={selectedVitals?.heartRate} liveEcg={selectedVitals?.ecg} spo2={selectedVitals?.o2} classification={selectedVitals?.current_condition} />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-[#121212] rounded-[16px] space-y-3">
                            <ActivitySquare className="w-12 h-12 text-slate-600 mb-1" />
                            <h3 className="text-base font-bold text-slate-400">Waiting for ECG Signal</h3>
                            <p className="text-slate-500 text-xs max-w-xs mt-1">Patient device is currently offline. Waveform tracking is on standby.</p>
                            <button
                              onClick={() => {
                                if (selectedPatient?.id) {
                                  startIoTSimulation(selectedPatient.id);
                                }
                              }}
                              className="px-4 py-2 bg-accent-maroon hover:bg-[#630b0d] text-white text-xs font-bold rounded-lg shadow-md transition-all"
                            >
                              Simulate Patient Device
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Vitals summary block underneath */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 select-none">
                      <VitalBox label="Heart Rate" value={isSelectedConnected ? selectedVitals?.heartRate : '--'} unit="BPM" icon={HeartPulse} color="text-rose-500 bg-rose-500/10 border-rose-500/20" />
                      <VitalBox label="SpO₂" value={isSelectedConnected ? selectedVitals?.o2 : '--'} unit="%" icon={Droplets} color="text-blue-400 bg-blue-500/10 border-blue-500/20" />
                      <VitalBox label="Temperature" value={isSelectedConnected ? selectedVitals?.temp.toFixed(1) : '--'} unit="°C" icon={Thermometer} color="text-amber-500 bg-amber-500/10 border-amber-500/20" />
                      <VitalBox label="Blood Pressure" value={isSelectedConnected ? "118/76" : '--'} unit="mmHg" icon={Activity} color="text-purple-400 bg-purple-500/10 border-purple-500/20" />
                      <VitalBox label="Resp. Rate" value={isSelectedConnected ? "16" : '--'} unit="bpm" icon={ActivitySquare} color="text-teal-400 bg-teal-500/10 border-teal-500/20" />
                    </div>
                  </div>

                  {/* AI Clinical Analysis: 4 cols */}
                  <div className="col-span-12 xl:col-span-4 bg-[#151B2C] rounded-[24px] border border-[#1e2640] p-6 flex flex-col justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2 mb-5">
                        <BrainCircuit className="w-5 h-5 text-accent-maroon" /> AI Clinical Analysis
                      </h3>
                      {isSelectedConnected ? (
                        <div className="space-y-4">
                          <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-0.5">Detected Rhythm</p>
                            <p className="text-sm font-black text-rose-500">Possible Atrial Fibrillation</p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-[#111625] rounded-xl border border-[#1e2640]">
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Confidence</p>
                              <p className="text-lg font-black text-white">97%</p>
                            </div>
                            <div className="p-3 bg-[#111625] rounded-xl border border-[#1e2640]">
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Risk Level</p>
                              <p className="text-lg font-black text-rose-500">High</p>
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Reasoning Details</p>
                            <ul className="list-disc list-inside text-xs text-slate-300 font-semibold space-y-1">
                              <li>Irregular RR intervals detected.</li>
                              <li>Absent P waves in Lead II.</li>
                              <li>Variable ventricular rhythm.</li>
                            </ul>
                          </div>
                          
                          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Recommendation</p>
                            <p className="text-xs text-amber-300 font-semibold mt-1">Immediate clinical review recommended. Initiate anticoagulation protocol.</p>
                          </div>
                        </div>
                      ) : (
                        <div className="py-16 text-center text-slate-500 font-medium text-xs flex flex-col items-center justify-center gap-2">
                          <BrainCircuit className="w-10 h-10 text-slate-600 mb-2" />
                          <span>AI analysis requires active telemetry feed.</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 mt-6">
                      <button className="w-full py-3 bg-accent-maroon hover:bg-[#630b0d] text-white font-bold rounded-xl text-xs uppercase transition-colors tracking-wide shadow-lg shadow-accent-maroon/25 flex items-center justify-center gap-1.5">
                        <Phone className="w-4 h-4" /> Notify Emergency
                      </button>
                      <button className="w-full py-3 bg-[#1e2640] hover:bg-[#2c375c] text-white font-semibold rounded-xl text-xs transition-colors">
                        View Full Report
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lower grid: Patient Info & Timeline */}
                <div className="grid grid-cols-12 gap-6">
                  {/* Patient Info Panel */}
                  <div className="col-span-12 lg:col-span-6 bg-[#151B2C] rounded-[24px] border border-[#1e2640] p-6">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Patient Information</h4>
                    <div className="space-y-3.5 text-xs font-semibold text-slate-300">
                      <div className="flex justify-between border-b border-[#1e2640] pb-2">
                        <span className="text-slate-500">Age / Gender</span>
                        <span className="font-bold text-white">{selectedPatient.age || 45} / {selectedPatient.gender || 'Male'}</span>
                      </div>
                      <div className="flex justify-between border-b border-[#1e2640] pb-2">
                        <span className="text-slate-500">Blood Group</span>
                        <span className="font-bold text-white">{selectedPatient.bloodGroup || 'O+'}</span>
                      </div>
                      <div className="flex justify-between border-b border-[#1e2640] pb-2">
                        <span className="text-slate-500">Contact</span>
                        <span className="font-bold text-white">{selectedPatient.phone || '+1 (555) 0198'}</span>
                      </div>
                      <div className="flex justify-between border-b border-[#1e2640] pb-2">
                        <span className="text-slate-500">Emergency Contact</span>
                        <span className="font-bold text-white">{selectedPatient.emergencyContact || '+1 (555) 0199'}</span>
                      </div>
                      <div className="flex justify-between border-b border-[#1e2640] pb-2">
                        <span className="text-slate-500">Hardware Status</span>
                        <span className="font-bold text-white">ESP32 HeartSync</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Battery Level</span>
                        <span className="font-bold text-white flex items-center gap-1">
                          <Battery className="w-4 h-4 text-emerald-500" /> {isSelectedConnected ? '92%' : '--'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Clinical Timeline Panel */}
                  <div className="col-span-12 lg:col-span-6 bg-[#151B2C] rounded-[24px] border border-[#1e2640] p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-center mb-4 select-none">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Clinical Timeline
                      </h3>
                      <button className="text-[10px] font-bold text-accent-maroon hover:underline uppercase tracking-wide">View All</button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto max-h-[140px] pr-1 space-y-4">
                      {selectedAlerts.length > 0 ? selectedAlerts.map((a, i) => (
                        <div key={i} className="flex gap-3 relative">
                          <div className="w-0.5 bg-[#2d3a5f] absolute top-5 bottom-[-20px] left-[7px]"></div>
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 z-10 ${a.severity === 'CRITICAL' ? 'bg-rose-500/20' : 'bg-amber-500/20'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${a.severity === 'CRITICAL' ? 'bg-rose-500' : 'bg-amber-500'}`}></div>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">{a.type || 'Abnormal Rhythm Detected'}</p>
                            <p className="text-[9px] font-semibold text-slate-400">{new Date(a.detectedAt).toLocaleTimeString()}</p>
                          </div>
                        </div>
                      )) : (
                        <div className="text-center text-slate-500 font-semibold py-8 text-xs">No recent events recorded.</div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 font-semibold text-sm">
                <HeartPulse className="w-12 h-12 text-slate-700 mb-3 animate-pulse" />
                Select a patient from the queue to start monitoring.
              </div>
            )}
          </main>
        </div>
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
  <div className={`rounded-[20px] p-4 border flex flex-col justify-between ${color}`}>
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 rounded-xl bg-white/5"><Icon className="w-5 h-5" /></div>
    </div>
    <div>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <p className="text-2xl font-black text-white">{value}</p>
        <span className="text-[10px] font-bold text-slate-400">{unit}</span>
      </div>
    </div>
  </div>
);

export default DoctorDashboard;
