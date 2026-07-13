import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  AlertCircle, 
  Clock, 
  MapPin, 
  ShieldCheck, 
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Menu
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DoctorSidebar from '../components/DoctorSidebar';

const DoctorAlerts = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'emergencyAlerts'),
      orderBy('detectedAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAlerts(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
      <title>Alert History | HeartSync</title>
      
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
        <header className="h-20 md:h-24 bg-white border-b border-slate-200 px-6 md:px-12 flex flex-col md:flex-row items-center justify-between shrink-0 py-4 md:py-0">
          <div className="flex items-center gap-4 w-full md:w-auto mb-4 md:mb-0">
             <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-400 hover:text-accent-maroon transition-all">
                <Menu className="w-6 h-6" />
             </button>
             <div className="min-w-0">
               <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter italic truncate">Emergency Logs</h2>
               <p className="hidden md:block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">Institutional Incident Archive</p>
             </div>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
             <div className="relative group flex-1 md:flex-none">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-accent-maroon transition-colors" />
                <input 
                  type="text"
                  placeholder="Filter incident logs..."
                  className="w-full md:w-64 lg:w-80 pl-11 pr-6 py-2.5 md:py-3 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl outline-none focus:border-accent-maroon transition-all font-bold text-sm"
                />
             </div>
             <button className="p-2.5 md:p-3 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl text-slate-400 hover:text-accent-maroon transition-all shrink-0">
                <Filter className="w-5 h-5" />
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-12 no-scrollbar">
           <div className="max-w-7xl mx-auto space-y-8 md:space-y-10">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
                 <AlertStat label="Critical Events" value={alerts.filter(a => a.severity === 'CRITICAL').length} icon={AlertCircle} color="red" />
                 <AlertStat label="Resolved Cases" value={alerts.filter(a => a.status === 'RESOLVED').length} icon={CheckCircle2} color="green" />
                 <AlertStat label="Response Time" value="4m 12s" icon={Clock} className="hidden sm:flex" />
              </div>

              <div className="bg-white rounded-[32px] md:rounded-[48px] border border-slate-100 shadow-premium p-6 md:p-10">
                 <div className="space-y-6">
                    {loading ? (
                      <div className="py-20 text-center animate-pulse">
                         <div className="w-12 h-12 bg-slate-100 rounded-full mx-auto mb-4" />
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scanning Grid Archives...</p>
                      </div>
                    ) : alerts.length > 0 ? alerts.map((alert) => (
                      <div 
                        key={alert.id}
                        onClick={() => navigate(`/doctor/patient/${alert.patientId}`)}
                        className="group flex flex-col xl:flex-row items-start xl:items-center justify-between p-6 md:p-8 bg-slate-50/50 hover:bg-white rounded-2xl md:rounded-3xl border border-transparent hover:border-slate-100 hover:shadow-xl transition-all cursor-pointer"
                      >
                         <div className="flex items-center gap-4 md:gap-6 mb-6 xl:mb-0 w-full xl:w-auto">
                            <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center text-lg md:text-xl font-black shadow-lg shrink-0 ${
                              alert.severity === 'CRITICAL' ? 'bg-accent-maroon text-white' : 'bg-amber-500 text-white'
                            }`}>
                               {alert.severity === 'CRITICAL' ? '!' : '?'}
                            </div>
                            <div className="min-w-0 flex-1">
                               <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-1">
                                  <h4 className="font-black text-slate-900 italic tracking-tighter text-base md:text-lg truncate">{alert.patientName || 'Active Node'}</h4>
                                  <span className={`px-2 py-0.5 rounded-lg text-[7px] md:text-[8px] font-black uppercase tracking-widest ${
                                    alert.status === 'RESOLVED' ? 'bg-green-50 text-green-600' : 'bg-accent-maroon/5 text-accent-maroon'
                                  }`}>
                                     {alert.status?.replace('_', ' ') || 'PENDING'}
                                  </span>
                               </div>
                               <div className="flex flex-wrap gap-x-4 gap-y-2">
                                  <div className="flex items-center gap-1.5">
                                     <Clock className="w-3 h-3 text-slate-300 shrink-0" />
                                     <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                        {new Date(alert.detectedAt).toLocaleString()}
                                     </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 min-w-0">
                                     <AlertCircle className="w-3 h-3 text-accent-maroon opacity-50 shrink-0" />
                                     <p className="text-[9px] md:text-[10px] font-bold text-slate-600 truncate max-w-[200px] sm:max-w-xs">{alert.aiSummary || 'Cardiac anomaly detected by neural node'}</p>
                                  </div>
                               </div>
                            </div>
                         </div>

                         <div className="flex items-center gap-4 md:gap-6 w-full xl:w-auto pt-6 xl:pt-0 border-t xl:border-0 border-slate-100">
                            <div className="text-right flex-1 xl:flex-none min-w-0">
                               <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">Impact Level</p>
                               <p className={`text-xs md:text-sm font-black italic truncate ${alert.severity === 'CRITICAL' ? 'text-accent-maroon' : 'text-amber-500'}`}>
                                  {alert.severity || 'UNKNOWN'}
                               </p>
                            </div>
                            <button className="p-3 md:p-4 bg-white border border-slate-100 text-slate-400 rounded-xl md:rounded-2xl group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 transition-all shrink-0">
                               <ArrowRight className="w-4 md:w-5 h-4 md:h-5" />
                            </button>
                         </div>
                      </div>
                    )) : (
                      <div className="py-16 md:py-20 text-center p-6">
                         <ShieldCheck className="w-10 md:w-12 h-10 md:h-12 text-slate-100 mx-auto mb-4" />
                         <h3 className="text-lg md:text-xl font-black text-slate-900 italic tracking-tighter">Zero Incidents Archived</h3>
                         <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest mt-2">Perfect medical safety index maintained</p>
                      </div>
                    )}
                 </div>
              </div>
           </div>
        </div>
      </main>
    </div>
  );
};

const AlertStat = ({ label, value, icon: Icon, color }: any) => (
  <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-premium flex items-center justify-between">
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-4xl font-black text-slate-900 tracking-tighter italic">{value}</p>
    </div>
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
      color === 'red' ? 'bg-accent-maroon text-white shadow-xl shadow-accent-maroon/20' :
      color === 'green' ? 'bg-green-500 text-white shadow-xl shadow-green-500/20' :
      'bg-slate-50 text-slate-300'
    }`}>
      <Icon className="w-7 h-7" />
    </div>
  </div>
);

export default DoctorAlerts;
