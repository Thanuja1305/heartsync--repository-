import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  HeartPulse, Users, Activity, Bell, FileText,
  MessageSquare, Settings, LogOut, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

interface DoctorSidebarProps {
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
  alertCount?: number;
}

const navItems = [
  { id: 'overview',         label: 'Overview',        icon: HeartPulse,    path: '/doctor/dashboard' },
  { id: 'patients',         label: 'Patients',         icon: Users,         path: '/doctor/patients' },
  { id: 'live-monitoring',  label: 'Live Monitoring',  icon: Activity,      path: '/doctor/live-monitoring' },
  { id: 'alerts',           label: 'Alerts',           icon: Bell,          path: '/doctor/alerts' },
  { id: 'reports',          label: 'Reports',          icon: FileText,      path: '/doctor/alerts' },
  { id: 'messages',         label: 'Messages',         icon: MessageSquare, path: '/doctor/dashboard' },
  { id: 'settings',         label: 'Settings',         icon: Settings,      path: '/doctor/profile' },
];

const DoctorSidebar: React.FC<DoctorSidebarProps> = ({ isOpen, setIsOpen, alertCount = 0 }) => {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/doctor/login');
  };

  const onItemClick = (path: string) => {
    navigate(path);
    if (setIsOpen) setIsOpen(false);
  };

  const SidebarContent = () => (
    <aside className="w-[220px] h-full bg-[#111827] border-r border-white/[0.06] flex flex-col text-white overflow-hidden">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center justify-between">
          <button onClick={() => onItemClick('/doctor/dashboard')} className="flex items-center gap-3">
            <div className="w-8 h-8 bg-accent-maroon rounded-xl flex items-center justify-center shadow-lg shadow-accent-maroon/30">
              <HeartPulse className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-sm font-black text-white tracking-tight leading-none">HeartSync</h1>
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mt-0.5">Doctor Portal</p>
            </div>
          </button>
          {setIsOpen && (
            <button onClick={() => setIsOpen(false)} className="lg:hidden p-1.5 text-slate-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-4 space-y-0.5">
        {navItems.map(item => {
          const isActive = location.pathname === item.path ||
            (item.id === 'overview' && location.pathname === '/doctor/dashboard');
          return (
            <button key={item.id} onClick={() => onItemClick(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-[11px] transition-all relative group ${
                isActive
                  ? 'bg-accent-maroon text-white shadow-lg shadow-accent-maroon/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}>
              {/* Active indicator */}
              {isActive && (
                <motion.div layoutId="activeNav"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-white rounded-r-full" />
              )}
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === 'alerts' && alertCount > 0 && (
                <span className="w-4 h-4 bg-red-500 rounded-full text-[8px] font-black flex items-center justify-center text-white shrink-0">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Doctor profile card (bottom) */}
      <div className="px-3 py-4 border-t border-white/[0.06] shrink-0">
        <button onClick={() => onItemClick('/doctor/profile')}
          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all group text-left">
          <div className="relative shrink-0">
            <div className="w-9 h-9 bg-accent-maroon rounded-xl flex items-center justify-center text-white font-black text-sm overflow-hidden">
              {profile?.photoURL
                ? <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
                : (profile?.displayName || 'D').charAt(0).toUpperCase()
              }
            </div>
            {/* Online dot */}
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#111827]">
              <div className="w-full h-full bg-green-400 rounded-full animate-ping opacity-60" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black text-white truncate group-hover:text-accent-maroon transition-colors">
              {profile?.displayName || 'Dr. Medical'}
            </p>
            <p className="text-[8px] font-bold text-slate-500 truncate">Cardiologist</p>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span className="text-[8px] font-bold text-green-500">Online</span>
            </div>
          </div>
        </button>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 mt-1 rounded-xl text-slate-600 hover:text-red-400 hover:bg-red-500/5 transition-all text-[10px] font-bold">
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block h-screen sticky top-0 shrink-0">
        <SidebarContent />
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: -220 }} animate={{ x: 0 }} exit={{ x: -220 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 h-full z-[90] lg:hidden"
          >
            <SidebarContent />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default DoctorSidebar;

