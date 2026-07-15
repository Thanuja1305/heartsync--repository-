import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, AlertCircle, Activity, Bell, Search, Filter,
  Settings, FileText, ShieldCheck, Clock,
  Droplets, Thermometer, BrainCircuit, HeartPulse,
  Wifi, ZoomIn, ZoomOut, SkipBack, SkipForward, Play, Pause,
  Maximize2, Building2, Wind, ChevronDown, Menu, Ambulance
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, limit, orderBy, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db, rtdb } from '../lib/firebase';
import { ref, onValue } from 'firebase/database';
import { validateSensorPacket } from '../lib/dataValidator';
import { startIoTSimulation } from '../services/iotService';
import DoctorSidebar from '../components/DoctorSidebar';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PatientRecord {
  id: string;
  displayName?: string;
  fullName?: string;
  age?: number;
  gender?: string;
  bloodGroup?: string;
  phone?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  photoURL?: string;
  doctorId?: string;
}

interface VitalsRecord {
  heartRate?: number;
  bpm?: number;
  o2?: number;
  temp?: number;
  humidity?: number;
  isEmergency?: boolean;
  ecg?: number[];
  fingerDetected?: boolean;
  leadsOff?: boolean;
  lastSeen?: number;
  timestamp?: number | string;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const getPatientStatus = (v?: VitalsRecord): 'critical' | 'warning' | 'stable' => {
  if (!v) return 'stable';
  const hr = v.heartRate || v.bpm || 0;
  const o2 = v.o2 || 0;
  if (v.isEmergency || hr > 140 || (hr > 0 && hr < 40) || (o2 > 0 && o2 < 90)) return 'critical';
  if (hr > 100 || hr < 55 || (o2 > 0 && o2 < 95)) return 'warning';
  return 'stable';
};

const STATUS: Record<string, { badge: string; dot: string; label: string; statColor: string }> = {
  critical: { badge: 'bg-red-500/20 text-red-400 border border-red-500/30', dot: 'bg-red-500', label: 'Critical', statColor: 'bg-red-500/10 text-red-400 border-red-500/20' },
  warning:  { badge: 'bg-orange-500/20 text-orange-400 border border-orange-500/30', dot: 'bg-orange-500', label: 'Moderate', statColor: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  stable:   { badge: 'bg-green-500/20 text-green-400 border border-green-500/30', dot: 'bg-green-500', label: 'Stable', statColor: 'bg-green-500/10 text-green-400 border-green-500/20' },
};

// ─── AI Analysis ─────────────────────────────────────────────────────────────

function getAIAnalysis(v?: VitalsRecord) {
  const hr = v?.heartRate || v?.bpm || 0;
  const o2 = v?.o2 || 0;
  if (!v || (hr === 0 && o2 === 0)) return {
    rhythm: 'Awaiting Data', risk: 'Unknown', riskColor: '#6b7280', confidence: 0,
    reasons: ['No telemetry feed active', 'Connect patient device to begin'],
    recommendation: 'Connect wearable device to enable AI analysis.'
  };
  if (hr > 140 || (o2 > 0 && o2 < 90) || v?.isEmergency) return {
    rhythm: 'Possible Atrial Fibrillation', risk: 'High Risk', riskColor: '#ef4444', confidence: 97,
    reasons: ['Irregular RR intervals', 'Absent P waves', 'Variable ventricular rhythm'],
    recommendation: 'Immediate physician review recommended.'
  };
  if (hr > 100) return {
    rhythm: 'Sinus Tachycardia', risk: 'Moderate', riskColor: '#f59e0b', confidence: 89,
    reasons: ['Elevated heart rate detected', 'Regular P waves present', 'Normal QRS complex'],
    recommendation: 'Monitor closely. Consider causes of tachycardia.'
  };
  if (o2 > 0 && o2 < 95) return {
    rhythm: 'Normal Sinus Rhythm', risk: 'Moderate', riskColor: '#f59e0b', confidence: 92,
    reasons: ['Low oxygen saturation', 'Possible respiratory compromise', 'Monitor closely'],
    recommendation: 'Check respiratory status. Consider supplemental oxygen.'
  };
  return {
    rhythm: 'Normal Sinus Rhythm', risk: 'Low Risk', riskColor: '#22c55e', confidence: 98,
    reasons: ['Regular P waves', 'Normal QRS morphology', 'Consistent RR intervals'],
    recommendation: 'Continue routine monitoring. All parameters nominal.'
  };
}

// ─── ECG Hook ─────────────────────────────────────────────────────────────────

function useECGPath(running: boolean) {
  const points = useRef<number[]>(Array(200).fill(50));
  const step = useRef(0);
  const [path, setPath] = useState('');
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const s = step.current;
      let val = 50;
      if (s === 11) val = 44; else if (s === 12) val = 42; else if (s === 13) val = 44;
      else if (s === 16) val = 57; else if (s === 17) val = 8;
      else if (s === 18) val = 86; else if (s === 19) val = 50;
      else if (s === 23) val = 42; else if (s === 24) val = 40; else if (s === 25) val = 43;
      points.current.shift();
      points.current.push(val);
      setPath(points.current.map((y, x) => `${x === 0 ? 'M' : 'L'}${x * 2.52},${y}`).join(' '));
      step.current = (s + 1) % 42;
    }, 38);
    return () => clearInterval(id);
  }, [running]);
  return path;
}

