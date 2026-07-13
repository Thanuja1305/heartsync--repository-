import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  User, 
  Phone, 
  ShieldAlert, 
  Activity, 
  ChevronRight, 
  ArrowLeft,
  Camera,
  CheckCircle2,
  HeartPulse,
  Stethoscope,
  Save,
  Plus,
  X,
  AlertCircle,
  Menu,
  Upload
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PatientSidebar from '../components/PatientSidebar';
import { doc, setDoc, onSnapshot, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const STEPS = [
  { id: 'basic', label: 'Basic Information', icon: User, fields: ['fullName', 'username', 'age', 'gender', 'bloodGroup', 'occupation', 'height', 'weight'] },
  { id: 'contact', label: 'Contact Details', icon: Phone, fields: ['phoneNumber', 'address', 'emergencyContactName', 'emergencyContactPhone'] },
  { id: 'questionnaire', label: 'Medical History', icon: Stethoscope, fields: ['hasHeartAttack', 'hasHypertension', 'hasThyroid', 'hasAnxiety', 'stressLevel', 'hasDiabetes', 'isSmoking', 'hasChestPain', 'hasBreathingIssue', 'hasFamilyHistory'] },
  { id: 'photo', label: 'Profile Photo', icon: Camera, fields: ['photoURL'] },
  { id: 'review', label: 'Final Review', icon: CheckCircle2, fields: [] }
];

const profileSchema = z.object({
  fullName: z.string().min(3, "Required"),
  username: z.string().optional(),
  age: z.string().min(1, "Required"),
  gender: z.enum(['Male', 'Female', 'Other', 'Prefer not to say']),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  occupation: z.string().optional(),
  height: z.string().optional(),
  weight: z.string().optional(),
  phoneNumber: z.string().regex(/^[0-9]{10}$/, "Valid 10-digit number"),
  address: z.string().min(5, "Required"),
  emergencyContactName: z.string().min(3, "Required"),
  emergencyContactPhone: z.string().regex(/^[0-9]{10}$/, "Valid 10-digit number"),
  hasHeartAttack: z.boolean().default(false),
  hasHypertension: z.boolean().default(false),
  hasThyroid: z.boolean().default(false),
  hasAnxiety: z.boolean().default(false),
  stressLevel: z.number().min(1).max(10).default(5),
  hasDiabetes: z.boolean().default(false),
  isSmoking: z.boolean().default(false),
  hasChestPain: z.boolean().default(false),
  hasBreathingIssue: z.boolean().default(false),
  hasFamilyHistory: z.boolean().default(false),
  photoURL: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const DEFAULT_VALUES: ProfileFormData = {
  fullName: '',
  username: '',
  age: '',
  gender: 'Male',
  bloodGroup: 'A+',
  occupation: '',
  height: '',
  weight: '',
  phoneNumber: '',
  address: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  hasHeartAttack: false,
  hasHypertension: false,
  hasThyroid: false,
  hasAnxiety: false,
  stressLevel: 5,
  hasDiabetes: false,
  isSmoking: false,
  hasChestPain: false,
  hasBreathingIssue: false,
  hasFamilyHistory: false,
  photoURL: ''
};

const PatientProfile = () => {
  const navigate = useNavigate();
  const { user, showToast, updateProfileData } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPhotoPreview, setLocalPhotoPreview] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [patientData, setPatientData] = useState<any>(null);

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { isValid },
    trigger,
    reset
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema) as any,
    mode: 'onChange',
    defaultValues: DEFAULT_VALUES
  });

  useEffect(() => {
    if (!user) return;
    const fetchInitialData = async () => {
      const docRef = doc(db, 'patients', user.uid);
      try {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data() as ProfileFormData;
          setPatientData(data);
          reset({ ...DEFAULT_VALUES, ...data });
          if (data.photoURL) setLocalPhotoPreview(data.photoURL);
        } else {
          setValue('fullName', user.displayName || '');
          if (user.photoURL) {
            setValue('photoURL', user.photoURL);
            setLocalPhotoPreview(user.photoURL);
          }
        }
      } catch (err: any) {
        handleFirestoreError(err, OperationType.GET, `patients/${user.uid}`);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [user, reset, setValue]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => setLocalPhotoPreview(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    setSaving(true);
    try {
      let finalPhotoURL = data.photoURL;
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const storageRef = ref(storage, `patients/${user.uid}/profile_${Date.now()}.${fileExt}`);
        const uploadResult = await uploadBytes(storageRef, selectedFile);
        finalPhotoURL = await getDownloadURL(uploadResult.ref);
      }

      const patientPayload = {
        ...data,
        photoURL: finalPhotoURL,
        onboardingCompleted: true,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'patients', user.uid), patientPayload, { merge: true });
      await updateProfileData({ 
        onboardingCompleted: true,
        fullName: data.fullName,
        photoURL: finalPhotoURL
      });

      showToast("Medical profile synchronized", "success");
      navigate('/patient/dashboard');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `patients/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-12 text-center font-black text-slate-400 animate-pulse uppercase text-xs tracking-widest">Accessing Medical Records...</div>;

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden relative font-sans text-slate-900">
      <PatientSidebar 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen} 
        patientData={patientData || getValues()} 
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-20 md:h-24 bg-white/70 backdrop-blur-2xl border-b border-slate-100 px-4 md:px-12 flex items-center justify-between shrink-0 border-transparent">
          <div className="flex items-center gap-3 md:gap-4">
             <button 
               onClick={() => setIsSidebarOpen(true)}
               className="lg:hidden p-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
               type="button"
             >
               <Menu className="w-5 h-5 md:w-6 md:h-6" />
             </button>
             <div className="flex items-center gap-2 md:gap-3">
                <div className="hidden sm:block p-2 text-white bg-accent-maroon rounded-xl md:rounded-2xl shadow-lg shadow-accent-maroon/20">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-base md:text-2xl font-black text-slate-900 tracking-tight">Clinical Profile</h1>
                  <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Onboarding & Baselines</p>
                </div>
             </div>
          </div>
        </header>

        {/* Scrollable Container */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 no-scrollbar">
          <div className="max-w-5xl mx-auto pb-20">
            <div className="flex flex-col lg:flex-row gap-8 md:gap-12 lg:items-start">
        {/* Sidebar Steps */}
        <aside className="w-full lg:w-72 shrink-0 lg:sticky lg:top-8">
          <div className="bg-white rounded-[24px] md:rounded-[32px] border border-slate-100 p-4 md:p-6 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible no-scrollbar">
            {STEPS.map((step, idx) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setCurrentStep(idx)}
                className={`flex-shrink-0 flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl md:rounded-2xl transition-all ${
                  currentStep === idx ? 'bg-accent-maroon text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'
                }`}
              >
                <step.icon className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{step.label}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Form Content */}
        <div className="flex-1 min-w-0">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 md:space-y-10">
            <header className="px-2">
               <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight italic mb-1 md:mb-2">{STEPS[currentStep].label}</h2>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Medical Compliance Node {currentStep + 1}</p>
            </header>

            <div className="bg-white rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-premium p-6 md:p-10">
              {currentStep === 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  <FormInput control={control} name="fullName" label="Full Name" />
                  <FormInput control={control} name="age" label="Age" type="number" />
                  <FormSelect control={control} name="gender" label="Gender" options={['Male', 'Female', 'Other', 'Prefer not to say']} />
                  <FormSelect control={control} name="bloodGroup" label="Blood Group" options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']} />
                  <FormInput control={control} name="occupation" label="Occupation" />
                  <div className="grid grid-cols-2 gap-4">
                    <FormInput control={control} name="height" label="Height (cm)" />
                    <FormInput control={control} name="weight" label="Weight (kg)" />
                  </div>
                </div>
              )}

              {currentStep === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  <FormInput control={control} name="phoneNumber" label="Phone (+91)" />
                  <FormInput control={control} name="address" label="Residential Address" />
                  <FormInput control={control} name="emergencyContactName" label="Emergency Contact Name" />
                  <FormInput control={control} name="emergencyContactPhone" label="Emergency Contact Phone" />
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6 md:space-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                    <FormToggle control={control} name="hasHeartAttack" label="Previous Heart Attack?" />
                    <FormToggle control={control} name="hasHypertension" label="BP / Hypertension?" />
                    <FormToggle control={control} name="hasThyroid" label="Thyroid Condition?" />
                    <FormToggle control={control} name="hasAnxiety" label="Anxiety?" />
                    <FormToggle control={control} name="hasDiabetes" label="Diabetes?" />
                    <FormToggle control={control} name="isSmoking" label="Smoking Habits?" />
                    <FormToggle control={control} name="hasChestPain" label="Chest Pain History?" />
                    <FormToggle control={control} name="hasBreathingIssue" label="Breathing Issues?" />
                    <FormToggle control={control} name="hasFamilyHistory" label="Family Heart Disease?" />
                  </div>
                  <div className="pt-6 border-t border-slate-50">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Daily Stress Level (1-10)</label>
                    <Controller
                      control={control}
                      name="stressLevel"
                      render={({ field }) => (
                        <div className="space-y-6">
                           <div className="relative group flex items-center gap-4 md:gap-6">
                              <div className="relative flex-1 h-2.5 md:h-3 bg-slate-100 rounded-full overflow-hidden">
                                 <motion.div 
                                   initial={false}
                                   animate={{ width: `${(( (field.value || 5) - 1) / 9) * 100}%` }}
                                   className="absolute top-0 left-0 h-full bg-gradient-to-r from-accent-maroon to-medical-red"
                                 />
                                 <input 
                                   type="range" 
                                   min="1" 
                                   max="10" 
                                   className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                   {...field}
                                   value={field.value ?? 5}
                                   onChange={e => field.onChange(parseInt(e.target.value))}
                                 />
                              </div>
                              <motion.div 
                                key={field.value}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="w-12 h-12 md:w-14 md:h-14 bg-slate-900 text-white rounded-xl md:rounded-2xl flex flex-col items-center justify-center shadow-2xl shrink-0"
                              >
                                 <span className="text-lg md:text-xl font-black">{field.value ?? 5}</span>
                                 <span className="text-[8px] font-black uppercase opacity-40">LVL</span>
                              </motion.div>
                           </div>
                           <div className="flex justify-between px-1">
                              {['Low', 'Medium', 'High'].map((label, i) => (
                                <span key={label} className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{label}</span>
                              ))}
                           </div>
                        </div>
                      )}
                    />
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="flex flex-col items-center py-6 md:py-10">
                   <div className="relative group mb-8 md:mb-10">
                      <input type="file" id="p-up" className="hidden" onChange={handleFileChange} />
                      <label htmlFor="p-up" className="w-40 h-40 md:w-48 md:h-48 bg-slate-50 border-4 border-white shadow-2xl rounded-[32px] md:rounded-[40px] overflow-hidden flex items-center justify-center cursor-pointer hover:scale-105 transition-all">
                        {localPhotoPreview ? (
                          <img src={localPhotoPreview} className="w-full h-full object-cover" />
                        ) : (
                          <Camera className="w-10 h-10 md:w-12 md:h-12 text-slate-200" />
                        )}
                      </label>
                      <label htmlFor="p-up" className="absolute -bottom-2 md:-bottom-4 -right-2 md:-right-4 bg-accent-maroon text-white p-3 md:p-4 rounded-2xl md:rounded-3xl shadow-xl cursor-pointer hover:scale-110 transition-all border-4 border-white">
                        <Upload className="w-4 h-4 md:w-5 md:h-5" />
                      </label>
                   </div>
                   <p className="text-[10px] md:text-xs font-bold text-slate-400 text-center max-w-xs px-4 uppercase tracking-widest">Upload medical ID photo for clinical identification.</p>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="bg-slate-50 rounded-2xl md:rounded-3xl overflow-hidden border border-slate-100">
                    <SummaryRow label="Patient" value={getValues('fullName')} />
                    <SummaryRow label="Blood" value={getValues('bloodGroup')} />
                    <SummaryRow label="Age" value={getValues('age')} />
                    <SummaryRow label="Stress" value={getValues('stressLevel')} />
                  </div>
                  <div className="p-4 md:p-6 bg-green-50 rounded-2xl md:rounded-3xl border border-green-100 flex gap-3 md:gap-4">
                    <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-green-500 shrink-0" />
                    <div>
                      <p className="text-xs md:text-sm font-black text-green-900 tracking-tight">Records Verified</p>
                      <p className="text-[10px] md:text-xs font-medium text-green-600/70">Signature ready for medical synchronization.</p>
                    </div>
                  </div>
                </div>
              )}

              <footer className="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-slate-50 flex justify-between items-center px-1">
                <button 
                  type="button" 
                  onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                  className="px-4 md:px-8 py-3 md:py-4 text-[9px] md:text-[10px] font-black uppercase text-slate-400 hover:text-slate-900 transition-colors disabled:opacity-0"
                  disabled={currentStep === 0}
                >
                  Back
                </button>
                {currentStep === STEPS.length - 1 ? (
                  <button 
                    type="submit"
                    disabled={saving}
                    className="px-6 md:px-10 py-3 md:py-5 bg-accent-maroon text-white rounded-xl md:rounded-2xl shadow-xl shadow-accent-maroon/20 text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                  >
                    {saving ? "Syncing..." : "Sync Profile"}
                    {!saving && <Save className="w-4 h-4" />}
                  </button>
                ) : (
                  <button 
                    type="button" 
                    onClick={() => setCurrentStep(prev => Math.min(STEPS.length - 1, prev + 1))}
                    className="px-6 md:px-10 py-3 md:py-5 bg-slate-900 text-white rounded-xl md:rounded-2xl shadow-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Next Section
                  </button>
                )}
              </footer>
            </div>
          </form>
        </div>
      </div>
    </div>
  </main>
</div>
</div>
  );
};

const FormInput = ({ control, name, label, ...props }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">{label}</label>
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <input 
          {...field} 
          value={field.value ?? ''} 
          {...props} 
          className="w-full p-4 bg-slate-50 border border-transparent focus:border-accent-maroon/20 focus:bg-white rounded-2xl text-sm font-bold outline-none transition-all" 
        />
      )}
    />
  </div>
);

const FormSelect = ({ control, name, label, options }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">{label}</label>
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <select 
          {...field} 
          value={field.value ?? ''}
          className="w-full p-4 bg-slate-50 border border-transparent focus:border-accent-maroon/20 focus:bg-white rounded-2xl text-sm font-bold outline-none transition-all appearance-none cursor-pointer"
        >
          <option value="" disabled>Select {label}</option>
          {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
    />
  </div>
);

const FormToggle = ({ control, name, label }: any) => (
  <Controller
    control={control}
    name={name}
    render={({ field }) => (
      <div 
        onClick={() => field.onChange(!field.value)}
        className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100/50 hover:bg-slate-100/50 transition-colors cursor-pointer group select-none"
      >
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-900 transition-colors">{label}</span>
        <div 
          className={`w-12 h-6 rounded-full p-1 flex items-center transition-all duration-300 ${field.value ? 'bg-accent-maroon justify-end' : 'bg-slate-300 justify-start'}`}
        >
          <motion.div 
            layout
            className="w-4 h-4 bg-white rounded-full shadow-lg" 
          />
        </div>
      </div>
    )}
  />
);

const SummaryRow = ({ label, value }: any) => (
  <div className="flex justify-between p-5 border-b border-white last:border-0">
    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{label}</span>
    <span className="text-xs font-black text-slate-900">{value || '--'}</span>
  </div>
);

export default PatientProfile;
