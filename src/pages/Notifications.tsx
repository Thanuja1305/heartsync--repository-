import React from 'react';
import { motion } from 'motion/react';
import { Bell, Heart, AlertCircle, CheckCircle2, Info, Clock, Trash2 } from 'lucide-react';
import PatientSidebar from '../components/PatientSidebar';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, onSnapshot, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const Notifications = () => {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [patientData, setPatientData] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      const docRef = doc(db, 'patients', user.uid);
      const unsubscribe = onSnapshot(docRef, (snap) => {
        if (snap.exists()) setPatientData(snap.data());
      });
      return () => unsubscribe();
    }
  }, [user]);

  // For this prototype, we'll listen to a theoretical 'notifications' collection
  useEffect(() => {
    if (user) {
      const q = query(collection(db, 'notifications'), where('userId', '==', user.uid));
      const unsubscribe = onSnapshot(q, (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        setNotifications(data.sort((a, b) => {
          const timeA = a.createdAt?.toMillis() || a.timestamp?.toMillis() || 0;
          const timeB = b.createdAt?.toMillis() || b.timestamp?.toMillis() || 0;
          return timeB - timeA;
        }));
      });
      return () => unsubscribe();
    }
  }, [user]);

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (e) {
      console.error(e);
    }
  };

  const clearAllNotifications = async () => {
    try {
      const q = query(collection(db, 'notifications'), where('userId', '==', user?.uid));
      const snap = await getDocs(q);
      const batchPromises = snap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(batchPromises);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden relative font-sans text-slate-900">
      <PatientSidebar 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen} 
        patientData={patientData} 
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-20 md:h-24 bg-white/70 backdrop-blur-2xl border-b border-slate-100 px-6 md:px-12 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
             <button 
               onClick={() => setIsSidebarOpen(true)}
               className="lg:hidden p-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
             >
               <Bell className="w-5 h-5" />
             </button>
             <div className="flex items-center gap-3">
                <div className="hidden sm:block p-2.5 bg-accent-maroon rounded-2xl shadow-lg shadow-accent-maroon/20">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">Intelligence Hub</h1>
                  <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Status & Alerts</p>
                </div>
             </div>
          </div>
          <button 
            onClick={clearAllNotifications}
            className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-accent-maroon transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="hidden xs:inline">Clear All Logs</span>
            <span className="xs:hidden">Clear</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-12">
          <div className="max-w-4xl mx-auto space-y-6">
            {notifications.length > 0 ? notifications.map((notif, i) => (
              <motion.div 
                key={notif.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`bg-white rounded-[24px] md:rounded-[32px] p-6 md:p-8 border ${notif.type?.toLowerCase() === 'emergency' ? 'border-red-100 bg-red-50/10' : 'border-slate-100'} shadow-xl relative group overflow-hidden`}
              >
                 {notif.type?.toLowerCase() === 'emergency' && <div className="absolute left-0 top-0 bottom-0 w-1 md:w-2 bg-red-500" />}
                 
                 <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col sm:flex-row gap-4 md:gap-6">
                       <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 ${
                         notif.type?.toLowerCase() === 'emergency' ? 'bg-red-500 text-white shadow-xl shadow-red-500/20' : 
                         notif.type?.toLowerCase() === 'success' ? 'bg-green-500 text-white shadow-xl shadow-green-500/20' : 
                         'bg-slate-50 text-slate-400'
                       }`}>
                          {notif.type?.toLowerCase() === 'emergency' ? <AlertCircle className="w-5 h-5 md:w-6 md:h-6" /> : 
                           notif.type?.toLowerCase() === 'success' ? <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" /> : 
                           <Info className="w-5 h-5 md:w-6 md:h-6" />}
                       </div>
                       <div>
                          <div className="flex flex-wrap items-center gap-3 mb-2">
                             <h3 className="text-base md:text-lg font-black text-slate-900 tracking-tight">{notif.title || 'System Alert'}</h3>
                             <span className="text-[8px] md:text-[9px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 flex items-center gap-1">
                               <Clock className="w-3 h-3" />
                               {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                                notif.timestamp?.toDate ? notif.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                             </span>
                          </div>
                          <p className="text-xs md:text-sm font-bold text-slate-600 leading-relaxed max-w-2xl">{notif.message || notif.body || 'No message content available.'}</p>
                       </div>
                    </div>
                    <button 
                      onClick={() => deleteNotification(notif.id)}
                      className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all sm:opacity-0 group-hover:opacity-100"
                    >
                       <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                 </div>
              </motion.div>
            )) : (
              <div className="bg-white rounded-[32px] md:rounded-[40px] p-12 md:p-24 border-2 border-dashed border-slate-100 text-center">
                 <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 md:mb-8 text-slate-200 opacity-50">
                    <Bell className="w-8 h-8 md:w-10 md:h-10" />
                 </div>
                 <h2 className="text-lg md:text-xl font-black text-slate-900 mb-2">No Active Logs</h2>
                 <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Health system is stable. No warnings issued.</p>
              </div>
            )}
            
            {/* Seeded Data for prototype if empty */}
            {notifications.length === 0 && (
               <div className="pt-20">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] text-center mb-10">Simulation Data Sequence Beta</p>
                  <div className="space-y-6 opacity-40 grayscale pointer-events-none">
                     <PreviewNotif type="success" title="Registry Connected" message="System protocol for clinical data synchronization initialized successfully." />
                     <PreviewNotif type="success" title="Vitals Calibrated" message="IoT Sensor Array MAX30102 successfully calibrated with local hub." />
                  </div>
               </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

const PreviewNotif = ({ type, title, message }: any) => (
  <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-xl opacity-50">
    <div className="flex gap-6">
       <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
         type === 'success' ? 'bg-green-500 text-white' : 'bg-slate-50 text-slate-400'
       }`}>
          {type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <Info className="w-6 h-6" />}
       </div>
       <div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight mb-2">{title}</h3>
          <p className="text-sm font-bold text-slate-600 leading-relaxed">{message}</p>
       </div>
    </div>
  </div>
);

export default Notifications;
