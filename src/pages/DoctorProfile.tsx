import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  HeartPulse, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  Stethoscope, 
  GraduationCap, 
  Clock, 
  Save, 
  Camera,
  CheckCircle2,
  Menu
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DoctorSidebar from '../components/DoctorSidebar';

const DoctorProfile = () => {
  const { user, profile, showToast, updateProfileData } = useAuth();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    specialization: '',
    hospitalName: '',
    experience: '',
    phoneNumber: '',
    gender: '',
    qualification: '',
    availability: 'Available',
    location: '',
    photoURL: ''
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || '',
        specialization: profile.specialization || 'Cardiologist',
        hospitalName: profile.hospitalName || '',
        experience: profile.experience || '',
        phoneNumber: profile.phoneNumber || '',
        gender: profile.gender || 'Male',
        qualification: profile.qualification || '',
        availability: profile.availability || 'Available',
        location: profile.location || '',
        photoURL: profile.photoURL || ''
      });
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    try {
      await updateProfileData(formData);
      showToast('Neural Profile Synchronized', 'success');
      setEditing(false);
    } catch (error) {
      showToast('Sync Failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#0B1120] text-white overflow-hidden">
      <title>Doctor Profile | HeartSync</title>
      <DoctorSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      {/* MOBILE OVERLAY */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] lg:hidden"
          />
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* HEADER */}
        <header className="h-16 bg-[#111827] border-b border-white/[0.06] px-4 lg:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
             <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-400 hover:text-accent-maroon transition-all">
               <Menu className="w-6 h-6" />
             </button>
             <div>
               <h2 className="text-base font-black text-white tracking-tight leading-none">Doctor Profile</h2>
               <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mt-0.5">Verified Medical Credentials</p>
             </div>
          </div>
          <button 
            onClick={() => setEditing(!editing)}
          className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${
              editing
                ? 'bg-white/10 text-slate-400 hover:bg-white/5'
                : 'bg-accent-maroon text-white hover:bg-accent-maroon/90'
            }`}
          >
            {editing ? 'Cancel' : 'Edit Profile'}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 no-scrollbar">
          <div className="max-w-4xl mx-auto space-y-5">
            <form onSubmit={handleSave} className="space-y-5">
              {/* HERO SECTION */}
              <div className="bg-[#111827] rounded-2xl border border-white/[0.06] p-6 relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-8 opacity-5 hidden sm:block">
                    <HeartPulse className="w-48 h-48 text-accent-maroon" />
                 </div>
                 
                 <div className="relative flex flex-col md:flex-row items-center gap-8 md:gap-10">
                    <div className="relative group">
                       <div className="w-32 h-32 md:w-40 md:h-40 bg-slate-900 rounded-[32px] md:rounded-[40px] flex items-center justify-center text-white text-4xl md:text-5xl font-black overflow-hidden border-4 md:border-8 border-slate-50 shadow-2xl">
                          {formData.photoURL ? (
                            <img src={formData.photoURL} alt="" className="w-full h-full object-cover" />
                          ) : (
                            formData.displayName?.charAt(0) || 'D'
                          )}
                       </div>
                       {editing && (
                         <button type="button" className="absolute -bottom-2 -right-2 p-3 md:p-4 bg-accent-maroon text-white rounded-xl md:rounded-2xl shadow-xl hover:scale-110 transition-all border-2 md:border-4 border-white">
                            <Camera className="w-4 h-4 md:w-5 md:h-5" />
                         </button>
                       )}
                    </div>
                    
                    <div className="flex-1 text-center md:text-left min-w-0">
                       <div className="flex items-center justify-center md:justify-start gap-4 mb-2">
                          {editing ? (
                            <input 
                              value={formData.displayName}
                              onChange={e => setFormData({...formData, displayName: e.target.value})}
                              className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter italic bg-slate-50 border border-slate-100 rounded-xl px-4 py-1 outline-none focus:border-accent-maroon/20 w-full md:w-auto"
                              placeholder="Full Name"
                            />
                          ) : (
                           <h1 className="text-2xl font-black text-white tracking-tight truncate">{formData.displayName || 'Dr. Medical'}</h1>
                          )}
                          <div className="p-1.5 bg-green-500 rounded-lg shrink-0">
                             <CheckCircle2 className="w-4 h-4 text-white" />
                          </div>
                       </div>

                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 leading-none">
                           Node ID: <span className="text-accent-maroon">HS-DOC-{user?.id?.substring(0, 8).toUpperCase() || user?.uid?.substring(0, 8).toUpperCase() || 'UNSYNCED'}</span>
                        </p>
                       
                       <div className="flex flex-wrap justify-center md:justify-start gap-4 md:gap-6">
                          <div className="flex items-center gap-2">
                             <Stethoscope className="w-4 h-4 text-accent-maroon shrink-0" />
                             {editing ? (
                               <input 
                                 value={formData.specialization}
                                 onChange={e => setFormData({...formData, specialization: e.target.value})}
                                 className="text-sm font-bold text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-1 outline-none"
                               />
                             ) : (
                               <span className="text-sm font-bold text-slate-600 tracking-tight">{formData.specialization}</span>
                             )}
                          </div>
                          <div className="flex items-center gap-2">
                             <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                             {editing ? (
                               <input 
                                 value={formData.hospitalName}
                                 onChange={e => setFormData({...formData, hospitalName: e.target.value})}
                                 className="text-sm font-bold text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-1 outline-none"
                               />
                             ) : (
                               <span className="text-sm font-bold text-slate-600 tracking-tight">{formData.hospitalName || 'Institutional Node'}</span>
                             )}
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              {/* DETAILS GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                 <div className="bg-[#111827] rounded-2xl border border-white/[0.06] p-5 space-y-5">
                     <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/[0.06] pb-3">Professional Record</h3>
                    
                    <div className="space-y-6">
                      <InfoInput 
                        label="Experience" 
                        icon={Clock} 
                        value={formData.experience} 
                        editing={editing} 
                        onChange={val => setFormData({...formData, experience: val})}
                        placeholder="e.g. 12 Years"
                      />
                      <InfoInput 
                        label="Qualification" 
                        icon={GraduationCap} 
                        value={formData.qualification} 
                        editing={editing} 
                        onChange={val => setFormData({...formData, qualification: val})}
                        placeholder="e.g. MBBS, MD (Cardiology)"
                      />
                      <div className="space-y-3">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                        <div className="flex flex-wrap gap-3">
                          {['Available', 'In Consultation', 'Emergency Only'].map(status => (
                            <button
                              key={status}
                              type="button"
                              disabled={!editing}
                              onClick={() => setFormData({...formData, availability: status})}
                              className={`flex-1 min-w-[120px] py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
                                formData.availability === status 
                                  ? 'bg-slate-900 text-white shadow-lg' 
                                  : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                 </div>

                 <div className="bg-[#111827] rounded-2xl border border-white/[0.06] p-5 space-y-5">
                     <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/[0.06] pb-3">Contact Gateway</h3>
                    
                    <div className="space-y-6">
                      <InfoInput 
                        label="Cloud Email" 
                        icon={Mail} 
                        value={user?.email || ''} 
                        editing={false} 
                        onChange={() => {}} 
                      />
                      <InfoInput 
                        label="Verified Phone" 
                        icon={Phone} 
                        value={formData.phoneNumber} 
                        editing={editing} 
                        onChange={val => setFormData({...formData, phoneNumber: val})}
                      />
                      <InfoInput 
                        label="Practice Location" 
                        icon={MapPin} 
                        value={formData.location} 
                        editing={editing} 
                        onChange={val => setFormData({...formData, location: val})}
                      />
                    </div>
                 </div>
              </div>

              {editing && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="fixed bottom-6 right-6 md:bottom-12 md:right-12 z-50 flex items-center gap-4"
                >
                   <button 
                    type="submit"
                    disabled={loading}
                    className="px-6 md:px-10 py-4 md:py-5 bg-accent-maroon text-white rounded-[20px] md:rounded-[24px] font-black text-[10px] md:text-[12px] uppercase tracking-widest shadow-24 md:shadow-2xl shadow-accent-maroon/40 flex items-center gap-3 md:gap-4 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                   >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Synchronize
                   </button>
                </motion.div>
              )}
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

const InfoInput = ({ label, icon: Icon, value, editing, onChange, placeholder }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
      editing ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-transparent'
    }`}>
      <Icon className={`w-4 h-4 ${editing ? 'text-accent-maroon' : 'text-slate-300'}`} />
      {editing ? (
        <input 
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 bg-transparent text-sm font-bold text-slate-900 outline-none"
          placeholder={placeholder}
        />
      ) : (
        <span className="text-sm font-bold text-slate-900 tracking-tight">{value || 'Not Configured'}</span>
      )}
    </div>
  </div>
);

export default DoctorProfile;
