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
        navigate('/doctor/dashboard');
      } else if (profile?.role === 'patient') {
        navigate('/patient/dashboard');
      } else if (profile?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/select-role');
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
    <div className="min-h-screen bg-white flex overflow-hidden">
      <title>Doctor Access | HeartSync</title>
      
      {/* LEFT SIDE: Clinical Command Center Illustration */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#071226] relative flex-col items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#0a1f44 2px, transparent 2px), linear-gradient(90deg, #0a1f44 2px, transparent 2px)', backgroundSize: '50px 50px' }} />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          className="relative z-10 w-full max-w-lg"
        >
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-12 rounded-[64px] shadow-2xl relative overflow-hidden group">
            <div className="flex items-center gap-4 mb-12">
               <div className="p-3 bg-accent-maroon rounded-2xl">
                  <Heart className="w-8 h-8 text-white" />
               </div>
               <h1 className="text-3xl font-black text-white tracking-tighter">Sync MD</h1>
            </div>

            <h2 className="text-5xl font-black text-white leading-tight mb-8 tracking-tighter">
              Advanced Cardiac <br />
              <span className="text-accent-maroon text-4xl">Command Center.</span>
            </h2>

            {/* Emergency UI Animation */}
            <div className="bg-black/40 rounded-3xl border border-white/5 p-6 mb-12">
               <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <div className="w-2 h-2 rounded-full bg-slate-700" />
                  </div>
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Incoming Emergency</span>
               </div>
               <div className="space-y-3">
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className="w-1/2 h-full bg-accent-maroon/20" 
                    />
                  </div>
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                     <span className="text-[9px] font-bold text-white/40">ECG VERIFICATION</span>
                     <Activity className="w-3 h-3 text-accent-maroon animate-pulse" />
                  </div>
               </div>
            </div>

            <div className="space-y-4 text-white/40">
               {[
                 { icon: Building2, text: "Institutional Grade Infrastructure" },
                 { icon: Medal, text: "Board Certified Verification Node" },
                 { icon: ShieldCheck, text: "Ultra-Secure Clinical Tunneling" }
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
          initial={{ opacity: 0, x: -20 }}
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
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-4 italic uppercase">
              {resetMode ? "Session Recovery" : "Doctor Portal"}
            </h2>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">
              {resetMode 
                ? "Re-authorize clinical node access."
                : "Medical Professional Verified Sign-In"}
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
              <p className="text-xs font-bold text-green-600 leading-relaxed uppercase tracking-tight text-left">
                Recovery link dispatched. Check institutional archives.
              </p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            {!resetMode && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">License ID</label>
                  <div className="relative group">
                    <input
                      type="text"
                      value={licenseId}
                      onChange={(e) => setLicenseId(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[24px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none transition-all font-bold text-slate-900 placeholder:text-slate-300"
                      placeholder="MD-9921"
                      required
                    />
                    <Medal className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-accent-maroon transition-colors" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hospital</label>
                  <div className="relative group">
                    <input
                      list="hospitals"
                      value={hospital}
                      onChange={(e) => setHospital(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[24px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none transition-all font-bold text-slate-900 placeholder:text-slate-300"
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
                    <Building2 className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-accent-maroon transition-colors" />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{resetMode ? "Medical ID" : "Work Email (Institutional)"}</label>
              <div className="relative group">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-[24px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none transition-all font-bold text-slate-900 placeholder:text-slate-300"
                  placeholder="dr.name@hospital.com"
                  required
                />
                <Mail className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-accent-maroon transition-colors" />
              </div>
            </div>

            {!resetMode && (
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cloud Key</label>
                  <button 
                    type="button" 
                    onClick={() => setResetMode(true)}
                    className="text-[10px] font-black text-accent-maroon uppercase hover:underline"
                  >
                    Forgot Access
                  </button>
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

            {resetMode && (
              <div className="flex justify-end px-1">
                <button 
                  type="button" 
                  onClick={() => setResetMode(false)}
                  className="text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors"
                >
                  Return to Portal Login
                </button>
              </div>
            )}

            <button
              disabled={loading}
              className="w-full py-6 bg-[#071226] text-white font-black rounded-[28px] shadow-2xl shadow-indigo-900/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {resetMode ? "Dispatch Recovery Protocol" : "Authorize Session"}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 flex items-center gap-4 text-slate-200">
             <div className="h-px bg-slate-100 flex-1" />
             <span className="text-[10px] font-black tracking-[0.2em] uppercase">Security Standard</span>
             <div className="h-px bg-slate-100 flex-1" />
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full mt-8 py-5 bg-white border border-slate-100 shadow-xl rounded-[28px] flex items-center justify-center gap-4 hover:bg-slate-50 transition-all font-black text-xs uppercase tracking-widest text-slate-900"
          >
            <Chrome className="w-5 h-5" /> Institutional SSO (MD ID)
          </button>

          <div className="mt-12 text-center border-t border-slate-50 pt-8">
            <p className="text-sm font-bold text-slate-400">
              New medical practitioner? <br />
              <Link to="/signup" className="text-accent-maroon hover:underline font-black uppercase tracking-widest text-xs mt-2 inline-block">Register Board Account</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DoctorLogin;
