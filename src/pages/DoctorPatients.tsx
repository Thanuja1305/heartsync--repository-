import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Search, 
  Filter, 
  ChevronRight, 
  User,
  Activity,
  Heart,
  Clock,
  ArrowUpRight,
  Menu
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DoctorSidebar from '../components/DoctorSidebar';

const DoctorPatients = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'high_risk' | 'active'>('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'patient'),
      where('status', '==', 'approved')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPatients(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredPatients = patients.filter(p => {
    const matchesSearch = (p.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (p.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
      <title>Patient Registry | HeartSync</title>
      
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
               <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter italic truncate">Patient Registry</h2>
               <p className="hidden md:block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">Institutional Care Management</p>
             </div>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
             <div className="relative group flex-1 md:flex-none">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-accent-maroon transition-colors" />
                <input 
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full md:w-64 lg:w-80 pl-11 pr-6 py-2.5 md:py-3 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl outline-none focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon transition-all font-bold text-sm"
                />
             </div>
             <button className="p-2.5 md:p-3 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl text-slate-400 hover:text-accent-maroon transition-all shrink-0">
                <Filter className="w-5 h-5" />
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-12 no-scrollbar">
           <div className="max-w-7xl mx-auto space-y-8 md:space-y-10">
              
              {/* STATS OVERVIEW */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                 <RegistryStat label="Total Nodes" value={patients.length} icon={Users} />
                 <RegistryStat label="Active" value={patients.length} icon={Activity} color="green" />
                 <RegistryStat label="Critical" value="0" icon={Heart} color="red" />
                 <RegistryStat label="Synced" value={patients.length} icon={Clock} />
              </div>

              {/* PATIENT GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                {loading ? (
                  Array(8).fill(0).map((_, i) => (
                    <div key={i} className="h-80 bg-slate-100 rounded-[40px] animate-pulse" />
                  ))
                ) : filteredPatients.length > 0 ? filteredPatients.map((patient) => (
                  <motion.div
                    key={patient.id}
                    layoutId={patient.id}
                    onClick={() => navigate(`/doctor/patient/${patient.id}`)}
                    className="group bg-white rounded-[40px] border border-slate-100 shadow-premium p-8 hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer relative overflow-hidden"
                  >
                     <div className="absolute top-0 right-0 p-6">
                        <ArrowUpRight className="w-5 h-5 text-slate-100 group-hover:text-accent-maroon transition-colors" />
                     </div>
                     
                     <div className="flex flex-col items-center text-center space-y-6">
                        <div className="relative">
                           <div className="w-24 h-24 bg-slate-900 rounded-3xl flex items-center justify-center text-white text-3xl font-black overflow-hidden border-4 border-slate-50 shadow-xl">
                              {patient.photoURL ? (
                                <img src={patient.photoURL} alt="" className="w-full h-full object-cover" />
                              ) : (
                                patient.displayName?.charAt(0) || 'P'
                              )}
                           </div>
                           <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-xl border-4 border-white flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                           </div>
                        </div>

                        <div>
                           <h4 className="text-xl font-black text-slate-900 tracking-tighter italic leading-none">{patient.displayName || 'Unnamed Patient'}</h4>
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{patient.age ? `${patient.age} Years • ${patient.gender}` : 'Details Pending'}</p>
                        </div>

                        <div className="w-full pt-6 border-t border-slate-50 flex items-center justify-around">
                           <div className="text-center">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status</p>
                              <span className="px-3 py-1 bg-green-50 text-green-600 text-[9px] font-black uppercase tracking-widest rounded-lg">Stable</span>
                           </div>
                           <div className="text-center">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Risk</p>
                              <span className="px-3 py-1 bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest rounded-lg">Normal</span>
                           </div>
                        </div>
                     </div>
                  </motion.div>
                )) : (
                  <div className="col-span-full py-20 text-center">
                     <div className="w-20 h-20 bg-slate-100 rounded-[32px] flex items-center justify-center mx-auto mb-6">
                        <Search className="w-8 h-8 text-slate-300" />
                     </div>
                     <h3 className="text-xl font-black text-slate-900 italic tracking-tighter">No Nodes Detected</h3>
                     <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-2">Try adjusting your spectral scan filters</p>
                  </div>
                )}
              </div>
           </div>
        </div>
      </main>
    </div>
  );
};

const RegistryStat = ({ label, value, icon: Icon, color }: any) => (
  <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-5">
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
      color === 'green' ? 'bg-green-500/10 text-green-500' :
      color === 'red' ? 'bg-accent-maroon/10 text-accent-maroon' :
      'bg-slate-50 text-slate-400'
    }`}>
      <Icon className="w-6 h-6" />
    </div>
    <div>
      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
      <p className="text-2xl font-black text-slate-900 tracking-tighter italic leading-none">{value}</p>
    </div>
  </div>
);

export default DoctorPatients;
