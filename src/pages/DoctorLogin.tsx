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
  Stethoscope,
  Eye,
  EyeOff,
  Chrome,
  AlertCircle,
  Building2,
  Medal
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';


const DoctorLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [licenseId, setLicenseId] = useState('');
  const [hospital, setHospital] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { showToast, user, profile, loading: authLoading, login, loginWithGoogle, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Auto redirect if already logged in
  React.useEffect(() => {
    if (!authLoading && user) {
      if (profile?.role === 'doctor') {
        const status = profile.roleProfile?.verification_status || 'pending';
        if (status === 'approved') {
          navigate('/doctor/dashboard');
        } else {
          navigate('/doctor-verification-pending');
        }
      } else if (profile?.role === 'patient') {
        navigate('/patient/dashboard');
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
      setError(err.message || 'Access denied');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Institutional Email required for recovery.");
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
      setError(err.message || "Recovery link generation failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await loginWithGoogle('doctor');
    } catch (err: any) {
      setError(err.message || 'Clinical SSO failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden font-sans">
      <title>Doctor Access | HeartSync</title>
      
      {/* LEFT SIDE: Clinical Command Center Illustration */}
      <div className="w-full lg:w-1/2 bg-[#0F1522] relative flex flex-col justify-between p-8 lg:p-16 select-none border-b lg:border-b-0 lg:border-r border-white/5 min-h-[400px] lg:min-h-screen">
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent-maroon rounded-xl flex items-center justify-center shadow-lg shadow-accent-maroon/20 border border-accent-maroon/30">
            <Heart className="w-5 h-5 text-white fill-white animate-pulse" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">HeartSync</span>
        </div>

        {/* Hero Section */}
        <div className="my-auto py-12 lg:py-0 space-y-8">
          <div className="space-y-2">
            <h2 className="text-5xl font-black text-white leading-tight tracking-tight">
              Advanced Cardiac
            </h2>
            <h2 className="text-5xl font-black text-accent-maroon leading-tight tracking-tight">
              Command Center.
            </h2>
          </div>

          {/* Telemetry Card */}
          <div className="bg-[#0B0F19] rounded-2xl border border-white/5 p-6 flex gap-6 items-center shadow-2xl max-w-md w-full">
            {/* Waveforms */}
            <div className="flex-1 space-y-4 border-r border-white/5 pr-6">
              <div className="relative">
                <svg className="w-full h-12 text-[#991B1B]" viewBox="0 0 200 60" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M0 30 L50 30 L55 10 L60 50 L65 30 L85 30 L90 20 L95 40 L100 30 L130 30 L135 5 L140 55 L145 30 L165 30 L170 20 L175 40 L180 30 L200 30" />
                </svg>
              </div>
              <div className="relative">
                <svg className="w-full h-12 text-[#10b981]" viewBox="0 0 200 60" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M0 30 L40 30 L45 15 L50 45 L55 30 L80 30 L85 10 L90 50 L95 30 L120 30 L125 15 L130 45 L135 30 L160 30 L165 10 L170 50 L175 30 L200 30" />
                </svg>
              </div>
            </div>
            
            {/* Structured Triage List */}
            <div className="w-28 shrink-0 flex flex-col justify-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Triage Status</span>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-400">Critical:</span>
                  <span className="font-black text-rose-500">2</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-400">Moderate:</span>
                  <span className="font-black text-amber-500">5</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-400">Stable:</span>
                  <span className="font-black text-emerald-500">11</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="space-y-3.5 border-t border-white/5 pt-8">
          <div className="flex items-center gap-3 text-slate-400">
            <Building2 className="w-4 h-4 text-accent-maroon opacity-65" />
            <span className="text-xs font-semibold tracking-wide">Institutional Grade Infrastructure</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-accent-maroon opacity-65" />
            <span className="text-xs font-semibold tracking-wide">Board Certified Verification Node</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <Lock className="w-4 h-4 text-accent-maroon opacity-65" />
            <span className="text-xs font-semibold tracking-wide">Ultra-Secure Clinical Tunneling</span>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-[#F8FAFC] lg:overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white p-8 rounded-3xl border border-slate-100 shadow-premium space-y-6"
        >
          {/* Form Header */}
          <div className="space-y-3">
            {/* Sync Capsule Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent-maroon/5 rounded-full border border-accent-maroon/10">
              <Heart className="w-3 h-3 text-accent-maroon fill-accent-maroon animate-pulse" />
              <span className="text-[9px] font-black text-accent-maroon uppercase tracking-widest">Sync</span>
            </div>
            
            <h2 className="text-3xl font-black text-slate-900 tracking-tight italic uppercase">
              {resetMode ? "Session Recovery" : "Doctor Portal"}
            </h2>
            <p className="text-slate-400 font-bold uppercase text-[9px] tracking-[0.15em] leading-none">
              {resetMode 
                ? "Re-authorize clinical node access."
                : "Medical Professional Verified Sign-In"}
            </p>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <p className="text-xs text-rose-800 font-bold">{error}</p>
            </div>
          )}

          {resetSent && (
            <div className="p-4 bg-green-50 border border-green-100 rounded-2xl flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-green-700 leading-relaxed uppercase tracking-tight text-left">
                Recovery link dispatched. Check institutional archives.
              </p>
            </div>
          )}

          {/* Credentials Alert Box */}
          <div className="p-4 bg-red-50/50 border border-red-100/40 rounded-2xl">
            <p className="text-[9px] font-black text-accent-maroon uppercase tracking-widest mb-1.5 font-mono">DEMO ACCESS CREDENTIALS</p>
            <p className="text-xs font-semibold text-slate-600 font-mono">Email: <span className="font-mono font-bold text-slate-950">doctor@heartsync.com</span></p>
            <p className="text-xs font-semibold text-slate-600 font-mono">Password: <span className="font-mono font-bold text-slate-950">doctor123</span></p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {!resetMode && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">License ID</label>
                  <div className="relative group">
                    <input
                      type="text"
                      value={licenseId}
                      onChange={(e) => setLicenseId(e.target.value)}
                      className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-accent-maroon/20 focus:border-accent-maroon outline-none transition-all font-bold text-slate-900 placeholder:text-slate-300 text-xs"
                      placeholder="MD-9921"
                      required
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center p-1 bg-slate-100 rounded-lg">
                      <Medal className="w-3.5 h-3.5 text-slate-400 group-focus-within:text-accent-maroon transition-colors" />
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Hospital</label>
                  <div className="relative group">
                    <input
                      list="hospitals"
                      value={hospital}
                      onChange={(e) => setHospital(e.target.value)}
                      className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-accent-maroon/20 focus:border-accent-maroon outline-none transition-all font-bold text-slate-900 placeholder:text-slate-300 text-xs"
                      placeholder="e.g. Apollo"
                      required
                    />
                    <datalist id="hospitals">
                      <option value="Apollo Hospitals" />
                      <option value="Fortis Healthcare" />
                      <option value="Max Medical" />
                      <option value="AIIMS" />
                      <option value="Lilavati Hospital" />
                      <option value="Medanta" />
                      <option value="Kokilaben Dhirubhai Ambani Hospital" />
                      <option value="Private Clinic" />
                    </datalist>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center p-1 bg-slate-100 rounded-lg">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 group-focus-within:text-accent-maroon transition-colors" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">
                {resetMode ? "Medical ID" : "Work Email (Institutional)"}
              </label>
              <div className="relative group">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-accent-maroon/20 focus:border-accent-maroon outline-none transition-all font-bold text-slate-900 placeholder:text-slate-300 text-xs"
                  placeholder="dr.name@hospital.com"
                  required
                />
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-accent-maroon transition-colors" />
              </div>
            </div>

            {!resetMode && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Cloud Key</label>
                  <button 
                    type="button" 
                    onClick={() => setResetMode(true)}
                    className="text-[9px] font-black text-accent-maroon uppercase tracking-wide hover:underline"
                  >
                    Forgot Access
                  </button>
                </div>
                <div className="relative group">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-accent-maroon/20 focus:border-accent-maroon outline-none transition-all font-bold text-slate-900 placeholder:text-slate-300 text-xs"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-950 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {resetMode && (
              <div className="flex justify-end px-1">
                <button 
                  type="button" 
                  onClick={() => setResetMode(false)}
                  className="text-[9px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors"
                >
                  Return to Portal Login
                </button>
              </div>
            )}

            <button
              disabled={loading}
              className="w-full py-3.5 bg-[#0B0F19] hover:bg-[#121824] text-white font-black rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[11px] disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {resetMode ? "Dispatch Recovery Protocol" : "Authorize Session"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="flex items-center gap-4 text-slate-300 my-4">
            <div className="h-px bg-slate-100 flex-1" />
            <span className="text-[9px] font-black tracking-[0.2em] uppercase text-slate-400">Security Standard</span>
            <div className="h-px bg-slate-100 flex-1" />
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3 bg-white border border-slate-200 shadow-sm rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50 transition-all font-black text-[11px] uppercase tracking-widest text-slate-900"
          >
            <Chrome className="w-4 h-4 text-slate-700" />
            <span>Institutional SSO (MD ID)</span>
          </button>

          <div className="text-center pt-2">
            <p className="text-xs font-bold text-slate-400">
              Don't have a doctor account? <br />
              <Link to="/doctor-signup" className="text-accent-maroon hover:underline font-black uppercase tracking-widest text-[10px] mt-2 inline-block">Create Doctor Account</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DoctorLogin;
