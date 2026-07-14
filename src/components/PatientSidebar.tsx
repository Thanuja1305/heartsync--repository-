import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Heart, HeartPulse, BrainCircuit, FileText, Bell, Settings, LogOut, X,
  MessageSquare, MapPin, Navigation
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface PatientSidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isConnected?: boolean;
  patientData?: any;
}

const NAV_ITEMS = [
  { name: 'Dashboard',   icon: HeartPulse,      path: '/patient/dashboard' },
  { name: 'AI Assessment', icon: BrainCircuit,  path: '/patient/ai-assessment' },
  { name: 'AI Chat',     icon: MessageSquare,   path: '/patient/ai-chat' },
  { name: 'Nearby Care', icon: MapPin,          path: '/patient/nearby-care' },
  { name: 'Ambulance',   icon: Navigation,      path: '/patient/live-location' },
  { name: 'Reports',     icon: FileText,        path: '/patient/consultations' },
  { name: 'Alerts',      icon: Bell,            path: '/patient/notifications' },
  { name: 'Profile',     icon: Settings,        path: '/patient/profile' },
];

const PatientSidebar: React.FC<PatientSidebarProps> = ({ isSidebarOpen, setIsSidebarOpen: setIsOpen, isConnected = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  return (
    <>
      <aside className={`
        fixed lg:relative z-[90] lg:z-10
        w-[220px] h-full bg-accent-maroon text-white flex flex-col border-r border-white/10
        transition-transform duration-300 ease-in-out lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        shadow-2xl lg:shadow-xl lg:shadow-accent-maroon/20 shrink-0
      `}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center border border-white/20">
              <Heart className="w-5 h-5 text-white fill-white" />
            </div>
            <div>
              <h1 className="text-[15px] font-black tracking-tight leading-none">HeartSync</h1>
              <p className="text-[8px] font-black text-white/50 uppercase tracking-widest leading-none mt-0.5">Patient Portal</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="lg:hidden p-1 text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto no-scrollbar">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            // Active if exact path matches, or if it is Settings and path is Profile
            const isActive = location.pathname === item.path;
            return (
              <button key={item.name}
                onClick={() => { navigate(item.path); setIsOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold tracking-tight transition-all ${
                  isActive
                    ? 'bg-white/20 text-white shadow-sm'
                    : 'text-white/65 hover:text-white hover:bg-white/10'
                }`}>
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-white/60'}`} />
                {item.name}
              </button>
            );
          })}
        </nav>

        {/* Bottom: Device status + Logout */}
        <div className="px-3 py-4 border-t border-white/10 space-y-3">
          <div className="p-3 bg-white/[0.07] rounded-xl border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-white/50 uppercase tracking-wider">Device Status</span>
              <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${isConnected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-400'}`}>
                {isConnected ? '● Connected' : '● Offline'}
              </span>
            </div>
            <p className="text-[11px] font-bold text-white">ESP32 HeartSync</p>
            <div className="flex items-center justify-between text-[9px] text-white/50">
              <span>Battery</span>
              <span className="font-mono font-bold text-white/70">{isConnected ? '92%' : '--'}</span>
            </div>
          </div>
          <button onClick={async () => { await logout(); navigate('/patient/login'); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all">
            <LogOut className="w-3.5 h-3.5" />Sign Out
          </button>
        </div>
      </aside>
    </>
  );
};

export default PatientSidebar;
