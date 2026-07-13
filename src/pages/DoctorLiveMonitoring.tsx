import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Search, 
  AlertCircle, 
  ArrowRight,
  TrendingUp,
  HeartPulse,
  Thermometer,
  Zap,
  Globe,
  Loader2,
  Menu
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DoctorSidebar from '../components/DoctorSidebar';

const DoctorLiveMonitoring = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<any[]>([]);
  const [vitalsMap, setVitalsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    // 1. Fetch Approved Patients
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'patient'),
      where('status', '==', 'approved')
    );

    const unsubscribePatients = onSnapshot(q, (snap) => {
      const patientDocs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPatients(patientDocs);
      setLoading(false);
    });

    // 2. Listen to ALL liveHealthMetrics
    const unsubscribeVitals = onSnapshot(collection(db, 'liveHealthMetrics'), (snap) => {
      const metrics: Record<string, any> = {};
      snap.forEach(doc => {
        metrics[doc.id] = doc.data();
      });
      setVitalsMap(metrics);
    });

    return () => {
      unsubscribePatients();
      unsubscribeVitals();
    };
  }, []);

  const criticalPatients = patients.filter(p => vitalsMap[p.id]?.isEmergency);
  const stablePatients = patients.filter(p => !vitalsMap[p.id]?.isEmergency);

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
      <title>Live Telemetry | HeartSync</title>
      
      {/* MOBILE OVERLAY */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[80] lg:hidden"
          />
        )}
      </AnimatePresence>

      <DoctorSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-20 md:h-24 bg-white border-b border-slate-200 px-6 md:px-12 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
             <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-400 hover:text-accent-maroon transition-all">
                <Menu className="w-6 h-6" />
             </button>
             <div>
               <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter italic">Live Telemetry</h2>
               <p className="hidden md:block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">Real-time Biometric Stream Processing</p>
             </div>
          </div>
          
          <div className="flex items-center gap-3 md:gap-6">
             <div className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-slate-900 rounded-lg md:rounded-xl">
                <div className="w-1.5 md:w-2 h-1.5 md:h-2 bg-medical-red rounded-full animate-pulse" />
                <span className="text-[8px] md:text-[9px] font-black text-white uppercase tracking-widest shrink-0">Live Sync</span>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-12 no-scrollbar">
           <div className="max-w-7xl mx-auto space-y-10 md:space-y-12">
              
              {/* CRITICAL ALERTS SECTION */}
              <AnimatePresence>
                {criticalPatients.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-6"
                  >
                     <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-accent-maroon" />
                        <h3 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-[0.15em] md:tracking-[0.2em]">Immediate Action Required</h3>
                        <div className="flex-1 h-px bg-slate-200" />
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                        {criticalPatients.map((p) => (
                          <CriticalCard 
                            key={p.id} 
                            patient={p} 
                            vitals={vitalsMap[p.id]} 
                            onClick={() => navigate(`/doctor/patient/${p.id}`)} 
                          />
                        ))}
                     </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* STABLE FEED SECTION */}
              <div className="space-y-6 md:space-y-8">
                 <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                       <Zap className="w-5 h-5 text-green-500" />
                       <h3 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-[0.15em] md:tracking-[0.2em]">Stream Nodes</h3>
                    </div>
                    <div className="px-3 md:px-4 py-1.5 md:py-2 bg-white rounded-xl border border-slate-100 shadow-sm text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0 text-center">
                       {stablePatients.length} Connected
                    </div>
                 </div>

                 <div className="bg-white rounded-[32px] md:rounded-[48px] border border-slate-100 shadow-premium overflow-hidden">
                    <div className="overflow-x-auto">
                       <table className="w-full text-left border-collapse">
                          <thead>
                             <tr className="bg-slate-50/50">
                                <th className="px-6 md:px-10 py-5 md:py-6 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Patient Identity</th>
                                <th className="px-6 md:px-10 py-5 md:py-6 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Cardiac Status</th>
                                <th className="px-6 md:px-10 py-5 md:py-6 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Oxygen Sat.</th>
                                <th className="px-6 md:px-10 py-5 md:py-6 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Core Temp</th>
                                <th className="px-6 md:px-10 py-5 md:py-6 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Link</th>
                             </tr>
                          </thead>
                          <tbody>
                             {loading ? (
                                <tr>
                                   <td colSpan={5} className="py-16 md:py-20 text-center">
                                      <Loader2 className="w-8 md:w-10 h-8 md:h-10 text-slate-200 animate-spin mx-auto mb-4" />
                                      <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Scanning Grid Nodes...</p>
                                   </td>
                                </tr>
                             ) : stablePatients.map((p) => {
                                const v = vitalsMap[p.id];
                                return (
                                  <tr 
                                    key={p.id} 
                                    onClick={() => navigate(`/doctor/patient/${p.id}`)}
                                    className="group border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-all cursor-pointer"
                                  >
                                     <td className="px-6 md:px-10 py-5 md:py-6 min-w-[200px]">
                                        <div className="flex items-center gap-3 md:gap-4">
                                           <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-900 rounded-xl md:rounded-2xl flex items-center justify-center text-white font-black overflow-hidden shadow-lg shrink-0">
                                              {p.photoURL ? <img src={p.photoURL} alt="" className="w-full h-full object-cover" /> : p.displayName?.charAt(0)}
                                           </div>
                                           <div className="min-w-0">
                                              <p className="text-sm font-black text-slate-900 tracking-tight italic truncate">{p.displayName || 'Active Node'}</p>
                                              <p className="text-[8px] md:text-[9px] font-black text-green-500 uppercase tracking-widest">Signal Locked</p>
                                           </div>
                                        </div>
                                     </td>
                                     <td className="px-6 md:px-10 py-5 md:py-6 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                           <HeartPulse className="w-4 h-4 text-accent-maroon opacity-40" />
                                           <span className="font-black text-slate-900 italic text-sm md:text-base">{v?.heartRate || '--'} <span className="text-[9px] md:text-[10px] font-bold text-slate-400 not-italic uppercase">BPM</span></span>
                                        </div>
                                     </td>
                                     <td className="px-6 md:px-10 py-5 md:py-6 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                           <Activity className="w-4 h-4 text-blue-400 opacity-40" />
                                           <span className="font-black text-slate-900 italic text-sm md:text-base">{v?.o2 || '--'} <span className="text-[9px] md:text-[10px] font-bold text-slate-400 not-italic">%</span></span>
                                        </div>
                                     </td>
                                     <td className="px-6 md:px-10 py-5 md:py-6 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                           <Thermometer className="w-4 h-4 text-amber-400 opacity-40" />
                                           <span className="font-black text-slate-900 italic text-sm md:text-base">{v?.temp?.toFixed(1) || '--'} <span className="text-[9px] md:text-[10px] font-bold text-slate-400 not-italic uppercase">°C</span></span>
                                        </div>
                                     </td>
                                     <td className="px-6 md:px-10 py-5 md:py-6">
                                        <button className="p-2.5 md:p-3 bg-white border border-slate-100 text-slate-400 rounded-xl group-hover:bg-accent-maroon group-hover:text-white group-hover:border-accent-maroon transition-all">
                                           <ArrowRight className="w-4 h-4" />
                                        </button>
                                     </td>
                                  </tr>
                                );
                             })}
                             {!loading && stablePatients.length === 0 && (
                               <tr>
                                  <td colSpan={5} className="py-16 text-center">
                                     <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">No active stream nodes detected</p>
                                  </td>
                               </tr>
                             )}
                          </tbody>
                       </table>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </main>
    </div>
  );
};

