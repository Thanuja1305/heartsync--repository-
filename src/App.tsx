import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NetworkProvider } from './context/NetworkContext';
import ProtectedRoute from './components/ProtectedRoute';

// Lazy load components
import Landing from './pages/Landing';
import PatientLogin from './pages/PatientLogin';
import DoctorLogin from './pages/DoctorLogin';
import Signup from './pages/Signup';
import RoleSelection from './pages/RoleSelection';
const PatientSignup = lazy(() => import('./pages/PatientSignup'));
const DoctorSignup = lazy(() => import('./pages/DoctorSignup'));
const PatientOnboarding = lazy(() => import('./pages/PatientOnboarding'));
const DoctorOnboarding = lazy(() => import('./pages/DoctorOnboarding'));
const PatientDashboard = lazy(() => import('./pages/PatientDashboard'));
const PatientProfile = lazy(() => import('./pages/PatientProfile'));
const NearbyCare = lazy(() => import('./pages/NearbyCare'));
const AIAssessment = lazy(() => import('./pages/AIAssessment'));
const AIChat = lazy(() => import('./pages/AIChat'));
const LiveLocation = lazy(() => import('./pages/LiveLocation'));
const Consultations = lazy(() => import('./pages/Consultations'));
const Notifications = lazy(() => import('./pages/Notifications'));
import AdminLogin from './pages/AdminLogin';
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const PendingApproval = lazy(() => import('./pages/PendingApproval'));
const DoctorDashboard = lazy(() => import('./pages/DoctorDashboard'));
const DoctorProfile = lazy(() => import('./pages/DoctorProfile'));
const DoctorPatients = lazy(() => import('./pages/DoctorPatients'));
const DoctorPatientDetails = lazy(() => import('./pages/DoctorPatientDetails'));
const DoctorLiveMonitoring = lazy(() => import('./pages/DoctorLiveMonitoring'));
const DoctorAlerts = lazy(() => import('./pages/DoctorAlerts'));
const DoctorEmergency = lazy(() => import('./pages/DoctorEmergency'));

const LoadingFallback = () => (
  <div className="min-h-screen bg-white flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 border-2 border-slate-100 rounded-full" />
        <div className="absolute inset-0 border-2 border-accent-maroon border-t-transparent rounded-full animate-spin" />
        <Heart className="absolute inset-0 m-auto w-4 h-4 text-accent-maroon animate-pulse" />
      </div>
      <p className="text-slate-400 font-bold uppercase text-[9px] tracking-[0.3em] animate-pulse">Initializing Portal...</p>
    </div>
  </div>
);

export default function App() {
  return (
    <Router>
      <NetworkProvider>
        <AuthProvider>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/patient/login" element={<PatientLogin />} />
            <Route path="/doctor/login" element={<DoctorLogin />} />
            <Route path="/signup" element={<Signup />} />
            
            <Route path="/auth" element={<RoleSelection />} />
            <Route path="/select-role" element={<Navigate to="/auth" replace />} />
            <Route path="/patient-login" element={<PatientLogin />} />
            <Route path="/patient-signup" element={<PatientSignup />} />
            <Route path="/doctor-login" element={<DoctorLogin />} />
            <Route path="/doctor-signup" element={<DoctorSignup />} />
            <Route path="/patient-dashboard" element={
              <ProtectedRoute accessRole="patient">
                <PatientDashboard />
              </ProtectedRoute>
            } />
            <Route path="/doctor-dashboard" element={
              <ProtectedRoute accessRole="doctor">
                <DoctorDashboard />
              </ProtectedRoute>
            } />
            <Route path="/doctor-verification-pending" element={
              <ProtectedRoute>
                <PendingApproval />
              </ProtectedRoute>
            } />

            <Route path="/patient/onboarding" element={
              <ProtectedRoute>
                <PatientOnboarding />
              </ProtectedRoute>
            } />

            <Route path="/doctor/registration" element={
              <ProtectedRoute>
                <DoctorOnboarding />
              </ProtectedRoute>
            } />

            <Route path="/patient/dashboard" element={
              <ProtectedRoute accessRole="patient">
                <PatientDashboard />
              </ProtectedRoute>
            } />

            <Route path="/patient/profile" element={
              <ProtectedRoute accessRole="patient">
                <PatientProfile />
              </ProtectedRoute>
            } />

            <Route path="/patient/nearby-care" element={
              <ProtectedRoute>
                <NearbyCare />
              </ProtectedRoute>
            } />

            <Route path="/patient/ai-assessment" element={
              <ProtectedRoute>
                <AIAssessment />
              </ProtectedRoute>
            } />

            <Route path="/patient/ai-chat" element={
              <ProtectedRoute>
                <AIChat />
              </ProtectedRoute>
            } />

            <Route path="/patient/live-location" element={
              <ProtectedRoute>
                <LiveLocation />
              </ProtectedRoute>
            } />

            <Route path="/patient/consultations" element={
              <ProtectedRoute>
                <Consultations />
              </ProtectedRoute>
            } />

            <Route path="/patient/notifications" element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            } />

            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={
              <ProtectedRoute accessRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            } />

            <Route path="/doctor/dashboard" element={
              <ProtectedRoute accessRole="doctor">
                <DoctorDashboard />
              </ProtectedRoute>
            } />

            <Route path="/doctor/profile" element={
              <ProtectedRoute accessRole="doctor">
                <DoctorProfile />
              </ProtectedRoute>
            } />

            <Route path="/doctor/patients" element={
              <ProtectedRoute accessRole="doctor">
                <DoctorPatients />
              </ProtectedRoute>
            } />

            <Route path="/doctor/patient/:id" element={
              <ProtectedRoute accessRole="doctor">
                <DoctorPatientDetails />
              </ProtectedRoute>
            } />

            <Route path="/doctor/live-monitoring" element={
              <ProtectedRoute accessRole="doctor">
                <DoctorLiveMonitoring />
              </ProtectedRoute>
            } />

            <Route path="/doctor/alerts" element={
              <ProtectedRoute accessRole="doctor">
                <DoctorAlerts />
              </ProtectedRoute>
            } />

            <Route path="/doctor/emergency" element={
              <ProtectedRoute accessRole="doctor">
                <DoctorEmergency />
              </ProtectedRoute>
            } />

            <Route path="/pending-approval" element={
              <ProtectedRoute>
                <PendingApproval />
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </AuthProvider>
     </NetworkProvider>
    </Router>
  );
}
