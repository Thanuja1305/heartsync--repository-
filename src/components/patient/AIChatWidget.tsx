import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Send, User, Sparkles, X, Heart, ShieldCheck, Minimize2, Maximize2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface AIChatWidgetProps {
  userId: string;
}

const AIChatWidget: React.FC<AIChatWidgetProps> = ({ userId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [vitals, setVitals] = useState<any>(null);
  const [patientData, setPatientData] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userId) {
      const unsubPatient = onSnapshot(doc(db, 'patients', userId), (snap) => {
        if (snap.exists()) setPatientData(snap.data());
      });
      const unsubMetrics = onSnapshot(doc(db, 'liveHealthMetrics', userId), (snap) => {
        if (snap.exists()) setVitals(snap.data());
      });
      return () => {
        unsubPatient();
        unsubMetrics();
      };
    }
  }, [userId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, isMinimized]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const context = `
        You are "HeartSync AI Agent". A medical assistant for a patient.
        Patient: ${patientData?.fullName || 'Active Patient'}
        Stats: HR: ${vitals?.heartRate || '72'} BPM, SpO2: ${vitals?.o2 || '98'}%.
        Be professional, reassuring, and concise. Advise emergency services only if HR > 120 or SpO2 < 90.
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

      setMessages(prev => [...prev, { role: 'model', text: data.text || "Synchronizing with medical nodes..." }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "Telemetry link interrupted. Please rely on emergency protocols." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      <AnimatePresence>
        {isOpen && !isMinimized && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="w-[380px] h-[520px] bg-white rounded-[32px] shadow-premium border border-slate-100 flex flex-col overflow-hidden mb-4"
          >
            <div className="p-6 bg-accent-maroon text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black tracking-tight">HeartSync AI</h4>
                  <p className="text-[8px] font-black uppercase tracking-widest opacity-60 italic">Live Medical Node</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsMinimized(true)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar" ref={scrollRef}>
              {messages.length === 0 && (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-accent-maroon/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-accent-maroon animate-pulse" />
                  </div>
                  <h5 className="font-black text-slate-900 tracking-tight mb-2 italic">How is your heart today?</h5>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed px-6">
                    Analyze vitals or describe symptoms for pre-clinical assessment.
                  </p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-4 rounded-2xl text-xs font-bold leading-relaxed max-w-[80%] ${
                    msg.role === 'user' ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-50 text-slate-600 border border-slate-100 rounded-tl-none'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="p-4 bg-slate-50 rounded-2xl rounded-tl-none border border-slate-100 italic text-[10px] font-black text-slate-400 uppercase animate-pulse">
                    Analyzing Telemetry...
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-50 bg-slate-50/50">
              <div className="relative">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Describe your symptoms..."
                  className="w-full bg-white border border-slate-100 px-6 py-4 rounded-2xl text-xs font-bold outline-none focus:border-accent-maroon/20 focus:ring-4 focus:ring-accent-maroon/5 transition-all"
                />
                <button 
                  onClick={handleSend}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-accent-maroon text-white rounded-xl shadow-lg shadow-accent-maroon/20"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => {
          if (isOpen && isMinimized) setIsMinimized(false);
          else setIsOpen(!isOpen);
        }}
        className="w-16 h-16 bg-accent-maroon text-white rounded-[24px] shadow-glow-maroon hover:shadow-glow-maroon-hover hover:scale-105 active:scale-95 transition-all flex items-center justify-center relative group"
      >
        <Bot className={`w-8 h-8 transition-transform duration-500 ${isOpen ? 'rotate-[360deg]' : ''}`} />
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-4 border-white rounded-full" />
      </button>
    </div>
  );
};

export default AIChatWidget;
