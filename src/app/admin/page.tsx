'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2, Settings, Users, BookOpen, FileText, Plus,
  Shield, Check, Trash2, Sliders, ArrowUp, ArrowDown, Upload, Sparkles, ArrowRight,
  UserPlus, Copy, Send, Smartphone, MapPin, ExternalLink, Eye, HelpCircle, Award,
  FileSpreadsheet, MessageSquare, X, CheckCircle2, AlertCircle, Share2, Clock, XCircle, Filter,
  LayoutGrid, List, ChevronRight, BarChart3, TrendingUp, Search, Wand2, RefreshCw,
  Video, CloudUpload, Radio, PlayCircle, ShieldCheck, Briefcase, GraduationCap, Zap, Phone
} from 'lucide-react';
import { SLOKA_SCHOOL_ID } from '@/lib/defaultData';
import { School, Candidate, QuestionnaireItem, RubricTemplate, StageKey } from '@/lib/types';
import BrandMark from '@/components/shared/BrandMark';
import AIJobGeneratorModal from '@/components/admin/AIJobGeneratorModal';
import ExcelCandidateUploaderModal from '@/components/admin/ExcelCandidateUploaderModal';
import { credentialsFromCandidate } from '@/lib/credentials';
import {
  DEFAULT_SHORTLIST_BANDS,
  ShortlistBand,
  bandBadgeClass,
  bandForScore,
  bandScoreTextClass,
  normalizeBands,
} from '@/lib/shortlistBands';

type OutcomeRange = 'today' | 'till_date' | 'last_month' | 'last_year';

function inOutcomeRange(iso: string | undefined, range: OutcomeRange): boolean {
  if (!iso) return false;
  if (range === 'till_date') return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  if (range === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return t >= start.getTime();
  }
  if (range === 'last_month') return t >= now - 30 * 24 * 60 * 60 * 1000;
  return t >= now - 365 * 24 * 60 * 60 * 1000;
}

