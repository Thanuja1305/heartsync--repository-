import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode; accessRole?: 'patient' | 'doctor' | 'admin' }> = ({ children, accessRole }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const path = location.pathname;

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-2 border-slate-100 rounded-full" />
            <div className="absolute inset-0 border-2 border-accent-maroon border-t-transparent rounded-full animate-spin" />
            <Heart className="absolute inset-0 m-auto w-4 h-4 text-accent-maroon animate-pulse" />
          </div>
          <p className="text-slate-400 font-bold uppercase text-[9px] tracking-[0.3em] animate-pulse">Securing Session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If user is at role selection, let them be there if they don't have a role
  if (path === '/auth' || path === '/select-role') {
    if (profile?.role) {
      return <Navigate to="/" replace />;
    }
    return <>{children}</>;
  }

  // If user has no role, force role selection
  if (!profile?.role && path !== '/auth' && path !== '/select-role') {
    return <Navigate to="/auth" replace />;
  }

  // Role checking
  if (accessRole && profile?.role !== accessRole) {
    return <Navigate to="/" replace />;
  }

  // Role-based access control
  const isOnboarding = path === '/patient/onboarding' || path === '/doctor/registration';
  
  if (profile?.role === 'admin' && profile?.status === 'pending' && !isOnboarding) {
    return <Navigate to="/pending-approval" replace />;
  }

  if (profile?.status === 'approved' && path === '/pending-approval') {
    return <Navigate to="/" replace />;
  }

  if (profile?.role === 'patient' && (path.startsWith('/doctor') || path.startsWith('/doctor-')) && !path.startsWith(`/doctor/patient/${user.uid}`)) {
    return <Navigate to="/" replace />;
  }

  if (profile?.role === 'doctor' && (path.startsWith('/patient') || path.startsWith('/patient-'))) {
    return <Navigate to="/" replace />;
  }

  // If user is at a generic path or other, redirect to home if needed
  if (path === '/signup') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
