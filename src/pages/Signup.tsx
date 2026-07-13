import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, User, Mail, Lock, ChevronRight, Check, Activity, ShieldCheck, ArrowRight, Dna, Database, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Signup = () => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Google synchronization failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Neural passkeys do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signup(email, password, fullName);
      // Auth listener handles redirection
    } catch (err: any) {
      setError(err.message || 'Registry synchronization failed. Please attempt again.');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step < 3) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row">
      <title>Registry | HeartSync</title>

      {/* Side Brand Area */}
      <div className="hidden lg:flex lg:w-1/3 bg-[#071226] relative flex-col items-center justify-between p-16 overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        
        <Link to="/" className="relative z-10 flex items-center gap-3 self-start">
           <Heart className="w-8 h-8 text-accent-maroon fill-accent-maroon animate-pulse" />
           <span className="text-2xl font-black text-white tracking-tighter">Sync</span>
        </Link>

        <div className="relative z-10 text-left">
           <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-maroon/20 border border-accent-maroon/30 text-accent-maroon text-[10px] font-bold uppercase tracking-wider mb-6">
             Clinical Platform
           </div>
           <h2 className="text-5xl font-bold text-white leading-[1.1] mb-8 tracking-tight">Advanced <br />Cardiac <br /><span className="text-accent-maroon">Response.</span></h2>
           <p className="text-slate-400 text-lg leading-relaxed max-w-sm font-medium">Join a global network of medical professionals and patients powered by real-time AI monitoring.</p>
        </div>

        <div className="relative z-10 self-start w-full">
           <div className="p-6 bg-white/[0.03] border border-white/10 rounded-[32px] backdrop-blur-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-accent-maroon/20 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-accent-maroon" />
              </div>
              <div>
                <p className="text-white font-bold tracking-tight">Certified Security</p>
                <p className="text-slate-500 text-xs text-balance">HIPAA & GDPR Compliant Architecture</p>
              </div>
           </div>
        </div>
      </div>

      {/* Form Area */}
      <div className="flex-1 overflow-y-auto bg-[#FAFAFA] flex items-center justify-center p-4 sm:p-8 py-12 sm:py-16">
        <div className="w-full max-w-2xl px-2 sm:px-4">
          <div className="mb-8 md:mb-12 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-1.5 mb-6 text-accent-maroon">
              {[1, 2, 3].map((s) => (
                <div 
                  key={s} 
                  className={`h-1 rounded-full transition-all duration-500 ${step >= s ? 'w-10 bg-accent-maroon' : 'w-4 bg-accent-maroon/10'}`} 
                />
              ))}
            </div>
            <h2 className="text-2xl md:text-4xl font-display font-black text-dark-navy tracking-tighter mb-2">Neural Registry</h2>
            <p className="text-muted text-sm font-medium">Establish your synchronization node on the HeartSync grid.</p>
          </div>

          <form onSubmit={handleSignup}>
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Entity Name</label>
                    <div className="relative group">
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-[24px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none transition-all font-bold text-slate-900 placeholder:text-slate-300"
                        placeholder="Dr. John Doe"
                        required
                      />
                      <User className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-Health Address</label>
                    <div className="relative group">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-[24px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none transition-all font-bold text-slate-900 placeholder:text-slate-300"
                        placeholder="registry@heartsync.health"
                        required
                      />
                      <Mail className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Primary Pass</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-6 py-4 md:py-5 bg-slate-50 border border-slate-100 rounded-[24px] focus:ring-4 focus:ring-accent-maroon/5 outline-none transition-all font-bold text-slate-900"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm Identity</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-6 py-4 md:py-5 bg-slate-50 border border-slate-100 rounded-[24px] focus:ring-4 focus:ring-accent-maroon/5 outline-none transition-all font-bold text-slate-900"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>

                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                    <button
                      type="button"
                      onClick={nextStep}
                      className="w-full py-6 bg-accent-maroon text-white font-black rounded-[28px] shadow-2xl shadow-accent-maroon/20 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                    >
                      Continue Registration <ChevronRight className="w-5 h-5" />
                    </button>
                  </motion.div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { icon: Activity, label: 'Real-time Telemetry', active: true },
                      { icon: ShieldCheck, label: 'Encrypted Grid', active: true },
                      { icon: Dna, label: 'Neural Mapping', active: true },
                      { icon: Database, label: 'Shared Ledger', active: false }
                    ].map((feature, i) => (
                      <div key={i} className={`p-6 rounded-[32px] border ${feature.active ? 'bg-white border-accent-maroon/20' : 'bg-slate-50 border-slate-100 opacity-60'} flex flex-col gap-4`}>
                        <feature.icon className={`w-6 h-6 ${feature.active ? 'text-accent-maroon' : 'text-slate-300'}`} />
                        <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{feature.label}</p>
                      </div>
                    ))}
                  </div>
                  
                  <div className="p-8 bg-blue-50/50 border border-blue-100 rounded-[32px]">
                    <h4 className="text-xs font-bold text-blue-900 mb-2 uppercase tracking-widest">Protocol Activation</h4>
                    <p className="text-xs text-blue-800 leading-relaxed font-medium">By initializing this node, you agree to HeartSync's medical synchronization protocols and data propagation privacy terms.</p>
                  </div>

                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={prevStep}
                      className="flex-1 py-6 bg-white border border-slate-200 text-slate-400 font-black rounded-[28px] uppercase tracking-widest text-xs"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={nextStep}
                      className="flex-[2] py-6 bg-dark-navy text-white font-black rounded-[28px] shadow-2xl shadow-indigo-900/10 uppercase tracking-widest text-xs"
                    >
                      Final Phase
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-10"
                >
                  {error && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs font-bold text-red-700 leading-relaxed uppercase tracking-tight">{error}</p>
                    </div>
                  )}

                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                         <Check className="w-6 h-6 text-green-600" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tighter">Ready for Synch</h3>
                    <p className="text-slate-400 text-sm font-medium">Your profile parameters have been validated against our medical grid protocols. Finalize authentication to proceed.</p>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={prevStep}
                        className="p-6 bg-white border border-slate-200 text-slate-400 font-black rounded-[28px] uppercase tracking-widest text-xs"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 py-6 bg-slate-900 text-white font-black rounded-[28px] shadow-2xl shadow-indigo-900/20 flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50"
                      >
                        {loading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <>Finalize Neural Profile <ChevronRight className="w-5 h-5" /></>}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          <div className="mt-12 text-center space-y-6">
            <div className="relative flex items-center gap-4">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest whitespace-nowrap">Neural Proxy Elevation</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading || googleLoading}
              className="w-full py-5 bg-white border border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-[0.25em] rounded-[24px] hover:bg-slate-50 transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {googleLoading ? (
                <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
              ) : (
                <>
                   <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sync with Google
                </>
              )}
            </button>

            <p className="text-sm font-bold text-slate-400">
               Already connected to the node? <br />
               <Link to="/auth" className="text-accent-maroon hover:underline font-black uppercase tracking-widest text-xs mt-2 inline-block">Secure Login</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
