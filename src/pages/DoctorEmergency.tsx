import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Navigation, 
  ShieldAlert, 
  MapPin, 
  Clock, 
  Phone, 
  ArrowRight,
  Activity,
  HeartPulse,
  Search,
  Filter,
  CheckCircle2,
  Ambulance,
  AlertCircle,
  Menu
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, limit, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DoctorSidebar from '../components/DoctorSidebar';

const PlusIcon = (props: any) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const GridStat = ({ label, value }: any) => (
  <div className="flex justify-between items-center py-1">
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    <span className="text-xl font-black text-white italic">{value}</span>
  </div>
);

const DoctorEmergency = () => {
  const navigate = useNavigate();
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'ambulanceDispatch'),
      orderBy('dispatchedAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDispatches(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const activeDispatches = dispatches.filter(d => d.status !== 'COMPLETED');
  const completedDispatches = dispatches.filter(d => d.status === 'COMPLETED');

  return (
    <div className="flex h-screen bg-[#0B1120] text-white overflow-hidden">
      <title>Emergency Dispatch | HeartSync</title>
      
      {/* MOBILE OVERLAY */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] lg:hidden"
          />
        )}
      </AnimatePresence>

      <DoctorSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-[#111827] border-b border-white/[0.06] px-4 lg:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-400 hover:text-white transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-black text-white tracking-tight leading-none">Emergency Dispatch</h1>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mt-0.5">Institutional First Response Portal</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-xl">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">{activeDispatches.length} Active</span>
            </div>
            <button className="px-4 py-2 bg-accent-maroon text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl shadow-accent-maroon/20 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
              <PlusIcon className="w-3 h-3 shrink-0" />
              <span className="hidden sm:inline">Manual Dispatch</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5">
          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Active Units', value: activeDispatches.length, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: Ambulance },
              { label: 'Completed', value: completedDispatches.length, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', icon: CheckCircle2 },
              { label: 'Avg Response', value: '4m 20s', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: Clock },
            ].map(stat => (
              <div key={stat.label} className="bg-[#111827] rounded-2xl border border-white/[0.06] p-4 flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${stat.bg}`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{stat.label}</p>
                  <p className={`text-2xl font-black leading-tight ${stat.color}`}>{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Active Dispatches */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ambulance className="w-4 h-4 text-accent-maroon" />
                  <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Active Deployments</h3>
                </div>
                <span className="text-[9px] font-black px-2.5 py-1 rounded-lg bg-accent-maroon/10 text-accent-maroon border border-accent-maroon/20">
                  {activeDispatches.length} Units En Route
                </span>
              </div>

              <div className="space-y-3">
                {loading ? (
                  Array(2).fill(0).map((_, i) => (
                    <div key={i} className="h-40 bg-[#111827] rounded-2xl animate-pulse border border-white/[0.06]" />
                  ))
                ) : activeDispatches.length > 0 ? activeDispatches.map((dispatch) => (
                  <div key={dispatch.id} className="bg-[#111827] rounded-2xl border border-white/[0.06] p-5 group hover:border-accent-maroon/20 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-slate-800 rounded-xl flex items-center justify-center text-white font-black text-lg border border-white/10">
                          {dispatch.ambulanceId?.charAt(0) || 'A'}
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white">Unit {dispatch.ambulanceId || 'Alpha-1'}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="w-1.5 h-1.5 bg-accent-maroon rounded-full animate-pulse" />
                            <span className="text-[9px] font-black text-accent-maroon uppercase tracking-widest">
                              {dispatch.status?.replace('_', ' ') || 'Dispatched'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/doctor/patient/${dispatch.patientId}`)}
                          className="px-3 py-1.5 bg-[#1E293B] border border-white/5 text-slate-400 text-[9px] font-black rounded-xl hover:border-accent-maroon/20 hover:text-accent-maroon transition-all flex items-center gap-1.5"
                        >
                          <Activity className="w-3 h-3" />
                          View
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Patient', value: dispatch.patientName || 'Emergency Node' },
                        { label: 'Impact Level', value: 'Level 1 - Critical', highlight: true },
                        { label: 'Destination', value: dispatch.hospitalAssigned || 'Nearest Facility' },
                        { label: 'ETA', value: dispatch.eta || 'Calculating...' },
                      ].map(item => (
                        <div key={item.label}>
                          <p className="text-[8px] font-black text-slate-600 uppercase tracking-wider mb-0.5">{item.label}</p>
                          <p className={`text-[11px] font-black truncate ${item.highlight ? 'text-accent-maroon' : 'text-white'}`}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )) : (
                  <div className="py-16 text-center bg-[#111827] rounded-2xl border border-white/[0.06] border-dashed">
                    <AlertCircle className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                    <h3 className="text-sm font-black text-slate-500">No Active Deployments</h3>
                    <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest mt-1">Grid readiness: 100%</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: Intelligence + History */}
            <div className="space-y-4">
              {/* Grid Intelligence */}
              <div className="bg-[#111827] rounded-2xl border border-white/[0.06] p-5">
                <h3 className="text-[9px] font-black text-accent-maroon uppercase tracking-widest mb-4">Grid Intelligence</h3>
                <div className="space-y-3 divide-y divide-white/[0.06]">
                  <GridStat label="Avg Response" value="4m 20s" />
                  <GridStat label="Hospital Bed Cap" value="84%" />
                  <GridStat label="Active Paramedics" value="12" />
                  <GridStat label="Total Dispatches" value={dispatches.length} />
                </div>
              </div>

              {/* Recent Archives */}
              <div className="bg-[#111827] rounded-2xl border border-white/[0.06] p-5 overflow-hidden">
                <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-4">Recent Archives</h3>
                <div className="space-y-3">
                  {completedDispatches.length > 0 ? completedDispatches.slice(0, 5).map(d => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between group cursor-pointer py-1"
                      onClick={() => navigate(`/doctor/patient/${d.patientId}`)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-white/5 rounded-xl group-hover:bg-accent-maroon/10 transition-colors shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 group-hover:text-accent-maroon transition-colors" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-black text-white truncate">{d.patientName || 'Completed Action'}</p>
                          <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">
                            {d.dispatchedAt ? new Date(d.dispatchedAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    </div>
                  )) : (
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest text-center py-4">No recent archives</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DoctorEmergency;
