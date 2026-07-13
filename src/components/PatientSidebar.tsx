import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Heart, 
  Activity, 
  MapPin, 
  Bell, 
  LogOut, 
  X, 
  Settings, 
  User,
  MessageSquare,
  Stethoscope,
  BrainCircuit
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface PatientSidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  patientData?: any;
}

const PatientSidebar: React.FC<PatientSidebarProps> = ({ isSidebarOpen, setIsSidebarOpen, patientData }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, logout, showToast } = useAuth();

  const handleSignOut = async () => {
    try {
      await logout();
      showToast('Successfully signed out', 'success');
      navigate('/patient/login');
    } catch (error) {
      showToast('Error signing out', 'error');
    }
  };

  const menuItems = [
    { icon: Heart, label: 'Dashboard', path: '/patient/dashboard' },
    { icon: BrainCircuit, label: 'AI Assessment', path: '/patient/ai-assessment' },
    { icon: MessageSquare, label: 'AI Chat', path: '/patient/ai-chat' },
    { icon: Activity, label: 'Nearby Care', path: '/patient/nearby-care' },
    { icon: MapPin, label: 'Live Location', path: '/patient/live-location' },
    { icon: Stethoscope, label: 'Consultations', path: '/patient/consultations' },
    { icon: Bell, label: 'Notifications', path: '/patient/notifications' },
    { icon: Settings, label: 'Profile Settings', path: '/patient/profile' }
  ];

  return (
    <>
      <aside className={`
        fixed lg:relative z-[90] lg:z-10
        w-80 h-full bg-[#6F1D1D] text-white flex flex-col border-r border-white/10
        transition-transform duration-500 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        shadow-2xl lg:shadow-none
      `}>
        {/* Header */}
        <div className="p-8 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Heart className="w-8 h-8 text-white fill-white animate-pulse" />
            <span className="text-xl font-bold text-white tracking-tight">
              HeartSync
            </span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* User Card */}
        <div className="p-8 pt-4">
          <div className="bg-white/5 rounded-[32px] p-6 border border-white/10 flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="w-20 h-20 rounded-[28px] overflow-hidden border-4 border-white shadow-premium ring-4 ring-white/5">
                <img 
                  src={patientData?.photoURL || user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} 
                  className="w-full h-full object-cover" 
                  alt="Profile" 
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-4 border-white rounded-full animate-pulse" />
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full mt-1">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              <span className="text-[9px] font-bold text-white uppercase tracking-widest">Active Node</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-6 space-y-1 overflow-y-auto no-scrollbar">
          <p className="px-4 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-4">Central Hub</p>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            
            return (
              <button
                key={item.label}
                onClick={() => {
                  navigate(item.path);
                  if (window.innerWidth < 1024) setIsSidebarOpen(false);
                }}
                className={`
                  w-full flex items-center gap-4 px-6 py-3.5 rounded-2xl transition-all group relative
                  ${isActive 
                    ? 'bg-white/15 text-white font-bold shadow-inner border border-white/10' 
                    : 'text-white/70 hover:text-white hover:bg-white/5'}
                `}
              >
                <item.icon className="w-4 h-4" />
                <span className="text-xs font-bold tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer: Logout */}
        <div className="p-6 border-t border-white/10">
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-3 bg-white/10 hover:bg-[#b91c1c] text-white rounded-xl text-xs font-bold transition-all border border-white/10"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default PatientSidebar;
