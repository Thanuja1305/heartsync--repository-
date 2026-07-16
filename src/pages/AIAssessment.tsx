import React from 'react';
import { motion } from 'motion/react';
import { Bot, Zap, Activity, ShieldAlert, History, Filter } from 'lucide-react';
import PatientSidebar from '../components/PatientSidebar';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { supabase } from '../lib/supabase';

const AIAssessment = () => {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [patientData, setPatientData] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);

  useEffect(() => {
    if (user) {
      const docRef = doc(db, 'patients', user.uid);
      const unsubscribe = onSnapshot(docRef, (snap) => {
        if (snap.exists()) setPatientData(snap.data());
      });
      return () => unsubscribe();
    }
  }, [user]);

  const [generating, setGenerating] = useState(false);

  const loadLatestReport = async () => {
    if (!user) return;
    try {
      const { data: pRec } = await supabase.from('patients').select('id').eq('user_id', user.uid).maybeSingle();
      if (pRec) {
        const { data } = await supabase
          .from('medical_reports')
          .select('report_data')
          .eq('patient_id', pRec.id)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (data && data.length > 0) {
          setAnalysis(data[0].report_data);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadLatestReport();
  }, [user]);

  const generateNewReport = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/report/${user.uid}`);
      const result = await res.json();
      if (result.success) {
        setAnalysis(result.data);
      }
    } catch (err) {
      console.error("Failed to generate report", err);
    } finally {
      setGenerating(false);
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
        <header className="h-20 md:h-24 bg-white/70 backdrop-blur-2xl border-b border-slate-100 px-4 md:px-12 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 md:gap-4">
             <button 
               onClick={() => setIsSidebarOpen(true)}
               className="lg:hidden p-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
             >
               <Bot className="w-5 h-5 md:w-6 md:h-6" />
             </button>
              <div className="flex items-center gap-2 md:gap-3">
                <div className="hidden sm:block p-2 text-white bg-accent-maroon rounded-xl md:rounded-2xl shadow-lg shadow-accent-maroon/20">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-base md:text-2xl font-black text-slate-900 tracking-tight">AI Assessment</h1>
                  <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Diagnostic Core v4.2</p>
                </div>
             </div>
          </div>
          <button 
            onClick={generateNewReport} 
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            <Activity className="w-4 h-4" />
            {generating ? 'Analyzing...' : 'Generate New Report'}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-12">
          <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
            <div className="grid lg:grid-cols-12 gap-6 md:gap-8">
              <div className="lg:col-span-8 space-y-6 md:space-y-8">
                {/* Risk Score Card */}
                <div className="bg-white rounded-[28px] md:rounded-[40px] p-6 md:p-10 border border-slate-100 shadow-premium relative overflow-hidden">
                   <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-accent-maroon/5 rounded-full blur-[80px]" />
                   <div className="relative z-10">
                      <div className="flex items-center justify-between mb-6 md:mb-12">
                        <h3 className="text-[9px] md:text-sm font-bold text-slate-900 uppercase tracking-widest">Heart Attack Risk Rating</h3>
                        <div className="p-2 bg-accent-maroon/5 rounded-lg md:rounded-xl text-accent-maroon">
                          <Zap className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                      </div>
                      
                      <div className="flex flex-col md:flex-row items-center gap-6 md:gap-12">
                         <div className="relative w-36 h-36 md:w-48 md:h-48 shrink-0">
                            <svg className="w-full h-full transform -rotate-90">
                               <circle 
                                 cx="50%" cy="50%" r="45%" 
                                 className="stroke-slate-50 fill-none" 
                                 strokeWidth="10" 
                               />
                               <motion.circle 
                                 cx="50%" cy="50%" r="45%" 
                                 className="stroke-accent-maroon fill-none" 
                                 strokeWidth="10" 
                                 strokeLinecap="round"
                                 initial={{ strokeDashoffset: 100 }}
                                 animate={{ strokeDashoffset: 100 - (analysis?.riskScore || 0) }}
                                 style={{ pathLength: 1 }}
                                 transition={{ duration: 1.5, ease: "circOut" }}
                               />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                               <span className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight">{analysis?.riskScore || '0'}</span>
                               <span className="text-[8px] md:text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-1">Index</span>
                            </div>
                         </div>
                         
                         <div className="flex-1 space-y-5 text-center md:text-left">
                            <div>
                               <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 md:mb-2">Clinical Interpretation</p>
                               <p className="text-sm md:text-lg font-medium text-slate-800 leading-snug md:leading-tight">{analysis?.currentVitalsAnalysis || analysis?.interpretation || 'Awaiting synchronization with clinical devices for real-time risk assessment.'}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 md:gap-4">
                               <div className="p-2.5 md:p-4 bg-slate-50/50 rounded-xl md:rounded-2xl border border-slate-100">
                                  <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1">Risk Level</p>
                                  <p className={`text-xs md:text-sm font-bold ${analysis?.riskLevel === 'High' ? 'text-accent-maroon' : 'text-green-600'}`}>{analysis?.riskLevel || 'Normal'}</p>
                               </div>
                               <div className="p-2.5 md:p-4 bg-slate-50/50 rounded-xl md:rounded-2xl border border-slate-100">
                                  <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1">Last Updated</p>
                                  <p className="text-xs md:text-sm font-bold text-slate-900">{analysis?.generatedAt ? new Date(analysis.generatedAt).toLocaleDateString() : (analysis?.timestamp?.toDate ? analysis.timestamp.toDate().toLocaleDateString() : 'Real-time')}</p>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="bg-white rounded-[28px] md:rounded-[40px] p-6 md:p-10 border border-slate-100 shadow-premium">
                   <div className="flex items-center gap-4 mb-4 md:mb-8 text-slate-900">
                     <div className="p-2 bg-accent-maroon/5 rounded-lg md:rounded-xl text-accent-maroon">
                       <ShieldAlert className="w-4 h-4 md:w-5 md:h-5" />
                     </div>
                     <h3 className="text-[9px] md:text-sm font-bold uppercase tracking-widest">Clinical Recommendations</h3>
                   </div>
                   <div className="grid grid-cols-1 gap-3 md:gap-4">
                      {(analysis?.recommendations || ["No clinical alerts detected. Continue maintaining balanced lifestyle and monitoring."]).map((rec: string, i: number) => (
                        <div key={i} className="flex gap-3 md:gap-4 p-4 md:p-6 bg-slate-50/50 rounded-2xl border border-slate-50 group hover:bg-white hover:border-accent-maroon/10 hover:shadow-premium transition-all">
                           <div className="w-6 h-6 md:w-8 md:h-8 bg-accent-maroon text-white rounded-lg md:rounded-xl flex items-center justify-center shrink-0 font-bold text-[9px] md:text-xs">
                              {i + 1}
                           </div>
                           <p className="text-[11px] md:text-sm font-medium text-slate-600 leading-relaxed">{rec}</p>
                        </div>
                      ))}
                   </div>
                </div>
              </div>

              <div className="lg:col-span-4 space-y-6 md:space-y-8">
                <div className="bg-slate-900 rounded-[32px] md:rounded-[40px] p-6 md:p-8 text-white relative overflow-hidden h-fit shadow-premium">
                   <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-accent-maroon/20 rounded-full blur-[50px]" />
                   <h4 className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-6 opacity-40">System Status</h4>
                   <div className="space-y-5 md:space-y-6">
                      <StatusItem label="Diagnostic Engine" status="Online" active />
                      <StatusItem label="Pattern Recognition" status="Enabled" active />
                      <StatusItem label="Clinical Synapse" status="Standby" />
                   </div>
                </div>

                <div className="bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-8 border border-slate-100 shadow-premium overflow-hidden relative">
                   <h4 className="text-[9px] md:text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-6 border-b border-slate-50 pb-4">Historical Trends</h4>
                   <div className="space-y-6">
                      <p className="text-[9px] md:text-[10px] font-medium text-slate-400 uppercase tracking-widest text-center py-6 md:py-10 leading-relaxed">Sync medical history to view <br />clinical health trends</p>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

const StatusItem = ({ label, status, active = false }: any) => (
  <div className="flex items-center justify-between">
    <span className="text-xs font-bold opacity-60">{label}</span>
    <div className="flex items-center gap-2">
       <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
       <span className="text-[10px] font-black uppercase tracking-widest">{status}</span>
    </div>
  </div>
);

export default AIAssessment;
