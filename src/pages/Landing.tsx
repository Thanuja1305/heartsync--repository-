import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Heart, Shield, Activity, Zap, ArrowRight, CheckCircle2, 
  BarChart3, Mail, Phone, MapPin, Send, AlertCircle, Clock, 
  Stethoscope, Share2, Globe, Lock, Brain, Database, Layers, 
  ShieldAlert, Ambulance, BellRing, HeartPulse, LineChart, Check
} from 'lucide-react';
import Navbar from '../components/Navbar';
import LiveLocationMap from '../components/LiveLocationMap';
import { useAuth } from '../context/AuthContext';

// Helper component for floating background particles
const BackgroundParticles = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute top-[10%] left-[5%] w-3 h-3 rounded-full bg-accent-maroon/20 blur-[1px] animate-drift-slow" />
      <div className="absolute top-[35%] right-[8%] w-2 h-2 rounded-full bg-medical-red/15 blur-[1px] animate-drift-slow [animation-delay:2s]" />
      <div className="absolute bottom-[25%] left-[12%] w-4 h-4 rounded-full bg-dark-navy/10 blur-[2px] animate-drift-slow [animation-delay:4s]" />
      <div className="absolute bottom-[45%] right-[22%] w-3 h-3 rounded-full bg-accent-maroon/10 blur-[1px] animate-drift-slow [animation-delay:1s]" />
      {/* Blurred glowing lights */}
      <div className="absolute top-1/4 left-1/3 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-accent-maroon/5 rounded-full blur-[100px] md:blur-[160px]" />
      <div className="absolute bottom-1/4 right-10 w-[200px] md:w-[450px] h-[200px] md:h-[450px] bg-dark-navy/5 rounded-full blur-[80px] md:blur-[140px]" />
    </div>
  );
};



