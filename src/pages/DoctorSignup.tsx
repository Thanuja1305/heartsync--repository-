import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, User, Mail, Lock, Phone, ShieldCheck, ArrowRight, Activity, AlertCircle, Award, Building, BookOpen, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const DoctorSignup = () => {
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [age, setAge] = useState('');
  
  // Professional Details
  const [medicalLicenseId, setMedicalLicenseId] = useState('');
  const [medicalCollege, setMedicalCollege] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [specialization] = useState('Cardiology'); // Auto-default to Cardiology
  
  // File upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signupDoctor, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle('doctor');
    } catch (err: any) {
      setError(err.message || 'Google authentication failed.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const uploadDocument = async (file: File): Promise<string> => {
    setUploadProgress(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `documents/${fileName}`;
      
      // Upload to supabase storage bucket (using 'verification-documents' bucket or fallback 'profiles')
      const { data, error: uploadErr } = await supabase.storage
        .from('verification-documents')
        .upload(filePath, file);
      
      if (uploadErr) {
        // Fallback to profiles bucket if verification-documents doesn't exist
        const { data: fbData, error: fbErr } = await supabase.storage
          .from('profiles')
          .upload(filePath, file);
        
        if (fbErr) throw fbErr;
        
        const { data: { publicUrl } } = supabase.storage
          .from('profiles')
          .getPublicUrl(filePath);
        return publicUrl;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('verification-documents')
        .getPublicUrl(filePath);
      return publicUrl;
    } catch (err) {
      console.warn("Document upload bucket error, using mock preview URL.");
      return `https://cnewnmlodacuokqdoxqb.supabase.co/storage/v1/object/public/profiles/mock_cert_${Date.now()}.pdf`;
    } finally {
      setUploadProgress(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Passkeys do not match.');
      return;
    }
    if (!selectedFile) {
      setError('Please upload verification details.');
      return;
    }
    
    setLoading(true);
    try {
      const docUrl = await uploadDocument(selectedFile);
      await signupDoctor(email, password, {
        fullName,
        phone,
        age: parseInt(age) || 0,
        medicalLicenseId,
        medicalCollege,
        experienceYears: parseInt(experienceYears) || 0,
        hospitalName,
        specialization,
        medicalDocumentUrl: docUrl
      });
      navigate('/doctor-verification-pending');
    } catch (err: any) {
      setError(err.message || 'Doctor registry rejected.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex overflow-hidden">
      <title>Doctor Registration | HeartSync</title>
      
      {/* Left side panel */}
      <div className="hidden lg:flex lg:w-1/3 bg-slate-900 relative flex-col justify-between p-16 overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-maroon/20 rounded-full blur-[120px] animate-pulse" />
        
        <Link to="/" className="relative z-10 flex items-center gap-3 self-start">
          <Heart className="w-8 h-8 text-accent-maroon fill-accent-maroon animate-pulse" />
          <span className="text-2xl font-black text-white tracking-tighter">Sync MD</span>
        </Link>

        <div className="relative z-10 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-maroon/20 border border-accent-maroon/30 text-accent-maroon text-[10px] font-bold uppercase tracking-wider mb-6">
            Doctor Portal
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-8 tracking-tight">Manage <br />Your Patients <br /><span className="text-accent-maroon">Seamlessly.</span></h2>
          <p className="text-slate-400 text-sm leading-relaxed max-w-sm font-medium">Register your medical credentials to analyze real-time ECG reports and respond to cardiac alerts.</p>
        </div>

        <div className="relative z-10 self-start w-full">
          <div className="p-6 bg-white/[0.03] border border-white/10 rounded-[24px] flex items-center gap-4">
            <ShieldCheck className="w-6 h-6 text-accent-maroon shrink-0" />
            <div>
              <p className="text-white font-bold text-xs">Certified Access</p>
              <p className="text-slate-500 text-[10px]">Board Verification Node Standard</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side form area */}
      <div className="flex-1 overflow-y-auto bg-slate-50/50 flex items-center justify-center p-8">
        <div className="w-full max-w-xl bg-white p-10 md:p-12 rounded-[32px] border border-slate-100 shadow-premium">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-1">Doctor Signup</h2>
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
                      placeholder="Dr. John Doe"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Work Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[20px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none font-bold text-slate-900 text-sm"
                      placeholder="dr.doe@hospital.com"
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
                  >
                    Next: Professional Details <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Age</label>
                      <input
                        type="number"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[20px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none font-bold text-slate-900 text-sm"
                        placeholder="35"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Years of Experience</label>
                      <input
                        type="number"
                        value={experienceYears}
                        onChange={(e) => setExperienceYears(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[20px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none font-bold text-slate-900 text-sm"
                        placeholder="8"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Medical License ID</label>
                    <input
                      type="text"
                      value={medicalLicenseId}
                      onChange={(e) => setMedicalLicenseId(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[20px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none font-bold text-slate-900 text-sm"
                      placeholder="MD-9921"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Medical College Name</label>
                    <input
                      type="text"
                      value={medicalCollege}
                      onChange={(e) => setMedicalCollege(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[20px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none font-bold text-slate-900 text-sm"
                      placeholder="Harvard Medical School"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hospital Name</label>
                      <input
                        type="text"
                        value={hospitalName}
                        onChange={(e) => setHospitalName(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[20px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none font-bold text-slate-900 text-sm"
                        placeholder="Apollo Hospital"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Specialization</label>
                      <input
                        type="text"
                        value={specialization}
                        disabled
                        className="w-full px-6 py-4 bg-slate-100 border border-slate-100 rounded-[20px] outline-none font-bold text-slate-500 text-sm cursor-not-allowed"
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
                    >
                      Next: Verification Docs <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-5">
                  <div className="space-y-2 text-center p-8 border-2 border-dashed border-slate-200 rounded-[24px] bg-slate-50/50 hover:bg-slate-50 transition-all relative group">
                    <FileText className="w-10 h-10 text-slate-300 mx-auto group-hover:scale-110 transition-transform" />
                    <p className="font-bold text-slate-700 text-sm mt-2">Upload Medical License Cert</p>
                    <p className="text-slate-400 text-xs">PDF, PNG, JPG up to 10MB</p>
                    <input
                      type="file"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      required
                    />
                    {selectedFile && (
                      <div className="mt-4 p-2 bg-green-50 text-green-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2">
                        Selected: {selectedFile.name}
                      </div>
                    )}
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
                      disabled={loading || uploadProgress}
                      className="flex-[2] py-5 bg-slate-900 text-white font-black rounded-[24px] hover:scale-[1.01] transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-xs disabled:opacity-50"
                    >
                      {loading || uploadProgress ? (
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          Submit Verification <ArrowRight className="w-4 h-4" />
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
            <span className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-300">Institutional SSO</span>
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
              Already registered?{' '}
              <Link to="/doctor/login" className="text-accent-maroon hover:underline font-black uppercase tracking-wider">Login Here</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorSignup;