// ─── Reusable sub-components ──────────────────────────────────────────────────

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
    <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{label}</p>
    <p className="text-[10px] font-bold text-slate-200 text-right max-w-[55%] truncate">{value}</p>
  </div>
);

const VitalBox = ({ icon: Icon, value, unit, label, color, sub }: any) => (
  <div className="flex-1 bg-[#0B1120] rounded-xl p-3 border border-white/5 min-w-0">
    <div className="flex items-center gap-1.5 mb-1.5">
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider truncate">{label}</span>
    </div>
    <p className={`text-xl font-black leading-none ${color}`}>
      {value ?? '--'}
      <span className="text-[9px] ml-1 text-slate-500 font-bold">{unit}</span>
    </p>
    {sub && <p className="text-[8px] text-slate-600 font-bold mt-1 truncate">{sub}</p>}
  </div>
);

const StatPill = ({ icon: Icon, value, label, color }: any) => (
  <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border shrink-0 ${color}`}>
    <Icon className="w-4 h-4 shrink-0" />
    <div>
      <p className="text-lg font-black leading-none">{value}</p>
      <p className="text-[8px] font-black uppercase tracking-wider opacity-70 leading-none mt-0.5">{label}</p>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const DoctorDashboard = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [vitalsMap, setVitalsMap] = useState<Record<string, VitalsRecord>>({});
  const [alerts, setAlerts] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isPaused, setIsPaused] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [activeEmergencyAlert, setActiveEmergencyAlert] = useState<any | null>(null);

  useEffect(() => { const t = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (profile !== null && profile?.role !== 'doctor') navigate('/'); }, [profile, navigate]);

  useEffect(() => {
    const isDemo = localStorage.getItem('demo_mode') === 'doctor' || !user?.uid || !db.app.options.apiKey || db.app.options.apiKey.includes('mock-api-key');

    if (isDemo) {
      const demoPatients = [
        {
          id: 'demo-patient-001',
          displayName: 'Sarah Jenkins',
          fullName: 'Sarah Jenkins',
          age: 38,
          gender: 'Female',
          bloodGroup: 'O-Positive',
          phone: '+1 (555) 048-1920',
          emergencyContact: 'Robert Jenkins (Spouse)',
          emergencyPhone: '+1 (555) 048-1921',
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
          emergencyContact: 'Faustina (Wife)',
          emergencyPhone: '+1 (555) 890-4822',
          status: 'approved'
        }
      ];
      setPatients(demoPatients);
      setSelectedId(prev => prev ?? demoPatients[0].id);
      setLoading(false);

      // Sim updates
      const interval = setInterval(() => {
        const updatedVitals: Record<string, VitalsRecord> = {};
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
            fingerDetected: true,
            leadsOff: false,
            lastSeen: Date.now(),
            ecg: Array(40).fill(0).map(() => Math.floor(400 + Math.random() * 100))
          };
        });
        setVitalsMap(prev => ({ ...prev, ...updatedVitals }));
      }, 1500);

      // Simple mock timeline
      setAlerts([
        { id: '1', patientId: 'demo-patient-002', patientName: 'Marcus Aurelius', severity: 'critical', message: 'Cardiac anomaly detected: HR 145, SpO2 88%', detectedAt: Date.now(), acknowledged: false, emergency: true }
      ]);

      return () => clearInterval(interval);
    }

    if (!user?.uid) return;
    const qP = query(collection(db, 'users'), where('role', '==', 'patient'), where('status', '==', 'approved'), limit(50));
    const unsubP = onSnapshot(qP, snap => {
      const pts = snap.docs.map(d => ({ id: d.id, ...d.data() } as PatientRecord));
      setPatients(pts);
      if (pts.length > 0) setSelectedId(prev => prev ?? pts[0].id);
      setLoading(false);
    });
    const unsubV = onSnapshot(collection(db, 'liveHealthMetrics'), snap => {
      const m: Record<string, VitalsRecord> = {};
      snap.forEach(d => { 
        const docData = d.data();
        m[d.id] = {
          ...docData,
          heartRate: docData.heartRate,
          bpm: docData.heartRate,
          o2: docData.o2,
          temp: docData.temp,
          humidity: docData.humidity,
          isEmergency: docData.isEmergency,
          fingerDetected: docData.fingerDetected !== false,
          leadsOff: docData.leadsOff === true,
          lastSeen: docData.timestamp ? Date.parse(docData.timestamp) : Date.now()
        } as VitalsRecord; 
      });
      setVitalsMap(prev => ({ ...prev, ...m }));
    });
    const unsubR = onValue(ref(rtdb, '/users'), snapshot => {
      if (!snapshot.exists()) return;
      const data = snapshot.val();
      const rtdbV: Record<string, VitalsRecord> = {};
      Object.keys(data).forEach(uid => {
        const node = data[uid];
        const live = node.liveReading || node.livereading || node;
        if (!live) return;
        const validated = validateSensorPacket({ ...live, timestamp: live.timestamp || Date.now() });
        if (validated.isValid) {
          rtdbV[uid] = {
            heartRate: validated.heartRate, bpm: validated.heartRate,
            o2: validated.o2, temp: validated.temp, humidity: validated.humidity,
            isEmergency: live.isEmergency === true || validated.heartRate > 140 || (validated.o2 > 0 && validated.o2 < 90),
            fingerDetected: live.fingerDetected !== false && validated.heartRate > 0 && validated.o2 > 0,
            leadsOff: live.leadsOff === true,
            lastSeen: Date.now()
          };
        }
      });
      setVitalsMap(prev => ({ ...prev, ...rtdbV }));
    });
    const qA = query(collection(db, 'emergencyAlerts'), orderBy('detectedAt', 'desc'), limit(20));
    const unsubA = onSnapshot(qA, snap => {
      const a = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAlerts(a);
      setNotifCount(a.filter((al: any) => !al.acknowledged).length);
      const activeEmergency = a.find((al: any) => al.status !== 'RESOLVED' && !al.acknowledged && al.emergency);
      setActiveEmergencyAlert(activeEmergency || null);
    });

    const handleTelemetry = (e: Event) => {
      const { patientId, data } = (e as CustomEvent).detail;
      setVitalsMap(prev => ({
        ...prev,
        [patientId]: {
          heartRate: data.bpm,
          bpm: data.bpm,
          o2: data.spo2,
          temp: data.temperature,
          humidity: data.humidity,
          isEmergency: data.alertLevel === 3,
          fingerDetected: data.fingerDetected,
          leadsOff: data.leadsOff,
          lastSeen: Date.now()
        }
      }));
    };
    window.addEventListener('heartsync-telemetry', handleTelemetry);

    return () => { 
      unsubP(); 
      unsubV(); 
      unsubA(); 
      unsubR(); 
      window.removeEventListener('heartsync-telemetry', handleTelemetry);
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!isSimulating || !selectedId) return;
    const stop = startIoTSimulation(selectedId);
    return () => stop();
  }, [isSimulating, selectedId]);

  const selectedPatient = useMemo(() => patients.find(p => p.id === selectedId), [patients, selectedId]);
  const selectedVitals = useMemo(() => vitalsMap[selectedId || ''], [vitalsMap, selectedId]);
  const aiAnalysis = useMemo(() => getAIAnalysis(selectedVitals), [selectedVitals]);
  const selectedStatus = useMemo(() => getPatientStatus(selectedVitals), [selectedVitals]);
  const ss = STATUS[selectedStatus];

  const stats = useMemo(() => {
    let online = 0, critical = 0, warning = 0, stable = 0;
    patients.forEach(p => {
      const v = vitalsMap[p.id];
      if (!v || !(v.heartRate || v.bpm)) return;
      online++;
      const s = getPatientStatus(v);
      if (s === 'critical') critical++; else if (s === 'warning') warning++; else stable++;
    });
    return { online, critical, warning, stable };
  }, [patients, vitalsMap]);

  const filteredPatients = useMemo(() =>
    !searchQ ? patients : patients.filter(p =>
      (p.displayName || p.fullName || '').toLowerCase().includes(searchQ.toLowerCase())
    ), [patients, searchQ]);

  const timeline = useMemo(() => {
    const items: { time: string; text: string; color: string }[] = [];
    alerts.slice(0, 4).forEach((a: any) => {
      const t = a.detectedAt ? new Date(a.detectedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--';
      items.push({ time: t, text: a.message || 'Emergency alert detected', color: '#ef4444' });
    });
    const base = currentTime.getTime();
    const fmt = (ms: number) => new Date(ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    if (items.length < 4) items.push({ time: fmt(base - 60000), text: 'Abnormal rhythm detected', color: '#ef4444' });
    if (items.length < 4) items.push({ time: fmt(base - 300000), text: 'Heart rate elevated', color: '#f59e0b' });
    if (items.length < 4) items.push({ time: fmt(base - 900000), text: 'ECG monitoring started', color: '#3b82f6' });
    if (items.length < 4) items.push({ time: fmt(base - 1800000), text: 'Device connected', color: '#22c55e' });
    return items.slice(0, 4);
  }, [alerts, currentTime]);

  const isDeviceConnected = useMemo(() => {
    if (!selectedVitals) return false;
    if (isSimulating) return true;
    if (selectedVitals.lastSeen) {
      return Date.now() - selectedVitals.lastSeen < 6000;
    }
    if (selectedVitals.timestamp) {
      const ts = typeof selectedVitals.timestamp === 'string' ? Date.parse(selectedVitals.timestamp) : selectedVitals.timestamp;
      return Date.now() - ts < 10000;
    }
    return true;
  }, [selectedVitals, isSimulating]);

  const fingerDetected = selectedVitals?.fingerDetected !== false;
  const leadsOff = selectedVitals?.leadsOff === true;

  const hr = isDeviceConnected && fingerDetected ? (selectedVitals?.heartRate || selectedVitals?.bpm) : 0;
  const o2 = isDeviceConnected && fingerDetected ? selectedVitals?.o2 : 0;
  const temp = isDeviceConnected ? selectedVitals?.temp : 0;
  const respRate = isDeviceConnected && fingerDetected && hr ? Math.max(12, Math.round(12 + (hr - 70) * 0.15)) : null;
  const bpSys = isDeviceConnected && fingerDetected && hr ? Math.min(180, Math.max(100, Math.round(110 + (hr - 70) * 0.5))) : null;
  const bpDia = bpSys ? Math.round(bpSys * 0.65) : null;
  const ecgPath = useECGPath(!isPaused && (isSimulating || (isDeviceConnected && !!selectedVitals)));

  const handleEmergency = useCallback(async () => {
    if (!selectedPatient) return;
    try {
      await addDoc(collection(db, 'emergencyAlerts'), {
        patientId: selectedId,
        patientName: selectedPatient.displayName || selectedPatient.fullName || 'Unknown',
        doctorId: user?.uid, severity: 'critical',
        message: 'Doctor initiated emergency — immediate intervention required',
        detectedAt: new Date().toISOString(), acknowledged: false, type: 'manual_emergency'
      });
      setShowEmergencyModal(false);
    } catch (e) { console.error(e); }
  }, [selectedPatient, selectedId, user]);

  const handleAcknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      await updateDoc(doc(db, 'emergencyAlerts', alertId), {
        acknowledged: true,
        status: 'RESOLVED',
        verifiedAt: new Date().toISOString(),
        verifiedBy: user?.uid
      });
      setActiveEmergencyAlert(null);
    } catch (e) { console.error(e); }
  }, [user]);

  return (
    <div className="flex h-screen bg-[#0B1120] text-white overflow-hidden">
      {/* Real-time Emergency Alert Banner */}
      <AnimatePresence>
        {activeEmergencyAlert && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] max-w-2xl w-full px-4"
          >
            <div className="bg-[#1e1b1b] border-2 border-red-500 rounded-3xl p-5 shadow-2xl shadow-red-500/10 flex flex-col md:flex-row items-center gap-4 relative overflow-hidden animate-pulse">
              <div className="w-12 h-12 bg-red-500/20 rounded-2xl flex items-center justify-center shrink-0 border border-red-500/40 relative">
                <AlertCircle className="w-6 h-6 text-red-500 animate-bounce" />
                <span className="absolute inset-0 border border-red-500 rounded-2xl animate-ping opacity-75" />
              </div>
              
              <div className="flex-1 min-w-0 text-center md:text-left">
                <div className="flex items-center gap-2 justify-center md:justify-start">
                  <span className="text-[10px] font-black uppercase tracking-widest text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">Critical Patient Alert</span>
                  <span className="text-[10px] text-slate-500 font-bold">{new Date(activeEmergencyAlert.detectedAt).toLocaleTimeString()}</span>
                </div>
                <h4 className="text-sm font-black text-white mt-1">
                  Patient {patients.find(p => p.id === activeEmergencyAlert.patientId)?.displayName || patients.find(p => p.id === activeEmergencyAlert.patientId)?.fullName || activeEmergencyAlert.patientName} is in Danger!
                </h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  <span className="font-bold text-slate-200">AI Summary Rhythm Report:</span> Possible Atrial Fibrillation / High Risk Cardiac Event detected. Vitals at trigger: <span className="font-black text-red-400">{activeEmergencyAlert.vitalsAtTrigger?.heartRate || '--'} BPM</span>, <span className="font-black text-blue-400">{activeEmergencyAlert.vitalsAtTrigger?.spo2 || '--'}% SpO₂</span>. Immediate clinical review required!
                </p>
              </div>

              <div className="flex flex-row md:flex-col gap-2 shrink-0 w-full md:w-auto">
                <button 
                  onClick={() => {
                    setSelectedId(activeEmergencyAlert.patientId);
                    setShowEmergencyModal(true);
                  }}
                  className="flex-1 md:w-32 py-2 bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-red-500/20"
                >
                  Triage Unit
                </button>
                <button 
                  onClick={() => handleAcknowledgeAlert(activeEmergencyAlert.id)}
                  className="flex-1 md:w-32 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-white/5"
                >
                  Acknowledge
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] lg:hidden" />
        )}
      </AnimatePresence>

      {/* Emergency Modal */}
      <AnimatePresence>
        {showEmergencyModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
              className="bg-[#1E293B] border border-red-500/30 rounded-3xl p-8 max-w-sm w-full shadow-2xl">
              <div className="w-14 h-14 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Ambulance className="w-7 h-7 text-red-400" />
              </div>
              <h3 className="text-lg font-black text-white text-center mb-2">Confirm Emergency Alert</h3>
              <p className="text-xs text-slate-400 text-center mb-6 leading-relaxed">
                This will immediately notify emergency services for{' '}
                <span className="text-white font-bold">{selectedPatient?.displayName || selectedPatient?.fullName || 'this patient'}</span>.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowEmergencyModal(false)}
                  className="flex-1 py-3 bg-[#0B1120] border border-white/10 text-slate-300 text-xs font-black rounded-xl hover:bg-white/5 transition-colors">
                  Cancel
                </button>
                <button onClick={handleEmergency}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white text-xs font-black rounded-xl transition-colors">
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <DoctorSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} alertCount={notifCount} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* TOP HEADER */}
        <header className="h-16 bg-[#111827] border-b border-white/[0.06] px-4 lg:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-400 hover:text-white transition-colors shrink-0">
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-black text-white tracking-tight leading-none">Doctor Dashboard</h1>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mt-0.5">Monitor patients in real-time</p>
            </div>
          </div>

          <div className="hidden xl:flex items-center gap-2 flex-1 justify-center">
            <StatPill icon={Users} value={stats.online} label="Patients Online" color="bg-green-500/10 text-green-400 border-green-500/20" />
            <StatPill icon={AlertCircle} value={stats.critical} label="Critical Cases" color="bg-red-500/10 text-red-400 border-red-500/20" />
            <StatPill icon={Activity} value={stats.warning} label="Moderate Risk" color="bg-orange-500/10 text-orange-400 border-orange-500/20" />
            <StatPill icon={ShieldCheck} value={stats.stable} label="Stable" color="bg-teal-500/10 text-teal-400 border-teal-500/20" />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-2 bg-[#1E293B] rounded-xl border border-white/5 cursor-pointer hover:bg-white/5 transition-colors">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] font-bold text-slate-300">City Heart Hospital</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </div>
            <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-slate-500">
              <Clock className="w-3 h-3" />
              {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <button className="relative p-2.5 bg-[#1E293B] rounded-xl border border-white/5 hover:bg-white/5 transition-colors">
              <Bell className="w-4 h-4 text-slate-400" />
              {notifCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[8px] font-black flex items-center justify-center">
                  {notifCount}
                </span>
              )}
            </button>
            <button onClick={() => navigate('/doctor/profile')} className="p-2.5 bg-[#1E293B] rounded-xl border border-white/5 hover:bg-white/5 transition-colors">
              <Settings className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </header>

        {/* BODY: 3 columns */}
        <div className="flex-1 flex overflow-hidden">

          {/* PATIENT LIST */}
          <div className="w-[280px] shrink-0 bg-[#111827] border-r border-white/[0.06] flex flex-col overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-white/[0.06] shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-black text-white">
                  Patient List <span className="text-slate-600 font-bold">({patients.length})</span>
                </h3>
                <button className="p-1.5 bg-[#1E293B] rounded-lg border border-white/5 hover:bg-white/5 transition-colors">
                  <Filter className="w-3 h-3 text-slate-400" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" />
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search patients..."
                  className="w-full pl-8 pr-3 py-2 bg-[#1E293B] border border-white/[0.06] rounded-xl text-[11px] text-white placeholder-slate-600 outline-none focus:border-accent-maroon/40 transition-colors font-medium" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
              {loading ? (
                Array(6).fill(0).map((_, i) => <div key={i} className="h-[76px] bg-[#1E293B]/40 rounded-2xl animate-pulse" />)
              ) : filteredPatients.length === 0 ? (
                <div className="py-16 text-center">
                  <Users className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                  <p className="text-[11px] font-bold text-slate-600">No patients found</p>
                </div>
              ) : filteredPatients.map(patient => {
                const v = vitalsMap[patient.id];
                const pStatus = getPatientStatus(v);
                const ps = STATUS[pStatus];
                const isActive = patient.id === selectedId;
                const pHR = v?.heartRate || v?.bpm;
                const pO2 = v?.o2;
                return (
                  <motion.button key={patient.id} onClick={() => setSelectedId(patient.id)} whileHover={{ x: 2 }}
                    className={`w-full text-left p-3 rounded-2xl transition-all border ${isActive
                      ? 'bg-accent-maroon/15 border-accent-maroon/30'
                      : 'bg-[#1E293B]/30 border-white/[0.04] hover:bg-[#1E293B]/70 hover:border-white/10'
                    }`}>
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 overflow-hidden flex items-center justify-center text-white font-black text-sm border border-white/10">
                          {patient.photoURL
                            ? <img src={patient.photoURL} alt="" className="w-full h-full object-cover" />
                            : (patient.displayName || patient.fullName || 'P').charAt(0).toUpperCase()}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#111827] ${ps.dot}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p className="text-[11px] font-black text-white truncate">{patient.displayName || patient.fullName || 'Patient'}</p>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${ps.badge}`}>{ps.label}</span>
                        </div>
                        <p className="text-[9px] text-slate-600 font-bold">HS-{patient.id.slice(-4).toUpperCase()} • {patient.age ? `${patient.age} yrs` : '--'}</p>
                        <div className="flex items-center gap-3 mt-1">
                          {pHR && <span className="flex items-center gap-1 text-[9px] font-black text-red-400"><HeartPulse className="w-2.5 h-2.5" />{pHR} BPM</span>}
                          {pO2 && <span className="flex items-center gap-1 text-[9px] font-black text-blue-400"><Droplets className="w-2.5 h-2.5" />{pO2}%</span>}
                          {!pHR && !pO2 && <span className="text-[9px] text-slate-700 font-bold">Offline</span>}
                        </div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* CENTER: ECG + VITALS */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0B1120] min-w-0">
            {/* ECG Header */}
            <div className="px-5 pt-4 pb-2 flex items-center justify-between gap-3 shrink-0">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-black text-white leading-tight">
                    {selectedPatient?.displayName || selectedPatient?.fullName || 'No Patient Selected'}
                    {selectedPatient && (
                      <span className="text-slate-600 font-bold text-xs ml-2">(HS-{selectedId?.slice(-4).toUpperCase()})</span>
                    )}
                  </h2>
                  {selectedPatient && <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${ss.badge}`}>{ss.label}</span>}
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-green-400">
                    <div className={`w-1.5 h-1.5 rounded-full ${isDeviceConnected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
                    {isDeviceConnected ? 'Connected' : 'Offline'}
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400">
                    <Wifi className="w-3 h-3" />Signal: {isDeviceConnected ? 'Excellent' : 'Waiting'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!isSimulating
                  ? <button onClick={() => setIsSimulating(true)} className="px-3 py-1.5 bg-accent-maroon/20 border border-accent-maroon/30 text-accent-maroon text-[9px] font-black rounded-xl hover:bg-accent-maroon/30 transition-colors">Simulate Device</button>
                  : <button onClick={() => setIsSimulating(false)} className="px-3 py-1.5 bg-slate-800 border border-white/10 text-slate-400 text-[9px] font-black rounded-xl hover:bg-white/5 transition-colors">Stop Sim</button>
                }
                <button className="p-2 bg-[#1E293B] rounded-xl border border-white/5 hover:bg-white/5 transition-colors">
                  <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* ECG Chart */}
            <div className="mx-5 relative overflow-hidden rounded-2xl border border-white/[0.06]"
              style={{ height: 200, backgroundColor: '#050c18' }}>
              <div className="absolute inset-0" style={{
                backgroundImage: 'linear-gradient(rgba(239,68,68,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(239,68,68,0.04) 1px, transparent 1px)',
                backgroundSize: '25px 25px'
              }} />
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 504 100" preserveAspectRatio="none">
                {ecgPath && isDeviceConnected && !leadsOff
                  ? <path d={ecgPath} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ filter: 'drop-shadow(0 0 5px rgba(239,68,68,0.7))' }} />
                  : <line x1="0" y1="50" x2="504" y2="50" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="4,4" opacity="0.3" />
                }
              </svg>
              {leadsOff && isDeviceConnected && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-[1.5px] pointer-events-none">
                  <div className="bg-[#1E293B] border border-amber-500/30 rounded-xl px-4 py-2 text-amber-400 font-black text-[10px] tracking-wider uppercase font-mono animate-pulse">
                    ⚠️ Leads Off — Attach ECG Electrodes
                  </div>
                </div>
              )}
              {!isDeviceConnected && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-[1.5px] pointer-events-none">
                  <div className="bg-[#1E293B] border border-red-500/30 rounded-xl px-4 py-2 text-red-500 font-black text-[10px] tracking-wider uppercase font-mono animate-pulse">
                    ⚠️ DEVICE OFFLINE
                  </div>
                </div>
              )}
              <div className="absolute top-2 left-4 flex gap-5 text-[8px] font-black text-slate-700 select-none">
                <span>P</span><span>Q</span><span className="text-red-700">R</span><span>S</span><span>T</span>
              </div>
              <div className="absolute top-2 right-3 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                <span className="text-[8px] font-black text-red-400 font-mono">LIVE ECG</span>
              </div>
              <div className="absolute bottom-2 left-4 text-[8px] font-black text-slate-700 font-mono">
                25 mm/s &nbsp;&nbsp; 10 mm/mV &nbsp;&nbsp; 500 Hz
              </div>
              <div className="absolute bottom-2 right-3 text-[8px] font-bold text-slate-700">{currentTime.toLocaleTimeString()}</div>
            </div>

            {/* ECG Controls */}
            <div className="flex items-center justify-center gap-2 mt-3 shrink-0">
              <button className="p-2 bg-[#1E293B] rounded-xl border border-white/5 hover:bg-white/5 transition-colors"><ZoomOut className="w-3.5 h-3.5 text-slate-500" /></button>
              <button className="p-2 bg-[#1E293B] rounded-xl border border-white/5 hover:bg-white/5 transition-colors"><SkipBack className="w-3.5 h-3.5 text-slate-500" /></button>
              <button onClick={() => setIsPaused(p => !p)}
                className="p-3 bg-accent-maroon rounded-xl hover:bg-[#7f1d1d] transition-colors shadow-lg shadow-accent-maroon/20">
                {isPaused ? <Play className="w-4 h-4 text-white" /> : <Pause className="w-4 h-4 text-white" />}
              </button>
              <button className="p-2 bg-[#1E293B] rounded-xl border border-white/5 hover:bg-white/5 transition-colors"><SkipForward className="w-3.5 h-3.5 text-slate-500" /></button>
              <button className="p-2 bg-[#1E293B] rounded-xl border border-white/5 hover:bg-white/5 transition-colors"><ZoomIn className="w-3.5 h-3.5 text-slate-500" /></button>
              <button className="p-2 bg-[#1E293B] rounded-xl border border-white/5 hover:bg-white/5 transition-colors"><Maximize2 className="w-3.5 h-3.5 text-slate-500" /></button>
            </div>

            {/* Live Vitals */}
            <div className="mx-5 mt-4 shrink-0">
              <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-2">Live Vitals</p>
              <div className="flex gap-2">
                <VitalBox icon={HeartPulse} value={isDeviceConnected ? (fingerDetected ? hr : 'Place finger') : '--'} unit={isDeviceConnected && fingerDetected ? "BPM" : ""} label="Heart Rate" color="text-red-400"
                  sub={isDeviceConnected ? (fingerDetected ? (hr > 100 ? 'Elevated' : 'Normal range') : 'Place finger on sensor') : 'Device Offline'} />
                <VitalBox icon={Droplets} value={isDeviceConnected ? (fingerDetected ? `${o2}` : 'Place finger') : '--'} unit={isDeviceConnected && fingerDetected ? "%" : ""} label="SpO₂" color="text-blue-400"
                  sub={isDeviceConnected ? (fingerDetected ? (o2 < 95 ? 'Below Normal' : 'Oxygen Stable') : 'Place finger on sensor') : 'Device Offline'} />
                <VitalBox icon={Thermometer} value={isDeviceConnected ? (temp ? temp.toFixed(1) : 'No reading') : '--'} unit={isDeviceConnected && temp ? "°C" : ""} label="Temperature" color="text-orange-400"
                  sub={isDeviceConnected ? (temp ? (temp > 38 ? 'Elevated' : 'Body Normal') : 'No reading') : 'Device Offline'} />
                <VitalBox icon={Activity} value={isDeviceConnected ? (fingerDetected && bpSys && bpDia ? `${bpSys}/${bpDia}` : 'No reading') : '--'} unit={isDeviceConnected && fingerDetected && bpSys ? "mmHg" : ""} label="Blood Pressure" color="text-violet-400"
                  sub={isDeviceConnected ? (fingerDetected ? 'Sys/Dia' : 'No reading') : 'Device Offline'} />
                <VitalBox icon={Wind} value={isDeviceConnected ? (fingerDetected && respRate ? respRate : 'No reading') : '--'} unit="" label="Resp Rate" color="text-teal-400"
                  sub={isDeviceConnected ? (fingerDetected ? 'Breaths/min' : 'No reading') : 'Device Offline'} />
              </div>
            </div>

            <div className="mx-5 mt-3 flex items-center justify-between text-[8px] font-bold text-slate-700">
              <span>Last Updated: {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              <span className="flex items-center gap-1 text-green-700">
                <div className="w-1 h-1 bg-green-600 rounded-full animate-pulse" />Live Monitoring
              </span>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="w-[300px] shrink-0 bg-[#111827] border-l border-white/[0.06] overflow-y-auto no-scrollbar">
            <div className="p-4 space-y-4">

              {/* AI Analysis */}
              <div className="bg-[#1E293B] rounded-2xl border border-white/[0.06] p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-accent-maroon" />
                    <span className="text-[10px] font-black text-white uppercase tracking-wider">AI Analysis</span>
                  </div>
                  <span className="text-[8px] font-black px-2 py-1 rounded-lg border"
                    style={{ backgroundColor: aiAnalysis.riskColor + '20', color: aiAnalysis.riskColor, borderColor: aiAnalysis.riskColor + '30' }}>
                    {aiAnalysis.risk}
                  </span>
                </div>

                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[8px] font-black text-slate-600 uppercase tracking-wider mb-1">Detected Rhythm</p>
                    <p className="text-xs font-black leading-tight" style={{ color: aiAnalysis.riskColor }}>{aiAnalysis.rhythm}</p>
                  </div>
                  <div className="relative w-14 h-14 shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="13" fill="none" stroke="#1a2744" strokeWidth="3.5" />
                      <circle cx="18" cy="18" r="13" fill="none" stroke={aiAnalysis.riskColor} strokeWidth="3.5"
                        strokeDasharray={`${(aiAnalysis.confidence / 100) * 81.7} 81.7`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-sm font-black text-white leading-none">{aiAnalysis.confidence || '--'}</span>
                      <span className="text-[7px] text-slate-500 font-bold">%</span>
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-[8px] font-black text-slate-600 uppercase tracking-wider mb-1.5">Reasons</p>
                  <ul className="space-y-1">
                    {aiAnalysis.reasons.map((r: string, i: number) => (
                      <li key={i} className="flex items-start gap-1.5 text-[10px] text-slate-400 font-medium leading-tight">
                        <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: aiAnalysis.riskColor }} />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mb-4 p-3 bg-[#0B1120] rounded-xl border border-white/5">
                  <p className="text-[8px] font-black text-slate-600 uppercase tracking-wider mb-1">Recommendation</p>
                  <p className="text-[10px] text-slate-300 font-medium leading-relaxed">{aiAnalysis.recommendation}</p>
                </div>

                <div className="space-y-2">
                  <button onClick={() => setShowEmergencyModal(true)}
                    className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white text-[10px] font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20">
                    <Ambulance className="w-3.5 h-3.5" /> Notify Emergency
                  </button>
                  <button onClick={() => navigate('/doctor/alerts')}
                    className="w-full py-2.5 bg-[#0B1120] border border-white/10 text-slate-300 text-[10px] font-black rounded-xl hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
                    <FileText className="w-3.5 h-3.5" /> View Full Report
                  </button>
                </div>
              </div>

              {/* Patient Information */}
              <div className="bg-[#1E293B] rounded-2xl border border-white/[0.06] p-4">
                <h4 className="text-[10px] font-black text-white uppercase tracking-wider mb-3">Patient Information</h4>
                {selectedPatient ? (
                  <div>
                    <InfoRow label="Age / Gender" value={`${selectedPatient.age || '--'} / ${selectedPatient.gender || '--'}`} />
                    <InfoRow label="Blood Group" value={selectedPatient.bloodGroup || '--'} />
                    <InfoRow label="Contact" value={selectedPatient.phone || '+-- --- -------'} />
                    <InfoRow label="Emergency Contact" value={selectedPatient.emergencyContact || selectedPatient.emergencyPhone || '--'} />
                    <InfoRow label="Device" value="ESP32 HeartSync" />
                    <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Battery</p>
                      <div className="flex items-center gap-2">
                        <div className="w-14 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: '92%' }} />
                        </div>
                        <span className="text-[10px] font-black text-green-400">92%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Last Updated</p>
                      <p className="text-[10px] font-bold text-slate-200">
                        {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-[11px] text-slate-600 font-bold">Select a patient to view info</p>
                  </div>
                )}
              </div>

              {/* Clinical Timeline */}
              <div className="bg-[#1E293B] rounded-2xl border border-white/[0.06] p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[10px] font-black text-white uppercase tracking-wider">Clinical Timeline</h4>
                  <button onClick={() => navigate('/doctor/alerts')}
                    className="text-[9px] font-black text-accent-maroon hover:underline">View All</button>
                </div>
                <div className="space-y-3">
                  {timeline.map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <div className="w-2 h-2 rounded-full mt-0.5" style={{ backgroundColor: item.color }} />
                        {i < timeline.length - 1 && <div className="w-px h-4 bg-white/[0.06]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-slate-300 leading-tight">{item.text}</p>
                        <p className="text-[8px] text-slate-600 font-bold mt-0.5">{item.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;