const Landing = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // Redirection logic for authenticated users
  useEffect(() => {
    if (user && profile?.role) {
      if (profile.role === 'admin') navigate('/admin');
      else if (profile.role === 'patient') navigate('/patient-dashboard');
      else if (profile.role === 'doctor') navigate('/doctor-dashboard');
    }
  }, [user, profile, navigate]);

  // Fluctuating real-time state variables
  const [isBeating, setIsBeating] = useState(false);
  const [heartRate, setHeartRate] = useState(72);
  const [spo2, setSpo2] = useState(99);
  const [temp, setTemp] = useState(98.6);
  const [bp, setBp] = useState("118/76");
  const [confidence, setConfidence] = useState(99.45);
  const [eta, setEta] = useState(3.4);

  // Stats Counters
  const [activeStreams, setActiveStreams] = useState(4821);
  const [emergencyCases, setEmergencyCases] = useState(12480);

  // Form states for contact section
  const [formState, setFormState] = useState({ name: '', email: '', org: '', subject: '', message: '' });
  const [focused, setFocused] = useState<Record<string, boolean>>({});

  // Real-time fluctuating variables handler
  useEffect(() => {
    const valInterval = setInterval(() => {
      setHeartRate(prev => {
        const diff = Math.random() > 0.5 ? 1 : -1;
        const next = prev + diff;
        return next >= 69 && next <= 78 ? next : prev;
      });
      setSpo2(prev => {
        if (Math.random() > 0.8) {
          return prev === 99 ? 98 : 99;
        }
        return prev;
      });
      setTemp(prev => {
        const diff = (Math.random() - 0.5) * 0.1;
        const next = parseFloat((prev + diff).toFixed(1));
        return next >= 98.2 && next <= 98.9 ? next : prev;
      });
      setBp(prev => {
        return Math.random() > 0.6 
          ? (Math.random() > 0.5 ? "120/78" : "117/75")
          : "118/76";
      });
      setConfidence(prev => {
        const diff = (Math.random() - 0.5) * 0.05;
        const next = parseFloat((prev + diff).toFixed(2));
        return next >= 99.2 && next <= 99.8 ? next : prev;
      });
      setEta(prev => {
        const next = parseFloat((prev - 0.1).toFixed(1));
        return next <= 0.5 ? 3.8 : next;
      });
      setActiveStreams(prev => {
        const diff = Math.random() > 0.5 ? 1 : -1;
        return prev + diff;
      });
      if (Math.random() > 0.9) {
        setEmergencyCases(prev => prev + 1);
      }
    }, 3000);

    return () => clearInterval(valInterval);
  }, []);

  // ECG Line Generator
  const ecgPoints = useRef<number[]>(Array(120).fill(50));
  const [ecgPath, setEcgPath] = useState('');
  const ecgStep = useRef(0);

  useEffect(() => {
    const ecgInterval = setInterval(() => {
      const step = ecgStep.current;
      let nextVal = 50; // default baseline

      // Realistic ECG heartbeat waveform cycle
      if (step >= 0 && step < 12) {
        nextVal = 50;
      } else if (step === 12) {
        nextVal = 44; // P wave bump
      } else if (step === 13) {
        nextVal = 47; 
      } else if (step >= 14 && step < 18) {
        nextVal = 50;
      } else if (step === 18) {
        nextVal = 58; // Q wave sharp dip down
      } else if (step === 19) {
        nextVal = 10; // R wave spike up (contraction)
        setIsBeating(true); // Pulse triggers
        setTimeout(() => setIsBeating(false), 200);
      } else if (step === 20) {
        nextVal = 85; // S wave deep dip
      } else if (step === 21) {
        nextVal = 50; // return to baseline
      } else if (step >= 22 && step < 26) {
        nextVal = 50;
      } else if (step === 26) {
        nextVal = 42; // T wave bump
      } else if (step === 27) {
        nextVal = 46; 
      } else {
        nextVal = 50;
      }

      ecgPoints.current.shift();
      ecgPoints.current.push(nextVal);
      
      const path = ecgPoints.current
        .map((y, x) => `${x === 0 ? 'M' : 'L'}${x * 4.2},${y}`)
        .join(' ');
      
      setEcgPath(path);
      ecgStep.current = (step + 1) % 40; // 40-step cycle loops
    }, 45);

    return () => clearInterval(ecgInterval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-dark-navy relative overflow-hidden font-sans">
      <title>HeartSync | Emergency Cardiac Protocol</title>
      
      {/* Dynamic Embedded Styles for Advanced Animations */}
      <style>{`
        @keyframes flow-dash {
          to {
            stroke-dashoffset: -40;
          }
        }
        .animate-flow-line {
          stroke-dasharray: 8 4;
          animation: flow-dash 1.6s linear infinite;
        }
        @keyframes pulse-ring {
          0% {
            transform: scale(0.8);
            opacity: 0.8;
          }
          100% {
            transform: scale(2.2);
            opacity: 0;
          }
        }
        .animate-pulse-ring {
          animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(1.5deg); }
        }
        .animate-float-slow {
          animation: float-slow 6s ease-in-out infinite;
        }
        @keyframes drift-slow {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(25px, -25px) scale(1.1); }
        }
        .animate-drift-slow {
          animation: drift-slow 10s ease-in-out infinite;
        }
        .glass-premium {
          background: rgba(255, 255, 255, 0.55);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          box-shadow: 0 10px 40px -10px rgba(15, 23, 42, 0.04);
        }
        .glass-premium-dark {
          background: rgba(15, 23, 42, 0.88);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 10px 45px -10px rgba(0, 0, 0, 0.3);
        }
      `}</style>

      {/* Global Background Particles & Lighting Fades */}
      <BackgroundParticles />
      
      {/* Premium Sticky Sticky Navbar */}
      <Navbar />

      {/* ================= HERO SECTION ================= */}
      <section id="home" className="relative pt-36 md:pt-48 pb-20 md:pb-36 px-4 md:px-8 overflow-hidden min-h-[75vh] flex items-center justify-center">
        {/* Abstract background ECG waveform lines */}
        <div className="absolute inset-0 opacity-[0.03] select-none pointer-events-none z-0 flex items-center">
          <svg className="w-full h-48 text-accent-maroon" viewBox="0 0 1400 120" preserveAspectRatio="none">
            <path d="M0,60 L300,60 L320,40 L340,80 L360,60 L600,60 L620,10 L640,110 L660,60 L1000,60 L1020,45 L1040,75 L1060,60 L1400,60" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10 flex flex-col items-center">
          {/* Real-time sync node badge */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/70 backdrop-blur-md border border-dark-navy/5 rounded-full mb-8 w-fit shadow-sm"
          >
            <div className="w-2 h-2 bg-accent-maroon rounded-full animate-ping" />
            <div className="w-2 h-2 bg-accent-maroon rounded-full absolute" />
            <span className="text-[8px] md:text-[9.5px] font-black text-dark-navy/75 uppercase tracking-[0.25em]">Autonomous Emergency Loop</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-4xl sm:text-6xl md:text-7xl font-display font-bold leading-[1.1] tracking-tight text-dark-navy mb-8"
          >
            Synchronizing <span className="text-accent-maroon font-black relative px-2">Every Heartbeat</span> <br className="hidden sm:inline" />
            with Life-Saving <span className="font-light text-accent-maroon">Precision</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-muted text-sm md:text-lg leading-relaxed max-w-2xl mb-12 font-medium"
          >
            A futuristic, AI-connected emergency coordination infrastructure linking patient wearable sensors, instant cloud triage, localized responders, and global critical networks. Every second counts.
          </motion.p>

          {/* Premium action buttons */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 w-full sm:w-auto"
          >
            <Link 
              to="/auth" 
              className="w-full sm:w-auto group px-8 py-4.5 bg-accent-maroon text-white text-[10px] md:text-[11px] font-black uppercase tracking-[0.25em] rounded-2xl shadow-xl shadow-accent-maroon/20 hover:bg-dark-navy hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-3"
            >
              Get Started <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-300" />
            </Link>
            <Link 
              to="/auth" 
              className="w-full sm:w-auto px-8 py-4.5 bg-white/60 backdrop-blur-md border border-dark-navy/10 text-dark-navy text-[10px] md:text-[11px] font-black uppercase tracking-[0.25em] rounded-2xl hover:bg-white hover:shadow-lg transition-all duration-300 text-center"
            >
              Watch Demo
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ================= REAL-TIME FLOATING STATISTICS ================= */}
      <section className="py-12 px-4 md:px-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
            {[
              { label: "Live Monitoring", value: activeStreams.toLocaleString() + " Active", icon: HeartPulse, color: "text-accent-maroon bg-accent-maroon/5 border-accent-maroon/10" },
              { label: "AI Accuracy", value: "99.8% Perfect", icon: Brain, color: "text-dark-navy bg-dark-navy/5 border-dark-navy/5" },
              { label: "Response Time", value: "< 2.0 Minutes", icon: Zap, color: "text-medical-red bg-medical-red/5 border-medical-red/10" },
              { label: "Connected Clinics", value: "148+ Global Nodes", icon: Shield, color: "text-accent-maroon bg-accent-maroon/5 border-accent-maroon/10" },
              { label: "Protected Lives", value: emergencyCases.toLocaleString() + "+ Saved", icon: CheckCircle2, color: "text-dark-navy bg-dark-navy/5 border-dark-navy/5" }
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                whileHover={{ y: -6, scale: 1.02 }}
                className="glass-premium p-6 rounded-[24px] border border-dark-navy/5 flex flex-col justify-between cursor-default transition-all duration-300"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color} mb-4 border`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[8.5px] font-black text-muted uppercase tracking-wider mb-1">{stat.label}</p>
                  <p className="text-base md:text-lg font-black text-dark-navy tracking-tight">{stat.value}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CORE FEATURES SECTION ================= */}
      <section id="features" className="py-24 md:py-32 px-4 md:px-8 relative z-10 scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
            <p className="text-[10px] font-black text-accent-maroon uppercase tracking-[0.3em] mb-4">Patient Security Node</p>
            <h2 className="text-3xl md:text-5xl font-display font-black text-dark-navy tracking-tight mb-6">
              Empowering Emergent Healthcare with Autonomous Technology
            </h2>
            <p className="text-muted text-sm md:text-base font-medium leading-relaxed">
              We leverage cloud-synchronized telemetry metrics and localized algorithms to dispatch life-saving networks the very instant abnormalities are identified.
            </p>
          </div>

          {/* Streamlined Features Grid - 4 core premium cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-24 md:mb-32">
            {[
              { icon: HeartPulse, title: "Live Vitals Tracking", desc: "Instantly stream patient ECG rhythms, blood saturation, core humidity, and temperature straight from patient portals." },
              { icon: Brain, title: "Algorithmic Analysis", desc: "Automated neural nodes process multi-channel telemetry streams, evaluating distress states within milliseconds." },
              { icon: Stethoscope, title: "Clinical Synchronization", desc: "Nearby cardiologists and clinical providers receive live diagnostic warnings and historic visual medical profiles." },
              { icon: Ambulance, title: "Automated Dispatch", desc: "The software calculates live physical routes and signals nearby response teams with localized GPS vectors." }
            ].map((feat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.05 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="glass-premium p-8 rounded-[28px] border border-dark-navy/5 relative overflow-hidden group cursor-pointer transition-all duration-500"
              >
                {/* Visual hover border glow accent */}
                <div className="absolute inset-0 bg-gradient-to-br from-accent-maroon/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute top-0 left-0 w-1 h-0 bg-accent-maroon group-hover:h-full transition-all duration-500" />

                <div className="w-12 h-12 bg-white/80 rounded-2xl flex items-center justify-center text-accent-maroon border border-dark-navy/5 shadow-sm group-hover:bg-accent-maroon group-hover:text-white transition-all duration-300 mb-6">
                  <feat.icon className="w-6 h-6 group-hover:scale-110 transition-transform duration-300" />
                </div>
                
                <h3 className="text-sm font-black text-dark-navy uppercase tracking-wider mb-4">{feat.title}</h3>
                <p className="text-muted text-xs leading-relaxed font-medium">{feat.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Interactive Live Dashboard Showcase - Seamlessly integrated into Features */}
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* Dashboard Mockup Left Content */}
            <div className="lg:col-span-4">
              <p className="text-[10px] font-black text-accent-maroon uppercase tracking-[0.3em] mb-4">Command Center</p>
              <h2 className="text-3xl md:text-4xl font-display font-black text-dark-navy tracking-tight leading-tight mb-6">
                Institutional Telemetry Portal
              </h2>
              <p className="text-muted text-sm leading-relaxed mb-8 font-medium">
                Our interface is engineered for hyper-density. Medical directors study clean waveform patterns, patient geographical positions, and automated AI confidence parameters on a synchronized dashboard.
              </p>
              
              <div className="space-y-4">
                {[
                  { label: "ECG Waveform Stream", desc: "Fluid, millisecond-accurate mathematical cardiac trace rendering." },
                  { label: "Confidence Coefficient", desc: "Real-time accuracy estimates based on patient histories." },
                  { label: "Telemetry Synchronization", desc: "Immediate visual broadcast to ambulance and clinic nodes." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-accent-maroon-light flex items-center justify-center text-accent-maroon shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5" strokeWidth={3} />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-dark-navy uppercase tracking-wider mb-1">{item.label}</h4>
                      <p className="text-xs text-muted leading-relaxed font-medium">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dashboard Mockup Showcase */}
            <div className="lg:col-span-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="glass-premium-dark rounded-[32px] p-6 md:p-8 text-white relative shadow-2xl overflow-hidden"
              >
                {/* Header of mockup */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-white/10 pb-6 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent-maroon rounded-lg">
                      <Heart className="w-4 h-4 text-white fill-white/20" />
                    </div>
                    <div>
                      <span className="text-xs font-black uppercase tracking-[0.15em] text-white">Terminal Node HS-982</span>
                      <p className="text-[9px] text-white/40 font-mono tracking-widest">TRANSMITTING SIGNAL - HYDERABAD HUB</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-medical-red animate-ping" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/80 bg-white/10 px-3 py-1 rounded-full border border-white/5">
                      Live Telemetry Stream
                    </span>
                  </div>
                </div>

                {/* Vitals grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "HEART RATE", val: `${heartRate} BPM`, status: "Fluctuating (Normal)", color: "text-medical-red" },
                    { label: "SPO₂ LEVELS", val: `${spo2}%`, status: "Oxygen Stable", color: "text-white" },
                    { label: "BODY TEMPERATURE", val: `${temp} °F`, status: "Thermal Normal", color: "text-white" },
                    { label: "BLOOD PRESSURE", val: bp, status: "Sys/Dia Stable", color: "text-white" }
                  ].map((v, i) => (
                    <div key={i} className="bg-white/5 border border-white/5 p-4 rounded-2xl relative">
                      <p className="text-[8px] font-black text-white/50 uppercase tracking-widest mb-1">{v.label}</p>
                      <p className={`text-xl md:text-2xl font-black ${v.color} tracking-tighter mb-0.5`}>{v.val}</p>
                      <p className="text-[8.5px] text-white/30 font-medium">{v.status}</p>
                    </div>
                  ))}
                </div>

                {/* Real-time ECG Live Waveform graph container */}
                <div className="bg-slate-950/80 border border-white/5 rounded-2xl p-4 mb-6 relative overflow-hidden">
                  <div className="absolute top-2 left-4 text-[7px] font-black text-white/30 uppercase tracking-widest font-mono">Continuous R-Wave Electrocardiogram Feed</div>
                  <div className="absolute top-2 right-4 text-[7px] font-mono text-medical-red animate-pulse flex items-center gap-1">
                    <span className="w-1 h-1 bg-medical-red rounded-full animate-ping" />
                    ECG NODE: SYNCED
                  </div>
                  
                  {/* Graph Grid Lines overlay */}
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(211,47,47,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(211,47,47,0.02)_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />

                  {/* SVG ECG Waveform */}
                  <div className="h-28 w-full flex items-center justify-center relative select-none">
                    <svg className="w-full h-full" viewBox="0 0 500 100" preserveAspectRatio="none">
                      <path 
                        d={ecgPath}
                        fill="none"
                        stroke="#D32F2F"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="drop-shadow-[0_0_8px_rgba(211,47,47,0.6)]"
                      />
                    </svg>
                  </div>
                </div>

                {/* Live GPS Map and dispatch status */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Small Info Panel */}
                  <div className="md:col-span-4 space-y-3">
                    <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
                      <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-1">AI Diagnostics</p>
                      <span className="text-base font-black text-white">{confidence}% Confidence</span>
                      <p className="text-[8px] text-white/30 font-semibold mt-1">NO DISTRESS SUSPECTED</p>
                    </div>
                    <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
                      <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-1">Ambulance Vector</p>
                      <span className="text-base font-black text-white">ETA {eta} Mins</span>
                      <p className="text-[8px] text-white/30 font-semibold mt-1">EMERGENCY STANDBY STATUS</p>
                    </div>
                  </div>

                  {/* Map Preview widget */}
                  <div className="md:col-span-8 h-44 rounded-xl overflow-hidden border border-white/10 relative">
                    <LiveLocationMap 
                      patientPosition={[17.3850, 78.4867]}
                      isEmergency={false}
                    />
                    <div className="absolute inset-0 bg-accent-maroon/5 pointer-events-none" />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= ABOUT US SECTION ================= */}
      <section id="about" className="py-24 md:py-32 px-4 md:px-8 bg-white relative z-10 border-t border-dark-navy/5 scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
            <p className="text-[10px] font-black text-accent-maroon uppercase tracking-[0.3em] mb-4">About HeartSync</p>
            <h2 className="text-3xl md:text-5xl font-display font-black text-dark-navy tracking-tight mb-6">
              The Real-Time Lifesaving Loop
            </h2>
            <p className="text-muted text-sm md:text-base font-medium leading-relaxed">
              We connect critical care interfaces in a single continuous pipeline, reducing reaction times from minutes to milliseconds to protect vulnerable patient circles.
            </p>
          </div>

          {/* Unified Timeline & Mission Pipeline */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-center mb-24">
            {/* Mission statement */}
            <div className="lg:col-span-2 space-y-6">
              <span className="text-[8.5px] font-black text-accent-maroon uppercase tracking-widest block">Our Operational Core</span>
              <h3 className="text-2xl md:text-3xl font-display font-black text-dark-navy leading-tight">
                Engineering trust where every second is absolute.
              </h3>
              <p className="text-muted text-sm leading-relaxed font-medium">
                Traditional emergency services respond after an incident is manually flagged. HeartSync shifts clinical response to a proactive model. By linking wearable sensors to sub-second cloud triage algorithms and local emergency responders, medical professionals receive live feeds and exact routes before patient events fully develop.
              </p>
              <div className="p-6 bg-slate-50 border border-dark-navy/5 rounded-3xl">
                <span className="text-[8.5px] font-black text-accent-maroon uppercase tracking-widest block mb-2">Our Standards</span>
                <p className="text-xs text-muted leading-relaxed font-semibold">
                  Architected to adhere to the strictest security frameworks. Fully end-to-end encrypted medical transmissions ready for HIPAA compliance and localized hospital network standards.
                </p>
              </div>
            </div>

            {/* Streamlined timeline workflow */}
            <div className="lg:col-span-3 space-y-6">
              {[
                { stage: "Continuous Wearable Feeds", desc: "Patient sensors stream real-time ECG waveforms, heart rates, and blood oxygen levels continuously to our encrypted portal.", step: "01" },
                { stage: "Sub-Second AI Diagnostics", desc: "Automated neural algorithms evaluate raw streams within milliseconds to triage distress states and evaluate arrhythmia risk.", step: "02" },
                { stage: "Clinical Warning Broadcaster", desc: "Clinicians, caretakers, and cardiologists receive high-priority system alerts detailing precise telemetry data.", step: "03" },
                { stage: "Autonomous Dispatch Coordination", desc: "Our system calculates live routing vectors, immediately alerting the closest responders and preparing the hospital ER.", step: "04" }
              ].map((step, idx) => (
                <div key={idx} className="flex gap-6 p-6 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-dark-navy/5 transition-all duration-300">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center font-black text-xs text-accent-maroon border border-dark-navy/5 shrink-0 shadow-sm">
                    {step.step}
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-dark-navy tracking-wider mb-1.5">{step.stage}</h4>
                    <p className="text-muted text-xs leading-relaxed font-semibold">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Access Terminals Inside About Section */}
          <div className="border-t border-dark-navy/5 pt-20">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-[8.5px] font-black text-accent-maroon uppercase tracking-widest block mb-3">Response Portals</span>
              <h3 className="text-xl md:text-2xl font-black text-dark-navy uppercase tracking-tight">Establish Your Telemetry Connection</h3>
              <p className="text-muted text-xs font-semibold leading-relaxed mt-2">Select your custom dashboard below to authenticate and enter the HeartSync network.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Patient Portal Card */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                onClick={() => navigate('/patient/login')}
                className="group relative min-h-[220px] rounded-[24px] overflow-hidden cursor-pointer border border-dark-navy/5 shadow-premium flex flex-col justify-between p-8 transition-all duration-500 hover:border-accent-maroon/20 hover:shadow-2xl hover:shadow-accent-maroon/5 bg-slate-50"
              >
                <div>
                  <div className="w-10 h-10 bg-white border border-dark-navy/5 rounded-xl flex items-center justify-center mb-5 shadow-sm">
                    <Activity className="w-5 h-5 text-accent-maroon" />
                  </div>
                  <h3 className="text-xl font-display font-black text-dark-navy mb-2 tracking-tight">Patient Portal</h3>
                  <p className="text-muted text-xs font-medium leading-relaxed">Access your active vital streams, review historic diagnostic records, and configure emergency warning targets.</p>
                </div>
                
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-accent-maroon group-hover:translate-x-2 transition-transform duration-300">
                  Access Portal <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </motion.div>

              {/* Doctor Portal Card */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                onClick={() => navigate('/doctor/login')}
                className="group relative min-h-[220px] rounded-[24px] overflow-hidden cursor-pointer bg-dark-navy shadow-premium flex flex-col justify-between p-8 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-dark-navy/30"
              >
                <div className="absolute bottom-0 right-0 w-[150px] h-[150px] bg-accent-maroon/10 rounded-full blur-[60px] pointer-events-none" />

                <div>
                  <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-accent-maroon transition-colors">
                    <Stethoscope className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-display font-black text-white mb-2 tracking-tight">Responder Node</h3>
                  <p className="text-white/40 text-xs font-medium leading-relaxed">Advanced healthcare dashboards designed for medical directors, dispatch controllers, and cardiologists.</p>
                </div>
                
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white group-hover:text-accent-maroon group-hover:translate-x-2 transition-all duration-300">
                  Terminal Login <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= GET IN TOUCH SECTION ABOVE FOOTER ================= */}
      <section id="contact" className="py-24 md:py-32 px-4 md:px-8 bg-white relative z-10 scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
            <p className="text-[10px] font-black text-accent-maroon uppercase tracking-[0.3em] mb-4">Connect with HeartSync</p>
            <h2 className="text-3xl md:text-5xl font-display font-black text-dark-navy tracking-tight mb-6">
              Let's Build the Future of Emergency Healthcare
            </h2>
            <p className="text-muted text-sm md:text-base font-medium leading-relaxed">
              Whether you're a hospital network director, medical researcher, health provider, or emergency technology partner, our implementation team is ready to coordinate integration.
            </p>
          </div>

          {/* 3-Column horizontal grid of options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              { icon: Shield, title: "Hospital Integrations", desc: "Integrate HeartSync protocols into existing critical clinic nodes." },
              { icon: Brain, title: "Research Partnerships", desc: "Collaborate on next-generation AI-driven diagnostics innovation." },
              { icon: Globe, title: "Global Deployment", desc: "Expand intelligent emergency response networks across new global territories." }
            ].map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                whileHover={{ y: -6 }}
                className="glass-premium p-8 rounded-[28px] border border-dark-navy/5 flex flex-col gap-6 items-start shadow-sm hover:border-accent-maroon/20 hover:shadow-xl transition-all duration-300 cursor-default"
              >
                <div className="p-3 bg-accent-maroon-light rounded-xl text-accent-maroon shrink-0">
                  <card.icon className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-dark-navy uppercase tracking-wider mb-2">{card.title}</h4>
                  <p className="text-muted text-xs leading-relaxed font-medium">{card.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FINAL CALL-TO-ACTION SECTION ================= */}
      <section className="py-24 md:py-32 px-4 md:px-8 bg-dark-navy text-white relative z-10 overflow-hidden">
        {/* Background glow constraints */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] md:w-[700px] h-[350px] md:h-[700px] bg-accent-maroon/10 rounded-full blur-[100px] md:blur-[160px] opacity-80" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-display font-medium leading-tight mb-6 tracking-tight">
            Every Heartbeat Deserves a <span className="text-accent-maroon italic font-black">Faster Response</span>
          </h2>
          <p className="text-white/50 text-sm md:text-lg max-w-xl mx-auto mb-10 leading-relaxed font-medium">
            Join the decentralized emergency synchronization loop. Deploy real-time diagnostics, protect vulnerable patient circles, and save lives with modern algorithmic speed.
          </p>

          <Link 
            to="/auth" 
            className="inline-flex group px-10 py-5 bg-accent-maroon text-white text-[11px] font-black uppercase tracking-[0.25em] rounded-2xl hover:bg-white hover:text-dark-navy hover:shadow-2xl transition-all duration-300 items-center justify-center gap-3"
          >
            Establish Connection <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-300" />
          </Link>

          {/* Running clean ECG line behind CTA text */}
          <div className="mt-20 h-16 w-full opacity-10 pointer-events-none select-none">
            <svg className="w-full h-full" viewBox="0 0 1400 100" preserveAspectRatio="none">
              <path
                d="M0,50 L200,50 L220,30 L240,70 L260,50 L400,50 L420,10 L440,90 L460,50 L700,50 L720,40 L740,60 L760,50 L900,50 L920,20 L940,80 L960,50 L1100,50 L1120,45 L1140,55 L1160,50 L1400,50"
                fill="none"
                stroke="#FFF"
                strokeWidth="1.5"
                className="animate-pulse"
              />
            </svg>
          </div>
        </div>
      </section>

      {/* ================= PREMIUM FOOTER SECTION ================= */}
      <footer className="bg-dark-navy text-white relative z-10 border-t border-white/5 pt-20 pb-10 px-4 md:px-8 overflow-hidden">
        {/* Faint animated ECG line wrapping across the top divider */}
        <div className="absolute top-0 left-0 right-0 h-12 opacity-5 select-none pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 1400 100" preserveAspectRatio="none">
            <path
              d="M0,50 L400,50 L420,35 L440,65 L460,50 L800,50 L820,15 L840,85 L860,50 L1400,50"
              fill="none"
              stroke="#D32F2F"
              strokeWidth="2"
              className="animate-pulse"
            />
          </svg>
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 mb-16">
            
            {/* Column 1: Brand */}
            <div className="lg:col-span-4 relative">
              {/* Floating Heartbeat background effect behind brand column */}
              <div className="absolute -left-10 -top-10 w-36 h-36 rounded-full bg-accent-maroon/5 blur-2xl animate-pulse pointer-events-none" />

              <Link to="/" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex items-center gap-2.5 mb-6 group w-fit">
                <div className="p-2 bg-accent-maroon rounded-lg shadow-lg shadow-accent-maroon/10">
                  <Heart className="w-4.5 h-4.5 text-white fill-white/20" />
                </div>
                <span className="text-lg font-display font-black text-white tracking-tight">HeartSync</span>
              </Link>
              
              <p className="text-white/50 text-xs md:text-sm leading-relaxed mb-6 font-medium max-w-sm">
                Advanced AI-powered emergency synchronization platform connecting patients, doctors, hospitals, and emergency responders in real time. Every heartbeat deserves an intelligent response.
              </p>

              <div className="space-y-2 text-[10px] font-black uppercase tracking-widest text-accent-maroon/80">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-maroon animate-pulse" />
                  AI Powered Healthcare
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-maroon animate-pulse" />
                  Real-Time Emergency Response
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-maroon animate-pulse" />
                  IoT Connected Infrastructure
                </div>
              </div>
            </div>

            {/* Column 2: Navigation Links */}
            <div className="lg:col-span-2">
              <h4 className="font-black text-white uppercase text-[10px] tracking-[0.2em] mb-6">Quick Links</h4>
              <ul className="space-y-3.5">
                {[
                  { name: "Home", href: "#home" },
                  { name: "Features", href: "#features" },
                  { name: "AI Engine", href: "#features" },
                  { name: "Live Dashboard", href: "#features" },
                  { name: "About", href: "#home" },
                  { name: "Contact", href: "#contact" }
                ].map((link, idx) => (
                  <li key={idx}>
                    <a 
                      href={link.href} 
                      onClick={(e) => {
                        e.preventDefault();
                        const id = link.href.replace('#', '');
                        const elem = document.getElementById(id);
                        if (elem) elem.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="text-white/40 hover:text-accent-maroon hover:translate-x-1 font-bold text-xs uppercase tracking-wider transition-all duration-300 inline-block relative group"
                    >
                      {link.name}
                      <span className="absolute bottom-0 left-0 w-0 h-px bg-accent-maroon transition-all duration-300 group-hover:w-full" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Trust & Technology */}
            <div className="lg:col-span-3">
              <h4 className="font-black text-white uppercase text-[10px] tracking-[0.2em] mb-6">Healthcare Standards</h4>
              <ul className="space-y-3">
                {[
                  { label: "HIPAA Ready", icon: Shield },
                  { label: "GDPR Compliant", icon: Lock },
                  { label: "Secure Cloud Core", icon: Database },
                  { label: "End-to-End Encryption", icon: KeyRingIcon },
                  { label: "Real-Time Sync Protocol", icon: Activity },
                  { label: "24/7 Monitoring Nodes", icon: HeartPulse }
                ].map((item, idx) => {
                  const IconComponent = item.icon || Shield;
                  return (
                    <li key={idx} className="flex items-center gap-3 text-white/50 text-xs font-bold uppercase tracking-wider">
                      <IconComponent className="w-4 h-4 text-accent-maroon shrink-0" />
                      {item.label}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Column 4: Contact & Socials */}
            <div className="lg:col-span-3">
              <h4 className="font-black text-white uppercase text-[10px] tracking-[0.2em] mb-6">Connect With HeartSync</h4>
              <p className="text-white/40 text-xs leading-relaxed mb-6 font-medium">
                For hospital partnerships, clinical research collaborations, or localized rescue grid node integration:
              </p>
              
              <div className="space-y-2.5 text-xs font-bold text-white/70 mb-6">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-accent-maroon" />
                  <a href="mailto:sync@heartsync.health" className="hover:text-accent-maroon transition-colors">sync@heartsync.health</a>
                </div>
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-accent-maroon" />
                  <span>Hyderabad Hub, India</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-accent-maroon" />
                  <span>+91 90000 00000</span>
                </div>
              </div>

              {/* Social Link Handles */}
              <div className="flex gap-4">
                {['Twitter', 'LinkedIn', 'Github', 'Instagram'].map((s, i) => (
                  <a 
                    key={i} 
                    href="#" 
                    onClick={(e) => e.preventDefault()}
                    className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-white/60 hover:text-white hover:bg-accent-maroon hover:shadow-lg hover:shadow-accent-maroon/20 transition-all duration-300 text-[10px] font-black uppercase tracking-tighter"
                  >
                    {s[0]}
                  </a>
                ))}
              </div>
            </div>

          </div>

          {/* Bottom Bar separated by a thin animated ECG waveform line */}
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 relative">
            <p className="text-[9.5px] font-black text-white/30 uppercase tracking-widest">
              © 2026 HeartSync. All Rights Reserved.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center">
              {['Privacy Policy', 'Terms of Service', 'Security Standards', 'Accessibility'].map((item, i) => (
                <a 
                  key={i} 
                  href="#" 
                  onClick={e => e.preventDefault()}
                  className="text-[9.5px] font-black text-white/30 hover:text-accent-maroon uppercase tracking-widest transition-colors duration-200"
                >
                  {item}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Simple placeholder fallback icon for secure decryption key
const KeyRingIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z" />
    <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
  </svg>
);

export default Landing;
