import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell, AlertCircle, Clock, ShieldCheck, Search,
  Filter, CheckCircle2, ArrowRight, Menu, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, limit, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DoctorSidebar from '../components/DoctorSidebar';

const DoctorAlerts = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'emergencyAlerts'), orderBy('detectedAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, snap => {
      setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const unacknowledged = alerts.filter(a => !a.acknowledged).length;
  const criticalCount = alerts.filter(a => (a.severity || '').toLowerCase() === 'critical').length;
  const resolvedCount = alerts.filter(a => (a.status || '').toLowerCase() === 'resolved').length;

  const filtered = search
    ? alerts.filter(a =>
        (a.patientName || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.message || '').toLowerCase().includes(search.toLowerCase())
      )
    : alerts;

  const getSeverityStyles = (sev: string) => {
    const s = (sev || '').toLowerCase();
    if (s === 'critical') return { badge: 'bg-red-500/20 text-red-400 border border-red-500/30', icon: 'bg-red-500/20 text-red-400', dot: 'bg-red-500' };
    if (s === 'moderate' || s === 'warning') return { badge: 'bg-orange-500/20 text-orange-400 border border-orange-500/30', icon: 'bg-orange-500/20 text-orange-400', dot: 'bg-orange-500' };
    return { badge: 'bg-blue-500/20 text-blue-400 border border-blue-500/30', icon: 'bg-blue-500/20 text-blue-400', dot: 'bg-blue-400' };
  };

  const formatDate = (d: any) => {
    if (!d) return '--';
    try { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return '--'; }
  };

  const handleAcknowledge = async (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try { await updateDoc(doc(db, 'emergencyAlerts', alertId), { acknowledged: true, status: 'RESOLVED' }); }
    catch (err) { console.error(err); }
  };

  return (
    <div className="flex h-screen bg-[#0B1120] text-white overflow-hidden">
      {/* Mobile overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] lg:hidden" />
        )}
      </AnimatePresence>

      <DoctorSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} alertCount={unacknowledged} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-[#111827] border-b border-white/[0.06] px-4 lg:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-400 hover:text-white transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-black text-white tracking-tight leading-none">Alert History</h1>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mt-0.5">Emergency Incident Archive</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search alerts..."
                className="pl-9 pr-4 py-2 bg-[#1E293B] border border-white/[0.06] rounded-xl text-[11px] text-white placeholder-slate-600 outline-none focus:border-accent-maroon/40 transition-colors w-48 font-medium" />
            </div>
            <button className="p-2.5 bg-[#1E293B] rounded-xl border border-white/5 hover:bg-white/5 transition-colors">
              <Filter className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Critical Events', value: criticalCount, icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
              { label: 'Resolved Cases', value: resolvedCount, icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
              { label: 'Pending Review', value: unacknowledged, icon: Clock, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
            ].map(stat => (
              <div key={stat.label} className="bg-[#111827] rounded-2xl border border-white/[0.06] p-4 flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${stat.bg}`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{stat.label}</p>
                  <p className={`text-2xl font-black leading-tight ${stat.color}`}>{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Alert List */}
          <div className="bg-[#111827] rounded-2xl border border-white/[0.06] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <h3 className="text-[10px] font-black text-white uppercase tracking-wider">Incident Log ({filtered.length})</h3>
              <Bell className="w-3.5 h-3.5 text-slate-600" />
            </div>
            <div className="divide-y divide-white/[0.04]">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <div key={i} className="p-4 animate-pulse flex items-center gap-4">
                    <div className="w-10 h-10 bg-white/5 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-white/5 rounded w-1/3" />
                      <div className="h-2 bg-white/5 rounded w-2/3" />
                    </div>
                  </div>
                ))
              ) : filtered.length === 0 ? (
                <div className="py-20 text-center">
                  <ShieldCheck className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm font-black text-slate-600">No Incidents Archived</p>
                  <p className="text-[10px] text-slate-700 font-bold mt-1">Perfect safety index maintained</p>
                </div>
              ) : filtered.map(alert => {
                const sev = getSeverityStyles(alert.severity);
                return (
                  <motion.div key={alert.id} whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
                    onClick={() => alert.patientId && navigate(`/doctor/patient/${alert.patientId}`)}
                    className="p-4 flex items-center gap-4 cursor-pointer transition-colors group">
                    {/* Severity dot */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${sev.icon}`}>
                      <AlertCircle className="w-5 h-5" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-[12px] font-black text-white truncate">{alert.patientName || 'Unknown Patient'}</p>
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg ${sev.badge}`}>
                          {(alert.severity || 'unknown').toUpperCase()}
                        </span>
                        {alert.acknowledged && (
                          <span className="text-[8px] font-black px-2 py-0.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20">RESOLVED</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium truncate">{alert.message || 'Cardiac anomaly detected'}</p>
                      <p className="text-[9px] text-slate-700 font-bold mt-0.5 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />{formatDate(alert.detectedAt)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {!alert.acknowledged && (
                        <button onClick={(e) => handleAcknowledge(alert.id, e)}
                          className="px-3 py-1.5 bg-green-500/10 border border-green-500/20 text-green-400 text-[9px] font-black rounded-lg hover:bg-green-500/20 transition-colors">
                          Resolve
                        </button>
                      )}
                      <button className="p-2 bg-[#1E293B] border border-white/5 rounded-xl text-slate-600 group-hover:text-slate-300 transition-colors">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorAlerts;
