import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Send, User, Sparkles, AlertCircle, Heart, Zap, ShieldCheck, Menu } from 'lucide-react';
import PatientSidebar from '../components/PatientSidebar';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const AIChat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [vitals, setVitals] = useState<any>(null);
  const [patientData, setPatientData] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      const unsubPatient = onSnapshot(doc(db, 'patients', user.uid), (snap) => {
        if (snap.exists()) setPatientData(snap.data());
      });
      const unsubMetrics = onSnapshot(doc(db, 'liveHealthMetrics', user.uid), (snap) => {
        if (snap.exists()) setVitals(snap.data());
      });
      const unsubAnalysis = onSnapshot(doc(db, 'aiAnalysis', user.uid), (snap) => {
        if (snap.exists()) setAnalysis(snap.data());
      });
      return () => {
        unsubPatient();
        unsubMetrics();
        unsubAnalysis();
      };
    }
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const context = `
        You are "CardioAssist AI", a specialized cardiac emergency assistant.
        Patient Information:
        Name: ${patientData?.fullName || 'Registry Patient'}
        Age: ${patientData?.age || 'N/A'}
        Live Vitals:
        Heart Rate: ${vitals?.heartRate || 'Monitoring...'} BPM
        Blood Pressure: ${vitals?.bpSys || '--'}/${vitals?.bpDia || '--'} mmHg
        Oxygen (SpO2): ${vitals?.o2 || '--'}%
        Current AI Risk Assessment: ${analysis?.riskLevel || 'Unknown'} (Risk Score: ${analysis?.riskScore || '0'}/100)
        Emergency Status: ${vitals?.isEmergency ? 'EMERGENCY TRIGGERED' : 'Stable'}

        Instruction: 
        1. Always be calm, medical-focused, and concise.
        2. If vitals show signs of heart attack (HR > 120, BP > 160, Risk Score > 80), immediately advise clicking the EMERGENCY SOS and provide immediate survival steps (sit down, chew aspirin if not allergic, stay calm).
        3. Do not provide general medical advice; stay focused on cardiac health and emergency prevention.
        4. Use the telemetry data provided above to give specific insights.
      `;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          history: messages,
          context: context
        })
      });

      if (!response.ok) throw new Error("Server communication failure");
      const data = await response.json();

      const aiText = data.text || "I'm sorry, I'm having trouble processing your cardiac data right now. Please monitor your live dashboard or contact help.";
      setMessages(prev => [...prev, { role: 'model', text: aiText }]);
    } catch (error: any) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "Emergency Comms Error: Please rely on your manual emergency protocols if you feel chest pain." }]);
    } finally {
      setIsLoading(false);
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
        <header className="h-20 lg:h-24 bg-white/70 backdrop-blur-2xl border-b border-slate-100 px-4 md:px-6 lg:px-12 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 md:gap-4">
             <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 bg-white rounded-xl border border-slate-100 shadow-sm text-slate-600">
               <Menu className="w-5 h-5" />
             </button>
             <div className="p-2 md:p-3 bg-accent-maroon rounded-lg md:rounded-2xl shadow-lg shadow-accent-maroon/20 text-white">
               <Bot className="w-5 h-5 md:w-6 md:h-6" />
             </div>
             <div>
               <h1 className="text-base md:text-2xl font-bold text-slate-900 tracking-tight">AI Heart Assistant</h1>
               <p className="text-[8px] md:text-[10px] font-medium text-slate-400 uppercase tracking-widest leading-none">Powered by Gemini Neural V3</p>
             </div>
          </div>
          
          <div className="hidden sm:flex items-center gap-4 md:gap-6">
             <div className="flex flex-col items-end">
                <span className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Live Sync Status</span>
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                   <span className="text-[10px] md:text-xs font-bold text-slate-900 truncate max-w-[100px] md:max-w-none">{analysis?.riskLevel || 'Stable'} Risk Indication</span>
                </div>
             </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col min-h-0 bg-white m-3 sm:m-4 md:m-6 lg:m-12 rounded-[20px] md:rounded-[40px] shadow-premium border border-slate-100 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 space-y-5 md:space-y-8 no-scrollbar" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[300px] h-full text-center max-w-lg mx-auto py-10 md:py-0">
                 <div className="w-16 h-16 md:w-24 md:h-24 bg-accent-maroon/5 rounded-full flex items-center justify-center mb-4 md:mb-6">
                    <Sparkles className="w-8 h-8 md:w-10 md:h-10 text-accent-maroon animate-pulse" />
                 </div>
                 <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-2 md:mb-4 tracking-tight px-4">Hello {patientData?.fullName?.split(' ')[0] || 'Registry Patient'}</h2>
                 <p className="text-xs md:text-sm font-medium text-slate-500 leading-relaxed px-6 md:px-0">
                   I am your personalized 24/7 cardiac intelligence assistant. I monitor your live vitals and ECG patterns to provide emergency guidance.
                 </p>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mt-8 md:mt-12 w-full px-4 md:px-0">
                    <Suggestion title="Interpret ECG" onClick={() => setInput("Can you explain my current ECG status?")} />
                    <Suggestion title="Symptom Check" onClick={() => setInput("I'm feeling slight chest pressure, what should I do?")} />
                 </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-3 md:gap-4 max-w-[90%] md:max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                   <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-900 text-white' : 'bg-accent-maroon text-white'}`}>
                      {msg.role === 'user' ? <User className="w-4 h-4 md:w-5 md:h-5" /> : <Bot className="w-4 h-4 md:w-5 md:h-5" />}
                   </div>
                   <div className={`p-4 md:p-6 rounded-[20px] md:rounded-3xl text-sm font-medium leading-relaxed shadow-sm ${
                     msg.role === 'user' ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-50 text-slate-700 border border-slate-100 rounded-tl-none'
                   }`}>
                      {msg.text}
                   </div>
                </div>
              </motion.div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                 <div className="flex gap-3 md:gap-4">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-accent-maroon rounded-lg md:rounded-xl flex items-center justify-center text-white">
                       <Bot className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    <div className="flex gap-1 items-center px-4 md:px-6 py-3 md:py-4 bg-slate-50 rounded-[20px] md:rounded-3xl">
                       <div className="w-1.5 h-1.5 bg-accent-maroon rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                       <div className="w-1.5 h-1.5 bg-accent-maroon rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                       <div className="w-1.5 h-1.5 bg-accent-maroon rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                    </div>
                 </div>
              </div>
            )}
          </div>

          <div className="p-4 md:p-8 border-t border-slate-100 bg-[#F8FAFC]">
            <div className="relative max-w-4xl mx-auto flex gap-3 md:gap-4">
               <input 
                 type="text" 
                 value={input}
                 onChange={(e) => setInput(e.target.value)}
                 onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                 placeholder="Describe symptoms or ask about clinical heart metrics..."
                 className="flex-1 bg-white border border-slate-100 px-5 md:px-8 py-3.5 md:py-4 rounded-xl md:rounded-3xl text-sm md:text-base font-medium focus:outline-none focus:border-accent-maroon/20 focus:shadow-premium ring-offset-2 focus:ring-4 focus:ring-accent-maroon/5 transition-all w-full placeholder:text-slate-300"
               />
               <button 
                 onClick={handleSend}
                 disabled={isLoading}
                 className="w-12 h-12 md:w-14 md:h-14 bg-accent-maroon rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-glow-maroon hover:shadow-glow-maroon-hover hover:scale-105 active:scale-95 transition-all shrink-0"
               >
                 <Send className="w-5 h-5 md:w-6 md:h-6" />
               </button>
            </div>
            <p className="text-center mt-3 text-[8px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest hidden xs:block">
              Emergency Note: AI guidance is pre-clinical. Always rely on the SOS button for critical events.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
};

const Suggestion = ({ title, onClick }: any) => (
  <button 
    onClick={onClick}
    className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-left hover:border-accent-maroon/20 hover:bg-white hover:shadow-xl transition-all group"
  >
    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-accent-maroon">Quick Check</p>
    <p className="text-sm font-bold text-slate-900">{title}</p>
  </button>
);

export default AIChat;