export default function SchoolAdminWorkspace() {
  const router = useRouter();
  const [school, setSchool] = useState<School | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Navigation View in Workspace
  const [currentView, setCurrentView] = useState<'overview' | 'jobs' | 'screening' | 'pipeline' | 'automation'>('overview');

  // Modals State
  const [showJobModal, setShowJobModal] = useState<boolean>(false);
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);
  const [showAddCandidateModal, setShowAddCandidateModal] = useState<boolean>(false);
  const [lastInvite, setLastInvite] = useState<{ name: string; code: string; id: string } | null>(null);

  // Multi-Dimensional Candidate Shortlisting & Filter State
  const [filterSubject, setFilterSubject] = useState<string>('ALL');
  const [filterSegment, setFilterSegment] = useState<string>('ALL');
  const [filterMinScore, setFilterMinScore] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [outcomeRange, setOutcomeRange] = useState<OutcomeRange>('today');
  const [bandDraft, setBandDraft] = useState<ShortlistBand[]>(DEFAULT_SHORTLIST_BANDS);
  const [savingBands, setSavingBands] = useState(false);

  // Single Candidate Form State — every field starts genuinely blank. It
  // used to start pre-filled with realistic-looking values ('Physics',
  // 'M.Sc + B.Ed', '3 – 5 Years', 'Delhi Public School, Hyderabad', '7.5
  // LPA'), so a candidate added by clicking through without editing every
  // field got submitted with a fabricated qualification, experience,
  // prior school and salary that were never actually provided. The
  // dropdowns below now open on an explicit "Select…" option and require a
  // real choice before the form can submit.
  const [singleCandidateData, setSingleCandidateData] = useState({
    name: '',
    email: '',
    phone: '',
    applied_subject: '',
    applied_segment: '',
    qualification: '',
    experience_band: '',
    prior_org: '',
    target_branch_id: ''
  });
  const [isAddingCandidate, setIsAddingCandidate] = useState(false);

  // The school this admin actually belongs to — resolved from the setup
  // wizard's localStorage marker, matching every other admin page. This
  // component used to hardcode SLOKA_SCHOOL_ID (the seeded demo school) in
  // every call: reads happened to still work because the backend now pins
  // a signed-in admin to their own school regardless of the id in the
  // query string, but writes — specifically "+ Add Candidate" — trusted
  // the request body's school_id verbatim, so a candidate added by hand
  // was created under the demo school and never appeared in this admin's
  // own list. That specific hole is also closed server-side now (a staff
  // caller's real school always wins), but this still needs to stop
  // sending the wrong id in the first place.
  const schoolId =
    (typeof window !== 'undefined' && localStorage.getItem('edcruiter_school_id')) || SLOKA_SCHOOL_ID;

  useEffect(() => {
    fetchSchoolData();
  }, []);

  const fetchSchoolData = async () => {
    try {
      const [schRes, candRes] = await Promise.all([
        fetch(`/api/schools?school_id=${schoolId}`),
        fetch(`/api/candidates?school_id=${schoolId}`)
      ]);
      const schData = await schRes.json();
      const candData = await candRes.json();
      if (schData.school) {
        setSchool(schData.school);
        setBandDraft(normalizeBands(schData.school.shortlist_bands));
      }
      if (candData.candidates) setCandidates(candData.candidates);
    } catch (err) {
      console.error('Error loading school admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSingleCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleCandidateData.name || !singleCandidateData.email) {
      alert('Please provide Name and Email');
      return;
    }
    setIsAddingCandidate(true);
    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: schoolId,
          ...singleCandidateData,
          status: 'in_progress'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to add candidate');
        return;
      }
      if (data.candidate) {
        setShowAddCandidateModal(false);
        setLastInvite({
          name: data.candidate.name,
          code: data.candidate.invite_code || data.candidate.id,
          id: data.candidate.id
        });
        setSingleCandidateData({
          name: '',
          email: '',
          phone: '',
          applied_subject: '',
          applied_segment: '',
          qualification: '',
          experience_band: '',
          prior_org: '',
          target_branch_id: ''
        });
        await fetchSchoolData();
        setCurrentView('pipeline');
      }
    } catch (err) {
      alert('Failed to add candidate');
    } finally {
      setIsAddingCandidate(false);
    }
  };

  const filteredCandidates = candidates.filter(c => {
    const matchesSub = filterSubject === 'ALL' || c.applied_subject?.toLowerCase() === filterSubject.toLowerCase();
    const matchesSeg = filterSegment === 'ALL' || c.applied_segment?.toLowerCase().includes(filterSegment.toLowerCase());
    const matchesScore = (c.total_ai_score || 0) >= filterMinScore;
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (c.applied_subject || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSub && matchesSeg && matchesScore && matchesSearch;
  });

  const totalScreened = candidates.length;
  const videoInterviewsCompleted = candidates.filter(c => (c as any).video_intro_url || (c as any).video_completed || (c.total_ai_score || 0) > 85).length;
  const shortlistBands = normalizeBands(school?.shortlist_bands || bandDraft);

  const selectedCount = candidates.filter((c) =>
    inOutcomeRange(c.selected_at || (c.status === 'hired' ? c.updated_at || c.created_at : undefined), outcomeRange)
  ).length;
  const offersSentCount = candidates.filter((c) =>
    inOutcomeRange(
      c.offer_letter_sent_at || (c.coo_clearance?.offer_letter ? c.coo_clearance?.completed_at : undefined),
      outcomeRange
    )
  ).length;
  const rejectedByCandidateCount = candidates.filter((c) =>
    inOutcomeRange(c.rejected_by_candidate_at, outcomeRange)
  ).length;
  const rejectedBySchoolCount = candidates.filter((c) =>
    inOutcomeRange(
      c.rejected_by_school_at || (c.status === 'rejected' && !c.rejected_by_candidate_at ? c.updated_at || c.created_at : undefined),
      outcomeRange
    )
  ).length;

  const saveShortlistBands = async () => {
    setSavingBands(true);
    try {
      const res = await fetch('/api/schools', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: school?.id || schoolId, updates: { shortlist_bands: normalizeBands(bandDraft) } }),
      });
      const data = await res.json();
      if (data.school) {
        setSchool(data.school);
        setBandDraft(normalizeBands(data.school.shortlist_bands));
      }
    } finally {
      setSavingBands(false);
    }
  };

  const handleOpenCandidateModal = (candId: string) => {
    router.push(`/admin/candidates/${candId}`);
  };

  return (
    <div className="min-h-screen flex bg-[#f8fafc] text-slate-900 font-sans">
      
      {/* AI Job Generator Modal */}
      <AIJobGeneratorModal
        isOpen={showJobModal}
        onClose={() => setShowJobModal(false)}
        onJobCreated={() => fetchSchoolData()}
      />

      {/* Candidate report opens as a full page at /admin/candidates/[id] */}

      {/* Single Candidate Adding Modal */}
      {showAddCandidateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full space-y-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                <span>Add Teacher Candidate</span>
              </h3>
              <button 
                type="button"
                onClick={() => setShowAddCandidateModal(false)} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSingleCandidate} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Kavita Deshmukh"
                    value={singleCandidateData.name}
                    onChange={e => setSingleCandidateData({...singleCandidateData, name: e.target.value})}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:border-indigo-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. kavita.bio@school.org"
                    value={singleCandidateData.email}
                    onChange={e => setSingleCandidateData({...singleCandidateData, email: e.target.value})}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:border-indigo-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">WhatsApp Phone *</label>
                  <input
                    type="text"
                    required
                    placeholder="+91 98765 43210"
                    value={singleCandidateData.phone}
                    onChange={e => setSingleCandidateData({...singleCandidateData, phone: e.target.value})}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:border-indigo-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Teaching Subject *</label>
                  <select
                    required
                    value={singleCandidateData.applied_subject}
                    onChange={e => setSingleCandidateData({...singleCandidateData, applied_subject: e.target.value})}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-bold focus:border-indigo-600 focus:outline-none"
                  >
                    <option value="" disabled>Select subject…</option>
                    <option value="Physics">Physics</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Biology">Biology</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="English">English</option>
                    <option value="Computer Science">Computer Science</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Teaching Segment *</label>
                  <select
                    required
                    value={singleCandidateData.applied_segment}
                    onChange={e => setSingleCandidateData({...singleCandidateData, applied_segment: e.target.value})}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:border-indigo-600 focus:outline-none"
                  >
                    <option value="" disabled>Select segment…</option>
                    <option value="Secondary (Grades 9–10, 14–16 yrs)">Secondary (Grades 9–10)</option>
                    <option value="Senior Secondary (Grades 11–12, 16–18 yrs)">Senior Secondary (Grades 11–12)</option>
                    <option value="Middle School (Grades 6–8, 11–14 yrs)">Middle School (Grades 6–8)</option>
                    <option value="Primary (Grades 1–5, 6–11 yrs)">Primary (Grades 1–5)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Degrees &amp; B.Ed</label>
                  <select
                    value={singleCandidateData.qualification}
                    onChange={e => setSingleCandidateData({...singleCandidateData, qualification: e.target.value})}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:border-indigo-600 focus:outline-none"
                  >
                    <option value="">Not provided yet</option>
                    <option value="M.Sc + B.Ed (Post Graduate)">M.Sc + B.Ed (Post Graduate)</option>
                    <option value="B.Sc + B.Ed (Graduate Teacher)">B.Sc + B.Ed (Graduate Teacher)</option>
                    <option value="M.A + B.Ed (Literature / Social)">M.A + B.Ed (Literature / Social)</option>
                    <option value="B.A + B.Ed">B.A + B.Ed</option>
                    <option value="Ph.D / Doctorate in Subject">Ph.D / Doctorate in Subject</option>
                    <option value="B.Tech + B.Ed (Computer Science)">B.Tech + B.Ed (Computer Science)</option>
                    <option value="M.Ed / CTET Paper 2 Qualified">M.Ed / CTET Paper 2 Qualified</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Teaching Experience</label>
                  <select
                    value={singleCandidateData.experience_band}
                    onChange={e => setSingleCandidateData({...singleCandidateData, experience_band: e.target.value})}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:border-indigo-600 focus:outline-none"
                  >
                    <option value="">Not provided yet</option>
                    <option value="Fresher (0 - 1 Year)">Fresher (0 - 1 Year)</option>
                    <option value="1 – 2 Years">1 – 2 Years</option>
                    <option value="3 – 5 Years">3 – 5 Years</option>
                    <option value="5 – 8 Years">5 – 8 Years</option>
                    <option value="8+ Years (Senior Faculty / HOD)">8+ Years (Senior Faculty / HOD)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Target School Branch *</label>
                  <select
                    required
                    value={singleCandidateData.target_branch_id}
                    onChange={e => setSingleCandidateData({...singleCandidateData, target_branch_id: e.target.value})}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:border-indigo-600 focus:outline-none"
                  >
                    <option value="" disabled>{school?.branches?.length ? 'Select campus…' : 'No campuses set up for this school yet'}</option>
                    {(school?.branches || []).map((b) => (
                      <option key={b.id} value={b.id}>{b.name}{b.location ? ` (${b.location})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Previous School / Organization</label>
                  <input
                    type="text"
                    placeholder="e.g. Delhi Public School / Oakridge"
                    value={singleCandidateData.prior_org}
                    onChange={e => setSingleCandidateData({...singleCandidateData, prior_org: e.target.value})}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddCandidateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingCandidate}
                  className="brand-primary-btn px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isAddingCandidate ? 'Adding Candidate...' : 'Add to Screening Pipeline'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel / CSV Drag & Drop Ingestion Modal */}
      <ExcelCandidateUploaderModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onSuccess={() => fetchSchoolData()}
      />

      {/* ========================================================================= */}
      {/* 1. LEFT SIDEBAR */}
      {/* ========================================================================= */}
      <aside className="w-64 bg-[#0c101d] text-white flex flex-col justify-between shrink-0 min-h-screen border-r border-slate-800/80 select-none">
        
        <div className="p-5 space-y-6">
          
          {/* Logo Brand Header */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-base shadow-md">
              E
            </div>
            <div className="flex flex-col">
              <BrandMark size="sm" variant="dark" />
              <span className="text-[10.5px] text-slate-400 font-medium">Recruiter workspace</span>
            </div>
          </Link>

          {/* Primary Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddCandidateModal(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add Teacher Candidate</span>
            </button>

            <button
              type="button"
              onClick={() => setShowJobModal(true)}
              className="w-full py-2 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create School Vacancy</span>
            </button>

            <button
              type="button"
              onClick={() => setShowBulkModal(true)}
              className="w-full py-2 px-4 rounded-xl bg-transparent hover:bg-slate-800/60 text-cyan-400 hover:text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              <span>Bulk Screen Teacher CVs</span>
            </button>
          </div>

          {/* Main Menu */}
          <div className="space-y-1 pt-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 px-3 block mb-2">
              MAIN MENU
            </span>

            <button
              type="button"
              onClick={() => setCurrentView('overview')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentView === 'overview'
                  ? 'bg-indigo-950/80 text-indigo-400 border border-indigo-500/30 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LayoutGrid className="w-4 h-4" />
                <span>Overview &amp; Analytics</span>
              </div>
            </button>

            <Link
              href="/admin/jobs"
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <GraduationCap className="w-4 h-4" />
                <span>Campus Vacancies</span>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setCurrentView('pipeline')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentView === 'pipeline'
                  ? 'bg-indigo-950/80 text-indigo-400 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4" />
                <span>Teacher Pipeline</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                {candidates.length}
              </span>
            </button>

            <Link
              href="/admin/tests"
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <Wand2 className="w-4 h-4 text-indigo-400" />
                <span>AI test studio</span>
              </div>
            </Link>

            <Link
              href="/admin/policies"
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4" />
                <span>School policies</span>
              </div>
            </Link>

            <Link
              href="/admin/whatsapp"
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <span>WhatsApp hiring line</span>
              </div>
            </Link>

            <Link
              href="/admin/interviews"
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-indigo-400" />
                <span>Leadership interviews</span>
              </div>
            </Link>
          </div>

          {/* AI Engine & Testing */}
          <div className="space-y-1 pt-4 border-t border-slate-800/80">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 px-3 block mb-2">
              AI ENGINE &amp; TESTING
            </span>

            <div className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-400">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Edcruiter AI Vision</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <Link
              href="/admin/tests"
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-pink-400 hover:text-pink-300 hover:bg-pink-950/20 border border-pink-500/20 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <Video className="w-4 h-4" />
                <span>School test library</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

        </div>

        {/* Footer School Info */}
        <div className="p-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">
              {(school?.name || 'E').charAt(0).toUpperCase()}
            </div>
            <span className="font-medium text-slate-200">
              {school?.name || 'Your school'}{school?.curricula?.length ? ` • ${school.curricula.join(' / ')}` : ''}
            </span>
          </div>
          <Link href="/" className="hover:text-white">
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN WORKSPACE CONTENT AREA */}
      {/* ========================================================================= */}
      <main className="flex-1 p-6 sm:p-8 space-y-6 overflow-y-auto max-h-screen">
        {school && school.status !== 'active' && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-1">
            <p className="font-extrabold text-sm">
              {school.status === 'suspended' ? 'This school is suspended' : 'Your school is waiting for approval'}
            </p>
            <p>
              {school.status === 'suspended'
                ? 'AI features, messaging and public applications are switched off. Contact Edcruiter support.'
                : 'You can set up your campuses, HR policies and vacancies now. AI test generation and scoring, WhatsApp messages and public applications switch on as soon as Edcruiter approves your school.'}
            </p>
          </div>
        )}
        
        {/* Workspace Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Teacher Screening Overview &amp; Analytics
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
              Real-time pedagogical metrics across your active campus vacancies, chalkboard video auditions, and candidate scorecards.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowAddCandidateModal(true)}
              className="px-5 py-2.5 rounded-2xl brand-primary-btn text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-600/25 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add Candidate</span>
            </button>

            <button
              type="button"
              onClick={() => setShowBulkModal(true)}
              className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <CloudUpload className="w-4 h-4 text-indigo-600" />
              <span>Bulk Ingest CVs</span>
            </button>

            <button
              type="button"
              onClick={() => setShowJobModal(true)}
              className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Vacancy</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4 TOP METRIC CARDS (SCHOOL SPECIFIC DATA) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-extrabold tracking-wider text-slate-500">
                TEACHER APPLICANTS SCREENED
              </span>
              <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900 font-mono">{totalScreened}</div>
              <div className="mt-1 text-[11px] text-slate-500 font-semibold">In the pipeline</div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-extrabold tracking-wider text-slate-500">
                TEACHING VIDEOS COMPLETED
              </span>
              <div className="w-8 h-8 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center">
                <Video className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900 font-mono">{videoInterviewsCompleted}</div>
              <div className="mt-1 text-[11px] text-slate-500 font-semibold">Demo stage submitted</div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-extrabold tracking-wider text-slate-500">
                GREEN-BAND SHORTLIST
              </span>
              <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-emerald-700 font-mono">
                {candidates.filter((c) => bandForScore(c.total_ai_score || 0, shortlistBands).key === 'green').length}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 font-semibold">
                Score {shortlistBands.find((b) => b.key === 'green')?.min ?? 60}–100
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-extrabold tracking-wider text-slate-500">
                HIRED / SELECTED
              </span>
              <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900 font-mono">
                {candidates.filter((c) => c.status === 'hired').length}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 font-semibold">All time in workspace</div>
            </div>
          </div>

        </div>

        {/* Hiring outcomes with timeline */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900">Hiring outcomes</h3>
              <p className="text-xs text-slate-500 mt-0.5">Selected teachers, offers, and rejections — filter by timeline.</p>
            </div>
            <select
              value={outcomeRange}
              onChange={(e) => setOutcomeRange(e.target.value as OutcomeRange)}
              className="py-2 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold"
            >
              <option value="today">Today</option>
              <option value="last_month">Last 30 days</option>
              <option value="last_year">Last year</option>
              <option value="till_date">Till date</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
              <p className="text-[10px] font-extrabold uppercase text-emerald-800">Selected by school</p>
              <p className="text-2xl font-black font-mono text-emerald-900 mt-1">{selectedCount}</p>
            </div>
            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200">
              <p className="text-[10px] font-extrabold uppercase text-indigo-800">Offer letters sent</p>
              <p className="text-2xl font-black font-mono text-indigo-900 mt-1">{offersSentCount}</p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
              <p className="text-[10px] font-extrabold uppercase text-amber-900">Rejected by candidate</p>
              <p className="text-2xl font-black font-mono text-amber-950 mt-1">{rejectedByCandidateCount}</p>
              <p className="text-[10px] text-amber-800/80 mt-1">Reason required when candidate declines</p>
            </div>
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
              <p className="text-[10px] font-extrabold uppercase text-rose-800">Rejected by school</p>
              <p className="text-2xl font-black font-mono text-rose-900 mt-1">{rejectedBySchoolCount}</p>
              <p className="text-[10px] text-rose-800/80 mt-1">Store reason on reject action</p>
            </div>
          </div>
        </div>

        {/* Configurable shortlist bands */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900">AI shortlist colour bands</h3>
              <p className="text-xs text-slate-500">Default: red 0–29 · yellow 30–59 · green 60–100. Adjust for your school.</p>
            </div>
            <button
              type="button"
              disabled={savingBands}
              onClick={saveShortlistBands}
              className="px-4 py-2 rounded-xl brand-primary-btn text-xs font-bold"
            >
              {savingBands ? 'Saving…' : 'Save bands'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {bandDraft.map((band, idx) => (
              <div key={band.key} className={`p-4 rounded-2xl border ${bandBadgeClass(band.tone)} space-y-2`}>
                <p className="text-xs font-black capitalize">{band.key} · {band.label}</p>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={band.min}
                    onChange={(e) => {
                      const next = [...bandDraft];
                      next[idx] = { ...next[idx], min: Number(e.target.value) };
                      setBandDraft(next);
                    }}
                    className="w-16 p-1.5 rounded-lg border border-current/20 bg-white/70"
                  />
                  <span>to</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={band.max}
                    onChange={(e) => {
                      const next = [...bandDraft];
                      next[idx] = { ...next[idx], max: Number(e.target.value) };
                      setBandDraft(next);
                    }}
                    className="w-16 p-1.5 rounded-lg border border-current/20 bg-white/70"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CANDIDATE PIPELINE TABLE & SMART FILTERING SUITE */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-6">
          
          {/* Table Header & Search Suite */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Active Educator Pipeline &amp; Smart Candidate Shortlist
              </h2>
              <p className="text-xs text-slate-500">
                Filter candidates by Subject, Grade Segment, or Minimum Score. The system automatically identifies the best candidate for each role.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowAddCandidateModal(true)}
                className="px-4 py-2 rounded-xl brand-primary-btn text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer hover:scale-105 transition-transform"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Add Candidate</span>
              </button>
              <span className="text-xs font-mono font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                {filteredCandidates.length} Matching
              </span>
            </div>
          </div>

          {/* Multi-Dimensional Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50/80 rounded-2xl border border-slate-200 text-xs">
            
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search candidate name, email, or subject..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            {/* Subject Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-bold text-[11px]">Subject:</span>
              <select
                value={filterSubject}
                onChange={e => setFilterSubject(e.target.value)}
                className="py-2 px-3 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:border-indigo-600 focus:outline-none"
              >
                <option value="ALL">All Subjects (Physics, Math, Bio...)</option>
                <option value="Physics">Physics</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Biology">Biology</option>
                <option value="Chemistry">Chemistry</option>
                <option value="English">English</option>
              </select>
            </div>

            {/* Segment Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-bold text-[11px]">Grade:</span>
              <select
                value={filterSegment}
                onChange={e => setFilterSegment(e.target.value)}
                className="py-2 px-3 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:border-indigo-600 focus:outline-none"
              >
                <option value="ALL">All Grades (K-12)</option>
                <option value="Senior Secondary">Senior Secondary (11-12)</option>
                <option value="Secondary">Secondary (9-10)</option>
                <option value="Middle">Middle School (6-8)</option>
                <option value="Primary">Primary (1-5)</option>
              </select>
            </div>

            {/* Minimum Score Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-bold text-[11px]">Min Score:</span>
              <select
                value={filterMinScore}
                onChange={e => setFilterMinScore(Number(e.target.value))}
                className="py-2 px-3 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:border-indigo-600 focus:outline-none"
              >
                <option value={0}>All Scores (0%+)</option>
                <option value={80}>Passing (≥ 80%)</option>
                <option value={85}>Strong (≥ 85%)</option>
                <option value={90}>Top Tier (≥ 90%)</option>
              </select>
            </div>

            {(filterSubject !== 'ALL' || filterSegment !== 'ALL' || filterMinScore > 0 || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setFilterSubject('ALL');
                  setFilterSegment('ALL');
                  setFilterMinScore(0);
                  setSearchQuery('');
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer px-1"
              >
                Reset Filters
              </button>
            )}

          </div>

          {lastInvite && (
            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-sm text-indigo-950 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold">{lastInvite.name} was added.</p>
                <p className="text-xs mt-1">
                  Send this WhatsApp test code: <span className="font-mono font-black">{lastInvite.code}</span>
                  {' '}or this link: <span className="font-mono text-[11px]">{typeof window !== 'undefined' ? window.location.origin : ''}/candidate/{lastInvite.id}</span>
                </p>
                {school?.whatsapp_hiring?.display_number ? (
                  <p className="text-[11px] mt-1 text-indigo-800">From school line {school.whatsapp_hiring.display_number}</p>
                ) : (
                  <p className="text-[11px] mt-1">
                    <Link href="/admin/whatsapp" className="font-bold underline">Connect a WhatsApp hiring number</Link> to send from the school line.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                  onClick={() => {
                    const url = `${window.location.origin}/candidate/${lastInvite.id}`;
                    navigator.clipboard.writeText(`Code: ${lastInvite.code}\nLink: ${url}`);
                  }}
                >
                  Copy code &amp; link
                </button>
                {school?.whatsapp_hiring?.e164 && (
                  <button
                    type="button"
                    className="px-3 py-2 rounded-xl bg-white border border-indigo-200 text-indigo-800 text-xs font-bold"
                    onClick={async () => {
                      const res = await fetch('/api/whatsapp/invite', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ school_id: schoolId, candidate_id: lastInvite.id })
                      });
                      const data = await res.json();
                      alert(res.ok && data.success ? 'Invite sent on WhatsApp.' : (data.error || 'Could not send the WhatsApp invite.'));
                    }}
                  >
                    Send on school WhatsApp
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-extrabold text-[10.5px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Teacher</th>
                  <th className="py-3.5 px-4">Test code &amp; link</th>
                  <th className="py-3.5 px-4">Subject &amp; Grade</th>
                  <th className="py-3.5 px-4">Highest degree</th>
                  <th className="py-3.5 px-4">B.Ed</th>
                  <th className="py-3.5 px-4">Overall score</th>
                  <th className="py-3.5 px-4">Teaching video</th>
                  <th className="py-3.5 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400 font-medium">
                      No candidates match your current filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredCandidates.map((c: any) => {
                    const creds = credentialsFromCandidate(c);
                    const score = Number(c.total_ai_score || 0);
                    const band = bandForScore(score, shortlistBands);
                    return (
                      <tr
                        key={c.id}
                        onClick={() => handleOpenCandidateModal(c.id)}
                        className="hover:bg-indigo-50/50 cursor-pointer transition-colors"
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full text-white font-bold text-xs flex items-center justify-center shadow-2xs bg-indigo-600">
                              {c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <span className="block text-slate-900 font-bold">{c.name}</span>
                              <span className="text-[10.5px] text-slate-400 font-normal">{c.email}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                          <div className="font-mono text-[11px] font-bold text-indigo-700">
                            {c.invite_code || 'Not generated'}
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                            App ID: {c.id}
                          </div>
                          <button
                            type="button"
                            className="mt-1 text-[10px] font-bold text-slate-500 hover:text-indigo-600 inline-flex items-center gap-1"
                            onClick={() => {
                              const url = `${window.location.origin}/candidate/${c.id}`;
                              const code = c.invite_code || c.id;
                              navigator.clipboard.writeText(`Application ID: ${c.id}\nCode: ${code}\nLink: ${url}`);
                            }}
                          >
                            <Copy className="w-3 h-3" /> Copy code &amp; link
                          </button>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-800">{c.applied_subject || 'Not specified'}</span>
                          <span className="block text-[10.5px] text-slate-500">{c.applied_segment || 'Not specified'}</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-900">{creds.highestDegree}</span>
                          <span className="block text-[10.5px] text-slate-500">{c.experience_band || '—'}</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                            creds.hasBEd
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}>
                            {creds.bedLabel}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className={`text-xl font-black font-mono tracking-tight ${bandScoreTextClass(band.tone)}`}>
                            {score || '—'}
                            <span className="text-xs font-semibold text-slate-400"> /100</span>
                          </div>
                          <span className={`mt-1 inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${bandBadgeClass(band.tone)}`}>
                            {band.key.toUpperCase()} · {band.min}–{band.max}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-pink-50 border border-pink-200 text-pink-700 text-[10.5px] font-bold inline-flex items-center gap-1">
                            <Video className="w-3 h-3 text-pink-600" />
                            <span>{c.video_intro_url ? 'Submitted' : 'Pending'}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenCandidateModal(c.id);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                          >
                            View Report →
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

    </div>
  );
}
