import React from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Clock, LogOut, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const PendingApproval = () => {
  const { logout, profile } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[40px] p-12 border border-slate-100 shadow-premium text-center"
      >
        <div className="w-24 h-24 bg-accent-maroon/5 rounded-full flex items-center justify-center mx-auto mb-10 relative">
          <Clock className="w-10 h-10 text-accent-maroon animate-pulse" />
          <div className="absolute inset-0 border-4 border-accent-maroon/10 rounded-full border-t-accent-maroon animate-spin" />
        </div>

        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-4">Registry Verification</h1>
        <p className="text-slate-500 font-medium leading-relaxed mb-10">
          Your profile as a <span className="text-accent-maroon font-bold capitalize">{profile?.role}</span> is currently in the verification queue. Our medical administrators are reviewing your credentials.
        </p>

        <div className="space-y-4">
          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-left">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Security Status</h3>
            <div className="space-y-3">
              <StatusCheck label="Identity Synchronized" completed />
              <StatusCheck label="Professional Verification" />
              <StatusCheck label="Institutional Access Granted" />
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-6">
            <button 
              className="w-full py-4 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Contact Support
            </button>
            <button 
              onClick={() => logout()}
              className="w-full py-4 text-slate-400 text-xs font-black uppercase tracking-widest hover:text-red-500 transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out from Node
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const StatusCheck = ({ label, completed }: { label: string; completed?: boolean }) => (
  <div className="flex items-center gap-3">
    <div className={`w-4 h-4 rounded-full border-2 ${completed ? 'bg-accent-maroon border-accent-maroon' : 'border-slate-200'}`} />
    <span className={`text-xs font-bold ${completed ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
  </div>
);

export default PendingApproval;
