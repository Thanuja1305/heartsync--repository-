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
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
      <title>Emergency Dispatch | HeartSync</title>
      
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
               <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter italic">Emergency Dispatch</h2>
               <p className="hidden md:block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">Institutional First Response Portal</p>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
             <button className="px-4 md:px-6 py-2.5 md:py-3 bg-accent-maroon text-white rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest shadow-xl shadow-accent-maroon/20 flex items-center gap-2 md:gap-3 hover:scale-105 active:scale-95 transition-all">
                <PlusIcon className="w-3 md:w-4 h-3 md:h-4 shrink-0" />
                <span className="hidden sm:inline">Manual Dispatch Trigger</span>
                <span className="sm:hidden">Trigger</span>
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-12 no-scrollbar">
           <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10">
              
              {/* LEFT & CENTER: Active Dispatches */}
              <div className="lg:col-span-2 space-y-8 md:space-y-10">
                 <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                       <Ambulance className="w-5 h-5 text-accent-maroon" />
                       <h3 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-[0.15em] md:tracking-[0.2em]">Active Deployments</h3>
                    </div>
                    <span className="px-3 md:px-4 py-1.5 md:py-2 bg-accent-maroon/10 text-accent-maroon text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-lg md:rounded-xl whitespace-nowrap">
                       {activeDispatches.length} Units En Route
                    </span>
                 </div>

                 <div className="space-y-6">
                    {loading ? (
                      <div className="py-16 md:py-20 text-center bg-white rounded-[32px] md:rounded-[40px] border border-slate-100 animate-pulse">
                         <div className="w-10 h-10 bg-slate-100 rounded-full mx-auto mb-4" />
                         <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Scanning Dispatch Nodes...</p>
                      </div>
                    ) : activeDispatches.length > 0 ? activeDispatches.map((dispatch) => (
                      <div key={dispatch.id} className="bg-white rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-premium p-6 md:p-10 relative overflow-hidden group">
                         <div className="absolute top-0 right-0 p-6 md:p-8">
                            <Navigation className="w-8 h-8 md:w-10 md:h-10 text-slate-50 group-hover:text-accent-maroon/10 transition-colors duration-500" />
                         </div>
                         
                         <div className="flex flex-col xl:flex-row gap-8 md:gap-10 relative z-10">
                            <div className="flex-1 space-y-6 md:space-y-8">
                               <div className="flex items-center gap-4 md:gap-6">
                                  <div className="w-12 h-12 md:w-16 md:h-16 bg-slate-900 rounded-2xl md:rounded-3xl flex items-center justify-center text-white text-lg md:text-2xl font-black shrink-0">
                                     {dispatch.ambulanceId?.charAt(0) || 'A'}
                                  </div>
                                  <div className="min-w-0">
                                     <h4 className="text-lg md:text-xl font-black text-slate-900 italic tracking-tighter mb-1 truncate">Unit {dispatch.ambulanceId || 'Alpha-1'}</h4>
                                     <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-accent-maroon rounded-full animate-pulse shrink-0" />
                                        <span className="text-[9px] md:text-[10px] font-black text-accent-maroon uppercase tracking-widest truncate">{dispatch.status?.replace('_', ' ')}</span>
                                     </div>
                                  </div>
                               </div>

                               <div className="grid grid-cols-2 gap-4 md:gap-8">
                                  <div className="min-w-0">
                                     <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">Primary Patient</p>
                                     <p className="text-xs md:text-sm font-bold text-slate-900 tracking-tight truncate">{dispatch.patientName || 'Emergency Node'}</p>
                                  </div>
                                  <div className="min-w-0">
                                     <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">Impact Level</p>
                                     <p className="text-xs md:text-sm font-bold text-accent-maroon tracking-tight truncate">Level 1 - Critical</p>
                                  </div>
                                  <div className="min-w-0">
                                     <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">Destination</p>
                                     <p className="text-xs md:text-sm font-bold text-slate-900 tracking-tight truncate">{dispatch.hospitalAssigned || 'Institutional Node'}</p>
                                  </div>
                                  <div className="min-w-0">
                                     <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">ETA</p>
                                     <p className="text-xs md:text-sm font-bold text-slate-900 tracking-tight truncate">{dispatch.eta || 'Calculating...'}</p>
                                  </div>
                               </div>
                            </div>
                            
                            <div className="flex flex-row xl:flex-col gap-3 md:gap-4 shrink-0">
                               <button 
                                 onClick={() => navigate(`/doctor/patient/${dispatch.patientId}`)}
                                 className="flex-1 xl:w-48 py-3 md:py-4 bg-slate-50 text-slate-900 rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest border border-slate-100 hover:bg-slate-100 transition-all flex items-center justify-center gap-2 md:gap-3"
                               >
                                  <Activity className="w-3 md:w-4 h-3 md:h-4 text-accent-maroon" />
                                  Link
                               </button>
                               <button className="flex-1 xl:w-48 py-3 md:py-4 bg-slate-900 text-white rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2 md:gap-3">
                                  <Navigation className="w-3 md:w-4 h-3 md:h-4 text-medical-red" />
                                  Trace
                               </button>
                            </div>
                         </div>

                         <div className="mt-8 md:mt-10 pt-6 md:pt-8 border-t border-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-3 md:gap-4">
                               <div className="flex -space-x-2">
                                  {[1,2,3].map(i => (
                                    <div key={i} className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[7px] md:text-[8px] font-bold text-slate-400">R</div>
                                  ))}
                               </div>
                               <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest italic truncate hidden sm:inline">Responder Grid Assigned</span>
                               <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest italic sm:hidden">Responders</span>
                            </div>
                            <span className="text-[8px] md:text-[9px] font-black text-slate-300 uppercase tracking-widest italic whitespace-nowrap">Sync: 1.2s</span>
                         </div>
                      </div>
                    )) : (
                      <div className="py-16 md:py-20 text-center bg-white rounded-[32px] md:rounded-[40px] border border-slate-100 border-dashed p-6">
                         <AlertCircle className="w-10 md:w-12 h-10 md:h-12 text-slate-100 mx-auto mb-4" />
                         <h3 className="text-lg md:text-xl font-black text-slate-900 italic tracking-tighter">Negative Deployments</h3>
                         <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest mt-2">Grid readiness: 100%</p>
                      </div>
                    )}
                 </div>
              </div>

              {/* RIGHT: Stats & History */}
              <div className="space-y-8 md:space-y-10">
                 <div className="bg-slate-900 rounded-[32px] md:rounded-[40px] p-6 md:p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                       <Activity className="w-24 md:w-32 h-24 md:h-32 text-accent-maroon" />
                    </div>
                    <div className="relative z-10">
                       <h3 className="text-[9px] md:text-[10px] font-black text-accent-maroon uppercase tracking-widest mb-6 italic">Grid Intelligence</h3>
                       <div className="space-y-4 md:space-y-6">
                          <GridStat label="Avg Response" value="4m 20s" />
                          <GridStat label="Hospital Bed Cap" value="84%" />
                          <GridStat label="Active Paramedics" value="12" />
                       </div>
                    </div>
                 </div>

                 <div className="bg-white rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-premium p-6 md:p-8 overflow-hidden h-full">
                    <h3 className="text-xl font-black text-slate-900 tracking-tighter italic mb-6 md:mb-8">Recent Archives</h3>
                    <div className="space-y-5 md:space-y-6">
                       {completedDispatches.length > 0 ? completedDispatches.slice(0, 5).map(d => (
                         <div key={d.id} className="flex items-center justify-between group cursor-pointer" onClick={() => navigate(`/doctor/patient/${d.patientId}`)}>
                            <div className="flex items-center gap-3 md:gap-4 min-w-0">
                               <div className="p-2.5 md:p-3 bg-slate-50 text-slate-300 rounded-xl group-hover:bg-slate-900 group-hover:text-white transition-all shrink-0">
                                  <MapPin className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                   <p className="text-sm font-bold text-slate-900 tracking-tight italic truncate">{d.patientName || 'Completed Action'}</p>
                                   <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">{d.dispatchedAt ? new Date(d.dispatchedAt.seconds * 1000).toLocaleDateString() : 'N/A'}</p>
                                </div>
                            </div>
                            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                         </div>
                       )) : (
                         <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center py-4">No recent archives</p>
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

const GridStat = ({ label, value }: any) => (
  <div className="flex justify-between items-center">
     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
     <span className="text-xl font-black italic">{value}</span>
  </div>
);

const PlusIcon = (props: any) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export default DoctorEmergency;
