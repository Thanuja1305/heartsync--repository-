import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Navigation, 
  MapPin, 
  Phone, 
  ShieldAlert, 
  Heart, 
  Info, 
  Clock, 
  Route as RouteIcon,
  Crosshair,
  AlertTriangle,
  Activity,
  Menu
} from 'lucide-react';
import LiveLocationMap from '../components/LiveLocationMap';
import PatientSidebar from '../components/PatientSidebar';
import { useAuth } from '../context/AuthContext';
import { db, rtdb, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { ref, set, onValue, serverTimestamp as rtdbTimestamp } from 'firebase/database';

import { fetchFromOverpass } from '../lib/osm';

const LiveLocation = () => {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [patientData, setPatientData] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [vitals, setVitals] = useState<any>(null);
  const [nearbyHospitals, setNearbyHospitals] = useState<any[]>([]);
  const [nearbyDoctors, setNearbyDoctors] = useState<any[]>([]);
  const [ambulancePosition, setAmbulancePosition] = useState<[number, number] | undefined>(undefined);

  useEffect(() => {
    if (user) {
      onSnapshot(doc(db, 'patients', user.uid), (snap) => {
        if (snap.exists()) setPatientData(snap.data());
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `patients/${user.uid}`);
      });
      onSnapshot(doc(db, 'liveHealthMetrics', user.uid), (snap) => {
        if (snap.exists()) setVitals(snap.data());
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `liveHealthMetrics/${user.uid}`);
      });
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setCurrentLocation(newPos);
        
        // Sync to Realtime Database for ultra-low latency tracking
        if (user) {
          const locRef = ref(rtdb, `patientLocations/${user.uid}`);
          set(locRef, {
            latitude: newPos[0],
            longitude: newPos[1],
            updatedAt: rtdbTimestamp(),
            emergencyActive: vitals?.isEmergency || false
          }).catch(err => console.error("RTDB Sync Error:", err));
        }
      },
      (err) => console.error("GPS Error:", err),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [user, vitals?.isEmergency]);

  // Search for nearby hospitals and doctors using Overpass API
  useEffect(() => {
    if (currentLocation) {
      const [lat, lng] = currentLocation;
      const radius = 5000; // 5km
      
      // Overpass query for hospitals and doctors
      const query = `[out:json];(node["amenity"="hospital"](around:${radius},${lat},${lng});node["amenity"="doctors"](around:${radius},${lat},${lng}););out;`;
      
      fetchFromOverpass(query)
        .then(data => {
          if (data.elements) {
            const hospitals = data.elements
              .filter((el: any) => el.tags.amenity === 'hospital')
              .map((el: any) => ({
                name: el.tags.name || 'Cardiac Unit',
                position: [el.lat, el.lon] as [number, number],
                type: 'Cardiac Hospital'
              }));
            
            const doctors = data.elements
              .filter((el: any) => el.tags.amenity === 'doctors')
              .map((el: any) => ({
                name: el.tags.name || 'Cardiac Specialist',
                position: [el.lat, el.lon] as [number, number],
                specialization: 'Cardiologist'
              }));

            setNearbyHospitals(hospitals);
            setNearbyDoctors(doctors);
          }
        })
        .catch(err => console.error("OSM Search Error:", err));
    }
  }, [currentLocation]);


  // Ambulance Simulation Logic
  useEffect(() => {
    if (vitals?.isEmergency && currentLocation && nearbyHospitals.length > 0 && !ambulancePosition) {
      // Start ambulance at the nearest hospital
      const nearestHosp = nearbyHospitals[0];
      setAmbulancePosition(nearestHosp.position);
    } else if (!vitals?.isEmergency) {
      setAmbulancePosition(undefined);
    }
  }, [vitals?.isEmergency, currentLocation, nearbyHospitals]);

  // Move ambulance towards patient
  useEffect(() => {
    if (vitals?.isEmergency && ambulancePosition && currentLocation) {
      const timer = setInterval(() => {
        setAmbulancePosition(prev => {
          if (!prev) return prev;
          const [aLat, aLng] = prev;
          const [pLat, pLng] = currentLocation;
          
          // Move 5% of the distance each interval
          const newLat = aLat + (pLat - aLat) * 0.05;
          const newLng = aLng + (pLng - aLng) * 0.05;
          
          return [newLat, newLng];
        });
      }, 2000);
      return () => clearInterval(timer);
    }
  }, [vitals?.isEmergency, ambulancePosition, currentLocation]);

  if (!currentLocation) return <div className="h-screen w-screen flex items-center justify-center bg-slate-50"><Activity className="w-12 h-12 text-accent-maroon animate-spin" /></div>;

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden relative font-sans text-slate-900">
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[65] lg:hidden"
          />
        )}
      </AnimatePresence>

      <PatientSidebar 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen} 
        patientData={patientData} 
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Real-time Map Element */}
        <div className="absolute inset-0 z-0">
          <LiveLocationMap 
             patientPosition={currentLocation}
             hospitals={nearbyHospitals}
             cardiologists={nearbyDoctors}
             ambulancePosition={ambulancePosition}
             isEmergency={vitals?.isEmergency}
          />
        </div>

        {/* Floating Sidebar Toggle for Mobile */}
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="lg:hidden absolute top-4 left-4 z-20 p-3 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-100 shadow-xl text-slate-600 hover:bg-white transition-all transform active:scale-95"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Emergency HUD Overlays */}
        <div className="absolute top-4 md:top-6 left-4 md:left-6 right-4 md:right-6 z-10 flex flex-col md:flex-row justify-between items-start gap-4 md:gap-6 pointer-events-none mt-14 lg:mt-0">
           <header className="h-16 md:h-20 bg-white/80 backdrop-blur-2xl border border-white px-6 md:px-8 flex items-center gap-4 md:gap-6 rounded-[20px] md:rounded-[24px] shadow-2xl pointer-events-auto w-full md:w-auto">
             <div className="p-2.5 md:p-3 bg-accent-maroon rounded-lg md:rounded-xl shrink-0">
               <Navigation className="w-4 h-4 md:w-5 md:h-5 text-white" />
             </div>
             <div>
                <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">OSM Matrix Hub</p>
                <h1 className="text-sm md:text-lg font-black text-slate-900 tracking-tight truncate">Tracking Active</h1>
             </div>
           </header>

           {vitals?.isEmergency && (
             <motion.div 
               initial={{ y: -20, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               className="bg-red-600 text-white p-4 md:p-6 rounded-[20px] md:rounded-[24px] shadow-2xl flex items-center gap-4 md:gap-6 pointer-events-auto w-full md:w-auto"
             >
                <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 rounded-lg md:rounded-xl flex items-center justify-center animate-pulse shrink-0">
                   <AlertTriangle className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div>
                   <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-80">Emergency</p>
                   <p className="text-sm md:text-lg font-black tracking-tight leading-tight">Vitals Critical • Help is Navigating</p>
                </div>
             </motion.div>
           )}
        </div>

        <div className="absolute bottom-6 md:bottom-12 left-4 md:left-12 right-4 md:right-12 z-10 pointer-events-none">
           <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-4 md:gap-6 pointer-events-auto">
              <HUDCard 
                icon={MapPin} 
                label="Coordinates" 
                val={`${currentLocation[0].toFixed(4)}, ${currentLocation[1].toFixed(4)}`} 
              />
              <HUDCard 
                icon={RouteIcon} 
                label="Nearby Units" 
                val={nearbyHospitals.length > 0 ? `${nearbyHospitals.length} Found` : "Searching..."} 
                sub={nearbyHospitals[0]?.name || "Scanning Area"}
              />
              <button 
                onClick={() => {
                  window.location.reload(); 
                }}
                className="bg-slate-900 text-white px-6 md:px-8 py-4 md:py-6 rounded-[20px] md:rounded-[32px] flex items-center justify-center gap-4 hover:bg-black transition-all shadow-2xl pointer-events-auto w-full md:w-auto"
              >
                 <Crosshair className="w-5 h-5 md:w-6 md:h-6" />
                 <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em]">Force Lock</span>
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

const HUDCard = ({ icon: Icon, label, val, sub }: any) => (
  <div className="flex-1 bg-white/80 backdrop-blur-xl p-4 md:p-6 rounded-[20px] md:rounded-[32px] border border-white shadow-2xl space-y-0.5 md:space-y-1">
     <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
        <Icon className="w-3 h-3 md:w-3.5 md:h-3.5 text-accent-maroon" />
        <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
     </div>
     <p className="text-base md:text-lg font-black text-slate-900 leading-none truncate">{val}</p>
     {sub && <p className="text-[7px] md:text-[9px] font-bold text-slate-400 uppercase tracking-tight truncate max-w-[150px] md:max-w-[200px]">{sub}</p>}
  </div>
);

export default LiveLocation;
