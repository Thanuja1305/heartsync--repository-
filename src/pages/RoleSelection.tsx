import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Heart, Shield, ArrowRight, User as UserIcon, Activity, Plus, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const RoleSelection = () => {
  const navigate = useNavigate();
  const { updateProfileData, user, profile, loading: authLoading, showToast, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'patient' | 'doctor' | 'admin' | null>(null);

  // Remove automatic redirect on mount to allow users to see the Role Selection page when they click Sign In.
  const handleRoleSelect = async (role: 'patient' | 'doctor' | 'admin') => {
    setSelectedRole(role);
    setLoading(true);

    try {
      // If we already have a user and their profile role matches the selected role, send them directly to dashboard
      if (user && profile?.role === role) {
        showToast(`Welcome back! Accessing ${role} portal...`, 'success');
        if (role === 'patient') {
          navigate('/patient/dashboard');
        } else if (role === 'doctor') {
          const status = profile.roleProfile?.verification_status || 'pending';
          if (status === 'approved') {
            navigate('/doctor/dashboard');
          } else {
            navigate('/doctor-verification-pending');
          }
        } else {
          navigate('/admin');
        }
        setLoading(false);
        return;
      }

      // If we already have a user but their active session role is different, sign them out first
      if (user && profile?.role && profile.role !== role) {
        showToast(`Switching roles... signing out of active session`, 'success');
        await logout();
      }

      // If we have a user but no profile role, update the profile role
      if (user && !profile?.role) {
        await updateProfileData({ role });
        showToast(`${role} profile initialized`, 'success');
        if (role === 'patient') {
          navigate('/patient/dashboard');
        } else if (role === 'doctor') {
          navigate('/doctor-verification-pending');
        } else {
          navigate('/admin');
        }
        setLoading(false);
        return;
      }

      // If no user is logged in, show the login page for the selected role
      showToast(`Redirecting to ${role} login...`, 'success');
      const targetPath = role === 'admin' ? '/admin/login' : role === 'patient' ? '/patient/login' : '/doctor/login';
      setTimeout(() => {
        navigate(targetPath);
        setLoading(false);
      }, 800);

    } catch (error) {
      console.error("Error during role selection:", error);
      showToast("Verification protocol failed.", "error");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-accent-maroon/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-slate-50 rounded-full blur-[120px] pointer-events-none" />

      {/* Content Container */}
      <div className="max-w-5xl w-full relative z-10 text-center px-0 sm:px-6">
        {/* Header Section */}
        <motion.div
           initial={{ opacity: 0, y: -20 }}
           animate={{ opacity: 1, y: 0 }}
           className="mb-8 md:mb-16"
        >
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-accent-maroon/5 rounded-2xl border border-accent-maroon/10 mb-6 md:mb-8 mx-auto">
            <Heart className="w-5 h-5 text-accent-maroon fill-accent-maroon/20" />
            <span className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">HeartSync</span>
          </div>
          <h1 className="text-3xl md:text-6xl font-bold text-slate-900 tracking-tight mb-4 leading-tight">Choose Your Role</h1>
          <p className="text-slate-400 font-medium text-[9px] md:text-xs tracking-[0.1em] uppercase px-6">Select how you want to use the HeartSync platform</p>
        </motion.div>

        {/* Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto px-4 md:px-0">
          {/* Patient Card */}
          <RoleCard 
            title="I am a Patient"
            description="Monitor your heart health in real time, receive AI insights, and access emergency medical support."
            icon={Activity}
            role="patient"
            selected={selectedRole === 'patient'}
            isLoading={loading}
            onSelect={() => handleRoleSelect('patient')}
          />

          {/* Doctor Card */}
          <RoleCard 
            title="I am a Doctor"
            description="Monitor emergency patients, analyze ECG reports, and respond to critical health alerts."
            icon={Shield}
            role="doctor"
            selected={selectedRole === 'doctor'}
            isLoading={loading}
            onSelect={() => handleRoleSelect('doctor')}
          />

          {/* Admin Card (Hidden by default) */}
          {(new URLSearchParams(window.location.search).get('admin') === 'true' || profile?.role === 'admin') && (
            <RoleCard 
              title="Administrator"
              description="Manage medical personnel, verify professional credentials, and monitor system-wide cardiac health metrics."
              icon={ShieldCheck}
              role="admin"
              selected={selectedRole === 'admin'}
              isLoading={loading}
              onSelect={() => handleRoleSelect('admin')}
            />
          )}
        </div>
      </div>

      {/* Fast Transition Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white/60 backdrop-blur-md flex flex-col items-center justify-center text-center"
          >
            <div className="w-16 h-16 border-4 border-slate-100 border-t-accent-maroon rounded-full animate-spin mb-6" />
            <p className="text-[10px] font-black uppercase text-accent-maroon tracking-widest animate-pulse">Initializing Portal...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface RoleCardProps {
  title: string;
  description: string;
  icon: any;
  role: 'patient' | 'doctor' | 'admin';
  selected: boolean;
  isLoading: boolean;
  onSelect: () => void;
}

const RoleCard = ({ title, description, icon: Icon, role, selected, isLoading, onSelect }: RoleCardProps) => (
  <motion.button
    whileHover={{ y: -4, scale: 1.01 }}
    whileTap={{ scale: 0.98 }}
    disabled={isLoading}
    onClick={onSelect}
    className={`relative group bg-white p-8 md:p-12 rounded-[32px] md:rounded-[56px] border text-left transition-all overflow-hidden ${
      selected ? 'border-accent-maroon shadow-premium-hover ring-4 ring-accent-maroon/5' : 'border-slate-100 hover:border-slate-200 shadow-premium hover:shadow-premium-hover'
    }`}
  >
    {/* Card Glow Effect */}
    <div className={`absolute top-0 right-0 w-32 md:w-48 h-32 md:h-48 rounded-bl-[80px] md:rounded-bl-[100px] transition-all group-hover:opacity-100 opacity-0 ${
       role === 'patient' ? 'bg-accent-maroon/5' : 'bg-slate-50'
    }`} />

    <div className="relative z-10">
      <div className={`w-14 h-14 md:w-16 md:h-16 rounded-[20px] md:rounded-[24px] flex items-center justify-center mb-6 md:mb-10 transition-all ${
        selected ? 'bg-accent-maroon text-white animate-pulse' : 'bg-accent-maroon/5 text-accent-maroon group-hover:scale-110'
      }`}>
        <Icon className="w-6 h-6 md:w-8 md:h-8" />
      </div>
      
      <h3 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3 md:mb-4 tracking-tight">{title}</h3>
      <p className="text-slate-500 font-medium leading-relaxed mb-8 md:mb-10 text-xs md:text-sm">
        {description}
      </p>

      <div className={`inline-flex items-center gap-3 px-6 md:px-8 py-3.5 md:py-4 rounded-full font-bold text-[10px] md:text-xs uppercase tracking-wider transition-all ${
        selected ? 'bg-accent-maroon text-white' : 'bg-slate-900 text-white group-hover:bg-accent-maroon'
      }`}>
        {isLoading && selected ? 'Connecting...' : `Continue as ${role}`}
        <ArrowRight className="w-4 h-4" />
      </div>
    </div>
  </motion.button>
);

export default RoleSelection;
