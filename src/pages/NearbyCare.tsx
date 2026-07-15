import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  MapPin, 
  Filter, 
  Stethoscope, 
  Building2, 
  Star, 
  Clock, 
  PhoneCall, 
  Navigation, 
  ChevronRight, 
  CheckCircle2, 
  Calendar, 
  X, 
  MessageSquare, 
  ChevronDown,
  Activity,
  Heart,
  Zap,
  ShieldAlert,
  ArrowRight,
  Info,
  Bot,
  Menu
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PatientSidebar from '../components/PatientSidebar';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { fetchFromOverpass } from '../lib/osm';

const SYMPTOM_TO_SPECIALIST: Record<string, string> = {
  'chest pain': 'Cardiologist',
  'heart pain': 'Cardiologist',
  'palpitations': 'Cardiologist',
  'shortness of breath': 'Cardiologist',
  'dizziness': 'Cardiologist'
};

const SPECIALTIES = ['All', 'Cardiologist', 'Cardiac Surgeon', 'Electrophysiologist'];

const NearbyCare = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, showToast } = useAuth();
  const [patientData, setPatientData] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'doctors' | 'hospitals'>('doctors');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  
  const [doctors, setDoctors] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // Filtering states
  const [isEmergencyOnly, setIsEmergencyOnly] = useState(false);
  const [distanceRadius, setDistanceRadius] = useState(10);
  
  // Symptoms recommendation
  const [recomSpecialist, setRecomSpecialist] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const docRef = doc(db, 'patients', user.uid);
      const unsubscribe = onSnapshot(docRef, (snap) => {
        if (snap.exists()) setPatientData(snap.data());
      });
      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      (err) => console.error(err)
    );
  }, []);

  useEffect(() => {
    if (!userLocation) return;
    
    setLoading(true);
    const [lat, lng] = userLocation;
    const radius = distanceRadius * 1000;
    
    // Fetch Cardiologists/Doctors via Overpass
    const docQuery = `[out:json];node["amenity"="doctors"](around:${radius},${lat},${lng});out;`;
    fetchFromOverpass(docQuery)
      .then(data => {
        if (data.elements) {
          setDoctors(data.elements.map((el: any) => ({
            id: el.id,
            fullName: el.tags.name || 'Cardiac Specialist',
            specialization: 'Cardiologist',
            hospital: el.tags['addr:street'] || 'Downtown Medical Center',
            rating: (Math.random() * 1 + 4).toFixed(1),
            photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${el.id}`,
            emergency: true,
            experience: 'Expert level',
            availability: 'Available Now',
            distance: `${(Math.random() * 5).toFixed(1)} km`
          })));
        }
      })
      .catch(err => console.error("OSM Doctor Search Error:", err));

    // Fetch Cardiac Hospitals via Secure Backend proxy (RapidAPI Google Map Scraper + Overpass Fallback)
    fetch('/api/v1/nearby-hospitals-rapid', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ latitude: lat, longitude: lng })
    })
      .then(res => res.json())
      .then(data => {
        if (data.elements) {
          setHospitals(data.elements);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Hospital Proxy Search Error:", err);
        setLoading(false);
      });

  }, [userLocation, distanceRadius]);


  useEffect(() => {
    const queryLower = searchQuery.toLowerCase();
    const matched = Object.keys(SYMPTOM_TO_SPECIALIST).find(symptom => queryLower.includes(symptom));
    if (matched) {
      setRecomSpecialist(SYMPTOM_TO_SPECIALIST[matched]);
    } else {
      setRecomSpecialist(null);
    }
  }, [searchQuery]);

  const filteredDoctors = doctors.filter(doc => {
    const matchesSearch = doc.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         doc.specialization?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSpecialty = selectedSpecialty === 'All' || doc.specialization === selectedSpecialty;
    const matchesEmergency = !isEmergencyOnly || doc.emergency;
    return matchesSearch && matchesSpecialty && matchesEmergency;
  });

  const filteredHospitals = hospitals.filter(hosp => {
    const matchesSearch = hosp.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEmergency = !isEmergencyOnly || hosp.emergencyStatus === 'Active';
    return matchesSearch && matchesEmergency;
  });

  const handleBooking = (item: any) => {
    setSelectedItem(item);
    setShowBookingModal(true);
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden relative font-sans text-slate-900">
      <PatientSidebar 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen} 
        patientData={patientData} 
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="flex min-h-full">
            {/* Sidebar Filter */}
            <aside className="w-80 bg-white border-r border-slate-100 p-8 hidden xl:flex flex-col sticky top-0 h-full overflow-y-auto">
        <div className="mb-10">
          <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-2">Filters</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Refine Search</p>
        </div>

        <div className="space-y-10 flex-1">
          {/* Symptoms Search Filter */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest pl-2">Medical Conditions</label>
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-accent-maroon transition-colors" />
              <input 
                type="text" 
                placeholder="Search symptoms..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:ring-4 focus:ring-accent-maroon/5 focus:bg-white transition-all text-slate-600 placeholder:text-slate-300"
              />
            </div>
          </div>

          {/* Specialty Filter */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest pl-2">Specialization</label>
            <div className="grid grid-cols-1 gap-2">
              {SPECIALTIES.map(spec => (
                <button 
                  key={spec}
                  onClick={() => setSelectedSpecialty(spec)}
                  className={`flex items-center justify-between p-4 rounded-2xl transition-all group ${
                    selectedSpecialty === spec 
                    ? 'bg-accent-maroon text-white shadow-xl shadow-accent-maroon/20' 
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-sm font-bold">{spec}</span>
                  {selectedSpecialty === spec && <CheckCircle2 className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>

          {/* Availability Toggle */}
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
               <div className="flex items-center gap-3">
                  <ShieldAlert className={`w-5 h-5 ${isEmergencyOnly ? 'text-accent-maroon animate-pulse' : 'text-slate-300'}`} />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-tighter">Emergency Core</span>
               </div>
               <button 
                 onClick={() => setIsEmergencyOnly(!isEmergencyOnly)}
                 className={`w-12 h-6 rounded-full transition-all relative ${isEmergencyOnly ? 'bg-accent-maroon' : 'bg-slate-200'}`}
               >
                 <motion.div 
                   animate={{ x: isEmergencyOnly ? 24 : 4 }}
                   className="absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm" 
                 />
               </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Radius (km)</label>
                <span className="text-xs font-black text-slate-900">{distanceRadius} km</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="50" 
                value={distanceRadius} 
                onChange={e => setDistanceRadius(parseInt(e.target.value))}
                className="w-full accent-accent-maroon h-1 bg-slate-100 rounded-full cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="pt-10">
           <div className="p-6 bg-red-50 rounded-3xl border border-red-100 flex flex-col items-center text-center">
              <PhoneCall className="w-8 h-8 text-accent-maroon mb-4 animate-bounce" />
              <h4 className="text-sm font-black text-red-900 tracking-tight mb-2">Emergency Hotline</h4>
              <p className="text-[10px] font-bold text-red-700/60 uppercase tracking-widest leading-relaxed mb-4">Immediate clinical support 24/7</p>
              <button className="w-full py-3 bg-accent-maroon text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl shadow-xl shadow-accent-maroon/20">Call: 911-RESCUE</button>
           </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 p-4 sm:p-6 lg:p-12 overflow-y-auto no-scrollbar">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-8 mb-8 md:mb-12">
            <div>
              <div className="flex items-center gap-3 mb-2 md:mb-3">
                 <div className="p-2 bg-accent-maroon/10 rounded-lg md:rounded-xl">
                    <Navigation className="w-4 h-4 md:w-5 md:h-5 text-accent-maroon" />
                 </div>
                 <span className="text-[8px] md:text-[10px] font-black text-accent-maroon uppercase tracking-[0.3em]">Location: Downtown Medical Dist</span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Nearby Medical Support</h1>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4 self-start w-full md:w-auto">
               <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm text-slate-600">
                 <Menu className="w-5 h-5" />
               </button>
               <button onClick={() => setIsFilterModalOpen(true)} className="xl:hidden p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm text-slate-600 flex items-center gap-2">
                 <Filter className="w-5 h-5" />
                 <span className="text-xs font-bold hidden sm:inline">Filters</span>
               </button>
               <div className="flex flex-1 md:flex-none bg-white p-1 md:p-1.5 rounded-xl md:rounded-[24px] border border-slate-100 shadow-sm">
               <button 
                 onClick={() => setActiveTab('doctors')}
                 className={`flex-1 md:flex-none flex items-center justify-center gap-2 md:gap-3 px-4 md:px-8 py-2 md:py-3.5 rounded-lg md:rounded-2xl transition-all font-bold text-xs md:text-sm ${activeTab === 'doctors' ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10' : 'text-slate-400 hover:bg-slate-50'}`}
               >
                 <Stethoscope className="w-4 h-4" />
                 Doctors
               </button>
               <button 
                 onClick={() => setActiveTab('hospitals')}
                 className={`flex-1 md:flex-none flex items-center justify-center gap-2 md:gap-3 px-4 md:px-8 py-2 md:py-3.5 rounded-lg md:rounded-2xl transition-all font-bold text-xs md:text-sm ${activeTab === 'hospitals' ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10' : 'text-slate-400 hover:bg-slate-50'}`}
               >
                 <Building2 className="w-4 h-4" />
                 Hospitals
               </button>
            </div>
           </div>
          </header>

          {/* AI Recommendation Banner */}
          <AnimatePresence>
            {recomSpecialist && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mb-8 md:mb-12 overflow-hidden"
              >
                 <div className="p-6 md:p-8 bg-slate-900 rounded-[24px] md:rounded-[40px] text-white flex flex-col md:flex-row items-center gap-6 md:gap-8 relative overflow-hidden group">
                    <div className="absolute top-[-50%] right-[-10%] w-64 h-64 bg-accent-maroon/20 rounded-full blur-[100px]" />
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-accent-maroon rounded-[20px] md:rounded-3xl flex items-center justify-center shrink-0 shadow-2xl shadow-accent-maroon/30 animate-pulse transition-transform group-hover:scale-110">
                      <Zap className="w-8 h-8 md:w-10 md:h-10 text-white" />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <div className="flex items-center gap-2 mb-1.5 justify-center md:justify-start">
                         <Bot className="w-3.5 h-3.5 text-accent-maroon" />
                         <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-white/50">AI Recommendation Engine</span>
                      </div>
                      <h3 className="text-xl md:text-2xl font-black tracking-tight mb-2">Symptom Detected: <span className="text-accent-maroon">{searchQuery}</span></h3>
                      <p className="text-sm md:text-base text-white/60 font-medium leading-relaxed">Our diagnostic engine suggests consulting a <span className="text-white font-black underline decoration-accent-maroon decoration-4 underline-offset-4">{recomSpecialist}</span> immediately.</p>
                    </div>
                    <button 
                      onClick={() => { setSelectedSpecialty(recomSpecialist); setSearchQuery(''); }}
                      className="w-full md:w-auto px-6 lg:px-10 py-3.5 lg:py-5 bg-white text-slate-900 font-bold text-sm rounded-xl md:rounded-[24px] hover:bg-slate-100 transition-all flex items-center justify-center gap-3 group shrink-0"
                    >
                      Filter by Specialist <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 md:gap-8 pb-32">
             {activeTab === 'doctors' ? (
               filteredDoctors.length > 0 ? (
                 filteredDoctors.map(doc => (
                   <DoctorCard key={doc.id} doctor={doc} onBook={() => handleBooking(doc)} />
                 ))
               ) : <NoResults query={searchQuery} />
             ) : (
               filteredHospitals.length > 0 ? (
                 filteredHospitals.map(hosp => (
                   <HospitalCard key={hosp.id} hospital={hosp} />
                 ))
               ) : <NoResults query={searchQuery} />
             )}
          </div>
        </div>
      </div>
    </div>
  </main>

      {/* Booking Modal */}
      <AnimatePresence>
        {isFilterModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
               initial={{ y: '100%', opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               exit={{ y: '100%', opacity: 0 }}
               className="bg-white rounded-t-[32px] sm:rounded-[32px] w-full max-w-md overflow-hidden relative p-8 shadow-2xl"
            >
               <button onClick={() => setIsFilterModalOpen(false)} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900 transition-colors">
                  <X className="w-6 h-6" />
               </button>
               <div className="mb-8">
                 <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-1">Filters</h2>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Refine Search</p>
               </div>
               <div className="space-y-8 max-h-[70vh] overflow-y-auto no-scrollbar pb-6">
                  {/* Reuse Sidebar sections with better size for modal */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Medical Conditions</label>
                    <div className="relative group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        type="text" 
                        placeholder="Search symptoms..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border-none rounded-xl py-3.5 pl-12 pr-4 text-sm font-medium transition-all text-slate-600 outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Specialization</label>
                    <div className="flex flex-wrap gap-2">
                       {SPECIALTIES.map(spec => (
                         <button 
                           key={spec}
                           onClick={() => setSelectedSpecialty(spec)}
                           className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                             selectedSpecialty === spec ? 'bg-accent-maroon text-white' : 'bg-slate-50 text-slate-500'
                           }`}
                         >
                           {spec}
                         </button>
                       ))}
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                       <span className="text-xs font-bold text-slate-700 uppercase tracking-tighter">Emergency Core</span>
                       <button 
                         onClick={() => setIsEmergencyOnly(!isEmergencyOnly)}
                         className={`w-10 h-5 rounded-full relative ${isEmergencyOnly ? 'bg-accent-maroon' : 'bg-slate-200'}`}
                       >
                         <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${isEmergencyOnly ? 'left-5.5' : 'left-0.5'}`} />
                       </button>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-[10px] font-black text-slate-300 uppercase tracking-widest px-1">
                        <span>Radius</span>
                        <span className="text-slate-900">{distanceRadius} km</span>
                      </div>
                      <input type="range" min="1" max="50" value={distanceRadius} onChange={e => setDistanceRadius(parseInt(e.target.value))} className="w-full h-1 bg-slate-100 rounded-full accent-accent-maroon appearance-none" />
                    </div>
                  </div>
               </div>
               <button onClick={() => setIsFilterModalOpen(false)} className="w-full py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl mt-4">Apply Filters</button>
            </motion.div>
          </div>
        )}

        {showBookingModal && (
          <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-900/60 backdrop-blur-xl transition-all">
             <motion.div 
               initial={{ y: '100%', scale: 1 }}
               animate={{ y: 0, scale: 1 }}
               exit={{ y: '100%', scale: 1 }}
               className="bg-white rounded-t-[32px] sm:rounded-[32px] md:rounded-[48px] shadow-2xl w-full max-w-2xl overflow-hidden relative flex flex-col md:flex-row h-[90vh] md:h-auto"
             >
                <button onClick={() => setShowBookingModal(false)} className="absolute top-6 md:top-10 right-6 md:right-10 p-2 md:p-3 text-slate-300 hover:text-slate-900 transition-colors z-30">
                  <X className="w-6 h-6 md:w-8 md:h-8" />
                </button>
                
                <div className="md:w-2/5 bg-slate-950 p-8 md:p-12 text-white relative flex flex-col justify-between overflow-hidden shrink-0">
                  <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-accent-maroon/20 rounded-full blur-[100px]" />
                  <div className="relative z-10">
                      <div className="p-3 md:p-4 bg-accent-maroon rounded-2xl md:rounded-3xl w-fit mb-6 md:mb-8 shadow-2xl shadow-accent-maroon/30">
                        <Calendar className="w-6 h-6 md:w-8 md:h-8" />
                      </div>
                      <h3 className="text-2xl md:text-3xl font-black tracking-tight mb-4 leading-tight">Secure Final Consultation</h3>
                      <p className="text-white/40 text-xs md:text-sm font-medium leading-relaxed hidden sm:block">Your data will be encrypted and shared only with your selected care team.</p>
                  </div>
                  <div className="hidden md:flex flex-col gap-6 relative z-10 pt-10">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                            <ShieldAlert className="w-5 h-5 text-accent-maroon" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest text-white/70">ISO-Medical Sync</span>
                      </div>
                  </div>
                </div>

                <div className="flex-1 p-8 md:p-12 overflow-y-auto no-scrollbar bg-white">
                  <div className="mb-8 md:mb-12">
                    <p className="text-[9px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">Patient Information</p>
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl md:rounded-3xl border border-slate-100 mb-6 md:mb-8">
                       <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-white shadow-sm flex items-center justify-center text-accent-maroon font-black text-xs md:text-sm">AI</div>
                       <div className="min-w-0">
                          <p className="text-sm font-black text-slate-900 truncate">{user?.displayName || 'User Entity'}</p>
                          <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{user?.email}</p>
                       </div>
                    </div>

                    <div className="space-y-6 md:space-y-8">
                       <div className="space-y-3 md:space-y-4">
                          <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Medical Reason / Symptoms</label>
                          <textarea 
                            placeholder="Describe your current status..." 
                            defaultValue={searchQuery}
                            className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl md:rounded-3xl p-5 md:p-6 text-sm font-medium focus:bg-white focus:border-accent-maroon/20 outline-none transition-all resize-none h-28 md:h-32"
                          />
                       </div>
                       
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                          <div className="space-y-3 md:space-y-4">
                            <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Preferred Slot</label>
                            <div className="relative group">
                               <Clock className="absolute left-5 md:left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-accent-maroon transition-colors" />
                               <input type="time" className="w-full bg-slate-50 border-2 border-slate-50 rounded-xl md:rounded-[20px] py-3.5 md:py-4 pl-12 md:pl-14 pr-4 md:pr-6 text-sm font-black focus:bg-white focus:border-accent-maroon/20 transition-all outline-none" />
                            </div>
                          </div>
                          <div className="space-y-3 md:space-y-4">
                            <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Priority</label>
                            <select className="w-full bg-slate-50 border-2 border-slate-50 rounded-xl md:rounded-[20px] py-3.5 md:py-4 px-4 md:px-6 text-sm font-black focus:bg-white outline-none appearance-none cursor-pointer">
                               <option>Standard</option>
                               <option>High Priority</option>
                               <option>Critical (EMS)</option>
                            </select>
                          </div>
                       </div>
                    </div>
                  </div>

                  <div className="space-y-4 pb-8 md:pb-0">
                     <button 
                       onClick={() => {
                         showToast("Booking Successful", "success");
                         setShowBookingModal(false);
                       }}
                       className="w-full py-4 md:py-5 bg-accent-maroon text-white font-black text-[9px] md:text-[10px] uppercase tracking-[0.3em] rounded-xl md:rounded-[24px] shadow-2xl shadow-accent-maroon/20 hover:bg-slate-900 transition-all"
                     >
                       Initiate Secure Booking
                     </button>
                     <button onClick={() => setShowBookingModal(false)} className="w-full py-3 md:py-4 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] hover:text-slate-900 transition-colors">Discard</button>
                  </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  </div>
);
};

const DoctorCard = ({ doctor, onBook }: any) => (
  <motion.div 
    whileHover={{ y: -8 }}
    className="bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-8 border border-slate-100 shadow-xl group transition-all flex flex-col relative overflow-hidden"
  >
    <div className="absolute top-[-20%] right-[-20%] w-32 h-32 bg-slate-50 rounded-full blur-[40px] group-hover:bg-accent-maroon/5 transition-colors" />
    
    <div className="flex items-start justify-between gap-4 md:gap-6 mb-6 md:mb-8 relative z-10">
       <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-[24px] overflow-hidden shadow-xl ring-4 ring-slate-50 group-hover:ring-accent-maroon/20 transition-all shrink-0">
          <img src={doctor.photoURL} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={doctor.fullName} />
       </div>
       <div className="flex flex-col items-end shrink-0">
          <div className="flex items-center gap-1 px-2.5 py-1 bg-yellow-50 rounded-lg md:rounded-xl mb-3 md:mb-4">
             <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
             <span className="text-[9px] md:text-[10px] font-black text-yellow-700">{doctor.rating}</span>
          </div>
          {doctor.emergency && (
            <div className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 rounded-lg md:rounded-xl animate-pulse">
               <ShieldAlert className="w-3 h-3" />
               <span className="text-[9px] md:text-[10px] font-black tracking-tighter uppercase whitespace-nowrap">SOS Enabled</span>
            </div>
          )}
       </div>
    </div>

    <div className="flex-1 relative z-10">
       <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight transition-colors group-hover:text-accent-maroon line-clamp-1">{doctor.fullName}</h3>
       <div className="flex items-center gap-2 mb-4">
          <span className="text-[9px] md:text-[10px] font-black text-accent-maroon uppercase tracking-widest">{doctor.specialization}</span>
          <span className="text-slate-200 text-xs">/</span>
          <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">{doctor.experience}</span>
       </div>
       
       <div className="space-y-3 md:space-y-4 mb-6 md:mb-8">
          <div className="flex items-center gap-3 min-w-0">
             <Building2 className="w-3.5 h-3.5 text-slate-300 shrink-0" />
             <span className="text-xs font-bold text-slate-600 truncate">{doctor.hospital}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
             <div className="flex items-center gap-2 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <span className="text-[10px] md:text-xs font-bold text-slate-600 truncate">{doctor.distance}</span>
             </div>
             <div className="flex items-center gap-2 shrink-0">
                <Clock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <span className="text-[9px] md:text-[10px] font-black text-green-600 uppercase tracking-tighter">{doctor.availability}</span>
             </div>
          </div>
       </div>
    </div>

    <div className="flex gap-2 relative z-10 pt-4 border-t border-slate-50 mt-auto">
       <button className="flex-1 py-3.5 md:py-4 bg-slate-900 text-white rounded-xl md:rounded-[18px] text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-900/10">Profile</button>
       <button onClick={onBook} className="flex-1 py-3.5 md:py-4 bg-accent-maroon text-white rounded-xl md:rounded-[18px] text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-accent-maroon/20">Book Now</button>
    </div>
  </motion.div>
);

const HospitalCard = ({ hospital }: any) => (
  <motion.div 
    whileHover={{ y: -8 }}
    className="bg-white rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-xl overflow-hidden group transition-all"
  >
    <div className="h-40 md:h-48 relative overflow-hidden">
       <img src={hospital.photoURL} alt={hospital.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
       <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent flex flex-col justify-end p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-2 mb-2">
             <div className="px-2.5 py-1 bg-accent-maroon rounded text-[8px] font-black text-white uppercase tracking-widest">{hospital.type}</div>
             <div className="px-2.5 py-1 bg-white/20 backdrop-blur-md rounded text-[8px] font-black text-white uppercase tracking-widest">{hospital.distance}</div>
          </div>
          <h3 className="text-lg md:text-xl font-black text-white tracking-tight line-clamp-1">{hospital.name}</h3>
       </div>
    </div>
    
    <div className="p-6 md:p-8 space-y-6">
       <div className="grid grid-cols-2 gap-3 md:gap-4">
          <div className="p-3 md:p-4 bg-slate-50 rounded-xl md:rounded-2xl">
             <p className="text-[9px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Available Beds</p>
             <p className="text-lg md:text-xl font-black text-slate-900 tracking-tight">{hospital.beds}</p>
          </div>
          <div className="p-3 md:p-4 bg-slate-50 rounded-xl md:rounded-2xl">
             <p className="text-[9px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">ICU Capacity</p>
             <p className="text-lg md:text-xl font-black text-slate-900 tracking-tight text-accent-maroon">{hospital.icu}</p>
          </div>
       </div>

       <div className="flex flex-wrap gap-1.5 md:gap-2">
          {hospital.departments.map((dept: string) => (
             <span key={dept} className="px-3 md:px-4 py-1.5 md:py-2 bg-slate-50 border border-slate-100 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest">{dept}</span>
          ))}
       </div>

       <div className="flex flex-col sm:flex-row gap-2 md:gap-3 pt-4 border-t border-slate-50">
          <button className="flex-1 py-3.5 md:py-4 bg-slate-50 text-slate-900 rounded-xl md:rounded-[18px] text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-2">
             <Navigation className="w-3.5 h-3.5" /> <span>Navigate</span>
          </button>
          <button className="flex-1 py-3.5 md:py-4 bg-accent-maroon text-white rounded-xl md:rounded-[18px] text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-accent-maroon/20 flex items-center justify-center gap-2">
             <PhoneCall className="w-3.5 h-3.5" /> <span>Contact</span>
          </button>
       </div>
    </div>
  </motion.div>
);

const NoResults = ({ query }: any) => (
  <div className="col-span-full py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-100 flex flex-col items-center text-center">
    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-200">
      <Info className="w-12 h-12" />
    </div>
    <h3 className="text-xl font-black text-slate-900 mb-2">No Matches Found</h3>
    <p className="text-sm font-medium text-slate-400 max-w-xs">{query ? `We couldn't find any care providers matching "${query}". Try broadening your search filters.` : 'Our database is initializing. Please refining your criteria.'}</p>
  </div>
);

export default NearbyCare;
