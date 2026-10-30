'use client';

import React, { useState } from 'react';
import {
  Sparkles, CheckCircle2, ShieldAlert, Award, FileText, Video,
  Clock, Calendar, UserCheck, Building2, Users, Printer, AlertTriangle,
  MessageSquare, Send, Check, ArrowRight, User, Phone, Mail, MapPin,
  Briefcase, GraduationCap, DollarSign, Bot, HelpCircle, CheckCircle, XCircle, CheckSquare
} from 'lucide-react';
import { Candidate, StageResult, ProctoringEvent, StageKey } from '@/lib/types';
import { SLOKA_DEFAULT_STAGES } from '@/lib/defaultData';
import { calculateAuthenticityScore } from '@/lib/proctoringEngine';
import { cleanResumeReport } from '@/lib/reportText';

interface CandidateReportCardProps {
  candidate: Candidate;
  stageResults: StageResult[];
  proctoringEvents: ProctoringEvent[];
}

export default function CandidateReportCard({ candidate, stageResults, proctoringEvents }: CandidateReportCardProps) {
  // Aggregate real AI dimension scores directly from stage results
  const allDimensionScores: { dimension: string; score: number; justification: string; stage: string }[] = [];
  stageResults.forEach(sr => {
    if (sr.ai_scores?.scores) {
      sr.ai_scores.scores.forEach(s => {
        allDimensionScores.push({
          dimension: s.dimension,
          score: s.score,
          justification: s.justification,
          stage: sr.stage_name
        });
      });
    }
  });

  const avgScore = allDimensionScores.length
    ? (allDimensionScores.reduce((acc, curr) => acc + curr.score, 0) / allDimensionScores.length).toFixed(1)
    : 'N/A';

  // Multi-Tier Executive Approval Pipeline State
  const [rmApproved, setRmApproved] = useState(true);
  const [rmNotes, setRmNotes] = useState('Candidate demonstrated solid subject knowledge and student-centered pedagogy.');

  const [ihApproved, setIhApproved] = useState(false);
  const [ihNotes, setIhNotes] = useState('');

  const [cooApproved, setCooApproved] = useState(false);
  const [cooNotes, setCooNotes] = useState('');
  // Starts blank, not a plausible-looking '7.8 LPA' — this is the figure the
  // COO can actually send in a real offer letter, so a fabricated seed value
  // here isn't cosmetic, it's a wrong number that could go out to a candidate.
  const [offeredSalary, setOfferedSalary] = useState(candidate.expected_salary || '');

  // AI Resume Analyzer State. Starts null — not a fully fabricated dossier
  // (fake career milestones, a fake 8.5/10 score, a fake Olympiad-mentoring
  // claim) shown for any candidate who hasn't actually had their resume
  // analyzed yet, indistinguishable from a real AI result. The empty state
  // below prompts the reviewer to run a real audit instead.
  const [resumeReport, setResumeReport] = useState<any>(candidate.resume_analysis ? cleanResumeReport(candidate.resume_analysis) : null);
  const [analyzingResume, setAnalyzingResume] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  // Also starts blank rather than a fabricated bio paragraph (fake prior
  // schools, a fake CTET claim, a fake notice period) — that text used to be
  // sent to the AI analyzer verbatim as this candidate's "resume" if a
  // reviewer clicked re-audit without noticing it was placeholder copy.
  const [customResumeText, setCustomResumeText] = useState(candidate.resume_text || '');

  const handleRunResumeAudit = async () => {
    setAnalyzingResume(true);
    try {
      const res = await fetch('/api/resume-analyzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: candidate.school_id,
          candidate_id: candidate.id,
          resume_text: customResumeText
        })
      });
      const data = await res.json();
      if (data.report) {
        setResumeReport(data.report ? cleanResumeReport(data.report) : data.report);
        setShowResumeModal(false);
        alert('Resume analysis generated successfully with Edcruiter AI!');
      }
    } catch (err) {
      alert('Failed to analyze resume');
    } finally {
      setAnalyzingResume(false);
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') window.print();
  };

  // Helper to find stage result by stage key (supporting alias keys)
  const getStageResult = (stageKey: StageKey): StageResult | undefined => {
    if (stageKey === 'identity_verification' || stageKey === 'self_video_intro') {
      return stageResults.find(r => r.stage_key === 'identity_verification' || r.stage_key === 'self_video_intro');
    }
    return stageResults.find(r => r.stage_key === stageKey);
  };

  // Parse interview transcript into dialogue bubbles
  const parseInterviewTranscript = (transcriptText: string) => {
    if (!transcriptText) return [];
    const lines = transcriptText.split('\n\n').filter(Boolean);
    if (lines.length > 0 && lines[0].includes(':')) {
      return lines.map((line, idx) => {
        const isAI = line.includes('AI Evaluator') || line.includes('Gemini AI') || line.includes('Edcruiter AI') || line.startsWith('AI:');
        return {
          id: `line_${idx}`,
          speaker: isAI ? 'AI Academic Evaluator' : candidate.name,
          isAI,
          text: line.replace(/^\[.*?\]\s*/, '').replace(/^(AI Evaluator|Gemini AI|Edcruiter AI|AI|Candidate|.*?):\s*/, '')
        };
      });
    }
    return [{ id: 'line_single', speaker: 'Transcript', isAI: false, text: transcriptText }];
  };

  return (
    <div className="glass-card p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl space-y-8 text-xs">
      
      {/* 1. Header Dossier Banner & Overall Score */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center font-black text-2xl shadow-lg">
            {candidate.name[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-white tracking-tight">{candidate.name}</h2>
              <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                {candidate.applied_subject}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-slate-300">
                ID: {candidate.id}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 flex items-center gap-3">
              <span>{candidate.applied_segment}</span> • 
              <span>{candidate.experience_band} Experience</span> • 
              <span>{candidate.qualification}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">AI Competency Index</span>
            <span className="text-3xl font-black text-orange-400 font-mono">
              {avgScore} <span className="text-xs text-slate-400 font-normal">/ 10</span>
            </span>
          </div>
          <button
            onClick={handlePrint}
            className="p-2.5 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 transition-colors shadow-xs cursor-pointer"
            title="Print Candidate Evaluation Report"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. CANDIDATE ACADEMIC PROFILE SHOWCASE */}
      <div className="space-y-4">
        <h3 className="font-extrabold text-white text-base flex items-center gap-2">
          <User className="w-5 h-5 text-orange-400" /> Candidate Academic Profile & Key Bio Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-[#09090b] border border-white/10 space-y-1">
            <span className="text-slate-400 text-[10px] font-bold uppercase block">Contact & Email</span>
            <strong className="text-white text-xs block truncate">{candidate.email}</strong>
            <span className="text-slate-400 text-[11px] block">{candidate.phone || 'Not provided'}</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#09090b] border border-white/10 space-y-1">
            <span className="text-slate-400 text-[10px] font-bold uppercase block">Degree & Prior School</span>
            <strong className="text-white text-xs block">{candidate.qualification || 'Not provided'}</strong>
            <span className="text-slate-400 text-[11px] block">{candidate.prior_org || 'Not provided'}</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#09090b] border border-white/10 space-y-1">
            <span className="text-slate-400 text-[10px] font-bold uppercase block">Salary Fitment</span>
            <strong className="text-emerald-400 text-xs block">{candidate.expected_salary || 'Not provided'} (Exp)</strong>
            <span className="text-slate-400 text-[11px] block">Current: {candidate.current_salary || 'Not provided'}</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#09090b] border border-white/10 space-y-1">
            <span className="text-slate-400 text-[10px] font-bold uppercase block">Notice & Campus</span>
            <strong className="text-white text-xs block">{candidate.notice_period || 'Not provided'}</strong>
            <span className="text-slate-400 text-[11px] block">Relocate: {candidate.relocation_branches?.length ? candidate.relocation_branches.join(', ') : 'Not specified'}</span>
          </div>
        </div>
      </div>

      {/* 2.5 AI RESUME & CAREER TRAJECTORY DOSSIER */}
      {!resumeReport && (
        <div className="glass-card p-6 sm:p-7 rounded-3xl border border-white/10 shadow-2xl space-y-3 text-center">
          <div className="w-10 h-10 rounded-2xl bg-white/5 text-slate-400 flex items-center justify-center border border-white/10 mx-auto">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="font-extrabold text-white text-sm">No resume analysis yet</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            This candidate's CV hasn't been run through the AI resume audit. Nothing below is shown until a real analysis exists.
          </p>
          <button
            onClick={() => setShowResumeModal(true)}
            className="mx-auto px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-orange-400" /> Run AI Resume Audit
          </button>
        </div>
      )}

      {resumeReport && (
        <div className="glass-card p-6 sm:p-7 rounded-3xl border border-orange-500/30 shadow-2xl space-y-6 bg-gradient-to-b from-orange-500/5 to-transparent">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  AI Resume Forensic Dossier & Career Trajectory Audit
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                    Edcruiter AI Powered
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automated chronological audit of career gaps, upward/downward seniority shifts, tenure stability, and teacher accreditations.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowResumeModal(true)}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-orange-400" /> Re-Audit / Paste Full CV
            </button>
          </div>

          {/* Core Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-[#09090b] border border-white/10 space-y-1">
              <span className="text-slate-400 text-[10px] font-bold uppercase block">Resume Fitment Score</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-orange-400 font-mono">{resumeReport.overall_fitment_score}</span>
                <span className="text-xs text-slate-400">/ 10</span>
              </div>
              <span className="text-emerald-400 text-[11px] font-semibold block">Academic Match</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#09090b] border border-white/10 space-y-1">
              <span className="text-slate-400 text-[10px] font-bold uppercase block">Career Trajectory</span>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-black font-mono flex items-center gap-1 ${
                  resumeReport.career_trajectory?.trend === 'Upward'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : resumeReport.career_trajectory?.trend === 'Downward'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {resumeReport.career_trajectory?.trend === 'Upward' ? '↗ UPWARD' : resumeReport.career_trajectory?.trend === 'Downward' ? '↘ DOWNWARD' : '➔ LATERAL'}
                </span>
              </div>
              <span className="text-slate-400 text-[11px] block truncate">{resumeReport.career_trajectory?.summary}</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#09090b] border border-white/10 space-y-1">
              <span className="text-slate-400 text-[10px] font-bold uppercase block">Tenure Stability Index</span>
              <strong className={`text-xs block font-bold ${
                resumeReport.career_stability_index === 'High' ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {resumeReport.career_stability_index} Stability ({resumeReport.average_tenure_years ?? '—'} yrs / school)
              </strong>
              <span className="text-slate-400 text-[11px] block">Total: {resumeReport.total_experience_years ?? '—'} Yrs Experience</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#09090b] border border-white/10 space-y-1">
              <span className="text-slate-400 text-[10px] font-bold uppercase block">Job Hopping Risk</span>
              <strong className={`text-xs block font-bold ${
                resumeReport.job_hopping_risk === 'Low' ? 'text-emerald-400' : resumeReport.job_hopping_risk === 'Moderate' ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {resumeReport.job_hopping_risk} Risk Profile
              </strong>
              <span className="text-slate-400 text-[11px] block">No frequent mid-year exits</span>
            </div>
          </div>

          {/* CAREER GAPS RADAR */}
          {resumeReport.career_gaps && resumeReport.career_gaps.length > 0 && (
            <div className="space-y-2">
              <span className="text-orange-400 font-extrabold uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Career Gap Detection & Audit
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {resumeReport.career_gaps.map((gap: any, gIdx: number) => (
                  <div
                    key={gIdx}
                    className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                      gap.flagged
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                        : 'bg-white/5 border-white/10 text-slate-300'
                    }`}
                  >
                    <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${gap.flagged ? 'text-amber-400' : 'text-slate-400'}`} />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-xs font-bold text-white">{gap.period}</strong>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300">
                          {gap.duration_months} Months Gap
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-90">{gap.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SENIORITY TRAJECTORY & PROMOTIONS */}
          {resumeReport.career_trajectory?.milestones && resumeReport.career_trajectory.milestones.length > 0 && (
            <div className="space-y-2">
              <span className="text-orange-400 font-extrabold uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" /> Role Seniority & Promotion Timeline
              </span>
              <div className="p-4 rounded-2xl bg-[#09090b] border border-white/10 space-y-2.5">
                {resumeReport.career_trajectory.milestones.map((m: string, mIdx: number) => (
                  <div key={mIdx} className="flex items-center gap-3 text-xs">
                    <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                    <span className="text-slate-200">{m}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* QUALIFICATIONS & TEACHER ACCREDITATIONS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-[#09090b] border border-white/10 space-y-1.5">
              <span className="text-slate-400 text-[10px] font-bold uppercase flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-orange-400" /> Degrees Found
              </span>
              <strong className="text-white text-xs block">
                {resumeReport.qualifications_match?.degrees_found?.join(', ') || candidate.qualification || 'Not determined'}
              </strong>
              <p className="text-[11px] text-slate-400">{resumeReport.qualifications_match?.alignment_with_subject}</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#09090b] border border-white/10 space-y-1.5">
              <span className="text-slate-400 text-[10px] font-bold uppercase flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-emerald-400" /> B.Ed Certification
              </span>
              <strong className="text-emerald-400 text-xs block">
                {resumeReport.qualifications_match?.b_ed_status || 'Not determined'}
              </strong>
              <p className="text-[11px] text-slate-400">From the AI resume audit, not assumed</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#09090b] border border-white/10 space-y-1.5">
              <span className="text-slate-400 text-[10px] font-bold uppercase flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-blue-400" /> CTET / TET Status
              </span>
              <strong className="text-blue-400 text-xs block">
                {resumeReport.qualifications_match?.ctet_tet_status || 'Not determined'}
              </strong>
              <p className="text-[11px] text-slate-400">From the AI resume audit, not assumed</p>
            </div>
          </div>

          {/* RED FLAGS & GREEN FLAGS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Red Flags */}
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-2">
              <span className="text-rose-400 font-extrabold uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> Resume Anomaly Flags (For Verification)
              </span>
              <ul className="space-y-1 text-[11px] text-slate-300">
                {resumeReport.red_flags && resumeReport.red_flags.length > 0 ? (
                  resumeReport.red_flags.map((rf: string, rIdx: number) => (
                    <li key={rIdx} className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">•</span>
                      <span>{rf}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-400 italic">No red flags detected in resume audit.</li>
                )}
              </ul>
            </div>

            {/* Green Flags */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              <span className="text-emerald-400 font-extrabold uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Key Strengths & Standout Accreditations
              </span>
              <ul className="space-y-1 text-[11px] text-slate-300">
                {resumeReport.green_flags && resumeReport.green_flags.length > 0 ? (
                  resumeReport.green_flags.map((gf: string, gIdx: number) => (
                    <li key={gIdx} className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{gf}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-400 italic">Standard profile verified.</li>
                )}
              </ul>
            </div>
          </div>

          {/* RECOMMENDED INTERVIEW PROBES */}
          {resumeReport.recommended_interview_probes && resumeReport.recommended_interview_probes.length > 0 && (
            <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 space-y-2.5">
              <span className="text-orange-400 font-extrabold uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5" /> Hiring Committee Recommended Interview Probes (Resume Specific)
              </span>
              <div className="space-y-2">
                {resumeReport.recommended_interview_probes.map((probe: string, pIdx: number) => (
                  <div key={pIdx} className="p-2.5 rounded-xl bg-[#09090b] border border-white/10 text-xs text-slate-200 flex items-start gap-2">
                    <span className="text-orange-400 font-mono font-bold">Q{pIdx + 1}:</span>
                    <span>{probe}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* 3. SEQUENTIAL MULTI-TIER EXECUTIVE APPROVAL PIPELINE */}
      <div className="space-y-4 border-t border-white/10 pt-6">
        <h3 className="font-extrabold text-white text-base flex items-center gap-2">
          <Users className="w-5 h-5 text-orange-400" /> Sequential Multi-Tier Approval Pipeline (RM → IH → COO)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* TIER 1: RM */}
          <div className={`p-5 rounded-2xl border space-y-3 ${
            rmApproved ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-[#09090b] border-white/10 text-slate-300'
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-xs uppercase flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-orange-400" /> 1. Reporting Manager
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                rmApproved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {rmApproved ? 'APPROVED ✓' : 'PENDING'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed bg-white/5 p-2.5 rounded-xl font-mono">
              {rmNotes || 'Awaiting Subject Lead opinion...'}
            </p>
            {!rmApproved && (
              <div className="space-y-2 pt-1">
                <textarea
                  rows={2}
                  placeholder="Enter Reporting Manager Opinion..."
                  value={rmNotes}
                  onChange={e => setRmNotes(e.target.value)}
                  className="w-full p-2 rounded-xl bg-[#09090b] border border-white/10 text-white text-[11px]"
                />
                <button
                  onClick={() => setRmApproved(true)}
                  className="w-full py-2 rounded-xl orange-gradient-btn text-white font-bold text-xs"
                >
                  Pass Opinion & Approve →
                </button>
              </div>
            )}
          </div>

          {/* TIER 2: IH */}
          <div className={`p-5 rounded-2xl border space-y-3 ${
            ihApproved ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-[#09090b] border-white/10 text-slate-300'
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-xs uppercase flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-orange-400" /> 2. Institute Head
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                ihApproved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {ihApproved ? 'APPROVED ✓' : 'PENDING'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed bg-white/5 p-2.5 rounded-xl font-mono">
              {ihNotes || 'Awaiting Branch Principal approval & culture fit opinion...'}
            </p>
            {rmApproved && !ihApproved && (
              <div className="space-y-2 pt-1">
                <textarea
                  rows={2}
                  placeholder="Enter Institute Head Opinion..."
                  value={ihNotes}
                  onChange={e => setIhNotes(e.target.value)}
                  className="w-full p-2 rounded-xl bg-[#09090b] border border-white/10 text-white text-[11px]"
                />
                <button
                  onClick={() => setIhApproved(true)}
                  className="w-full py-2 rounded-xl orange-gradient-btn text-white font-bold text-xs"
                >
                  Approve & Forward to COO →
                </button>
              </div>
            )}
          </div>

          {/* TIER 3: COO */}
          <div className={`p-5 rounded-2xl border space-y-3 ${
            cooApproved ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-[#09090b] border-white/10 text-slate-300'
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-xs uppercase flex items-center gap-1.5">
                <Award className="w-4 h-4 text-orange-400" /> 3. COO Final Sign-Off
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                cooApproved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {cooApproved ? 'OFFER RELEASED ✓' : 'PENDING'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed bg-white/5 p-2.5 rounded-xl font-mono">
              {cooNotes || 'Awaiting COO executive sign-off & salary fitment...'}
            </p>
            {ihApproved && !cooApproved && (
              <div className="space-y-2 pt-1">
                <input
                  type="text"
                  placeholder="Final Offered Salary (e.g. 7.8 LPA)"
                  value={offeredSalary}
                  onChange={e => setOfferedSalary(e.target.value)}
                  className="w-full p-2 rounded-xl bg-[#09090b] border border-white/10 text-white text-[11px]"
                />
                <button
                  onClick={() => {
                    if (!offeredSalary.trim()) {
                      alert('Enter the final offered salary before releasing the offer.');
                      return;
                    }
                    setCooApproved(true);
                    setCooNotes(`Executive approval granted. Digital Offer issued at ${offeredSalary}.`);
                  }}
                  className="w-full py-2 rounded-xl orange-gradient-btn text-white font-bold text-xs"
                >
                  Final Executive Sign-Off & Release Offer →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. STRICT 1-TO-5 ORDERED STAGE BREAKDOWN & LIVE AI SCORES */}
      <div className="space-y-6 border-t border-white/10 pt-6">
        <div>
          <h3 className="font-extrabold text-white text-base flex items-center gap-2">
            <Award className="w-5 h-5 text-orange-400" /> 5-Stage Universal Assessment Submissions & Edcruiter AI Diagnoses
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Detailed chronological record of candidate responses, attached teaching demo videos (with unmuted audio), and AI rubrics.
          </p>
        </div>

        <div className="space-y-6">
          {SLOKA_DEFAULT_STAGES.map((stg) => {
            const sr = getStageResult(stg.key);
            const isCompleted = Boolean(sr);
            const scores = sr?.ai_scores?.scores || [];

            return (
              <div
                key={stg.key}
                className="glass-card p-6 rounded-3xl border border-white/10 space-y-4 shadow-xl"
              >
                {/* Stage Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 font-black text-sm flex items-center justify-center border border-orange-500/30">
                      {stg.order}
                    </span>
                    <div>
                      <h4 className="font-black text-white text-sm">{stg.name}</h4>
                      <p className="text-[11px] text-slate-400">{stg.description}</p>
                    </div>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
                    isCompleted
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-white/5 text-slate-500 border border-white/10'
                  }`}>
                    {isCompleted ? 'STAGE COMPLETED ✓' : 'NOT SUBMITTED YET'}
                  </span>
                </div>

                {isCompleted && sr ? (
                  <div className="space-y-4">
                    {/* Stage Specific Presentation */}

                    {/* STAGE 1: Identity & PDF CV */}
                    {stg.key === 'identity_verification' && (
                      <div className="space-y-3">
                        <div className="p-4 rounded-2xl bg-[#09090b] border border-white/10 text-xs text-slate-300 space-y-2">
                          <div className="flex items-center justify-between">
                            <strong className="text-white">Candidate Bio & Qualifications:</strong>
                            {candidate.resume_url && (
                              <a
                                href={candidate.resume_url}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 font-bold flex items-center gap-1.5 hover:bg-orange-500/30 transition-colors"
                              >
                                <FileText className="w-3.5 h-3.5" /> View Uploaded PDF Resume ↗
                              </a>
                            )}
                          </div>
                          <p className="text-[11px] leading-relaxed text-slate-400">{sr.written_submission}</p>
                        </div>
                      </div>
                    )}

                    {/* STAGE 2: Written / Theory (Core Depth & Lesson Plan) */}
                    {(stg.key === 'written_theory' || stg.key === 'lesson_plan' || stg.key === 'subject_quiz') && sr.written_submission && (
                      <div className="space-y-2">
                        <span className="text-[10px] text-orange-400 font-bold uppercase block flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" /> Written Pedagogical Response & Lesson Design Submission
                        </span>
                        <div className="p-4 rounded-2xl bg-[#09090b] border border-white/10 text-xs text-slate-300 font-mono whitespace-pre-line leading-relaxed">
                          {sr.written_submission}
                        </div>
                      </div>
                    )}

                    {/* STAGE 3: Micro-Teaching 5-Minute Video Demo */}
                    {(stg.key === 'micro_teaching_demo' || stg.key === 'lesson_demo') && (
                      <div className="space-y-2">
                        {sr.media_url ? (
                          <div className="space-y-1.5">
                            <span className="text-[10px] text-orange-400 font-bold uppercase flex items-center gap-1.5">
                              <Video className="w-3.5 h-3.5" /> 5-Minute Micro-Teaching Demo Recording (Video + Audio)
                            </span>
                            <video
                              src={sr.media_url}
                              controls
                              playsInline
                              crossOrigin="anonymous"
                              onLoadedMetadata={(e) => { e.currentTarget.volume = 1.0; }}
                              className="w-full max-w-xl rounded-2xl border border-white/10 aspect-video bg-black"
                            />
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                            No teaching demo video attached.
                          </div>
                        )}
                      </div>
                    )}

                    {/* STAGE 4: Situational Scenario Video Response */}
                    {(stg.key === 'situational_scenario' || stg.key === 'behavioural_assessment') && (
                      <div className="space-y-3">
                        {sr.media_url && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] text-orange-400 font-bold uppercase flex items-center gap-1.5">
                              <Video className="w-3.5 h-3.5" /> Situational Classroom Judgment Video Response (Video + Audio)
                            </span>
                            <video
                              src={sr.media_url}
                              controls
                              playsInline
                              crossOrigin="anonymous"
                              onLoadedMetadata={(e) => { e.currentTarget.volume = 1.0; }}
                              className="w-full max-w-xl rounded-2xl border border-white/10 aspect-video bg-black"
                            />
                          </div>
                        )}
                        {sr.written_submission && (
                          <div className="p-3.5 rounded-xl bg-[#09090b] border border-white/10 text-[11px] text-slate-300">
                            <strong className="text-white block mb-1">De-escalation Protocol Notes:</strong>
                            {sr.written_submission}
                          </div>
                        )}
                      </div>
                    )}

                    {/* STAGE 5: HR Policy Briefing & Code of Conduct */}
                    {(stg.key === 'hr_policy_briefing' || stg.key === 'hr_policy_check') && sr.written_submission && (
                      <div className="space-y-2">
                        <span className="text-[10px] text-orange-400 font-bold uppercase block">HR Policy Compliance & Safeguarding Confirmation</span>
                        <div className="p-3.5 rounded-xl bg-[#09090b] border border-white/10 text-xs text-slate-300">
                          {sr.written_submission}
                        </div>
                      </div>
                    )}

                    {/* Advanced Edcruiter AI Dimension Scores & CoT Analysis for This Stage */}
                    {sr.ai_scores && (
                      <div className="pt-3 border-t border-white/10 space-y-3.5">
                        
                        {/* Framework & Multimodal Badges */}
                        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#09090b] p-3 rounded-2xl border border-white/10">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-orange-400 font-extrabold uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                              <Award className="w-3.5 h-3.5" /> {sr.ai_scores.pedagogical_framework || 'Danielson Pedagogical Framework'}
                            </span>
                            {sr.ai_scores.blooms_taxonomy_level && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Bloom: {sr.ai_scores.blooms_taxonomy_level} Level
                              </span>
                            )}
                            {sr.ai_scores.multimodal_video_analyzed && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                                <Video className="w-3 h-3" /> Multimodal Video Analyzed
                              </span>
                            )}
                          </div>

                          {/* Plagiarism Badge */}
                          {sr.ai_scores.plagiarism_risk && sr.ai_scores.plagiarism_risk !== 'low' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-rose-400" /> AI Text Risk: {sr.ai_scores.plagiarism_risk.toUpperCase()}
                            </span>
                          )}
                        </div>

                        {/* Cross-Stage Discrepancy Alert */}
                        {sr.ai_scores.discrepancy_alert && (
                          <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-300 text-xs flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                            <span>{sr.ai_scores.discrepancy_alert}</span>
                          </div>
                        )}

                        {/* CoT Direct Evidence Quote */}
                        {sr.ai_scores.evidence_quote && (
                          <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs space-y-1">
                            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider block">
                              Observed Candidate Evidence:
                            </span>
                            <p className="italic text-slate-200">
                              &ldquo;{sr.ai_scores.evidence_quote}&rdquo;
                            </p>
                          </div>
                        )}

                        {/* Identified Pedagogical Gaps */}
                        {sr.ai_scores.identified_gaps && sr.ai_scores.identified_gaps.length > 0 && (
                          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider block text-rose-400">
                              Identified Pedagogical Gaps:
                            </span>
                            <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                              {sr.ai_scores.identified_gaps.map((gap, gIdx) => (
                                <li key={gIdx}>{gap}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Dimension Scorecards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                          {scores.map((dim, dIdx) => (
                            <div key={dIdx} className="p-3.5 rounded-2xl bg-[#09090b] border border-white/10 space-y-2">
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-bold text-white capitalize text-xs block">{dim.dimension.replace(/_/g, ' ')}</span>
                                  {dim.pedagogical_benchmark && (
                                    <span className="text-[9px] text-slate-400 block truncate">{dim.pedagogical_benchmark}</span>
                                  )}
                                </div>
                                <span className={`font-mono font-bold text-xs ${
                                  dim.score >= 8 ? 'text-emerald-400' : dim.score >= 5 ? 'text-amber-400' : 'text-rose-400'
                                }`}>
                                  {dim.score} / 10
                                </span>
                              </div>
                              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    dim.score >= 8 ? 'bg-emerald-500' : dim.score >= 5 ? 'bg-amber-500' : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${dim.score * 10}%` }}
                                />
                              </div>
                              <p className="text-[11px] text-slate-300 leading-snug">{dim.justification}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-[#09090b] text-slate-400 text-xs italic">
                    Candidate has not attempted or submitted this stage yet.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. AI PROCTORING INTEGRITY AUDIT LOG */}
      <div className="space-y-4 border-t border-white/10 pt-6">
        <h3 className="font-extrabold text-white text-base flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-400" /> AI Proctoring Security & Integrity Audit Log
        </h3>

        {(() => {
          const { score, label, violationCount } = calculateAuthenticityScore(proctoringEvents);
          // Tailwind only picks up literal class strings it can find at
          // build time — a `bg-${tone}-500/10`-style interpolation would
          // compile to nothing, so each tone is spelled out in full here.
          const TONE_CLASSES = {
            emerald: { box: 'bg-emerald-500/10 border-emerald-500/30', label: 'text-emerald-300', body: 'text-emerald-200', score: 'text-emerald-300' },
            indigo: { box: 'bg-indigo-500/10 border-indigo-500/30', label: 'text-indigo-300', body: 'text-indigo-200', score: 'text-indigo-300' },
            amber: { box: 'bg-amber-500/10 border-amber-500/30', label: 'text-amber-300', body: 'text-amber-200', score: 'text-amber-300' },
            rose: { box: 'bg-rose-500/10 border-rose-500/30', label: 'text-rose-300', body: 'text-rose-200', score: 'text-rose-300' },
          } as const;
          const tone = TONE_CLASSES[score >= 90 ? 'emerald' : score >= 70 ? 'indigo' : score >= 40 ? 'amber' : 'rose'];
          return (
            <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${tone.box}`}>
              <div>
                <p className={`text-[10px] font-extrabold uppercase tracking-wider ${tone.label}`}>Authenticity score</p>
                <p className={`text-xs mt-1 ${tone.body}`}>{label} · {violationCount} flagged event{violationCount === 1 ? '' : 's'} across the assessment</p>
              </div>
              <div className={`text-3xl font-black font-mono shrink-0 ${tone.score}`}>{score}%</div>
            </div>
          );
        })()}

        <div className="space-y-2">
          {proctoringEvents.length > 0 ? (
            proctoringEvents.map((evt) => (
              <div key={evt.id} className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <div>
                    <span className="font-bold uppercase font-mono">{evt.event_type.replace(/_/g, ' ')}</span>
                    <span className="text-slate-300 ml-2">{evt.details}</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-slate-400">{evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : 'Recorded'}</span>
              </div>
            ))
          ) : (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Clean Proctoring Record: Zero tab switches, gaze redirections, or unauthorized devices detected.
            </div>
          )}
        </div>
      </div>

      {/* MODAL: RE-AUDIT / PASTE RESUME TEXT */}
      {showResumeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card p-6 sm:p-8 rounded-3xl border border-orange-500/40 max-w-2xl w-full space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-400" />
                <h3 className="text-lg font-black text-white">Edcruiter AI Resume Forensic Auditor</h3>
              </div>
              <button onClick={() => setShowResumeModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Paste the candidate&apos;s full resume text, CV details, or employment history below. Edcruiter AI will analyze career gaps, upward/downward title shifts, and teacher accreditations in real-time.
            </p>

            <textarea
              rows={10}
              value={customResumeText}
              onChange={e => setCustomResumeText(e.target.value)}
              placeholder="Paste full CV / Resume text here..."
              className="w-full p-4 rounded-2xl bg-[#09090b] border border-white/10 text-white font-mono text-[11px] leading-relaxed focus:border-orange-500 focus:outline-none"
            />

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400">
                Word Count: {customResumeText.trim().split(/\s+/).filter(Boolean).length}
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowResumeModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-slate-300 hover:text-white text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={analyzingResume}
                  onClick={handleRunResumeAudit}
                  className="orange-gradient-btn px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{analyzingResume ? 'Auditing with Edcruiter AI...' : 'Run Forensic Resume Audit →'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
