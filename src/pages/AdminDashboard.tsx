import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Shield, Users, UserCheck, UserX, Clock, Search, Filter, LogOut, Heart, Activity, Stethoscope } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'patient' | 'doctor' | 'admin';
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: any;
}

const AdminDashboard = () => {
  const { profile, logout, showToast } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'patient' | 'doctor'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (profile?.role !== 'admin') {
      navigate('/');
      return;
    }

    const q = query(
      collection(db, 'users'),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const usersData: UserProfile[] = [];
      snap.forEach((doc) => {
        usersData.push({ uid: doc.id, ...doc.data() } as UserProfile);
      });
      setUsers(usersData);
      setLoading(false);
    });

    // Fetch total counts
    const qPatients = query(collection(db, 'users'), where('role', '==', 'patient'), where('status', '==', 'approved'));
    const qDoctors = query(collection(db, 'users'), where('role', '==', 'doctor'), where('status', '==', 'approved'));
    
    const unsubPatients = onSnapshot(qPatients, (snap) => setPatientCount(snap.size));
    const unsubDoctors = onSnapshot(qDoctors, (snap) => setDoctorCount(snap.size));

    return () => {
      unsubscribe();
      unsubPatients();
      unsubDoctors();
    };
  }, [profile, navigate]);

  const [patientCount, setPatientCount] = useState(0);
  const [doctorCount, setDoctorCount] = useState(0);

  const handleAction = async (uid: string, action: 'approved' | 'rejected') => {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        status: action,
        approvedAt: serverTimestamp(),
        approvedBy: profile?.uid
      });
      showToast(`User ${action} successfully`, 'success');
      if (selectedUser?.uid === uid) setSelectedUser(null);
    } catch (error) {
      console.error("Error updating user status:", error);
      showToast("Action failed. Verification node error.", "error");
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesFilter = filter === 'all' || u.role === filter;
    const matchesSearch = u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar logic... */}
      <aside className="w-80 bg-slate-900 text-white p-8 hidden lg:flex flex-col">
        <div className="flex items-center gap-3 mb-12">
          <div className="p-2.5 bg-accent-maroon rounded-2xl shadow-lg shadow-accent-maroon/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">HeartSync</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Admin Control v1.0</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarLink icon={Users} label="User Registry" active />
          <SidebarLink icon={Activity} label="System Analytics" />
          <SidebarLink icon={Shield} label="Security Logs" />
        </nav>

        <button 
          onClick={() => logout()}
          className="mt-auto flex items-center gap-3 p-4 text-slate-400 hover:text-white hover:bg-white/5 rounded-2xl transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-bold text-sm">Sign Out</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-24 bg-white border-b border-slate-200 px-12 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
             <div className="lg:hidden p-2.5 bg-accent-maroon rounded-xl">
               <Shield className="w-5 h-5 text-white" />
             </div>
             <div>
               <h2 className="text-2xl font-black text-slate-900 tracking-tight">Verification Nexus</h2>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Validate Clinical Access</p>
             </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
               <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Status: Online</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-12">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard label="Pending Verifications" value={users.length} icon={Clock} color="maroon" />
              <StatCard label="Active Patients" value={patientCount} icon={Heart} color="slate" />
              <StatCard label="Verified Doctors" value={doctorCount} icon={Stethoscope} color="slate" />
            </div>

            {/* Registry Tools */}
            <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-premium">
              <div className="flex flex-col md:flex-row gap-6 justify-between items-center mb-10">
                 <div className="relative w-full md:w-96">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                   <input 
                     type="text" 
                     placeholder="Search node ID or identity..."
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-accent-maroon/5 focus:border-accent-maroon/20 transition-all"
                   />
                 </div>
                 <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                   <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>All Nodes</FilterButton>
                   <FilterButton active={filter === 'patient'} onClick={() => setFilter('patient')}>Patients</FilterButton>
                   <FilterButton active={filter === 'doctor'} onClick={() => setFilter('doctor')}>Doctors</FilterButton>
                 </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-slate-50">
                      <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">Identification</th>
                      <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Portal Type</th>
                      <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right pr-4">Authorization</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                      <tr key={user.uid} className="group hover:bg-slate-50/50 transition-all cursor-pointer" onClick={() => setSelectedUser(user)}>
                        <td className="py-6 pl-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                              {user.displayName?.charAt(0) || user.email?.charAt(0) || '?'}
                            </div>
                            <div>
                              <p className="font-black text-slate-900">{user.displayName || 'Unknown identity'}</p>
                              <p className="text-xs font-medium text-slate-400 tracking-tight">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-6">
                           <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                             user.role === 'doctor' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-accent-maroon/5 text-accent-maroon border border-accent-maroon/10'
                           }`}>
                             {user.role || 'Unassigned'} Node
                           </span>
                        </td>
                        <td className="py-6 text-right pr-4">
                           <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleAction(user.uid, 'approved'); }}
                                className="p-2.5 bg-green-500 text-white rounded-xl shadow-lg shadow-green-500/20 hover:scale-110 transition-all"
                                title="Authorize Node"
                              >
                                <UserCheck className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleAction(user.uid, 'rejected'); }}
                                className="p-2.5 bg-slate-100 text-slate-400 rounded-xl hover:bg-red-500 hover:text-white hover:shadow-lg hover:shadow-red-500/20 transition-all"
                                title="Deny Authorization"
                              >
                                <UserX className="w-5 h-5" />
                              </button>
                           </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={3} className="py-20 text-center">
                          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200">
                             <Users className="w-8 h-8" />
                          </div>
                          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No pending node requests</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* User Details Modal */}
        {selectedUser && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="bg-white w-full max-w-2xl rounded-[48px] overflow-hidden shadow-2xl relative"
             >
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="absolute top-8 right-8 p-2 text-slate-400 hover:text-slate-900"
                >
                  <UserX className="w-6 h-6" />
                </button>

                <div className="p-12">
                   <div className="flex items-center gap-6 mb-10">
                      <div className="w-20 h-20 bg-slate-900 rounded-[28px] flex items-center justify-center text-white text-3xl font-black">
                         {selectedUser.displayName?.charAt(0) || selectedUser.email?.charAt(0)}
                      </div>
                      <div>
                         <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{selectedUser.displayName || 'Unnamed User'}</h3>
                         <span className={`inline-block mt-1 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                             selectedUser.role === 'doctor' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-accent-maroon/5 text-accent-maroon border border-accent-maroon/10'
                           }`}>
                             {selectedUser.role} Profile
                         </span>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-8 mb-12">
                      <DetailItem label="Email Identity" value={selectedUser.email} />
                      <DetailItem label="Registration Node" value={selectedUser.uid} />
                      
                      {selectedUser.role === 'doctor' ? (
                        <>
                          <DetailItem label="Hospital Affiliation" value={(selectedUser as any).hospitalName || 'Pending...'} />
                          <DetailItem label="Clinical Specialization" value={(selectedUser as any).specialization || 'Pending...'} />
                          <DetailItem label="Medical License ID" value={(selectedUser as any).licenseNumber || 'Pending...'} />
                          <DetailItem label="Years of Experience" value={(selectedUser as any).experience || '0'} />
                        </>
                      ) : (
                        <>
                          <DetailItem label="Patient Age" value={(selectedUser as any).age || 'N/A'} />
                          <DetailItem label="Blood Protocol" value={(selectedUser as any).bloodGroup || 'N/A'} />
                          <DetailItem label="Regional Node" value={`${(selectedUser as any).city || 'Unknown'}, ${(selectedUser as any).state || ''}`} />
                          <DetailItem label="SOS Contact" value={(selectedUser as any).emergencyContact || 'Not Set'} />
                        </>
                      )}
                   </div>

                   {selectedUser.role === 'patient' && (selectedUser as any).medicalHistory && (
                     <div className="mb-12 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Clinical History Overview</p>
                        <p className="text-sm font-bold text-slate-600 leading-relaxed">{(selectedUser as any).medicalHistory}</p>
                     </div>
                   )}

                   <div className="flex gap-4">
                      <button 
                        onClick={() => handleAction(selectedUser.uid, 'approved')}
                        className="flex-1 py-5 bg-green-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-green-500/20 hover:scale-[1.02] transition-all"
                      >
                        Authorize Access
                      </button>
                      <button 
                        onClick={() => handleAction(selectedUser.uid, 'rejected')}
                        className="flex-1 py-5 bg-white border border-slate-200 text-slate-400 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-red-50 text-red-500 hover:border-red-100 transition-all"
                      >
                        Deny Registration
                      </button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </main>
    </div>
  );
};

const DetailItem = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
    <p className="text-sm font-bold text-slate-900 tracking-tight">{value}</p>
  </div>
);

const SidebarLink = ({ icon: Icon, label, active }: { icon: any; label: string; active?: boolean }) => (
  <button className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold text-sm transition-all ${
    active ? 'bg-accent-maroon text-white shadow-lg shadow-accent-maroon/20' : 'text-slate-400 hover:text-white hover:bg-white/5'
  }`}>
    <Icon className="w-5 h-5" />
    {label}
  </button>
);

const StatCard = ({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: 'maroon' | 'slate' }) => (
  <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-premium flex items-center gap-6">
    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
      color === 'maroon' ? 'bg-accent-maroon text-white shadow-lg shadow-accent-maroon/20' : 'bg-slate-50 text-slate-400'
    }`}>
      <Icon className="w-8 h-8" />
    </div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-4xl font-black text-slate-900 tracking-tighter">{value}</p>
    </div>
  </div>
);

const FilterButton = ({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`px-6 py-2.5 rounded-xl font-bold text-xs transition-all ${
      active ? 'bg-white text-slate-900 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'
    }`}
  >
    {children}
  </button>
);

export default AdminDashboard;
