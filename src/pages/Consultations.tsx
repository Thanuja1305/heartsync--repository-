import React from 'react';
import { motion } from 'motion/react';
import { Stethoscope, MessageSquare, Calendar, Video, Clock, Star, Phone, User } from 'lucide-react';
import PatientSidebar from '../components/PatientSidebar';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

const Consultations = () => {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [patientData, setPatientData] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      const docRef = doc(db, 'patients', user.uid);
      const unsubscribe = onSnapshot(docRef, (snap) => {
        if (snap.exists()) setPatientData(snap.data());
      });
      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, 'appointments'), where('patientId', '==', user.uid));
      const unsubscribe = onSnapshot(q, (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAppointments(data);
      });
      return () => unsubscribe();
    }
  }, [user]);

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden relative font-sans text-slate-900">
      <PatientSidebar 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen} 
        patientData={patientData} 
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-20 md:h-24 bg-white/70 backdrop-blur-2xl border-b border-slate-100 px-4 md:px-12 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 md:gap-4">
             <button 
               onClick={() => setIsSidebarOpen(true)}
               className="lg:hidden p-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
             >
               <Stethoscope className="w-5 h-5" />
             </button>
             <div className="flex items-center gap-2 md:gap-3">
                <div className="hidden sm:block p-2.5 bg-accent-maroon rounded-2xl shadow-lg shadow-accent-maroon/20">
                  <Stethoscope className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-base md:text-2xl font-black text-slate-900 tracking-tight">Consultations</h1>
                  <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Manage Care & Experts</p>
                </div>
             </div>
          </div>
          <button className="hidden sm:block px-6 md:px-8 py-3 md:py-3.5 bg-slate-900 text-white text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] rounded-xl md:rounded-2xl shadow-xl shadow-slate-900/20 hover:scale-105 transition-all">Book New Service</button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-12 no-scrollbar">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 pb-24 lg:pb-0">
            <div className="lg:col-span-8 space-y-8 md:space-y-12">
              <section>
                <div className="flex items-center justify-between mb-6 md:mb-8">
                   <h2 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-widest">Active Appointments</h2>
                   <span className="px-3 py-1 bg-accent-maroon/10 text-accent-maroon text-[9px] md:text-[10px] font-black rounded-lg">{appointments.length} Total</span>
                </div>
                
                <div className="space-y-6">
                  {appointments.length > 0 ? appointments.map((apt, i) => (
                    <motion.div 
                      key={apt.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-8 border border-slate-100 shadow-xl group hover:border-accent-maroon/20 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
                         <div className="flex flex-col xs:flex-row gap-6">
                            <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-50 rounded-2xl md:rounded-[24px] border border-slate-100 flex items-center justify-center text-slate-300 shrink-0">
                               <User className="w-8 h-8 md:w-10 md:h-10" />
                            </div>
                            <div>
                               <p className="text-[9px] md:text-[10px] font-black text-accent-maroon uppercase tracking-widest mb-1">{apt.status || 'Scheduled'}</p>
                               <h3 className="text-lg md:text-xl font-black text-slate-900 mb-1">{apt.doctorName || 'Assigned Specialist'}</h3>
                               <p className="text-xs md:text-sm font-bold text-slate-400 mb-4">{apt.hospitalName || 'Cardiac Center'}</p>
                               <div className="flex flex-wrap items-center gap-4 md:gap-6">
                                  <div className="flex items-center gap-2 text-[10px] md:text-xs font-black text-slate-600">
                                     <Calendar className="w-3.5 h-3.5 opacity-40" />
                                     {apt.appointmentTime || 'TBD'}
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] md:text-xs font-black text-slate-600">
                                     <Clock className="w-3.5 h-3.5 opacity-40" />
                                     10:30 AM
                                  </div>
                               </div>
                            </div>
                         </div>
                         <div className="flex sm:flex-col gap-2 w-full sm:w-auto">
                            <button className="flex-1 sm:flex-none p-3 bg-slate-50 rounded-xl hover:bg-accent-maroon hover:text-white transition-all text-slate-400 flex justify-center">
                               <Video className="w-5 h-5" />
                            </button>
                            <button className="flex-1 sm:flex-none p-3 bg-slate-50 rounded-xl hover:bg-accent-maroon hover:text-white transition-all text-slate-400 flex justify-center">
                               <MessageSquare className="w-5 h-5" />
                            </button>
                         </div>
                      </div>
                    </motion.div>
                  )) : (
                    <div className="bg-white rounded-[32px] md:rounded-[40px] p-12 md:p-20 border-2 border-dashed border-slate-100 text-center">
                       <div className="w-12 h-12 md:w-16 md:h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                          <Calendar className="w-6 h-6 md:w-8 md:h-8" />
                       </div>
                       <p className="text-[10px] md:text-sm font-bold text-slate-400 uppercase tracking-widest">No Active Consultations found</p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="lg:col-span-4 space-y-8 md:space-y-12">
               <section>
                  <h2 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-widest mb-6 md:mb-8">Physician Network</h2>
                  <div className="bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-8 border border-slate-100 shadow-xl overflow-hidden relative">
                     <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Linked Specialist</p>
                     <div className="flex items-center gap-4 mb-8 p-4 bg-slate-50 rounded-2xl md:rounded-3xl border border-slate-100">
                        <div className="w-12 h-12 md:w-14 md:h-14 bg-white rounded-xl md:rounded-2xl flex items-center justify-center shadow-sm shrink-0">
                           <User className="w-5 h-5 md:w-6 md:h-6 text-accent-maroon" />
                        </div>
                        <div className="min-w-0">
                           <p className="text-sm font-black text-slate-900 truncate">{patientData?.assignedDoctor || 'Assigned Doctor'}</p>
                           <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Cardiology Lead</p>
                        </div>
                     </div>
                     <button className="w-full py-4 bg-slate-900 text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-xl md:rounded-2xl hover:opacity-90 transition-all">Direct Message</button>
                  </div>
               </section>

               <div className="block lg:hidden pt-4">
                  <button className="w-full py-4 bg-accent-maroon text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl shadow-xl shadow-accent-maroon/20">Book New Service</button>
               </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Consultations;
