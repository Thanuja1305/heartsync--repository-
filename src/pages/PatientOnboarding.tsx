import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Heart, ChevronRight, Check, Activity, ShieldCheck, AlertCircle, Calendar, User, Phone, MapPin, Search } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

const FloatingInput = ({ label, name, value, onChange, type = "text", placeholder, required = false }: any) => (
  <div className="space-y-1.5 group">
    <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1 block">{label}</label>
    <div className="relative">
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
  </div>
);

const PatientOnboarding = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fullName: profile?.fullName || '',
    age: '',
    gender: '',
    address: '',
    city: '',
    state: '',
    bloodGroup: '',
    emergencyContact: '',
    preExistingConditions: '',
    medicalHistory: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
      navigate('/patient/profile');
    } catch (err: any) {
      setError(err.message || 'Failed to sync health profile. Protocol rejection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col lg:flex-row relative">
      <title>Health Registry | HeartSync</title>

      {/* Background Shapes */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-accent-maroon-light/30 skew-x-[-12deg] translate-x-1/2 pointer-events-none -z-10" />

      {/* Sidebar Content */}
      <div className="lg:w-1/3 p-12 lg:p-20 relative flex flex-col justify-between shrink-0">
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-16 group">
            <div className="p-2 bg-accent-maroon rounded-xl shadow-lg shadow-accent-maroon/20 group-hover:scale-110 transition-transform duration-300">
               <Heart className="w-6 h-6 text-white fill-white/20" />
            </div>
            <span className="text-xl font-display font-black text-dark-navy tracking-widest uppercase">Health Hub</span>
          </Link>
          
          <div className="relative">
            <div className="w-1.5 h-12 bg-accent-maroon absolute -left-12 top-0 rounded-r-full" />
            <h1 className="text-5xl font-display font-black leading-[1.05] text-dark-navy tracking-tight mb-8">
              Personalizing <br />Your <span className="text-accent-maroon italic">Cardiac</span> Safety.
            </h1>
            <p className="text-muted text-base font-medium leading-relaxed max-w-sm">
              We require your clinical baseline to establish accurate monitoring thresholds on the HeartSync grid.
            </p>
          </div>

          <div className="mt-12 space-y-4">
             {[
               { label: "Profile Sync", value: `${Math.round((step/3)*100)}% Complete`, icon: Activity },
               { label: "Data Integrity", value: "HIPAA Compliant", icon: ShieldCheck }
             ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-dark-navy/5 shadow-sm">
                   <div className="p-2 bg-slate-50 rounded-xl text-accent-maroon">
                      <item.icon className="w-5 h-5" />
                   </div>
                   <div>
                      <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">{item.label}</p>
                      <p className="text-xs font-bold text-dark-navy">{item.value}</p>
                   </div>
                </div>
             ))}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 lg:h-screen lg:overflow-y-auto px-6 py-12 lg:py-24 lg:px-24">
        <div className="max-w-3xl">
          <form onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="space-y-12">
                  <header>
                    <h2 className="text-4xl font-display font-black text-dark-navy mb-3 tracking-tighter">Identity Parameters</h2>
                    <p className="text-muted font-medium">Basic biographic information for clinical record matching.</p>
                  </header>
                  
                  <div className="grid md:grid-cols-2 gap-8">
                    <FloatingInput label="Full Name" name="fullName" value={formData.fullName} onChange={handleChange} placeholder="John Doe" required />
                    <FloatingInput label="Age" name="age" value={formData.age} onChange={handleChange} type="number" placeholder="25" required />
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1 block">Gender Identity</label>
                      <select 
                        name="gender" 
                        value={formData.gender} 
                        onChange={handleChange}
                        className="w-full px-6 py-4 bg-white border border-dark-navy/5 rounded-[20px] focus:ring-4 focus:ring-accent-maroon/5 outline-none font-bold text-dark-navy"
                      >
                        <option value="">Select Protocol</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1 block">Blood Type</label>
                      <select 
                        name="bloodGroup" 
                        value={formData.bloodGroup} 
                        onChange={handleChange}
                        className="w-full px-6 py-4 bg-white border border-dark-navy/5 rounded-[20px] focus:ring-4 focus:ring-accent-maroon/5 outline-none font-bold text-dark-navy"
                      >
                        <option value="">Select Group</option>
                        {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button type="button" onClick={nextStep} className="w-full py-6 bg-dark-navy text-white text-[11px] font-black uppercase tracking-[0.3em] rounded-[24px] shadow-2xl shadow-dark-navy/20 hover:bg-black transition-all flex items-center justify-center gap-3">
                    Proceed to Clinical History <ChevronRight className="w-5 h-5" />
                  </button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="space-y-12">
                  <header>
                    <h2 className="text-4xl font-display font-black text-dark-navy mb-3 tracking-tighter">Clinical Mapping</h2>
                    <p className="text-muted font-medium">Describe your medical history to calibrate heart health algorithms.</p>
                  </header>

                  <div className="space-y-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1 block">Surgical History & Chronic Conditions</label>
                      <textarea 
                        name="medicalHistory"
                        value={formData.medicalHistory}
                        onChange={handleChange}
                        rows={4}
                        className="w-full px-6 py-4 bg-white border border-dark-navy/5 rounded-[24px] outline-none font-bold text-dark-navy placeholder:text-muted/20"
                        placeholder="List surgeries or chronic conditions..."
                      />
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1 block">Active Medications</label>
                       <textarea 
                        name="preExistingConditions"
                        value={formData.preExistingConditions}
                        onChange={handleChange}
                        rows={4}
                        className="w-full px-6 py-4 bg-white border border-dark-navy/5 rounded-[24px] outline-none font-bold text-dark-navy placeholder:text-muted/20"
                        placeholder="List current medications..."
                      />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button type="button" onClick={prevStep} className="px-10 py-6 bg-white border border-dark-navy/10 text-muted text-[11px] font-black uppercase tracking-[0.2em] rounded-[24px]">Back</button>
                    <button type="button" onClick={nextStep} className="flex-1 py-6 bg-dark-navy text-white text-[11px] font-black uppercase tracking-[0.3em] rounded-[24px] shadow-2xl shadow-dark-navy/10 flex items-center justify-center gap-3">
                      Emergency Routing <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="space-y-12">
                  <header>
                    <h2 className="text-4xl font-display font-black text-dark-navy mb-3 tracking-tighter">Response Propagation</h2>
                    <p className="text-muted font-medium">Define contact nodes and location parameters for emergency events.</p>
                  </header>

                  <div className="grid md:grid-cols-2 gap-8">
                    <FloatingInput label="SOS Phone Node" name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} placeholder="+1 (555) 000-0000" required />
                    <FloatingInput label="Street Registry" name="address" value={formData.address} onChange={handleChange} placeholder="123 Sync Lane" required />
                    <FloatingInput label="City" name="city" value={formData.city} onChange={handleChange} placeholder="New York" required />
                    <FloatingInput label="State Cluster" name="state" value={formData.state} onChange={handleChange} placeholder="NY" required />
                  </div>

                  {error && (
                    <div className="p-4 bg-red-50 border border-medical-red/10 rounded-2xl flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-medical-red shrink-0 mt-0.5" />
                      <p className="text-xs font-bold text-medical-red leading-relaxed uppercase tracking-tight">{error}</p>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <button type="button" onClick={prevStep} className="px-10 py-6 bg-white border border-dark-navy/10 text-muted text-[11px] font-black uppercase tracking-[0.2em] rounded-[24px]">Edit</button>
                    <button type="submit" disabled={loading} className="flex-1 py-6 bg-accent-maroon text-white text-[11px] font-black uppercase tracking-[0.3em] rounded-[24px] shadow-2xl shadow-accent-maroon/20 hover:bg-dark-navy transition-all flex items-center justify-center gap-3">
                       {loading ? <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" /> : <>Initialize Health Profile <ShieldCheck className="w-5 h-5" /></>}
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

// Internal Link Helper
const Link = ({ to, children, className, onClick }: any) => (
  <a 
    href={to} 
    onClick={(e) => {
      e.preventDefault();
      if (onClick) onClick();
      window.history.pushState({}, '', to);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }} 
    className={className}
  >
    {children}
  </a>
);

export default PatientOnboarding;
