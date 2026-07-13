import React from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  Activity, 
  Bell, 
  MapPin, 
  HeartPulse, 
  ShieldCheck,
  LogOut,
  ChevronRight,
  User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

interface DoctorSidebarProps {
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
}

const DoctorSidebar: React.FC<DoctorSidebarProps> = ({ isOpen, setIsOpen }) => {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { id: 'live-monitoring', label: 'Live Telemetry', icon: Activity, path: '/doctor/live-monitoring' },
    { id: 'patients', label: 'Patient Registry', icon: Users, path: '/doctor/patients' },
    { id: 'alerts', label: 'Alert History', icon: Bell, path: '/doctor/alerts' },
    { id: 'emergency', label: 'Emergency Dispatch', icon: MapPin, path: '/doctor/emergency' },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/doctor/login');
  };

  const onItemClick = (path: string) => {
    navigate(path);
    if (setIsOpen) setIsOpen(false);
  };

  return (
    <aside className={`
      w-80 bg-slate-900 text-white p-8 flex flex-col border-r border-white/5 h-screen sticky top-0 shrink-0 z-[100]
      transition-transform duration-300 ease-in-out lg:translate-x-0
      fixed lg:sticky
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onItemClick('/doctor/dashboard')}>
          <div className="p-2.5 bg-accent-maroon rounded-2xl shadow-lg shadow-accent-maroon/20">
            <HeartPulse className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight italic">HeartSync</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Medical Node</p>
          </div>
        </div>
        {setIsOpen && (
          <button onClick={() => setIsOpen(false)} className="lg:hidden p-2 text-slate-400 hover:text-white">
             <HeartPulse className="w-6 h-6" />
          </button>
        )}
      </div>

      <div 
        onClick={() => onItemClick('/doctor/profile')}
        className="mb-10 p-5 bg-white/5 rounded-3xl border border-white/10 hover:bg-white/10 transition-all cursor-pointer group"
      >
         <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-accent-maroon rounded-xl flex items-center justify-center text-white font-black shrink-0">
               {profile?.photoURL ? (
                 <img src={profile.photoURL} alt="" className="w-full h-full object-cover rounded-xl" />
               ) : (
                 profile?.displayName?.charAt(0) || 'D'
               )}
            </div>
            <div className="flex-1 min-w-0">
               <p className="text-sm font-bold text-white truncate group-hover:text-accent-maroon transition-colors">{profile?.displayName || 'Dr. Medical'}</p>
               <p className="text-[10px] font-black text-accent-maroon uppercase tracking-widest leading-none">Verified Doctor</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-all transform group-hover:translate-x-1" />
         </div>
         <div className="flex items-center gap-2 pt-4 border-t border-white/5">
            <ShieldCheck className="w-3 h-3 text-green-500" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Credentials</span>
         </div>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto no-scrollbar">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.id === 'live-monitoring' && location.pathname === '/doctor/dashboard');
          return (
            <button 
              key={item.id}
              onClick={() => onItemClick(item.path)}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold text-sm transition-all ${
                isActive 
                  ? 'bg-accent-maroon text-white shadow-lg shadow-accent-maroon/20' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <button 
        onClick={handleLogout}
        className="mt-6 flex items-center gap-3 p-4 text-slate-400 hover:text-white hover:bg-white/5 rounded-2xl transition-all"
      >
        <LogOut className="w-5 h-5" />
        <span className="font-bold text-sm">Sign Out</span>
      </button>
    </aside>
  );
};

export default DoctorSidebar;
