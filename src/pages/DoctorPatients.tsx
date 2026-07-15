import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, Search, Filter, ArrowRight, Activity,
  HeartPulse, Droplets, Thermometer, Menu, AlertCircle, ShieldCheck
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

const STATUS_STYLE = {
  critical: { badge: 'bg-red-500/20 text-red-400 border-red-500/30', dot: 'bg-red-500', label: 'Critical' },
  warning:  { badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30', dot: 'bg-orange-500', label: 'Moderate' },
  stable:   { badge: 'bg-green-500/20 text-green-400 border-green-500/30', dot: 'bg-green-500', label: 'Stable' },
};

const DoctorPatients = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<any[]>([]);
  const [vitalsMap, setVitalsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const isDemo = localStorage.getItem('demo_mode') === 'doctor' || !db.app.options.apiKey || db.app.options.apiKey.includes('mock-api-key');

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
            isEmergency: isCritical
          };
        });
        setVitalsMap(prev => ({ ...prev, ...updatedVitals }));
      }, 1500);

      return () => clearInterval(interval);
    }

    const q = query(collection(db, 'users'), where('role', '==', 'patient'), where('status', '==', 'approved'));
    const unsubP = onSnapshot(q, snap => {
      setPatients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsubV = onSnapshot(collection(db, 'liveHealthMetrics'), snap => {
      const m: Record<string, any> = {};
      snap.forEach(d => { m[d.id] = d.data(); });
      setVitalsMap(prev => ({ ...prev, ...m }));
    });
    const unsubR = onValue(ref(rtdb, '/users'), snapshot => {
      if (!snapshot.exists()) return;
      const data = snapshot.val();
      const rtdbV: Record<string, any> = {};
      Object.keys(data).forEach(uid => {
        const live = data[uid]?.liveReading || data[uid]?.livereading || data[uid];
        if (!live) return;
        const v = validateSensorPacket({ ...live, timestamp: live.timestamp || Date.now() });
        if (v.isValid) {
          rtdbV[uid] = { heartRate: v.heartRate, bpm: v.heartRate, o2: v.o2, temp: v.temp,
            isEmergency: v.heartRate > 140 || (v.o2 > 0 && v.o2 < 90) };
        }
      });
      setVitalsMap(prev => ({ ...prev, ...rtdbV }));
    });
    return () => { unsubP(); unsubV(); unsubR(); };
  }, []);

  const filtered = useMemo(() =>
    search ? patients.filter(p => (p.displayName || p.fullName || '').toLowerCase().includes(search.toLowerCase())) : patients,
    [patients, search]);

  const criticalCount = useMemo(() => patients.filter(p => getStatus(vitalsMap[p.id]) === 'critical').length, [patients, vitalsMap]);
  const warningCount = useMemo(() => patients.filter(p => getStatus(vitalsMap[p.id]) === 'warning').length, [patients, vitalsMap]);
  const stableCount = useMemo(() => patients.filter(p => getStatus(vitalsMap[p.id]) === 'stable').length, [patients, vitalsMap]);
  const alertCount = criticalCount + warningCount;

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
              <h1 className="text-base font-black text-white tracking-tight leading-none">Patient Registry</h1>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mt-0.5">All assigned patients</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patients..."
                className="pl-9 pr-4 py-2 bg-[#1E293B] border border-white/[0.06] rounded-xl text-[11px] text-white placeholder-slate-600 outline-none focus:border-accent-maroon/40 w-48 font-medium" />
            </div>
            <button className="p-2.5 bg-[#1E293B] rounded-xl border border-white/5 hover:bg-white/5">
              <Filter className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Patients', value: patients.length, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
              { label: 'Critical', value: criticalCount, icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
              { label: 'Moderate Risk', value: warningCount, icon: Activity, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
              { label: 'Stable', value: stableCount, icon: ShieldCheck, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
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

          {/* Patient Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {loading ? (
              Array(8).fill(0).map((_, i) => <div key={i} className="h-60 bg-[#111827] rounded-2xl animate-pulse" />)
            ) : filtered.length === 0 ? (
              <div className="col-span-full py-20 text-center">
                <Search className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <p className="text-sm font-black text-slate-600">No patients found</p>
              </div>
            ) : filtered.map(patient => {
              const v = vitalsMap[patient.id];
              const status = getStatus(v);
              const ss = STATUS_STYLE[status];
              const hr = v?.heartRate || v?.bpm;
              const o2 = v?.o2;
              const temp = v?.temp;
              return (
                <motion.div key={patient.id} whileHover={{ y: -3 }}
                  onClick={() => navigate(`/doctor/patient/${patient.id}`)}
                  className="bg-[#111827] border border-white/[0.06] rounded-2xl p-5 cursor-pointer group hover:border-accent-maroon/20 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-white font-black text-lg border border-white/10 overflow-hidden">
                        {patient.photoURL
                          ? <img src={patient.photoURL} alt="" className="w-full h-full object-cover" />
                          : (patient.displayName || patient.fullName || 'P').charAt(0).toUpperCase()}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#111827] ${ss.dot}`} />
                    </div>
                    <span className={`text-[9px] font-black px-2 py-1 rounded-lg border ${ss.badge}`}>{ss.label}</span>
                  </div>
                  <h4 className="text-sm font-black text-white truncate">{patient.displayName || patient.fullName || 'Patient'}</h4>
                  <p className="text-[9px] text-slate-600 font-bold mt-0.5">HS-{patient.id.slice(-4).toUpperCase()} • {patient.age ? `${patient.age} yrs` : '--'} • {patient.gender || '--'}</p>

                  <div className="mt-4 pt-3 border-t border-white/[0.06] grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <p className="text-[8px] font-black text-slate-600 uppercase">HR</p>
                      <p className={`text-sm font-black ${hr ? 'text-red-400' : 'text-slate-700'}`}>{hr ?? '--'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] font-black text-slate-600 uppercase">SpO₂</p>
                      <p className={`text-sm font-black ${o2 ? 'text-blue-400' : 'text-slate-700'}`}>{o2 ? `${o2}%` : '--'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] font-black text-slate-600 uppercase">Temp</p>
                      <p className={`text-sm font-black ${temp ? 'text-orange-400' : 'text-slate-700'}`}>{temp ? `${Number(temp).toFixed(1)}°` : '--'}</p>
                    </div>
                  </div>

                  <button className="w-full mt-3 py-2 bg-[#1E293B] border border-white/5 text-slate-400 text-[9px] font-black rounded-xl group-hover:bg-accent-maroon/10 group-hover:border-accent-maroon/20 group-hover:text-accent-maroon transition-all flex items-center justify-center gap-1.5">
                    View Details <ArrowRight className="w-3 h-3" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorPatients;
