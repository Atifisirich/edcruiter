'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Building2, Plus, Lock, Unlock, FileText, CheckCircle2, AlertTriangle, Users, Trash2 } from 'lucide-react';
import { School, AuditLogEntry, DeletionRequest } from '@/lib/types';

export default function SuperAdminPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequest[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [supportMode, setSupportMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // New School Form State
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolCode, setNewSchoolCode] = useState('');

  useEffect(() => {
    fetchSuperAdminData();
  }, []);

  const fetchSuperAdminData = async () => {
    try {
      const [schRes, auditRes, delRes] = await Promise.all([
        fetch('/api/schools'),
        fetch('/api/audit-logs'),
        fetch('/api/account/delete-request')
      ]);
      const schData = await schRes.json();
      const auditData = await auditRes.json();
      const delData = await delRes.json();

      if (schData.schools) setSchools(schData.schools);
      if (auditData.auditLogs) setAuditLogs(auditData.auditLogs);
      if (delData.requests) setDeletionRequests(delData.requests);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const setSchoolStatus = async (schoolId: string, name: string, status: 'active' | 'suspended') => {
    const verb = status === 'active' ? 'Approve' : 'Suspend';
    if (!window.confirm(`${verb} "${name}"?${status === 'active' ? ' It can then use AI scoring, WhatsApp and public applications.' : ' Its AI features, messaging and public applications will stop.'}`)) return;
    try {
      const res = await fetch('/api/schools', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: schoolId, updates: { status } })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not change the school status');
      await fetchSuperAdminData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not change the school status');
    }
  };

  const confirmDeletion = async (requestId: string, candidateId: string, email: string) => {
    if (!window.confirm(`Permanently delete this candidate's application (${email})? This removes their record, stage results, recordings, resume, and message history. This cannot be undone.`)) {
      return;
    }
    setConfirmingId(candidateId);
    try {
      const res = await fetch('/api/account/delete-request/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, candidate_id: candidateId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      fetchSuperAdminData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to fulfil deletion request');
    } finally {
      setConfirmingId(null);
    }
  };

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName || !newSchoolCode) return;

    try {
      const res = await fetch('/api/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSchoolName,
          code: newSchoolCode,
          branches: [
            { id: 'b1', name: 'Main Campus', code: `${newSchoolCode}-MAIN`, location: 'City Center' }
          ]
        })
      });
      const data = await res.json();
      if (data.school) {
        setNewSchoolName('');
        setNewSchoolCode('');
        fetchSuperAdminData();
      }
    } catch (err) {
      alert('Failed to onboard school');
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500 font-medium">Loading platform administration...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Platform Admin Banner */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xl shadow-indigo-500/5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-extrabold text-slate-900">Platform Super Admin Portal</h1>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Manage multi-tenant school onboarding, billing statuses, and platform-wide security audit trails.
          </p>
        </div>

        {/* Support Mode Toggle */}
        <div className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
          <div className="text-xs">
            <strong className="text-slate-900 font-bold block">Candidate Support Mode</strong>
            <span className="text-[11px] text-slate-500 font-medium">
              {supportMode ? 'Explicit Support Mode Active (Logged)' : 'Zero Default Access to Tenant Candidates'}
            </span>
          </div>
          <button
            onClick={() => setSupportMode(!supportMode)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
              supportMode ? 'bg-amber-600 text-white shadow-amber-600/20' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            {supportMode ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            {supportMode ? 'Support Mode ON' : 'Support Mode OFF'}
          </button>
        </div>
      </div>

      {/* Onboard New School Tenant */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-4">
        <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-indigo-600" /> Onboard New School Tenant
        </h2>

        <form onSubmit={handleCreateSchool} className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-medium">
          <input
            type="text"
            required
            placeholder="School Name (e.g. Oakridge International)"
            value={newSchoolName}
            onChange={e => setNewSchoolName(e.target.value)}
            className="p-3 rounded-xl border border-slate-200 bg-white"
          />
          <input
            type="text"
            required
            placeholder="Short Code (e.g. OAK)"
            value={newSchoolCode}
            onChange={e => setNewSchoolCode(e.target.value)}
            className="p-3 rounded-xl border border-slate-200 bg-white"
          />
          <button
            type="submit"
            className="gradient-btn py-3 font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md"
          >
            <Plus className="w-4 h-4" /> Onboard Tenant
          </button>
        </form>
      </div>

      {/* Tenants Table */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-4">
        <h2 className="text-lg font-extrabold text-slate-900">
          Tenant Schools ({schools.length})
          {schools.filter(sc => sc.status === 'onboarding').length > 0 && (
            <span className="ml-3 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              {schools.filter(sc => sc.status === 'onboarding').length} waiting for approval
            </span>
          )}
        </h2>
        <div className="divide-y divide-slate-100">
          {schools.map(sch => (
            <div key={sch.id} className="py-4 flex flex-wrap items-center justify-between gap-4 text-xs font-medium">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-slate-900 text-sm">{sch.name}</h4>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-indigo-50 text-indigo-700 font-mono font-bold border border-indigo-200">
                    {sch.code}
                  </span>
                </div>
                <p className="text-slate-500">{sch.primary_contact.name} • {sch.primary_contact.email}</p>
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  sch.status === 'active' ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : sch.status === 'suspended' ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}>
                  {sch.status === 'onboarding' ? 'WAITING FOR APPROVAL' : sch.status.toUpperCase()}
                </span>
                <span className="text-slate-600 font-semibold">{sch.branches.length} Campuses</span>
                {sch.status !== 'active' && (
                  <button
                    type="button"
                    onClick={() => setSchoolStatus(sch.id, sch.name, 'active')}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white cursor-pointer hover:bg-emerald-700"
                  >
                    Approve
                  </button>
                )}
                {sch.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => setSchoolStatus(sch.id, sch.name, 'suspended')}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold border border-slate-300 text-slate-600 cursor-pointer hover:bg-slate-50"
                  >
                    Suspend
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Right-to-Erasure Requests */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-4">
        <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-rose-600" /> Data Deletion Requests ({deletionRequests.length})
        </h2>
        <p className="text-xs text-slate-500">
          A candidate submitted these through the public &ldquo;Delete my data&rdquo; form. Each one is only a request —
          nothing is removed until you confirm it here, per matched application.
        </p>

        {deletionRequests.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No pending requests.</p>
        ) : (
          <div className="space-y-3">
            {deletionRequests.map((req) => (
              <div key={req.id} className="p-3.5 bg-rose-50/60 rounded-xl border border-rose-200 space-y-2">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-bold text-slate-900">{req.email}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Requested {new Date(req.requested_at).toLocaleString()}
                  </span>
                </div>
                {req.reason && <p className="text-[11px] text-slate-600 italic">&ldquo;{req.reason}&rdquo;</p>}
                <div className="space-y-1.5">
                  {req.matched_candidates.filter((m) => !m.fulfilled_at).map((m) => (
                    <div key={m.candidate_id} className="flex items-center justify-between gap-3 p-2 bg-white rounded-lg border border-rose-100 text-[11px]">
                      <span className="font-mono text-slate-600">{m.candidate_id} · {m.school_id}</span>
                      <button
                        onClick={() => confirmDeletion(req.id, m.candidate_id, req.email)}
                        disabled={confirmingId === m.candidate_id}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3 h-3" />
                        {confirmingId === m.candidate_id ? 'Deleting…' : 'Confirm & delete'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Platform-Wide Audit Log */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-4">
        <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" /> Platform Security Audit Trail
        </h2>

        <div className="space-y-2 text-xs font-medium">
          {auditLogs.map(log => (
            <div key={log.id} className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <span>{log.action}</span>
                  <span className="text-slate-500 font-semibold">• {log.actor_name} ({log.actor_role})</span>
                </div>
                <p className="text-slate-600 text-[11px]">{log.details}</p>
              </div>
              <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
