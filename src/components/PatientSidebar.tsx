import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Heart, 
  Activity, 
  History, 
  MapPin, 
  Bell, 
  Users, 
  LogOut, 
  X, 
  Settings, 
  User,
  MessageSquare,
  Stethoscope,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';

interface PatientSidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  patientData?: any;
}

const PatientSidebar: React.FC<PatientSidebarProps> = ({ isSidebarOpen, setIsSidebarOpen, patientData }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, showToast } = useAuth();

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      showToast('Successfully signed out', 'success');
      navigate('/patient/login');
    } catch (error) {
      showToast('Error signing out', 'error');
    }
  };

  const menuItems = [
    { icon: Activity, label: 'Live Monitor', path: '/', exact: true },
  ];

  return (
    <>
      <aside className={`
        fixed lg:relative z-[90] lg:z-10
        w-80 h-full bg-white border-r border-slate-100 flex flex-col
        transition-transform duration-500 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
       shadow-2xl lg:shadow-none
      `}>
        {/* Header */}
        <div className="p-8 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Heart className="w-8 h-8 text-accent-maroon fill-accent-maroon" />
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              HeartSync
            </span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 text-slate-400 hover:text-slate-900 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* User Card */}
        <div className="p-8 pt-4">
          <div className="bg-slate-50/50 rounded-[32px] p-6 border border-slate-100 flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="w-20 h-20 rounded-[28px] overflow-hidden border-4 border-white shadow-premium ring-4 ring-accent-maroon/5">
                <img 
                  src={patientData?.photoURL || user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} 
                  className="w-full h-full object-cover" 
                  alt="Profile" 
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-4 border-white rounded-full" />
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-accent-maroon/5 rounded-full mt-1">
              <div className="w-1.5 h-1.5 bg-accent-maroon rounded-full animate-pulse" />
              <span className="text-[9px] font-bold text-accent-maroon uppercase tracking-widest">Live Monitoring</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-6 space-y-1 overflow-y-auto no-scrollbar">
          <p className="px-4 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4">Central Hub</p>
          {menuItems.map((item) => {
            const isActive = item.exact 
              ? location.pathname === item.path 
              : location.pathname.startsWith(item.path);
            
            return (
              <button
                key={item.label}
                onClick={() => {
                  navigate(item.path);
                  if (window.innerWidth < 1024) setIsSidebarOpen(false);
                }}
                className={`
                  w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all group relative
                  ${isActive 
                    ? 'bg-slate-900 text-white shadow-premium' 
                    : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}
                `}
              >
                <div className={`p-2 rounded-xl transition-all ${isActive ? 'bg-white/10' : 'bg-slate-50 group-hover:bg-white'}`}>
                  <item.icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
      </aside>
    </>
  );
};

export default PatientSidebar;
