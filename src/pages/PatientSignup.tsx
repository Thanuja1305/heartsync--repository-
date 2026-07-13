import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, User, Mail, Lock, Phone, ShieldCheck, ArrowRight, Activity, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const PatientSignup = () => {
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactNumber, setEmergencyContactNumber] = useState('');
  
  // Medical info
  const [medicalConditions, setMedicalConditions] = useState('');
  const [medications, setMedications] = useState('');
  const [allergies, setAllergies] = useState('');
  const [familyHistory, setFamilyHistory] = useState('No');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signupPatient, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle('patient');
    } catch (err: any) {
      setError(err.message || 'Google authentication failed.');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Secret keys do not match.');
      return;
    }
    setLoading(true);
    try {
      await signupPatient(email, password, {
        fullName,
        phone,
        age: parseInt(age) || 0,
        gender,
        bloodGroup,
        emergencyContactName,
        emergencyContactNumber,
        medicalConditions,
        medications,
        allergies,
        familyHistory
      });
      navigate('/patient/dashboard');
    } catch (err: any) {
      setError(err.message || 'Signup registration rejected.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex overflow-hidden">
      <title>Patient Registration | HeartSync</title>
      
      {/* Left side panel */}
      <div className="hidden lg:flex lg:w-1/3 bg-slate-900 relative flex-col justify-between p-16 overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-maroon/20 rounded-full blur-[120px] animate-pulse" />
        
        <Link to="/" className="relative z-10 flex items-center gap-3 self-start">
          <Heart className="w-8 h-8 text-accent-maroon fill-accent-maroon animate-pulse" />
          <span className="text-2xl font-black text-white tracking-tighter">Sync</span>
        </Link>

        <div className="relative z-10 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-maroon/20 border border-accent-maroon/30 text-accent-maroon text-[10px] font-bold uppercase tracking-wider mb-6">
            Patient Portal
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-8 tracking-tight">Monitor <br />Your Biometrics <br /><span className="text-accent-maroon">Live.</span></h2>
          <p className="text-slate-400 text-sm leading-relaxed max-w-sm font-medium">Create an encrypted medical account connected directly to clinical response nodes.</p>
        </div>

        <div className="relative z-10 self-start w-full">
          <div className="p-6 bg-white/[0.03] border border-white/10 rounded-[24px] flex items-center gap-4">
            <ShieldCheck className="w-6 h-6 text-accent-maroon shrink-0" />
            <div>
              <p className="text-white font-bold text-xs">Encrypted Connection</p>
              <p className="text-slate-500 text-[10px]">HIPAA Compliant Protocol Grid</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side form area */}
      <div className="flex-1 overflow-y-auto bg-slate-50/50 flex items-center justify-center p-8">
        <div className="w-full max-w-xl bg-white p-10 md:p-12 rounded-[32px] border border-slate-100 shadow-premium">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-1">Patient Signup</h2>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-wider">Step {step} of 3</p>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3].map((s) => (
                <div key={s} className={`h-1 w-6 rounded-full transition-all duration-300 ${step >= s ? 'bg-accent-maroon' : 'bg-slate-100'}`} />
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-xs text-red-700 font-bold leading-normal">{error}</p>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-6">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[20px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none font-bold text-slate-900 text-sm"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[20px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none font-bold text-slate-900 text-sm"
                      placeholder="john@doe.com"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[20px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none font-bold text-slate-900 text-sm"
                      placeholder="+91 95504 13459"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[20px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none font-bold text-slate-900 text-sm"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[20px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none font-bold text-slate-900 text-sm"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="w-full py-5 bg-accent-maroon text-white font-black rounded-[24px] hover:scale-[1.01] transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-xs mt-6"
                  >\n                    Next: Biographic Data <ArrowRight className="w-4 h-4" />\n                  </button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-5">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5 col-span-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Age</label>
                      <input
                        type="number"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[20px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none font-bold text-slate-900 text-sm"
                        placeholder="30"
                        required
                      />
                    </div>
                    <div className="space-y-1.5 col-span-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gender</label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[20px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none font-bold text-slate-900 text-sm"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1.5 col-span-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Blood Group</label>
                      <select
                        value={bloodGroup}
                        onChange={(e) => setBloodGroup(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[20px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none font-bold text-slate-900 text-sm"
                      >
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Emergency Contact Name</label>
                      <input
                        type="text"
                        value={emergencyContactName}
                        onChange={(e) => setEmergencyContactName(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[20px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none font-bold text-slate-900 text-sm"
                        placeholder="Jane Doe"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Emergency Number</label>
                      <input
                        type="tel"
                        value={emergencyContactNumber}
                        onChange={(e) => setEmergencyContactNumber(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[20px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none font-bold text-slate-900 text-sm"
                        placeholder="+91 95504 13459"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-4 mt-6">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 py-5 border border-slate-200 text-slate-500 font-bold rounded-[24px] hover:bg-slate-50 transition-all uppercase tracking-wider text-xs"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="flex-[2] py-5 bg-accent-maroon text-white font-black rounded-[24px] hover:scale-[1.01] transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-xs"
                    >\n                      Next: Medical Parameters <ArrowRight className="w-4 h-4" />\n                    </button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pre-Existing Heart Conditions</label>
                    <textarea
                      value={medicalConditions}
                      onChange={(e) => setMedicalConditions(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[20px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none font-bold text-slate-900 text-sm h-24 resize-none"
                      placeholder="e.g. Arrhythmia, Coronary Artery Disease, none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Medications</label>
                      <input
                        type="text"
                        value={medications}
                        onChange={(e) => setMedications(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[20px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none font-bold text-slate-900 text-sm"
                        placeholder="e.g. Aspirin, Beta-blockers"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Allergies</label>
                      <input
                        type="text"
                        value={allergies}
                        onChange={(e) => setAllergies(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[20px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none font-bold text-slate-900 text-sm"
                        placeholder="e.g. Penicillin, none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Family History of Heart Disease</label>
                    <select
                      value={familyHistory}
                      onChange={(e) => setFamilyHistory(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[20px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none font-bold text-slate-900 text-sm"
                    >
                      <option value="No">No family history detected</option>
                      <option value="Yes">Yes, heart disease history present</option>
                    </select>
                  </div>
                  <div className="flex gap-4 mt-6">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="flex-1 py-5 border border-slate-200 text-slate-500 font-bold rounded-[24px] hover:bg-slate-50 transition-all uppercase tracking-wider text-xs"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-[2] py-5 bg-slate-900 text-white font-black rounded-[24px] hover:scale-[1.01] transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-xs disabled:opacity-50"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          Finalize Registration <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          <div className="mt-8 flex items-center gap-4 text-slate-200">
            <div className="h-px bg-slate-100 flex-1" />
            <span className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-300">Authentication Proxy</span>
            <div className="h-px bg-slate-100 flex-1" />
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full mt-6 py-4 bg-white border border-slate-100 hover:bg-slate-50 transition-all rounded-[24px] shadow-sm flex items-center justify-center gap-3 font-bold text-slate-800 text-xs uppercase tracking-wider"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.67 0 3.12.57 4.3 1.69l3.22-3.22C17.52 1.58 14.97 1 12 1 7.24 1 3.27 3.73 1.34 7.73l3.86 3C6.12 7.82 8.84 5.04 12 5.04z" />
              <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.44c-.28 1.48-1.12 2.74-2.37 3.59v2.98h3.84c2.25-2.07 3.58-5.12 3.58-8.72z" />
              <path fill="#FBBC05" d="M5.2 14.73c-.26-.78-.41-1.61-.41-2.48s.15-1.7.41-2.48l-3.86-3C.49 8.35 0 10.12 0 12s.49 3.65 1.34 5.27l3.86-3z" />
              <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.84-2.98c-1.1.74-2.5 1.18-4.12 1.18-3.16 0-5.88-2.78-6.8-5.69l-3.86 3C3.27 20.27 7.24 23 12 23z" />
            </svg>
            Register with Google
          </button>

          <div className="mt-8 text-center">
            <p className="text-xs font-bold text-slate-400">
              Already have a Patient node?{' '}
              <Link to="/patient-login" className="text-accent-maroon hover:underline font-black uppercase tracking-wider">Login Here</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientSignup;
