import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useNetwork } from './NetworkContext';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { db, rtdb } from '../lib/firebase';
import { doc, setDoc, collection } from 'firebase/firestore';
import { ref, set } from 'firebase/database';

interface ToastType {
  message: string;
  type: 'success' | 'error';
}

interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: 'patient' | 'doctor' | 'admin' | null;
  status?: 'pending' | 'approved' | 'rejected';
  onboarded?: boolean;
  onboardingCompleted?: boolean;
  created_at?: string;
  uid?: string; // Add uid for backwards compatibility with some components
  displayName?: string | null; // Backwards compatibility
  roleProfile?: any; // Sub-profile info (patient_profiles or doctor_profiles)
  fullName?: string | null;
  photoURL?: string | null;
  specialization?: string | null;
  hospitalName?: string | null;
  experience?: string | null;
  phoneNumber?: string | null;
  gender?: string | null;
  qualification?: string | null;
  availability?: string | null;
  location?: string | null;
}

interface AuthContextType {
  user: any;
  profile: UserProfile | null;
  loading: boolean;
  isOnline: boolean;
  toast: ToastType | null;
  showToast: (message: string, type: 'success' | 'error') => void;
  updateProfileData: (data: Partial<UserProfile>) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (intendedRole?: 'patient' | 'doctor') => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  signupPatient: (email: string, password: string, profileData: {
    fullName: string;
    phone: string;
    age: number;
    gender: string;
    bloodGroup: string;
    emergencyContactName: string;
    emergencyContactNumber: string;
    medicalConditions: string;
    medications: string;
    allergies: string;
    familyHistory: string;
  }) => Promise<void>;
  signupDoctor: (email: string, password: string, profileData: {
    fullName: string;
    phone: string;
    age: number;
    medicalLicenseId: string;
    medicalCollege: string;
    experienceYears: number;
    hospitalName: string;
    specialization?: string;
    medicalDocumentUrl?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null,
  loading: true, 
  isOnline: true,
  toast: null, 
  showToast: () => {},
  updateProfileData: async () => {},
  login: async () => {},
  loginWithGoogle: async () => {},
  resetPassword: async () => {},
  signup: async () => {},
  signupPatient: async () => {},
  signupDoctor: async () => {},
  logout: async () => {}
});

export const useAuth = () => useContext(AuthContext);

const safeStringify = (obj: any): string => {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular]";
      }
      seen.add(value);
      if (value instanceof HTMLElement || value instanceof Window || value instanceof Document) {
        return "[DOM Element]";
      }
    }
    return value;
  });
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const { isOnline } = useNetwork();
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('last_known_profile');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(!localStorage.getItem('last_known_profile'));
  const [toast, setToast] = useState<ToastType | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const logout = async () => {
    try {
      localStorage.removeItem('last_known_profile');
      setProfile(null);
    } catch (error) {
      console.error("Error during logout cleanup:", error);
    }
    await supabase.auth.signOut();
  };

  const seedDemoPatientData = async (uid: string, doctorUid?: string) => {
    try {
      // 1. Seed liveHealthMetrics document in Firestore
      await setDoc(doc(db, 'liveHealthMetrics', uid), {
        heartRate: 74,
        o2: 98,
        temp: 36.8,
        status: 'Optimal',
        timestamp: new Date().toISOString(),
        isEmergency: false
      }, { merge: true });

      // 2. Seed patients document in Firestore
      await setDoc(doc(db, 'patients', uid), {
        fullName: 'Sarah Jenkins',
        age: 38,
        gender: 'Female',
        bloodGroup: 'O-Positive',
        emergencyContact: 'Robert Jenkins (Spouse)',
        emergencyPhone: '+1 (555) 048-1921',
        medicalHistory: 'Chronic hypertension, minor mitral valve prolapse',
        onboardingCompleted: true,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 3. Seed patientHistory logs in Firestore
      const logsColl = collection(db, 'patientHistory', uid, 'logs');
      const logs = [
        { status: 'Optimal sinus rhythm', timestamp: new Date(Date.now() - 3600000).toISOString() },
        { status: 'Elevated heart rate', timestamp: new Date(Date.now() - 14400000).toISOString() },
        { status: 'Normal resting rhythm', timestamp: new Date(Date.now() - 86400000).toISOString() }
      ];
      for (const log of logs) {
        await setDoc(doc(logsColl), log);
      }

      // 4. Seed RTDB
      await set(ref(rtdb, `/users/${uid}`), {
        bpm: 74,
        spo2: 98,
        temperature: 36.8,
        humidity: 52,
        ecg: [512, 520, 530, 510, 480, 512, 550, 600, 450, 512, 512, 512, 515, 520, 512]
      });

      // 5. Seed Firestore users document with assignment
      await setDoc(doc(db, 'users', uid), {
        uid: uid,
        email: 'patient@heartsync.com',
        displayName: 'Sarah Jenkins',
        fullName: 'Sarah Jenkins',
        role: 'patient',
        status: 'approved',
        onboarded: true,
        onboardingCompleted: true,
        doctorId: doctorUid || null, // ASSIGN TO DOCTOR
        age: 38,
        gender: 'Female',
        bloodGroup: 'O-Positive',
        phone: '+1 (555) 048-1920',
        emergencyContact: 'Robert Jenkins (Spouse) - +1 (555) 048-1921'
      }, { merge: true });

      console.log("Successfully seeded demo patient data!");
    } catch (e) {
      console.error("Error seeding demo patient data:", e);
    }
  };

  const login = async (email: string, password: string) => {
    // Trim and normalize email for robust matching
    const normalizedEmail = email.trim().toLowerCase();
    
    // Check if this is a demo login request
    const isDoctorDemo = normalizedEmail === 'doctor@heartsync.demo' || normalizedEmail === 'doctor@heartsync.com';
    const isPatientDemo = normalizedEmail === 'patient@heartsync.demo' || normalizedEmail === 'patient@heartsync.com';
    
    let supabasePassword = password;
    if (normalizedEmail === 'doctor@heartsync.com' && password === 'doctor123') {
      supabasePassword = 'Doctor@123!';
    } else if (normalizedEmail === 'patient@heartsync.com' && password === 'patient123') {
      supabasePassword = 'Patient@123!';
    } else if (normalizedEmail === 'doctor@heartsync.demo' && password === 'Doctor@123') {
      supabasePassword = 'Doctor@123!';
    } else if (normalizedEmail === 'patient@heartsync.demo' && password === 'Patient@123') {
      supabasePassword = 'Patient@123!';
    }

    let result = null;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password: supabasePassword });
      if (error) throw error;
      result = data;
    } catch (error: any) {
      // If it fails and it's a demo account, let's auto-create it!
      if (isDoctorDemo && (password === 'Doctor@123' || password === 'doctor123')) {
        console.info("[DEMO SEEDING] Initializing Doctor Demo Account...");
        const doctorName = normalizedEmail === 'doctor@heartsync.com' ? 'Dr. Demo Heart Specialist' : 'Dr. Alexander Heartwise';
        try {
          await signupDoctor(normalizedEmail, supabasePassword, {
            fullName: doctorName,
            phone: '+1 (555) 019-2834',
            age: 45,
            medicalLicenseId: 'LIC-99281-MD',
            medicalCollege: 'Johns Hopkins School of Medicine',
            experienceYears: 18,
            hospitalName: 'Metropolitan Cardiac Institute',
            specialization: 'Advanced Electrophysiology'
          });
          
          // Force approve doctor profile in database
          const { data: authUser, error: authErr } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password: supabasePassword });
          if (authErr) throw authErr;
          
          if (authUser.user) {
            await supabase.from('profiles').update({ status: 'approved', onboarded: true, onboardingCompleted: true }).eq('id', authUser.user.id);
            await supabase.from('doctor_profiles').update({ verification_status: 'approved' }).eq('user_id', authUser.user.id);
            
            // Also seed to Firestore users collection
            await setDoc(doc(db, 'users', authUser.user.id), {
              uid: authUser.user.id,
              email: normalizedEmail,
              displayName: doctorName,
              fullName: doctorName,
              role: 'doctor',
              status: 'approved',
              onboarded: true,
              onboardingCompleted: true,
              specialization: 'Advanced Electrophysiology',
              hospitalName: 'Metropolitan Cardiac Institute',
              experience: '18 Years',
              phoneNumber: '+1 (555) 019-2834'
            }, { merge: true });
          }
          
          // Sign in again
          const retry = await supabase.auth.signInWithPassword({ email: normalizedEmail, password: supabasePassword });
          if (retry.error) throw retry.error;
          result = retry.data;
        } catch (seedErr: any) {
          console.error("[DEMO SEEDING ERROR]:", seedErr);
          throw new Error("Failed to auto-seed Doctor Demo account: " + seedErr.message);
        }
      } else if (isPatientDemo && (password === 'Patient@123' || password === 'patient123')) {
        console.info("[DEMO SEEDING] Initializing Patient Demo Account...");
        try {
          // Pre-fetch or pre-provision the doctor to establish relationship
          let doctorUid = '';
          const { data: docProf } = await supabase.from('profiles').select('id').eq('email', 'doctor@heartsync.com').maybeSingle();
          if (docProf) {
            doctorUid = docProf.id;
          } else {
            console.info("[DEMO SEEDING] Pre-provisioning Doctor Demo for Patient connection...");
            try {
              await signupDoctor('doctor@heartsync.com', 'Doctor@123!', {
                fullName: 'Dr. Demo Heart Specialist',
                phone: '+1 (555) 019-2834',
                age: 45,
                medicalLicenseId: 'LIC-99281-MD',
                medicalCollege: 'Johns Hopkins School of Medicine',
                experienceYears: 18,
                hospitalName: 'Metropolitan Cardiac Institute',
                specialization: 'Advanced Electrophysiology'
              });
              const { data: dAuth } = await supabase.auth.signInWithPassword({ email: 'doctor@heartsync.com', password: 'Doctor@123!' });
              if (dAuth.user) {
                doctorUid = dAuth.user.id;
                await supabase.from('profiles').update({ status: 'approved', onboarded: true, onboardingCompleted: true }).eq('id', doctorUid);
                await supabase.from('doctor_profiles').update({ verification_status: 'approved' }).eq('user_id', doctorUid);
                await setDoc(doc(db, 'users', doctorUid), {
                  uid: doctorUid,
                  email: 'doctor@heartsync.com',
                  displayName: 'Dr. Demo Heart Specialist',
                  fullName: 'Dr. Demo Heart Specialist',
                  role: 'doctor',
                  status: 'approved',
                  onboarded: true,
                  onboardingCompleted: true,
                  specialization: 'Advanced Electrophysiology',
                  hospitalName: 'Metropolitan Cardiac Institute',
                  phoneNumber: '+1 (555) 019-2834'
                }, { merge: true });
              }
            } catch (preErr) {
              console.error("Failed to pre-provision doctor:", preErr);
            }
          }

          await signupPatient(normalizedEmail, supabasePassword, {
            fullName: 'Sarah Jenkins',
            phone: '+1 (555) 048-1920',
            age: 38,
            gender: 'Female',
            bloodGroup: 'O-Positive',
            emergencyContactName: 'Robert Jenkins (Spouse)',
            emergencyContactNumber: '+1 (555) 048-1921',
            medicalConditions: 'Chronic hypertension, minor mitral valve prolapse',
            medications: 'Lisinopril 10mg daily',
            allergies: 'Penicillin',
            familyHistory: 'Maternal grandfather had coronary artery disease'
          });
          
          // Force approve patient profile in database
          const { data: authUser, error: authErr } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password: supabasePassword });
          if (authErr) throw authErr;
          
          if (authUser.user) {
            await supabase.from('profiles').update({ status: 'approved', onboarded: true, onboardingCompleted: true }).eq('id', authUser.user.id);
            
            // Seed demo metrics & history
            await seedDemoPatientData(authUser.user.id, doctorUid);

            // Establish relationship in Supabase SQL doctor_patients table
            if (doctorUid) {
              const { data: pRec } = await supabase.from('patients').select('id').eq('user_id', authUser.user.id).maybeSingle();
              const { data: dRec } = await supabase.from('doctors').select('id').eq('user_id', doctorUid).maybeSingle();
              if (pRec && dRec) {
                await supabase.from('doctor_patients').insert({
                  doctor_id: dRec.id,
                  patient_id: pRec.id,
                  status: 'active'
                });
                console.log("Seeded database link in doctor_patients successfully!");
              }
            }
          }
          
          // Sign in again
          const retry = await supabase.auth.signInWithPassword({ email: normalizedEmail, password: supabasePassword });
          if (retry.error) throw retry.error;
          result = retry.data;
        } catch (seedErr: any) {
          console.error("[DEMO SEEDING ERROR]:", seedErr);
          throw new Error("Failed to auto-seed Patient Demo account: " + seedErr.message);
        }
      } else {
        console.error("Login Error:", error);
        throw new Error(error.message || String(error));
      }
    }
    
    // Successful login: run automatic sync to Firestore for this account
    if (result?.user) {
      try {
        // Fetch latest profile from Supabase and sync to Firestore
        const { data: profileData } = await supabase.from('profiles').select('*').eq('id', result.user.id).single();
        if (profileData) {
          let subProfile = null;
          if (profileData.role === 'patient') {
            const { data: subData } = await supabase.from('patient_profiles').select('*').eq('user_id', result.user.id).maybeSingle();
            subProfile = subData;
          } else if (profileData.role === 'doctor') {
            const { data: subData } = await supabase.from('doctor_profiles').select('*').eq('user_id', result.user.id).maybeSingle();
            subProfile = subData;
          }
          
          await setDoc(doc(db, 'users', result.user.id), {
            uid: result.user.id,
            email: normalizedEmail,
            displayName: profileData.full_name,
            fullName: profileData.full_name,
            role: profileData.role,
            status: profileData.status || 'approved',
            onboarded: profileData.onboarded ?? true,
            onboardingCompleted: profileData.onboardingCompleted ?? true,
            photoURL: profileData.avatar_url || '',
            ...(subProfile || {})
          }, { merge: true });
          
          // Also if it is patient, ensure liveHealthMetrics is initialized
          if (profileData.role === 'patient') {
            await setDoc(doc(db, 'liveHealthMetrics', result.user.id), {
              heartRate: 74,
              o2: 98,
              temp: 36.8,
              status: 'Optimal',
              timestamp: new Date().toISOString(),
              isEmergency: false
            }, { merge: true });
          }
        }
      } catch (syncErr) {
        console.error("Error syncing profile to Firestore:", syncErr);
      }
    }
    
    showToast("Node Link Established", "success");
  };

  const loginWithGoogle = async (intendedRole?: 'patient' | 'doctor') => {
    if (intendedRole) {
      try {
        localStorage.setItem('intended_role', intendedRole);
      } catch (e) { console.warn('Could not save intended_role to localStorage'); }
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth'
      }
    });
    if (error) {
      console.error("Google Auth Error:", error);
      showToast(error.message, "error");
    } else {
      showToast("Google Identity Synchronized", "success");
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      console.error("Reset Error:", error);
      showToast(error.message, "error");
      throw new Error(error.message);
    }
    showToast("Identity recovery link sent to email.", "success");
  };

  const signup = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    });

    if (error) {
      console.error("Signup Error:", error);
      throw new Error(error.message);
    }

    if (data.user) {
      // Create profile record in Supabase
      const newProfile = {
        id: data.user.id,
        email,
        role: 'patient', 
        full_name: fullName,
        created_at: new Date().toISOString()
      };
      
      const { error: profileError } = await supabase.from('profiles').insert([newProfile as any]);
      if (profileError) {
          console.error("Profile creation error:", profileError);
      }
    }
    
    showToast("Neural Profile Registered", "success");
  };

  const signupPatient = async (email: string, password: string, profileData: {
    fullName: string;
    phone: string;
    age: number;
    gender: string;
    bloodGroup: string;
    emergencyContactName: string;
    emergencyContactNumber: string;
    medicalConditions: string;
    medications: string;
    allergies: string;
    familyHistory: string;
  }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: profileData.fullName
        }
      }
    });

    if (error) throw new Error(error.message);
    if (!data.user) throw new Error("Patient creation registration failed");

    // Create base profile
    const baseProfile = {
      id: data.user.id,
      user_id: data.user.id,
      email,
      full_name: profileData.fullName,
      role: 'patient'
    };
    const { error: baseError } = await supabase.from('profiles').insert([baseProfile as any]);
    if (baseError) console.error("Error creating patient base profile:", baseError);

    // Create patient sub-profile
    const patientProfilePayload = {
      user_id: data.user.id,
      phone: profileData.phone,
      age: profileData.age,
      gender: profileData.gender,
      blood_group: profileData.bloodGroup,
      medical_conditions: profileData.medicalConditions,
      medications: profileData.medications,
      allergies: profileData.allergies,
      family_history: profileData.familyHistory,
      emergency_contact_name: profileData.emergencyContactName,
      emergency_contact_number: profileData.emergencyContactNumber
    };
    const { error: patientProfileError } = await supabase.from('patient_profiles').insert([patientProfilePayload as any]);
    if (patientProfileError) console.error("Error creating patient sub-profile:", patientProfileError);

    // Create legacy patient record for backwards compatibility
    const legacyPatientPayload = {
      user_id: data.user.id,
      date_of_birth: new Date(new Date().getFullYear() - profileData.age, 0, 1).toISOString().split('T')[0],
      gender: profileData.gender,
      blood_group: profileData.bloodGroup,
      emergency_contact: profileData.emergencyContactName,
      emergency_phone: profileData.emergencyContactNumber,
      medical_notes: profileData.medicalConditions
    };
    const { error: legacyError } = await supabase.from('patients').insert([legacyPatientPayload as any]);
    if (legacyError) console.error("Error creating legacy patient:", legacyError);

    showToast("Patient Node Link Ready", "success");
  };

  const signupDoctor = async (email: string, password: string, profileData: {
    fullName: string;
    phone: string;
    age: number;
    medicalLicenseId: string;
    medicalCollege: string;
    experienceYears: number;
    hospitalName: string;
    specialization?: string;
    medicalDocumentUrl?: string;
  }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: profileData.fullName
        }
      }
    });

    if (error) throw new Error(error.message);
    if (!data.user) throw new Error("Doctor creation registration failed");

    // Create base profile
    const baseProfile = {
      id: data.user.id,
      user_id: data.user.id,
      email,
      full_name: profileData.fullName,
      role: 'doctor'
    };
    const { error: baseError } = await supabase.from('profiles').insert([baseProfile as any]);
    if (baseError) console.error("Error creating doctor base profile:", baseError);

    // Create doctor sub-profile
    const doctorProfilePayload = {
      user_id: data.user.id,
      phone: profileData.phone,
      age: profileData.age,
      medical_license_id: profileData.medicalLicenseId,
      medical_college: profileData.medicalCollege,
      experience_years: profileData.experienceYears,
      hospital_name: profileData.hospitalName,
      specialization: profileData.specialization || 'Cardiology',
      medical_document_url: profileData.medicalDocumentUrl || '',
      verification_status: 'pending'
    };
    const { error: doctorProfileError } = await supabase.from('doctor_profiles').insert([doctorProfilePayload as any]);
    if (doctorProfileError) console.error("Error creating doctor sub-profile:", doctorProfileError);

    // Create legacy doctor record for backwards compatibility
    const legacyDoctorPayload = {
      user_id: data.user.id,
      specialization: profileData.specialization || 'Cardiology',
      license_number: profileData.medicalLicenseId,
      hospital_name: profileData.hospitalName,
      availability: true
    };
    const { error: legacyError } = await supabase.from('doctors').insert([legacyDoctorPayload as any]);
    if (legacyError) console.error("Error creating legacy doctor:", legacyError);

    showToast("Doctor Verification Uploaded", "success");
  };

  const updateProfileData = React.useCallback(async (data: Partial<UserProfile>) => {
    if (!user) return;
    
    const updateData: any = { ...data };
    if (data.displayName) updateData.full_name = data.displayName;
    
    setProfile(prev => {
      const next = prev ? { ...prev, ...data } : null;
      if (next) {
        try {
          localStorage.setItem('last_known_profile', safeStringify(next));
        } catch (e) {
          console.error("Persistence failed:", e);
        }
      }
      return next;
    });
    
    try {
      const { error } = await supabase.from('profiles').update(updateData).eq('id', user.id);
      if (error) throw error;
    } catch (error) {
      console.error("Error updating profile data:", error);
      showToast("Sync Delayed: Offline update queued", "error");
      throw error;
    }
  }, [user]);

  useEffect(() => {
    let loadingTimer: NodeJS.Timeout | null = null;
    let realtimeSubscription: any = null;

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ? { ...session.user, uid: session.user.id } : null;
      setUser(currentUser);
      
      if (loadingTimer) {
        clearTimeout(loadingTimer);
        loadingTimer = null;
      }
      
      if (realtimeSubscription) {
          supabase.removeChannel(realtimeSubscription);
          realtimeSubscription = null;
      }

      if (currentUser) {
        const cached = localStorage.getItem('last_known_profile');
        let hasMatch = false;
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.id === currentUser.id) {
              hasMatch = true;
            }
          } catch (e) {}
        }

        if (!hasMatch) {
          setLoading(true);
        }

        loadingTimer = setTimeout(() => {
          setLoading(false);
          console.warn("Medical session initialization fallback triggered.");
        }, 5000);

        // Fetch initial profile
        const { data: profileData, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
            
        if (profileData) {
            // Fetch role sub-profile if applicable
            let subProfile = null;
            if (profileData.role === 'patient') {
              const { data } = await supabase.from('patient_profiles').select('*').eq('user_id', currentUser.id).maybeSingle();
              subProfile = data;
            } else if (profileData.role === 'doctor') {
              const { data } = await supabase.from('doctor_profiles').select('*').eq('user_id', currentUser.id).maybeSingle();
              subProfile = data;
            }

            const mappedProfile: UserProfile = {
                ...profileData,
                uid: profileData.id,
                email: currentUser.email || null,
                displayName: profileData.full_name,
                roleProfile: subProfile
            };
            setProfile(mappedProfile);
            try {
              localStorage.setItem('last_known_profile', safeStringify(mappedProfile));
            } catch (e) {}
            
            realtimeSubscription = supabase
                .channel(`public:profiles:id=eq.${currentUser.id}`)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${currentUser.id}` }, (payload) => {
                    const updatedProfile = payload.new as any;
                    setProfile(prev => {
                        const newProfile = {
                            ...prev,
                            ...updatedProfile,
                            uid: updatedProfile.id,
                            displayName: updatedProfile.full_name
                        };
                        try {
                            localStorage.setItem('last_known_profile', safeStringify(newProfile));
                        } catch (e) {}
                        return newProfile;
                    });
                })
                .subscribe();
                
        } else if (error && error.code === 'PGRST116') {
             console.log("Creating missing profile");
             let roleToAssign: 'patient' | 'doctor' | null = 'patient';
             try {
               const savedRole = localStorage.getItem('intended_role');
               if (savedRole === 'patient' || savedRole === 'doctor') {
                 roleToAssign = savedRole;
                 localStorage.removeItem('intended_role');
               }
             } catch(e) {}
             
             const newProfile = {
                 id: currentUser.id,
                 user_id: currentUser.id,
                 email: currentUser.email || '',
                 role: roleToAssign,
                 full_name: currentUser.user_metadata?.full_name || 'Medical Node',
                 avatar_url: currentUser.user_metadata?.avatar_url || ''
             };
             await supabase.from('profiles').insert([newProfile as any]);

             let subProfile = null;
             if (roleToAssign === 'patient') {
               const ppPayload = { user_id: currentUser.id, phone: '', age: null, gender: '', blood_group: '' };
               await supabase.from('patient_profiles').insert([ppPayload as any]);
               
               const legacyPatient = { user_id: currentUser.id, gender: '', blood_group: '' };
               await supabase.from('patients').insert([legacyPatient as any]);
             } else if (roleToAssign === 'doctor') {
               const dpPayload = { user_id: currentUser.id, phone: '', age: null, specialization: 'Cardiology', verification_status: 'pending' };
               await supabase.from('doctor_profiles').insert([dpPayload as any]);
               
               const legacyDoctor = { user_id: currentUser.id, specialization: 'Cardiology', availability: true };
               await supabase.from('doctors').insert([legacyDoctor as any]);
             }

             const mappedProfile: UserProfile = {
                 ...newProfile,
                 uid: newProfile.id,
                 email: currentUser.email || null,
                 displayName: newProfile.full_name,
                 roleProfile: subProfile
             } as UserProfile;
             setProfile(mappedProfile);
        }

        if (loadingTimer) {
            clearTimeout(loadingTimer);
            loadingTimer = null;
        }
        setLoading(false);

      } else {
        setProfile(null);
        localStorage.removeItem('last_known_profile');
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
            setLoading(false);
        }
    });

    return () => {
      authSubscription.unsubscribe();
      if (realtimeSubscription) supabase.removeChannel(realtimeSubscription);
      if (loadingTimer) clearTimeout(loadingTimer);
    };
  }, []);

  const value = React.useMemo(() => ({
    user,
    profile,
    loading,
    isOnline,
    toast,
    showToast,
    updateProfileData,
    login,
    loginWithGoogle,
    resetPassword,
    signup,
    signupPatient,
    signupDoctor,
    logout
  }), [user, profile, loading, isOnline, toast]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      {toast && (
        <div className="fixed bottom-10 right-10 z-[100] animate-in fade-in slide-in-from-bottom-5">
          <div className={`p-4 rounded-2xl bg-white border shadow-2xl flex items-center gap-3 min-w-[300px] ${
            toast.type === 'success' ? 'border-accent-maroon/20 text-accent-maroon' : 'border-red-200 text-red-600'
          }`}>
            {toast.type === 'success' ? (
              <div className="p-1 bg-accent-maroon/10 rounded-full">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            ) : (
              <div className="p-1 bg-red-100 rounded-full">
                <AlertCircle className="w-4 h-4" />
              </div>
            )}
            <p className="font-bold">{toast.message}</p>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};
