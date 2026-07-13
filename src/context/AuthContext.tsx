import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useNetwork } from './NetworkContext';
import { CheckCircle2, AlertCircle } from 'lucide-react';

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
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isOnline: boolean;
  toast: ToastType | null;
  showToast: (message: string, type: 'success' | 'error') => void;
  updateProfileData: (data: Partial<UserProfile>) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
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
  const [user, setUser] = useState<User | null>(null);
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

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("Login Error:", error);
      throw new Error(error.message);
    }
    showToast("Node Link Established", "success");
  };

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
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
        role: 'patient', // Default role, can be updated later
        full_name: fullName,
        status: 'approved',
        onboarded: false,
        onboardingCompleted: false
      };
      
      const { error: profileError } = await supabase.from('profiles').insert([newProfile]);
      if (profileError) {
          console.error("Profile creation error:", profileError);
      }
    }
    
    showToast("Neural Profile Registered", "success");
  };

  const updateProfileData = React.useCallback(async (data: Partial<UserProfile>) => {
    if (!user) return;
    
    // Map backwards compatibility fields back to Supabase schema fields
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
      const currentUser = session?.user || null;
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
            // Map fields for backwards compatibility
            const mappedProfile: UserProfile = {
                ...profileData,
                uid: profileData.id,
                email: currentUser.email || null,
                displayName: profileData.full_name
            };
            setProfile(mappedProfile);
            try {
              localStorage.setItem('last_known_profile', safeStringify(mappedProfile));
            } catch (e) {}
            
            // Subscribe to realtime updates for this profile
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
                
        } else if (error && error.code === 'PGRST116') { // Not found
             console.log("Creating missing profile");
             const newProfile = {
                 id: currentUser.id,
                 role: 'patient',
                 full_name: currentUser.user_metadata?.full_name || 'Medical Node',
                 status: 'approved',
                 onboarded: false,
                 onboardingCompleted: false
             };
             await supabase.from('profiles').insert([newProfile]);
             const mappedProfile: UserProfile = {
                 ...newProfile,
                 uid: newProfile.id,
                 email: currentUser.email || null,
                 displayName: newProfile.full_name
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

    // Check current session on mount
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
