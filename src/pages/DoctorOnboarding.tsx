import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Stethoscope, ChevronRight, Check, Upload, AlertCircle, Heart, Globe, Activity, Database } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

const FloatingInput = ({ label, name, value, onChange, type = "text", placeholder, required = false }: any) => (
  <div className="relative group">
    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 mb-2 block">{label}</label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      className="w-full px-6 py-4 bg-white border border-dark-navy/5 rounded-[20px] focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon outline-none transition-all font-bold text-dark-navy placeholder:text-muted/20"
      placeholder={placeholder}
      required={required}
    />
  </div>
);

const DoctorOnboarding = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fullName: profile?.fullName || '',
    specialization: '',
    experience: '',
    hospitalName: '',
    licenseNumber: '',
    contactNumber: '',
    email: user?.email || '',
    city: '',
    state: '',
    emergencyAvailability: true
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const nextStep = () => setStep(prev => prev + 1);
  const prevStep = () => setStep(prev => prev - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        ...formData,
        onboardingCompleted: true,
        updatedAt: new Date().toISOString()
      });
      navigate('/doctor/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to sync clinical profile. Node rejection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col lg:flex-row">
      <title>Clinical Registry | HeartSync</title>

      {/* Left Decoration Overlay */}
      <div className="hidden lg:flex lg:w-[400px] bg-dark-navy p-12 flex-col justify-between relative overflow-hidden shrink-0">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] bg-[size:32px_32px]" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="p-2 bg-accent-maroon rounded-xl">
               <Heart className="w-6 h-6 text-white fill-white/20" />
            </div>
            <span className="text-xl font-display font-black text-white tracking-widest uppercase">Node Control</span>
          </div>
          
          <h1 className="text-4xl lg:text-5xl font-bold leading-[1.1] mb-8 tracking-tight text-white">
            Elevating <br />Medical <br /><span className="text-accent-maroon">Standards.</span>
          </h1>
          
          <div className="space-y-6 mt-12">
            {[
              { icon: Globe, label: "Global Network", desc: "Connected to over 4k clusters." },
              { icon: Activity, label: "Live Telemetry", desc: "Real-time sync enabled." },
              { icon: Database, label: "Verified Node", desc: "Institutional grade credentials." }
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                 <item.icon className="w-5 h-5 text-accent-maroon shrink-0 mt-0.5" />
                 <div>
                    <p className="text-[10px] font-black text-white uppercase tracking-widest mb-1">{item.label}</p>
                    <p className="text-xs text-white/40 leading-relaxed">{item.desc}</p>
                 </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 pt-10 border-t border-white/5">
           <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">HeartSync Protocol v2.4</p>
        </div>
      </div>

      {/* Main Form Content */}
      <div className="flex-1 overflow-y-auto px-6 py-12 lg:p-20">
        <div className="max-w-3xl mx-auto">
          {/* Progress Tracker */}
          <div className="flex items-center gap-4 mb-16 px-2">
             {[1, 2, 3].map(s => (
               <div key={s} className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm transition-all duration-500 ${step >= s ? 'bg-accent-maroon text-white shadow-lg shadow-accent-maroon/20' : 'bg-white border border-dark-navy/10 text-muted'}`}>
                    {step > s ? <Check className="w-5 h-5" /> : s}
                  </div>
                  {s < 3 && <div className={`w-10 h-0.5 rounded-full ${step > s ? 'bg-accent-maroon' : 'bg-dark-navy/5'}`} />}
               </div>
             ))}
          </div>

          <form onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-10">
                  <header>
                    <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">Professional Identity</h2>
                    <p className="text-slate-500 font-medium leading-relaxed">Let's set up your clinical profile for patient orientation.</p>
                  </header>
                  <div className="grid md:grid-cols-2 gap-8">
                    <FloatingInput label="Full Name" name="fullName" value={formData.fullName} onChange={handleChange} placeholder="Dr. Sarah Connor" required />
                    <FloatingInput label="Primary Specialization" name="specialization" value={formData.specialization} onChange={handleChange} placeholder="Interventional Cardiology" required />
                    <FloatingInput label="Principal Hospital" name="hospitalName" value={formData.hospitalName} onChange={handleChange} placeholder="Mayo Clinic" required />
                    <FloatingInput label="Institutional Email" name="email" value={formData.email} onChange={handleChange} placeholder="doctor@hospital.com" required />
                    <FloatingInput label="Total Experience" name="experience" value={formData.experience} onChange={handleChange} type="number" placeholder="Yrs" />
                    <FloatingInput label="Current City" name="city" value={formData.city} onChange={handleChange} placeholder="New York" />
                    <FloatingInput label="State" name="state" value={formData.state} onChange={handleChange} placeholder="NY" />
                    <FloatingInput label="Emergency Contact" name="contactNumber" value={formData.contactNumber} onChange={handleChange} placeholder="+1 (555) 000-0000" />
                  </div>
                  <button type="button" onClick={nextStep} className="w-full py-6 bg-dark-navy text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-[24px] shadow-2xl shadow-dark-navy/10 hover:bg-black transition-all">
                    Initiate Phase II
                  </button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-10">
                  <header>
                    <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">Medical Verification</h2>
                    <p className="text-slate-500 font-medium leading-relaxed">We require valid credentials to grant access to the biotelemetry network.</p>
                  </header>
                  <div className="grid md:grid-cols-2 gap-8">
                    <FloatingInput label="Medical License Number" name="licenseNumber" value={formData.licenseNumber} onChange={handleChange} placeholder="LCS-9283-X" required />
                  </div>
                  
                  <div className="p-10 bg-white border border-dark-navy/5 rounded-[40px] border-dashed flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition-all group">
                     <div className="p-4 bg-accent-maroon-light rounded-2xl text-accent-maroon group-hover:scale-110 transition-transform mb-4">
                        <Upload className="w-6 h-6" />
                     </div>
                     <p className="text-sm font-black text-dark-navy uppercase tracking-widest mb-1">Upload Digital Certificate</p>
                     <p className="text-xs text-muted font-medium">Drag & drop your medical board certification (PDF, JPG)</p>
                  </div>

                  <div className="flex gap-4">
                    <button type="button" onClick={prevStep} className="px-10 py-6 bg-white border border-dark-navy/10 text-muted text-[11px] font-black uppercase tracking-[0.2em] rounded-[24px]">Back</button>
                    <button type="button" onClick={nextStep} className="flex-1 py-6 bg-dark-navy text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-[24px] shadow-2xl shadow-dark-navy/10">Continue to Finalization</button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-10">
                  <header>
                    <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">System Initialization</h2>
                    <p className="text-slate-500 font-medium leading-relaxed">Please review your clinical node parameters before deployment.</p>
                  </header>

                  {error && (
                    <div className="p-4 bg-red-50 border border-medical-red/10 rounded-2xl flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-medical-red shrink-0 mt-0.5" />
                      <p className="text-xs font-bold text-medical-red leading-relaxed uppercase tracking-tight">{error}</p>
                    </div>
                  )}

                  <div className="bg-white rounded-[40px] border border-dark-navy/5 overflow-hidden shadow-premium">
                    <div className="p-8 border-b border-dark-navy/5 flex items-center justify-between">
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-accent-maroon rounded-2xl flex items-center justify-center text-white font-bold">SC</div>
                          <div>
                            <p className="text-sm font-black text-dark-navy uppercase tracking-tight">{formData.fullName}</p>
                            <p className="text-xs text-muted font-medium italic">{formData.specialization}</p>
                          </div>
                       </div>
                       <div className="px-3 py-1 bg-green-50 text-green-600 text-[9px] font-bold uppercase tracking-widest rounded-full border border-green-100">Ready</div>
                    </div>
                    <div className="p-8 grid grid-cols-2 gap-8 bg-slate-50/30">
                       <div>
                          <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">Affiliation</p>
                          <p className="text-xs font-bold text-dark-navy">{formData.hospitalName}</p>
                       </div>
                       <div>
                          <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">Experience</p>
                          <p className="text-xs font-bold text-dark-navy">{formData.experience} Years</p>
                       </div>
                       <div>
                          <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">License ID</p>
                          <p className="text-xs font-bold text-dark-navy">{formData.licenseNumber}</p>
                       </div>
                       <div>
                          <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">Region</p>
                          <p className="text-xs font-bold text-dark-navy">{formData.city}, {formData.state}</p>
                       </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button type="button" onClick={prevStep} className="px-10 py-6 bg-white border border-dark-navy/10 text-muted text-[11px] font-black uppercase tracking-[0.2em] rounded-[24px]">Edit</button>
                    <button type="submit" disabled={loading} className="flex-1 py-6 bg-accent-maroon text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-[24px] shadow-2xl shadow-accent-maroon/20 hover:bg-dark-navy transition-all flex items-center justify-center gap-3 relative group overflow-hidden">
                      {loading ? (
                        <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <span className="relative z-10">Deploy Profile</span> 
                          <ShieldCheck className="w-6 h-6 group-hover:rotate-12 transition-transform relative z-10" />
                        </>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-r from-accent-maroon to-medical-red opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DoctorOnboarding;
