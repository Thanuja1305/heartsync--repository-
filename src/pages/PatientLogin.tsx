import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Heart, 
  Mail, 
  Lock, 
  ArrowRight, 
  Activity, 
  ShieldCheck, 
  Clock,
  Eye,
  EyeOff,
  Chrome,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';


const PatientLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { showToast, user, profile, loading: authLoading, login, loginWithGoogle, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Auto redirect if already logged in
  React.useEffect(() => {
    if (!authLoading && user) {
      if (profile?.role === 'patient') {
        navigate('/patient/dashboard');
      } else if (profile?.role === 'doctor') {
        const status = profile.roleProfile?.verification_status || 'pending';
        if (status === 'approved') {
          navigate('/doctor/dashboard');
        } else {
          navigate('/doctor-verification-pending');
        }
      } else if (profile?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/auth');
      }
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
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Medical ID required for recovery.");
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
      setError(err.message || "Recovery protocol failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await loginWithGoogle('patient');
    } catch (err: any) {
      setError(err.message || 'Google synchronization failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex overflow-hidden">
      <title>Patient Access | HeartSync</title>
      
      {/* LEFT SIDE: Medical Illustration & Animation */}
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
                  <Heart className="w-8 h-8 text-white animate-pulse" />
               </div>
               <h1 className="text-3xl font-black text-white tracking-tighter">Sync</h1>
            </div>

            <h2 className="text-5xl font-black text-white leading-tight mb-8 tracking-tighter">
              Your health monitored <br />
              <span className="text-accent-maroon">in real-time.</span>
            </h2>

            <div className="h-24 bg-white/5 rounded-3xl border border-white/10 flex items-center justify-center p-8 mb-12 overflow-hidden">
               <svg width="100%" height="100%" viewBox="0 0 100 20" preserveAspectRatio="none">
                  <motion.path
                    d="M0 10 L10 10 L12 2 L14 18 L16 10 L25 10 L27 5 L29 15 L31 10 L40 10 L42 2 L44 18 L46 10 L55 10 L57 5 L59 15 L61 10 L70 10 L72 2 L74 18 L76 10 L85 10 L87 5 L89 15 L91 10 L100 10"
                    fill="none"
                    stroke="#FF0000"
                    strokeWidth="0.5"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1, x: [0, -50, 0] }}
                    transition={{ 
                      pathLength: { duration: 2, repeat: Infinity },
                      x: { duration: 10, repeat: Infinity, ease: "linear" }
                    }}
                  />
               </svg>
            </div>

            <div className="space-y-4 text-white/60">
               {[
                 { icon: ShieldCheck, text: "HIPAA Compliant Encrypted Data" },
                 { icon: Activity, text: "Live Biotelemetry Stream" },
                 { icon: Clock, text: "24/7 AI Cardiac Watchdog" }
               ].map((item, i) => (
                 <div key={i} className="flex items-center gap-3">
                    <item.icon className="w-5 h-5 text-accent-maroon" />
                    <span className="text-sm font-bold">{item.text}</span>
                 </div>
               ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* RIGHT SIDE: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 md:p-20 bg-white">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md"
        >
          <div className="mb-12">
            <Link to="/" className="inline-flex items-center gap-2 mb-8 group">
               <div className="p-2 bg-accent-maroon/10 rounded-lg group-hover:bg-accent-maroon transition-colors">
                  <Heart className="w-5 h-5 text-accent-maroon group-hover:text-white" />
               </div>
               <span className="text-xl font-black text-slate-900 tracking-tighter">Sync</span>
            </Link>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-4 italic">
              {resetMode ? "Identity Recovery" : "Patient Portal"}
            </h2>
            <p className="text-slate-500 font-bold">
              {resetMode 
                ? "Re-establish secure clinical access."
                : "Secure biometric access for monitoring."}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-sm text-red-700 font-bold">{error}</p>
            </div>
          )}

          {resetSent && (
            <div className="mb-8 p-4 bg-green-50 border border-green-500/10 rounded-2xl flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-green-600 leading-relaxed uppercase tracking-tight">
                Recovery protocol initiated. Check your primary medical mailbox.
              </p>
            </div>
          )}

          {/* Demo Credentials Box */}
          <div className="mb-6 p-4 bg-accent-maroon/5 border border-accent-maroon/10 rounded-2xl">
            <p className="text-[10px] font-black text-accent-maroon uppercase tracking-widest mb-1">Demo Access Credentials</p>
            <p className="text-xs font-bold text-slate-700">Email: <span className="font-mono text-accent-maroon">patient@heartsync.com</span></p>
            <p className="text-xs font-bold text-slate-700">Password: <span className="font-mono text-accent-maroon">patient123</span></p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Medical ID (Email)</label>
              <div className="relative group">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-[24px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none transition-all font-bold text-slate-900 placeholder:text-slate-300"
                  placeholder="patient@heartsync.health"
                  required
                />
                <Mail className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-accent-maroon transition-colors" />
              </div>
            </div>

            {!resetMode && (
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Secret Key</label>
                </div>
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

            <div className="flex items-center justify-between px-1">
               <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative w-5 h-5">
                    <input 
                      type="checkbox" 
                      className="peer hidden"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <div className="w-5 h-5 border-2 border-slate-200 rounded-lg peer-checked:bg-accent-maroon peer-checked:border-accent-maroon transition-all" />
                    <ShieldCheck className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                  </div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">Stay Secured</span>
               </label>
               <button 
                 type="button" 
                 onClick={() => setResetMode(!resetMode)}
                 className="text-[10px] font-black text-accent-maroon uppercase hover:underline"
               >
                 {resetMode ? "Return to Login" : "Revoke Key"}
               </button>
            </div>

            <button
              disabled={loading}
              className="w-full py-6 bg-accent-maroon text-white font-black rounded-[28px] shadow-2xl shadow-accent-maroon/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {resetMode ? "Initialize Recovery" : "Access Dashboard"}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 flex items-center gap-4 text-slate-200">
             <div className="h-px bg-slate-100 flex-1" />
             <span className="text-[10px] font-black tracking-[0.2em] uppercase">Connect With</span>
             <div className="h-px bg-slate-100 flex-1" />
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full mt-8 py-5 bg-white border border-slate-100 shadow-xl rounded-[28px] flex items-center justify-center gap-4 hover:bg-slate-50 transition-all font-black text-xs uppercase tracking-widest text-slate-900"
          >
            <Chrome className="w-5 h-5" /> Medical ID (Google)
          </button>

          <div className="mt-12 text-center">
            <p className="text-sm font-bold text-slate-400">
              Don't have an account? <br />
              <Link to="/patient-signup" className="text-accent-maroon hover:underline font-black uppercase tracking-widest text-xs mt-2 inline-block">Create Patient Account</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PatientLogin;