const CriticalCard = ({ patient, vitals, onClick }: any) => (
  <motion.div 
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className="bg-white rounded-[40px] border-4 border-accent-maroon/20 shadow-2xl p-8 cursor-pointer group relative overflow-hidden"
  >
     <div className="absolute top-0 left-0 w-full h-1 bg-accent-maroon" />
     <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
           <div className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center text-white text-2xl font-black overflow-hidden shadow-2xl border-4 border-accent-maroon/10">
              {patient.photoURL ? <img src={patient.photoURL} alt="" className="w-full h-full object-cover" /> : patient.displayName?.charAt(0)}
           </div>
           <div>
              <h4 className="text-xl font-black text-slate-900 italic tracking-tighter">{patient.displayName}</h4>
              <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                 <span className="text-[9px] font-black text-accent-maroon uppercase tracking-widest">Abnormal Vitals Detected</span>
              </div>
           </div>
        </div>
        <div className="text-right">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Impact Level</p>
           <span className="px-3 py-1 bg-accent-maroon text-white text-[9px] font-black uppercase tracking-widest rounded-lg">Critical</span>
        </div>
     </div>

     <div className="grid grid-cols-2 gap-6 pt-8 border-t border-slate-50">
        <div className="p-4 bg-accent-maroon/5 rounded-2xl border border-accent-maroon/10">
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Heart Rate</p>
           <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-accent-maroon">{vitals?.heartRate}</span>
              <span className="text-[10px] font-bold text-slate-400">BPM</span>
           </div>
        </div>
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-accent-maroon transition-all group-hover:text-white flex items-center justify-between">
           <div className="group-hover:text-white">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-white/60">Oxygen</p>
              <p className="text-xl font-black italic">{vitals?.o2}%</p>
           </div>
           <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0" />
        </div>
     </div>
  </motion.div>
);

export default DoctorLiveMonitoring;
