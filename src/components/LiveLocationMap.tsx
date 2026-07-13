import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icons in Leaflet with React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to handle map view updates
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center, map.getZoom());
  return null;
}

interface Hospital {
  name: string;
  position: [number, number];
  type?: string;
}

interface Specialist {
  name: string;
  position: [number, number];
  specialization?: string;
}

interface LiveLocationMapProps {
  patientPosition: [number, number];
  hospitals?: Hospital[];
  cardiologists?: Specialist[];
  ambulancePosition?: [number, number];
  isEmergency?: boolean;
}

export default function LiveLocationMap({ 
  patientPosition, 
  hospitals = [], 
  cardiologists = [],
  ambulancePosition,
  isEmergency = false 
}: LiveLocationMapProps) {
  
  // Custom ambulance icon
  const ambulanceIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/1032/1032989.png',
    iconSize: [45, 45],
    iconAnchor: [22, 45],
    popupAnchor: [0, -45],
  });

  // Custom hospital icon
  const hospitalIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3304/3304567.png',
    iconSize: [35, 35],
    iconAnchor: [17, 35],
    popupAnchor: [0, -35],
  });

  // Custom specialist icon
  const specialistIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2773/2773033.png',
    iconSize: [35, 35],
    iconAnchor: [17, 35],
    popupAnchor: [0, -35],
  });

  // Patient icon with pulse effect for emergency
  const patientIcon = new L.DivIcon({
    className: 'custom-div-icon',
    html: `
      <div class="relative flex items-center justify-center">
        <div class="absolute w-8 h-8 ${isEmergency ? 'bg-red-500 animate-ping' : 'bg-accent-maroon/20 animate-pulse'} rounded-full"></div>
        <div class="relative w-4 h-4 ${isEmergency ? 'bg-red-600' : 'bg-accent-maroon'} rounded-full border-2 border-white shadow-lg"></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  return (
    <div className={`w-full h-full rounded-[32px] overflow-hidden border-4 ${isEmergency ? 'border-red-600' : 'border-white'} shadow-2xl relative z-0 transition-all duration-1000`}>
      <MapContainer
        center={patientPosition}
        zoom={14}
        scrollWheelZoom={true}
        className="w-full h-full"
        zoomControl={false}
      >
        <ChangeView center={patientPosition} />
        
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/hot/{z}/{x}/{y}.png"
        />

        {/* Patient Marker */}
        <Marker position={patientPosition} icon={patientIcon}>
          <Popup className="custom-popup">
            <div className="p-2 min-w-[150px]">
              <p className="font-black text-slate-900 uppercase tracking-widest text-[10px] mb-1">Patient Location</p>
              <div className="flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${isEmergency ? 'bg-red-600 animate-pulse' : 'bg-green-500'}`}></div>
                 <p className={`font-bold text-[10px] ${isEmergency ? 'text-red-600' : 'text-slate-500'}`}>
                    {isEmergency ? 'EMERGENCY PROTOCOL ACTIVE' : 'Status: Nominal'}
                 </p>
              </div>
            </div>
          </Popup>
        </Marker>

        {/* Ambulance Marker */}
        {ambulancePosition && (
          <Marker position={ambulancePosition} icon={ambulanceIcon}>
            <Popup>
               <div className="p-1">
                  <p className="font-black text-slate-900 uppercase tracking-widest text-xs">Dispatch Unit 🚑</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">ETA: 4 Minutes</p>
               </div>
            </Popup>
          </Marker>
        )}

        {/* Hospital Markers */}
        {hospitals.map((hospital, idx) => (
          <Marker key={`hosp-${idx}`} position={hospital.position} icon={hospitalIcon}>
            <Popup>
               <div className="p-1">
                  <p className="font-black text-slate-900 uppercase tracking-widest text-xs">{hospital.name}</p>
                  <p className="text-[10px] text-slate-500">{hospital.type || 'Cardiac Center'}</p>
               </div>
            </Popup>
          </Marker>
        ))}

        {/* Specialist Markers */}
        {cardiologists.map((doc, idx) => (
          <Marker key={`doc-${idx}`} position={doc.position} icon={specialistIcon}>
            <Popup>
               <div className="p-1">
                  <p className="font-black text-slate-900 uppercase tracking-widest text-xs">{doc.name}</p>
                  <p className="text-[10px] text-accent-maroon font-bold uppercase tracking-tighter">{doc.specialization || 'Cardiologist'}</p>
               </div>
            </Popup>
          </Marker>
        ))}

      </MapContainer>
    </div>
  );
}
