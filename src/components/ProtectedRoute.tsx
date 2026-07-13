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

  // If not logged in, allow auth pages, otherwise redirect to /auth
  if (!user) {
    if (path.startsWith('/doctor/login') || path.startsWith('/patient/login') || path.startsWith('/patient/signup') || path.startsWith('/doctor/signup') || path === '/' || path === '/auth' || path === '/signup') {
      return <>{children}</>;
    }
    return <Navigate to="/auth" replace />;
  }

  // User is authenticated
  const role = profile?.role;

  // 1. Check if user is accessing onboarding/registration or verification pending
  const isOnboarding = path === '/patient/onboarding' || path === '/doctor/registration' || path === '/doctor-verification-pending' || path === '/pending-approval';

  // 2. Prevent cross-access & wrong URL manual entry redirection
  // But allow onboarding/verification pages
  if (role === 'patient') {
    if (!isOnboarding && (path.startsWith('/doctor/dashboard') || path.startsWith('/doctor/patients') || path.startsWith('/doctor/live') || path.startsWith('/doctor/alerts') || path.startsWith('/doctor/emergency') || path.startsWith('/doctor/profile') || path.startsWith('/doctor/patient/') || path === '/admin')) {
      return <Navigate to="/patient/dashboard" replace />;
    }
  } else if (role === 'doctor') {
    if (!isOnboarding && (path.startsWith('/patient/dashboard') || path.startsWith('/patient/profile') || path.startsWith('/patient/ai') || path.startsWith('/patient/live') || path.startsWith('/patient/nearby') || path.startsWith('/patient/consultations') || path.startsWith('/patient/notifications') || path === '/admin')) {
      return <Navigate to="/doctor/dashboard" replace />;
    }
  } else if (role === 'admin') {
    if (!isOnboarding && (path.startsWith('/patient/dashboard') || path.startsWith('/doctor/dashboard'))) {
      return <Navigate to="/admin" replace />;
    }
  }

  // 3. Prevent accessing general/auth pages while logged in
  if (path === '/' || path === '/auth' || path === '/select-role' || path.includes('/login') || path === '/signup') {
    if (role === 'patient') {
      return <Navigate to="/patient/dashboard" replace />;
    } else if (role === 'doctor') {
      return <Navigate to="/doctor/dashboard" replace />;
    } else if (role === 'admin') {
      return <Navigate to="/admin" replace />;
    }
  }

  // 4. Specific role checking for route guards
  if (accessRole && role !== accessRole) {
    if (role === 'patient') return <Navigate to="/patient/dashboard" replace />;
    if (role === 'doctor') return <Navigate to="/doctor/dashboard" replace />;
    if (role === 'admin') return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
