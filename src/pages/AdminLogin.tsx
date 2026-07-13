import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Shield, 
  Mail, 
  Lock, 
  ArrowRight, 
  Activity, 
  ShieldCheck, 
  Clock,
  Eye,
  EyeOff,
  Chrome,
  AlertCircle,
  Database
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { auth, googleProvider, db } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { showToast, user, profile, loading: authLoading, login, loginWithGoogle, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Auto redirect if already logged in as admin
  React.useEffect(() => {
    if (!authLoading && user && profile?.role === 'admin') {
      navigate('/admin');
    }
  }, [user, profile, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetMode) {
      handleResetPassword(e);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Institutional login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Admin ID required for recovery.");
      return;
    }
    setLoading(true);
    setError('');
    try {
      await resetPassword(email);
      setResetSent(true);
      setTimeout(() => {
        setResetMode(false);
        setResetSent(false);
      }, 6000);
    } catch (err: any) {
      setError(err.message || "Root recovery protocol failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Google synchronization failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex overflow-hidden">
      <title>Admin Access | HeartSync</title>
      
      {/* LEFT SIDE: Admin Infrastructure Illustration */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative flex-col items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-maroon/20 rounded-full blur-[120px] animate-pulse" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          className="relative z-10 w-full max-w-lg"
        >
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-12 rounded-[64px] shadow-2xl relative overflow-hidden group">
            <div className="flex items-center gap-4 mb-12">
               <div className="p-3 bg-accent-maroon rounded-2xl">
                  <Shield className="w-8 h-8 text-white animate-pulse" />
               </div>
               <h1 className="text-3xl font-black text-white tracking-tighter">Admin</h1>
            </div>

            <h2 className="text-5xl font-black text-white leading-tight mb-8 tracking-tighter">
              Governance & <br />
              <span className="text-accent-maroon italic">Verification Node.</span>
            </h2>

            <div className="space-y-6 text-white/60 mb-12">
               {[
                 { icon: Database, text: "Clinical Registry Management" },
                 { icon: ShieldCheck, text: "Credential Verification Protocol" },
                 { icon: Clock, text: "System Audit & Compliance" }
               ].map((item, i) => (
                 <div key={i} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                    <item.icon className="w-5 h-5 text-accent-maroon" />
                    <span className="text-sm font-bold">{item.text}</span>
                 </div>
               ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* RIGHT SIDE: Admin Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 md:p-20 bg-white">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md"
        >
          <div className="mb-12">
            <Link to="/" className="inline-flex items-center gap-2 mb-8 group">
               <div className="p-2 bg-accent-maroon/10 rounded-lg group-hover:bg-accent-maroon transition-colors">
                  <Shield className="w-5 h-5 text-accent-maroon group-hover:text-white" />
               </div>
               <span className="text-xl font-black text-slate-900 tracking-tighter">HeartSync</span>
            </Link>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-4">
              {resetMode ? "Root Recovery" : "Admin Nexus"}
            </h2>
            <p className="text-slate-500 font-bold">
              {resetMode 
                ? "Re-establish administrative control."
                : "Authorize institutional access logs."}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-sm text-red-700 font-bold">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Admin ID</label>
              <div className="relative group">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-[24px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none transition-all font-bold text-slate-900 placeholder:text-slate-300"
                  placeholder="admin@heartsync.health"
                  required
                />
                <Mail className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-accent-maroon transition-colors" />
              </div>
            </div>

            {!resetMode && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Security Key</label>
                <div className="relative group">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-[24px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none transition-all font-bold text-slate-900 placeholder:text-slate-300"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-900"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            <button
              disabled={loading}
              className="w-full py-6 bg-slate-900 text-white font-black rounded-[28px] shadow-2xl shadow-slate-900/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {resetMode ? "Initialize Root Recovery" : "Access Nexus"}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full mt-8 py-5 bg-white border border-slate-100 shadow-xl rounded-[28px] flex items-center justify-center gap-4 hover:bg-slate-50 transition-all font-black text-xs uppercase tracking-widest text-slate-900"
          >
            <Chrome className="w-5 h-5" /> Institutional ID
          </button>

          <div className="mt-12 text-center">
             <button 
               type="button" 
               onClick={() => setResetMode(!resetMode)}
               className="text-[10px] font-black text-accent-maroon uppercase hover:underline"
             >
               {resetMode ? "Return to Login" : "Forgot Institutional Key?"}
             </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminLogin;
