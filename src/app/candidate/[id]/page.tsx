'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import {
  Sparkles, CheckCircle2, ShieldAlert, Award, FileText, Video,
  Clock, Lock, Check, UserCheck, AlertTriangle, Play, HelpCircle,
  Maximize2, Minimize2, Eye, Shield, Upload, FileCheck, Brain, ArrowRight,
  Camera, Monitor, ShieldCheck, Users, LogIn, ChevronRight, Loader2, Copy, KeyRound
} from 'lucide-react';
import { Candidate, StageConfig, StageKey, StageResult, QuestionnaireItem, AssessmentPack, HRPolicyDocument, ScheduledInterview } from '@/lib/types';
import { SLOKA_DEFAULT_STAGES, DEFAULT_QUESTIONNAIRES } from '@/lib/defaultData';
import LiveProctoringWebcam from '@/components/candidate/LiveProctoringWebcam';
import VideoRecorderUpload from '@/components/candidate/VideoRecorderUpload';
import PDFResumeUploader from '@/components/candidate/PDFResumeUploader';
import StructuredLessonPlanEditor from '@/components/candidate/StructuredLessonPlanEditor';
import { resolveSubjectPacket, subjectBucket, segmentTier } from '@/lib/questionBank';
import { pickActivePack, sameSubject } from '@/lib/subjectMatch';
import { MIN_LESSON_WORDS, countWords } from '@/lib/testRules';

// The Stage 1 subject/segment <select> options use exact-case canonical
// values ("Biology", not "biology") — a <select> whose bound value doesn't
// exactly match any <option value> silently renders as if the FIRST option
// were chosen, with no visual indication anything is wrong. A candidate
// record created through a path that doesn't write the canonical casing
// (seen in practice: WhatsApp lead capture storing "biology") would show
// "Physics" selected on screen while the real stored value stayed whatever
// it actually was — confusing for a candidate editing their own profile,
// and worth normalizing on load rather than requiring every write path to
// agree on exact casing forever.
const SUBJECT_OPTIONS = ['Physics', 'Mathematics', 'Biology', 'Chemistry', 'English', 'Social Studies'];
const SEGMENT_OPTIONS = ['Secondary (Grades 9-10)', 'Senior Secondary (Grades 11-12)', 'Middle School (Grades 6-8)', 'Primary (Grades 1-5)'];
const QUALIFICATION_OPTIONS = [
  'Graduation (B.Sc / B.A / B.Com)',
  'Masters / Post Graduation (M.Sc / M.A / M.Ed)',
  'B.Ed (Bachelor of Education)',
  'D.El.Ed / NTT / Montessori Diploma',
  'Ph.D / Doctorate'
];
const OTHER_QUALIFICATION = 'Others';

function canonicalOption(raw: string | undefined, options: string[]): string {
  if (!raw) return '';
  const match = options.find((opt) => opt.toLowerCase() === raw.toLowerCase());
  return match || raw;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

const STAGE_DISPLAY_INFO: Record<string, { shortTitle: string; subtitle: string; icon: any }> = {
  identity_verification: { shortTitle: 'Identity & CV', subtitle: 'Bio & Resume', icon: UserCheck },
  written_theory: { shortTitle: 'Written / Theory', subtitle: 'Pedagogy & Lesson', icon: FileText },
  micro_teaching_demo: { shortTitle: 'Teaching Demo', subtitle: '5-Min Video Demo', icon: Video },
  situational_scenario: { shortTitle: 'Situational Scenarios', subtitle: 'Classroom Cases', icon: Users },
  hr_policy_briefing: { shortTitle: 'HR Policies', subtitle: 'Signoff & Code', icon: ShieldCheck },
};

export default function CandidateAssessmentPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const candidateId = resolvedParams.id;

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [stageResults, setStageResults] = useState<StageResult[]>([]);
  const [activeStageKey, setActiveStageKey] = useState<StageKey>('identity_verification');
  const [loading, setLoading] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showFullscreenModal, setShowFullscreenModal] = useState<boolean>(false);

  // Live AI Proctoring Telemetry State
  const [proctoringWarnings, setProctoringWarnings] = useState<number>(0);
  const [proctoringTrustScore, setProctoringTrustScore] = useState<number>(100);
  const [proctoringStatus, setProctoringStatus] = useState<string>('Clear & Verified');
  const [customQuestions, setCustomQuestions] = useState<QuestionnaireItem[]>([]);
  const [assessmentPack, setAssessmentPack] = useState<AssessmentPack | null>(null);
  const [schoolPolicies, setSchoolPolicies] = useState<HRPolicyDocument[]>([]);
  const [scheduledInterviews, setScheduledInterviews] = useState<ScheduledInterview[]>([]);
  const [codeCopied, setCodeCopied] = useState(false);
  const [schoolName, setSchoolName] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [schoolSubjects, setSchoolSubjects] = useState<string[]>([]);
  const [schoolSegments, setSchoolSegments] = useState<string[]>([]);
  const [packState, setPackState] = useState<'checking' | 'ready' | 'preparing' | 'failed'>('checking');
  const [packError, setPackError] = useState('');
  // Shown inside the page. A browser pop-up (alert) takes some browsers out of
  // fullscreen, which the proctoring then counts against the candidate.
  const [stageError, setStageError] = useState('');

  // Stage 1: Identity & PDF CV State
  const [identityData, setIdentityData] = useState({
    name: '',
    dob: '',
    age: '',
    phone: '',
    qualification: '',
    experience_band: '',
    prior_org: '',
    current_salary: '',
    expected_salary: '',
    current_location: '',
    relocation_branches: [] as string[],
    languages: [] as string[],
    notice_period: '',
    applied_segment: '',
    applied_subject: ''
  });
  const [resumePdfUrl, setResumePdfUrl] = useState<string>('');
  const [otherQualification, setOtherQualification] = useState('');

  // Stage 2: Written / Theory Response
  const [writtenTheoryResponse, setWrittenTheoryResponse] = useState<string>('');
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({});

  // Stage 3: Micro-Teaching 5-Min Video Demo
  const [microDemoVideoUrl, setMicroDemoVideoUrl] = useState<string>('');

  // Stage 4: Situational Scenario Video & Notes
  const [situationalVideoUrl, setSituationalVideoUrl] = useState<string>('');
  const [situationalNotes, setSituationalNotes] = useState<string>('');

  // Stage 5: HR Policy Agreement
  const [hrNoticeConfirmed, setHrNoticeConfirmed] = useState<boolean>(false);
  const [hrSafeguardingConfirmed, setHrSafeguardingConfirmed] = useState<boolean>(false);
  const [hrCustomStatement, setHrCustomStatement] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [stageSubmitted, setStageSubmitted] = useState<boolean>(false);
  const [allCompleted, setAllCompleted] = useState<boolean>(false);
  const [showTabViolationModal, setShowTabViolationModal] = useState<boolean>(false);

  // Automatic Age Calculation from DOB
  const handleDobChange = (newDob: string) => {
    if (!newDob) {
      setIdentityData(prev => ({ ...prev, dob: '', age: '' }));
      return;
    }
    const birthDate = new Date(newDob);
    const today = new Date();
    let calculatedAge = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      calculatedAge--;
    }
    const ageStr = calculatedAge > 0 ? calculatedAge.toString() : '0';
    setIdentityData(prev => ({ ...prev, dob: newDob, age: ageStr }));
  };

  useEffect(() => {
    fetchCandidateData();
  }, [candidateId]);

  // The school's test for this candidate's subject and grade level. If it has
  // not been written yet, the server writes it and this keeps asking until it
  // is ready, so the candidate waits on a clear screen instead of getting two
  // stray questions or another subject's paper.
  useEffect(() => {
    if (!candidate || loadError) return;
    if (assessmentPack && pickActivePack([assessmentPack], candidate.applied_subject, candidate.applied_segment)) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      try {
        const res = await fetch('/api/assessment-packs/ensure');
        const data = await res.json();
        if (cancelled) return;
        if (data.state === 'ready') {
          setAssessmentPack(data.pack);
          setPackState('ready');
          return;
        }
        if (data.state === 'failed') {
          setPackState('failed');
          setPackError(data.error || '');
        } else {
          setPackState('preparing');
        }
      } catch {
        if (!cancelled) setPackState('preparing');
      }
      if (!cancelled) timer = setTimeout(check, 5000);
    };
    check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [candidate?.id, candidate?.applied_subject, candidate?.applied_segment, assessmentPack, loadError]);

  useEffect(() => {
    if (allCompleted && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [allCompleted]);

  // Visibility & Fullscreen Telemetry & Active Alert Modal
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && activeStageKey !== 'identity_verification') {
        setProctoringWarnings(prev => prev + 1);
        setProctoringTrustScore(prev => Math.max(10, prev - 15));
        setProctoringStatus('Tab Switch Detected');
        setShowTabViolationModal(true);
        logProctoringEvent('TAB_SWITCH', 'Candidate switched away from assessment tab.');
      }
    };

    const handleFullscreenChange = () => {
      const isFS = !!document.fullscreenElement;
      setIsFullscreen(isFS);
      if (!isFS && activeStageKey !== 'identity_verification' && !allCompleted) {
        setShowTabViolationModal(true);
        logProctoringEvent('FULLSCREEN_EXIT', 'Candidate exited fullscreen mode during proctored exam.');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [activeStageKey, allCompleted]);

  // Overlays and other windows. A floating app, a screen-share overlay or a
  // chat window on top of the test does not change the tab, so the tab-switch
  // check never sees it, but the page loses keyboard focus. Check for that, and
  // for a second screen, while a proctored stage is open.
  useEffect(() => {
    if (activeStageKey === 'identity_verification' || allCompleted) return;
    let lastLogged = 0;
    const reportFocusLoss = () => {
      if (document.hidden || document.hasFocus()) return;
      const now = Date.now();
      if (now - lastLogged < 15_000) return;
      lastLogged = now;
      handleProctoringAnomaly('FOCUS_LOST', 'The test window lost focus: another window or an overlay may be on top of it.');
    };
    const onBlur = () => { setTimeout(reportFocusLoss, 800); };
    window.addEventListener('blur', onBlur);
    const poll = setInterval(reportFocusLoss, 3000);

    const screenInfo = window.screen as Screen & { isExtended?: boolean };
    if (screenInfo.isExtended) {
      handleProctoringAnomaly('MULTIPLE_DISPLAYS', 'More than one screen is connected to this computer.');
    }
    return () => {
      window.removeEventListener('blur', onBlur);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStageKey, allCompleted]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const fetchCandidateData = async () => {
    try {
      // The candidate's real school_id is only known once this first fetch
      // resolves — questionnaires/assessment-packs/hr-policies all reject a
      // school_id that doesn't match the authenticated candidate's own
      // school (403 "Not your school"), so those three can't fire with a
      // guessed id the way this used to hardcode the seeded demo school's
      // id for every candidate. A candidate from any other school would
      // silently get empty quiz questions, no assessment pack, and no HR
      // policy text at stage 5 — not a visible error, just a broken stage.
      const [cRes, intvRes] = await Promise.all([
        fetch(`/api/candidates/${candidateId}`),
        fetch(`/api/interviews?candidate_id=${candidateId}`)
      ]);
      const cData = await cRes.json();
      const intvData = await intvRes.json().catch(() => ({}));
      setScheduledInterviews((intvData.interviews || []).filter((i: ScheduledInterview) => i.status === 'scheduled'));

      if (cData.candidate) {
        const realSchoolId = cData.candidate.school_id;
        const [qRes, packRes, polRes] = await Promise.all([
          fetch(`/api/questionnaires?school_id=${realSchoolId}`),
          fetch(`/api/assessment-packs?school_id=${realSchoolId}`),
          fetch(`/api/hr-policies?school_id=${realSchoolId}`)
        ]);
        const qData = await qRes.json();
        const packData = await packRes.json();
        const polData = await polRes.json();
        if (qData.questionnaires) setCustomQuestions(qData.questionnaires);
        setSchoolPolicies(polData.policies || []);
        setSchoolName(cData.schoolName || '');
        setSchoolSubjects(cData.schoolSubjects || []);
        setSchoolSegments(cData.schoolSegments || []);

        setCandidate(cData.candidate);
        setStageResults(cData.stageResults || []);

        setIdentityData({
          name: cData.candidate.name || '',
          dob: cData.candidate.dob || '',
          age: cData.candidate.age?.toString() || '',
          phone: cData.candidate.phone || '',
          // Left blank when not already on file, not defaulted to a specific
          // plausible-looking choice (a fresher candidate silently
          // pre-marked "2 – 4 years", or "30 days" notice for someone with
          // none, changes what a school decides to offer). Each dropdown
          // below now opens on an explicit "Select…" option instead.
          qualification: cData.candidate.qualification && !QUALIFICATION_OPTIONS.includes(cData.candidate.qualification)
            ? OTHER_QUALIFICATION
            : (cData.candidate.qualification || ''),
          experience_band: cData.candidate.experience_band || '',
          prior_org: cData.candidate.prior_org || '',
          current_salary: cData.candidate.current_salary || '',
          expected_salary: cData.candidate.expected_salary || '',
          current_location: cData.candidate.current_location || '',
          relocation_branches: cData.candidate.relocation_branches || [],
          languages: cData.candidate.languages || [],
          notice_period: cData.candidate.notice_period || '',
          applied_segment: canonicalOption(cData.candidate.applied_segment, SEGMENT_OPTIONS),
          applied_subject: canonicalOption(cData.candidate.applied_subject, SUBJECT_OPTIONS)
        });

        if (cData.candidate.resume_url) setResumePdfUrl(cData.candidate.resume_url);
        if (cData.candidate.qualification && !QUALIFICATION_OPTIONS.includes(cData.candidate.qualification)) {
          setOtherQualification(cData.candidate.qualification);
        }

        const packs: AssessmentPack[] = packData.packs || [];
        // Only ever the test written for this candidate's own subject and grade
        // level. No match means "prepare one", never another subject's test.
        const matched = pickActivePack(packs, cData.candidate.applied_subject, cData.candidate.applied_segment);
        setAssessmentPack(matched);
        setPackState(matched ? 'ready' : 'preparing');

        const completedKeys = (cData.stageResults || []).map((r: StageResult) => r.stage_key);
        const nextStage = SLOKA_DEFAULT_STAGES.find(s => !completedKeys.includes(s.key));
        if (nextStage) {
          setActiveStageKey(nextStage.key);
        } else if (completedKeys.length >= SLOKA_DEFAULT_STAGES.length) {
          setAllCompleted(true);
        }
      } else {
        // A genuine failure to load (bad link, deleted record, backend
        // error) used to be invisible — this branch fabricated a complete
        // plausible-looking profile (a 1996 DOB, "Hyderabad", a Manneguda
        // branch assignment) and let the candidate proceed as if nothing
        // were wrong, which also meant a real bug here would never surface
        // as a bug report. Show the failure instead.
        setLoadError(cData.error || 'We could not load your application. The link may be invalid or expired — contact the school you applied to.');
      }
    } catch (err) {
      console.error('Error loading candidate profile:', err);
      setLoadError('We could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const logProctoringEvent = async (type: string, description: string) => {
    try {
      await fetch('/api/proctoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: candidateId,
          stage_key: activeStageKey,
          event_type: type,
          details: description,
        })
      });
    } catch (err) {}
  };

  const handleProctoringAnomaly = (type: string, detail: string) => {
    setProctoringWarnings(prev => prev + 1);
    setProctoringTrustScore(prev => Math.max(10, prev - 8));
    setProctoringStatus(detail);
    logProctoringEvent(type, detail);
  };

  // Exact-string subject matching ('Physics' === 'Physics') almost never
  // succeeds against DEFAULT_QUESTIONNAIRES, which only defines ONE subject
  // per grade segment (English for pre-primary, Math for primary, Science
  // for middle, Physics for secondary/senior) as a generic last-resort set —
  // it was never meant to cover every subject. The old fallback chain, on a
  // miss, grabbed the first entry anywhere matching just the stage key —
  // ignoring subject AND segment — which for most candidates meant the
  // Pre-primary/English prompt regardless of what they actually applied
  // for. Bucket/tier matching (shared with resolveSubjectPacket) and
  // honouring the explicit 'ALL' wildcard fixes the common case; when
  // nothing genuinely matches this candidate's subject, this now returns
  // undefined so callers fall through to their own subject-correct generic
  // copy instead of showing another subject's content.
  const getDynamicQuestion = (stageKey: StageKey) => {
    const candSubject = subjectBucket(candidate?.applied_subject);
    const candSegment = segmentTier(candidate?.applied_segment);
    const subjectOk = (s: string) => s.toUpperCase() === 'ALL' || subjectBucket(s) === candSubject;
    const segmentOk = (s: string) => s.toUpperCase() === 'ALL' || segmentTier(s) === candSegment;

    const custom = customQuestions.find(q => q.stage_key === stageKey && subjectOk(q.subject) && segmentOk(q.segment))
      || customQuestions.find(q => q.stage_key === stageKey && subjectOk(q.subject));
    if (custom) return custom;

    return DEFAULT_QUESTIONNAIRES.find(q => q.stage_key === stageKey && subjectOk(q.subject) && segmentOk(q.segment))
      || DEFAULT_QUESTIONNAIRES.find(q => q.stage_key === stageKey && subjectOk(q.subject));
  };

  const handleSubmitStage = async (stageKey: StageKey, customResponseText?: string) => {
    setStageError('');
    const fail = (message: string) => {
      setStageError(message);
      setSubmitting(false);
    };
    // The click that submits is the one moment the browser lets us go back
    // into fullscreen if something knocked the candidate out of it.
    if (stageKey !== 'identity_verification' && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    if (stageKey === 'identity_verification') {
      if (!identityData.name.trim()) return fail('Please fill in your Full Legal Name before proceeding.');
      if (!identityData.phone.trim()) return fail('Please provide your WhatsApp / Contact Phone number.');
      if (!identityData.qualification) return fail('Please choose your highest qualification.');
      if (identityData.qualification === OTHER_QUALIFICATION && !otherQualification.trim()) {
        return fail('Please type your qualification.');
      }
      if (!resumePdfUrl && !candidate?.resume_url) {
        return fail('Please upload your CV as a PDF. It must be a proper CV with your name, qualifications and experience.');
      }
    }

    setSubmitting(true);
    try {
      let submissionData: any = {};

      if (stageKey === 'identity_verification') {
        const effectiveResume = resumePdfUrl || candidate?.resume_url || '';
        
        submissionData = {
          candidate_updates: {
            ...identityData,
            qualification: identityData.qualification === OTHER_QUALIFICATION ? otherQualification.trim() : identityData.qualification,
            name: identityData.name.trim(),
            phone: identityData.phone.trim(),
            age: identityData.age ? parseInt(identityData.age) : undefined,
            resume_url: effectiveResume
          },
          written_submission: `Candidate Profile Saved & Dossier Verified. Name: ${identityData.name}, Subject: ${identityData.applied_subject}, Qualification: ${identityData.qualification}, Experience: ${identityData.experience_band}. Resume: ${effectiveResume}`
        };

        // Update local candidate state immediately
        setCandidate(prev => prev ? ({
          ...prev,
          name: identityData.name.trim(),
          phone: identityData.phone.trim(),
          applied_subject: identityData.applied_subject,
          applied_segment: identityData.applied_segment,
          qualification: identityData.qualification,
          experience_band: identityData.experience_band,
          resume_url: effectiveResume
        }) : prev);
      } else if (stageKey === 'written_theory') {
        const textToSubmit = customResponseText !== undefined ? customResponseText : writtenTheoryResponse;
        const words = countWords(textToSubmit);
        if (!assessmentPack) return fail('Your test is still being prepared. Wait a moment, then submit.');
        const unanswered = assessmentPack.mcqs.filter((q) => !mcqAnswers[q.id]);
        if (unanswered.length > 0) {
          return fail(`Please answer every question. ${unanswered.length} still need an answer.`);
        }
        if (words < MIN_LESSON_WORDS) {
          return fail(`Your lesson plan has ${words} words. Please write at least ${MIN_LESSON_WORDS} words.`);
        }
        // Only the picks go to the server. It marks them against the answer key,
        // which never reaches this page.
        submissionData = { mcq_answers: mcqAnswers, lesson_plan: textToSubmit };
      } else if (stageKey === 'micro_teaching_demo') {
        if (!microDemoVideoUrl) {
          return fail('Please complete the live teaching demo recording before submitting.');
        }
        submissionData = {
          media_url: microDemoVideoUrl,
          video_url: microDemoVideoUrl,
          written_submission: '5-minute teaching demo recorded and submitted.'
        };
      } else if (stageKey === 'situational_scenario') {
        if (!situationalVideoUrl) {
          return fail('Please complete the live classroom scenario recording before submitting.');
        }
        submissionData = {
          media_url: situationalVideoUrl,
          video_url: situationalVideoUrl,
          written_submission: situationalNotes || 'Classroom scenario video submitted.'
        };
      } else if (stageKey === 'hr_policy_briefing') {
        if (!hrNoticeConfirmed || !hrSafeguardingConfirmed) {
          return fail('Please confirm all HR policy conditions to complete the assessment.');
        }
        submissionData = {
          written_submission: `HR Policy Confirmation:
- School policies accepted (${schoolPolicies.length ? schoolPolicies.map((p) => p.title).join(', ') : 'none published yet'}): ${hrNoticeConfirmed ? 'YES' : 'NO'}
- Child Safeguarding Code of Conduct Signed: ${hrSafeguardingConfirmed ? 'YES' : 'NO'}
- Additional Statement: ${hrCustomStatement || 'None'}`
        };
      }

      const res = await fetch('/api/stage-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: candidateId,
          stage_key: stageKey,
          proctoring_trust_score: proctoringTrustScore,
          ...submissionData
        })
      });

      const data = await res.json();
      const returnedResult = data.stageResult || data.result;

      if (returnedResult) {
        setStageResults(prev => [...prev.filter(r => r.stage_key !== stageKey), returnedResult]);
        setStageSubmitted(true);
        setTimeout(() => setStageSubmitted(false), 2000);

        if (stageKey === 'identity_verification') {
          setShowFullscreenModal(true);
        } else {
          const currentStageIndex = SLOKA_DEFAULT_STAGES.findIndex(s => s.key === stageKey);
          if (currentStageIndex < SLOKA_DEFAULT_STAGES.length - 1) {
            setActiveStageKey(SLOKA_DEFAULT_STAGES[currentStageIndex + 1].key);
          } else {
            setAllCompleted(true);
          }
        }
      } else {
        throw new Error(data.error || 'Failed to record stage result');
      }
    } catch (err: any) {
      setStageError(err.message || 'Failed to submit stage response. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnterFullscreenAndBeginStage2 = () => {
    setShowFullscreenModal(false);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    setActiveStageKey('written_theory');
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-12 text-center text-slate-500 space-y-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <div className="text-sm font-medium">Loading secure AI assessment environment...</div>
      </div>
    );
  }

  if (loadError || !candidate) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-12 text-center space-y-3">
        <ShieldAlert className="w-8 h-8 text-rose-500" />
        <div className="text-sm font-bold text-slate-900">Couldn&apos;t load your application</div>
        <div className="text-sm text-slate-500 max-w-sm">{loadError || 'Something went wrong. Please try again.'}</div>
      </div>
    );
  }

  const currentStageConfig = SLOKA_DEFAULT_STAGES.find(s => s.key === activeStageKey);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-16">
      
      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 sm:px-8 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-xl shadow-md">
              E
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">
                  {candidate.name || identityData.name || 'Candidate Assessment'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200">
                  {candidate.applied_subject || identityData.applied_subject || 'Physics'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">{schoolName || 'Your school'} • Automated AI Pre-Screening</p>
              {candidate.invite_code && (
                <button
                  type="button"
                  onClick={async () => {
                    // One link that opens the application anywhere, rather than a
                    // code the candidate has to pair with their phone or email.
                    try {
                      const res = await fetch('/api/candidates/my-link');
                      const data = await res.json();
                      if (!res.ok || !data.url) throw new Error('no link');
                      await navigator.clipboard.writeText(data.url);
                      setCodeCopied(true);
                      setTimeout(() => setCodeCopied(false), 2500);
                    } catch {
                      setStageError('Could not copy your link. Write down your application ID instead: ' + candidate.invite_code);
                    }
                  }}
                  title="Copies one link that opens your application on any phone or computer for 7 days. Paste it into WhatsApp (message yourself) or your notes. Do not share it."
                  className="mt-1 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[10.5px] font-bold hover:bg-amber-100 transition-colors"
                >
                  <KeyRound className="w-3 h-3" />
                  {codeCopied ? 'Link copied. Paste it in your notes or WhatsApp.' : 'Save my link to come back later'}
                  {codeCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Switch Candidate / Candidate Login Option */}
            <Link
              href="/teacher"
              className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-indigo-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Back to teacher workspace"
            >
              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Teacher space</span>
            </Link>

            {activeStageKey !== 'identity_verification' && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-mono">
                <Eye className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 animate-pulse" />
                <span className="text-slate-500 font-bold">Proctoring:</span>
                <strong className={proctoringTrustScore > 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400'}>
                  {proctoringTrustScore}% Trust
                </strong>
              </div>
            )}

            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">

        {/* Scheduled leadership interview, if the school has allotted one */}
        {scheduledInterviews.length > 0 && (
          <div className="space-y-3">
            {scheduledInterviews.map((intv) => (
              <div key={intv.id} className="p-4 sm:p-5 rounded-2xl bg-indigo-50 border-2 border-indigo-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wide text-indigo-600">Your interview is scheduled</p>
                  <p className="text-sm font-black text-slate-900 mt-0.5">
                    With {intv.assigned_user_name} · {new Date(intv.scheduled_at).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">{intv.duration_minutes} minutes over video call</p>
                </div>
                <a
                  href={intv.meeting_link}
                  target="_blank"
                  rel="noreferrer"
                  className="brand-primary-btn px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 shrink-0"
                >
                  <Video className="w-4 h-4" /> Join meeting
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Clean, Prominent Stage Stepper Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {SLOKA_DEFAULT_STAGES.map((stg) => {
            const isCompleted = stageResults.some(r => r.stage_key === stg.key);
            const isActive = activeStageKey === stg.key;
            const meta = STAGE_DISPLAY_INFO[stg.key] || { shortTitle: stg.name, subtitle: '', icon: FileText };
            const IconComp = meta.icon;

            return (
              <button
                key={stg.key}
                type="button"
                onClick={() => {
                  if (isCompleted || isActive) setActiveStageKey(stg.key);
                }}
                className={`relative p-3 sm:p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between gap-1.5 ${
                  isActive
                    ? 'brand-primary-btn text-white shadow-xl ring-2 ring-indigo-300'
                    : isCompleted
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-[10px] font-mono font-extrabold uppercase tracking-wider ${
                    isActive ? 'text-white/90' : isCompleted ? 'text-indigo-600' : 'text-slate-500'
                  }`}>
                    Stage {stg.order}
                  </span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  ) : (
                    <IconComp className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  )}
                </div>

                <div>
                  <div className="text-xs font-bold truncate">
                    {meta.shortTitle}
                  </div>
                  <div className={`text-[10px] truncate ${isActive ? 'text-white/80' : isCompleted ? 'text-indigo-600/80' : 'text-slate-500'}`}>
                    {meta.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Submission Toast */}
        {stageSubmitted && (
          <div className="p-4 bg-indigo-50 text-indigo-800 rounded-2xl border border-indigo-200 text-xs font-bold flex items-center gap-3 shadow-lg">
            <CheckCircle2 className="w-5 h-5 text-indigo-600" /> Stage saved. Moving you forward…
          </div>
        )}

        {/* STAGE 1: Full-Width Layout (No unnecessary right-side box) */}
        {allCompleted ? (
          <div className="max-w-2xl mx-auto">
            <div className="glass-card p-8 sm:p-12 rounded-3xl border border-indigo-200 text-center space-y-4 bg-white shadow-2xl">
              <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-200">
                <Award className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-slate-900">Well done, you&apos;ve finished</h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Thank you for your time. {schoolName || 'The school'} now has everything it needs to review your application.
              </p>
              <ol className="text-left text-xs space-y-2 max-w-md mx-auto pt-2">
                {[
                  ['The school reviews your answers and videos.', 'People at the school read every application. AI only helps them.'],
                  ['If you are shortlisted, you get an interview invite.', 'On WhatsApp and on this page, with the time and a meeting link.'],
                  ['Interviews happen in up to three short rounds.', 'Subject lead, then principal, then management.'],
                ].map(([title, detail], i) => (
                  <li key={title} className="flex gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[11px]">{i + 1}</span>
                    <span><strong className="block text-slate-900">{title}</strong><span className="text-slate-500">{detail}</span></span>
                  </li>
                ))}
              </ol>
              {candidate.invite_code && (
                <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                  To come back later, use the link we sent you, or tap &ldquo;Save my link&rdquo; at the top of this page. If you need to type it, your application ID is <strong className="font-mono text-slate-700">{candidate.invite_code}</strong>.
                </p>
              )}
              <div className="pt-2">
                <Link
                  href="/jobs"
                  className="brand-primary-btn px-6 py-2.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 shadow-xl"
                >
                  <span>Back to teaching jobs</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        ) : activeStageKey === 'identity_verification' ? (
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Stage Title Banner */}
            <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-200 bg-white space-y-2 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-indigo-600 tracking-wider">
                  Stage 1 of 5
                </span>
                <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                  Unproctored Profile Setup
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">1. Basic Identity & PDF CV Upload</h2>
              <p className="text-xs text-slate-500">
                Personal details, academic qualifications, teaching experience & resume dossier for institutional verification.
              </p>
            </div>

            {/* What to expect — set expectations before a teacher commits an hour */}
            <div className="glass-card p-6 sm:p-8 rounded-3xl border border-indigo-100 bg-indigo-50/50 space-y-4 shadow-sm">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">Before you begin</p>
                <h3 className="text-base font-black text-slate-900">What to expect — about 60 to 75 minutes in total</h3>
              </div>
              <ol className="grid sm:grid-cols-5 gap-2 text-[11px]">
                {[
                  ['1. Your profile', '5–10 min'],
                  ['2. Written test', '30–40 min'],
                  ['3. Teaching demo', 'up to 5 min on camera'],
                  ['4. Classroom scenario', 'up to 2 min on camera'],
                  ['5. School policies', '2 min'],
                ].map(([title, time]) => (
                  <li key={title} className="p-3 rounded-2xl bg-white border border-indigo-100">
                    <strong className="block text-slate-900">{title}</strong>
                    <span className="text-slate-500">{time}</span>
                  </li>
                ))}
              </ol>
              <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-700 list-disc list-inside">
                <li><strong>Take a break between stages.</strong> Each stage is saved when you submit it.</li>
                <li>Use a <strong>laptop or desktop</strong> with a camera and microphone, in a quiet room.</li>
                <li>To come back later, sign in with your phone or email and the code shown above.</li>
                <li><strong>People at the school make every decision.</strong> AI only helps them review.</li>
              </ul>
            </div>

            {/* Stage 1 Form Card */}
            <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-200 bg-white space-y-6 shadow-xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-600 font-bold mb-1.5">
                    Full Legal Name <span className="text-indigo-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chandra Sekhar"
                    value={identityData.name}
                    onChange={e => setIdentityData({...identityData, name: e.target.value})}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1.5">
                    Date of Birth & Age <span className="text-indigo-600">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={identityData.dob}
                      onChange={e => handleDobChange(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Age"
                      value={identityData.age}
                      readOnly
                      className="w-24 p-3 rounded-xl bg-slate-100/80 border border-slate-300 text-emerald-400 font-bold text-center focus:outline-none cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1.5">
                    WhatsApp / Contact Phone <span className="text-indigo-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98765 00000"
                    value={identityData.phone}
                    onChange={e => setIdentityData({...identityData, phone: e.target.value})}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1.5">
                    Highest Academic Qualification <span className="text-indigo-600">*</span>
                  </label>
                  <select
                    required
                    value={identityData.qualification}
                    onChange={e => setIdentityData({...identityData, qualification: e.target.value})}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="" disabled>Select your qualification…</option>
                    {QUALIFICATION_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    <option value={OTHER_QUALIFICATION}>Others (type below)</option>
                  </select>
                  {identityData.qualification === OTHER_QUALIFICATION && (
                    <input
                      type="text"
                      placeholder="Type your qualification (e.g. B.Tech Computer Science, MCA)"
                      value={otherQualification}
                      onChange={e => setOtherQualification(e.target.value)}
                      className="mt-2 w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none placeholder-slate-400"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1.5">
                    Total Teaching Experience <span className="text-indigo-600">*</span>
                  </label>
                  <select
                    required
                    value={identityData.experience_band}
                    onChange={e => setIdentityData({...identityData, experience_band: e.target.value})}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="" disabled>Select your experience…</option>
                    <option value="Fresher">Fresher (0 years)</option>
                    <option value="1 – 2 years">1 – 2 years</option>
                    <option value="2 – 4 years">2 – 4 years</option>
                    <option value="4 – 6 years">4 – 6 years</option>
                    <option value="6+ years">6+ years</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1.5">Previous School / Organization</label>
                  <input
                    type="text"
                    placeholder="e.g. Delhi Public School / Oakridge (or Fresher)"
                    value={identityData.prior_org}
                    onChange={e => setIdentityData({...identityData, prior_org: e.target.value})}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1.5">
                    Salary Fitment (Current vs Expected) <span className="text-indigo-600">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Current CTC (e.g. 5.0 LPA)"
                      value={identityData.current_salary}
                      onChange={e => setIdentityData({...identityData, current_salary: e.target.value})}
                      className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none placeholder-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="Expected CTC (e.g. 7.5 LPA)"
                      value={identityData.expected_salary}
                      onChange={e => setIdentityData({...identityData, expected_salary: e.target.value})}
                      className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none placeholder-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1.5">
                    Notice Period <span className="text-indigo-600">*</span>
                  </label>
                  <select
                    required
                    value={identityData.notice_period}
                    onChange={e => setIdentityData({...identityData, notice_period: e.target.value})}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="" disabled>Select notice period…</option>
                    <option value="Immediate">Immediate</option>
                    <option value="7 days">7 days</option>
                    <option value="15 days">15 days</option>
                    <option value="30 days (1 month)">30 days (1 month)</option>
                    <option value="60 days (2 months)">60 days (2 months)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-indigo-600 font-bold mb-1.5">
                    Target Teaching Subject <span className="text-indigo-600">*</span>
                  </label>
                  <select
                    value={identityData.applied_subject}
                    onChange={e => setIdentityData({...identityData, applied_subject: e.target.value})}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:border-indigo-500 focus:outline-none"
                  >
                    {(() => {
                      const base = schoolSubjects.length ? schoolSubjects : SUBJECT_OPTIONS;
                      const list = identityData.applied_subject && !base.some((s) => sameSubject(s, identityData.applied_subject))
                        ? [identityData.applied_subject, ...base]
                        : base;
                      return list.map((s) => <option key={s} value={s}>{s}</option>);
                    })()}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1.5">Target Grade Segment</label>
                  <select
                    value={identityData.applied_segment}
                    onChange={e => setIdentityData({...identityData, applied_segment: e.target.value})}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none"
                  >
                    {(() => {
                      const base = schoolSegments.length ? schoolSegments : SEGMENT_OPTIONS;
                      const list = identityData.applied_segment && !base.includes(identityData.applied_segment)
                        ? [identityData.applied_segment, ...base]
                        : base;
                      return list.map((s) => <option key={s} value={s}>{s}</option>);
                    })()}
                  </select>
                </div>
              </div>

              {/* PDF Resume Uploader */}
              <div className="pt-2 border-t border-slate-200">
                <PDFResumeUploader
                  schoolId={candidate.school_id}
                  candidateId={candidate.id}
                  defaultResumeUrl={resumePdfUrl || candidate.resume_url}
                  claimedName={identityData.name}
                  claimedQualification={identityData.qualification}
                  claimedExperience={identityData.experience_band}
                  claimedSubject={identityData.applied_subject || candidate.applied_subject}
                  claimedPriorOrg={identityData.prior_org}
                  onUploadComplete={(url: string) => setResumePdfUrl(url)}
                />
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSubmitStage('identity_verification')}
                  disabled={submitting}
                  className="brand-primary-btn px-8 py-3.5 rounded-2xl font-bold text-xs shadow-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <>
                      <span>Save & Proceed to Proctored Stage 2</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        ) : (
          /* STAGES 2 to 5: Responsive Split Layout with AI Proctoring Vision HUD */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Stage Tasks */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Stage Title Banner */}
              <div className="glass-card p-6 rounded-3xl border border-slate-200 bg-white space-y-2 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase text-indigo-600 tracking-wider">
                    Stage {currentStageConfig?.order} of 5
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200">
                    Strict Fullscreen AI Proctoring
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-900">{currentStageConfig?.name}</h2>
                <p className="text-xs text-slate-500">{currentStageConfig?.description}</p>
              </div>

              {stageError && (
                <div role="alert" className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{stageError}</span>
                </div>
              )}

              {/* STAGE 2: Written / Theory */}
              {activeStageKey === 'written_theory' && (
                <div className="space-y-6">
                  {!assessmentPack ? (
                    <div className="glass-card p-6 rounded-3xl border border-slate-200 bg-white text-center space-y-3">
                      {packState === 'failed' ? (
                        <>
                          <AlertTriangle className="w-7 h-7 text-amber-600 mx-auto" />
                          <h3 className="text-sm font-black text-slate-900">We could not prepare your test yet</h3>
                          <p className="text-xs text-slate-600">
                            {packError || 'Something went wrong while writing your test.'} We are trying again automatically. You can also close this page and come back in a few minutes with your link.
                          </p>
                        </>
                      ) : (
                        <>
                          <Loader2 className="w-7 h-7 text-indigo-600 animate-spin mx-auto" />
                          <h3 className="text-sm font-black text-slate-900">Preparing your {candidate.applied_subject} test</h3>
                          <p className="text-xs text-slate-600">
                            Your questions are written for {candidate.applied_subject} at {candidate.applied_segment}. This takes about a minute the first time. Please keep this page open.
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="glass-card p-5 rounded-3xl border border-slate-200 bg-white space-y-4">
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">MCQ test · {assessmentPack.mcqs.length} questions</p>
                        <h3 className="text-sm font-black text-slate-900">Subject check before the lesson plan</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Answered {Object.keys(mcqAnswers).filter((id) => assessmentPack.mcqs.some((q) => q.id === id)).length} of {assessmentPack.mcqs.length}
                        </p>
                      </div>
                      {assessmentPack.mcqs.map((q, idx) => (
                        <fieldset key={q.id} className="space-y-2 border-t border-slate-100 pt-3">
                          <legend className="text-xs font-bold text-slate-800">
                            {idx + 1}. {q.question_text}
                          </legend>
                          <div className="space-y-1.5">
                            {q.options.map((opt) => (
                              <label
                                key={opt}
                                className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs cursor-pointer ${
                                  mcqAnswers[q.id] === opt
                                    ? 'border-indigo-500 bg-indigo-100 text-indigo-900 font-semibold'
                                    : 'border-slate-300 bg-slate-100 text-slate-800'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={q.id}
                                  value={opt}
                                  checked={mcqAnswers[q.id] === opt}
                                  onChange={() => setMcqAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                                  className="mt-0.5"
                                />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      ))}
                    </div>
                  )}

                  <StructuredLessonPlanEditor
                    subject={candidate.applied_subject || identityData.applied_subject || 'Physics'}
                    segment={candidate.applied_segment || identityData.applied_segment || 'Secondary (Grades 9-10)'}
                    questionPrompt={assessmentPack?.lesson_prompt || getDynamicQuestion('written_theory')?.question_text}
                    rubricHint={getDynamicQuestion('written_theory')?.rubric_hint}
                    initialValue={writtenTheoryResponse}
                    onChange={(compiled) => setWrittenTheoryResponse(compiled)}
                  />

                  <div className="pt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSubmitStage('written_theory', writtenTheoryResponse)}
                      disabled={submitting || !assessmentPack}
                      className="brand-primary-btn px-8 py-3 rounded-2xl font-bold text-xs shadow-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving your answers...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit MCQs, lesson plan & advance to Stage 3</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* STAGE 3: Micro-Teaching 5-Min Video Demo */}
              {activeStageKey === 'micro_teaching_demo' && (
                <div className="space-y-6">
                  <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs space-y-2">
                    <span className="text-indigo-600 font-bold uppercase text-[10px] tracking-wider block">
                      Micro-Teaching Demo Task ({candidate.applied_subject || 'Physics'})
                    </span>
                    <p className="text-slate-900 font-bold">
                      {assessmentPack?.demo_prompt || getDynamicQuestion('micro_teaching_demo')?.question_text || `Deliver a 5-minute micro-teaching demo introducing a core concept in ${candidate.applied_subject}.`}
                    </p>
                  </div>

                  <VideoRecorderUpload
                    label="Live teaching demo"
                    defaultVideoUrl={microDemoVideoUrl}
                    prepSeconds={60}
                    maxRecordSeconds={300}
                    onVideoSubmit={(url: string) => setMicroDemoVideoUrl(url)}
                  />

                  <div className="pt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSubmitStage('micro_teaching_demo')}
                      disabled={submitting}
                      className="brand-primary-btn px-8 py-3 rounded-2xl font-bold text-xs shadow-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Submitting Video...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit Teaching Demo & Advance to Stage 4</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* STAGE 4: Situational Scenario */}
              {activeStageKey === 'situational_scenario' && (
                <div className="space-y-6">
                  <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs space-y-2">
                    <span className="text-indigo-600 font-bold uppercase text-[10px] tracking-wider block">
                      Classroom Situational Scenario
                    </span>
                    <p className="text-slate-900 font-bold">
                      {assessmentPack?.scenario_prompt || getDynamicQuestion('situational_scenario')?.question_text || 'Explain your 3-step de-escalation protocol when a student repeatedly disrupts class and refuses to engage.'}
                    </p>
                  </div>

                  <VideoRecorderUpload
                    label="Classroom scenario (live)"
                    defaultVideoUrl={situationalVideoUrl}
                    prepSeconds={60}
                    maxRecordSeconds={120}
                    onVideoSubmit={(url: string) => setSituationalVideoUrl(url)}
                  />

                  <div className="space-y-2">
                    <label className="block text-slate-600 font-bold text-xs">
                      Supporting Rationale & Classroom Management Strategy
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Write additional details regarding parent communication and restorative steps..."
                      value={situationalNotes}
                      onChange={e => setSituationalNotes(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:border-indigo-500 focus:outline-none placeholder-slate-400"
                    />
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSubmitStage('situational_scenario')}
                      disabled={submitting}
                      className="brand-primary-btn px-8 py-3 rounded-2xl font-bold text-xs shadow-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Submitting Video...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit Scenario & Advance to Final Stage</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* STAGE 5: HR Policies & Safeguarding */}
              {activeStageKey === 'hr_policy_briefing' && (
                <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-200 bg-white space-y-5 shadow-xl">
                  {schoolPolicies.length > 0 && (
                    <div className="space-y-3">
                      {schoolPolicies.map((p) => (
                        <article key={p.id} className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-xs">
                          <h4 className="font-black text-slate-900 mb-1">{p.title}</h4>
                          <pre className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed">{p.content}</pre>
                        </article>
                      ))}
                    </div>
                  )}

                  <div className="space-y-3 text-xs">
                    <label className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3 cursor-pointer hover:border-indigo-300 transition-colors">
                      <input
                        type="checkbox"
                        checked={hrNoticeConfirmed}
                        onChange={e => setHrNoticeConfirmed(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <strong className="text-slate-900 block">
                          {schoolPolicies.length > 0 ? "I accept this school's policies shown above" : "I agree to follow the school's HR policies"}
                        </strong>
                        <span className="text-slate-500 text-[11px]">
                          {schoolPolicies.length > 0
                            ? 'Including its notice period, working hours, and the other terms in each policy.'
                            : 'This school has not published its policies here yet. They will be shared with you before any offer.'}
                        </span>
                      </div>
                    </label>

                    <label className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3 cursor-pointer hover:border-indigo-300 transition-colors">
                      <input
                        type="checkbox"
                        checked={hrSafeguardingConfirmed}
                        onChange={e => setHrSafeguardingConfirmed(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <strong className="text-slate-900 block">POCSO & Child Safeguarding Zero-Tolerance Code</strong>
                        <span className="text-slate-500 text-[11px]">
                          I agree to uphold the school's child protection protocols and background clearance verification.
                        </span>
                      </div>
                    </label>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSubmitStage('hr_policy_briefing')}
                      disabled={submitting}
                      className="brand-primary-btn px-8 py-3 rounded-2xl font-bold text-xs shadow-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Finalizing Assessment...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit final assessment</span>
                          <CheckCircle2 className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Right Column: AI Proctoring Webcam HUD & Stage Scores */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Live AI Proctoring Camera HUD */}
              <div className="glass-card p-4 rounded-3xl border border-slate-200 dark:border-slate-200 bg-white dark:bg-white space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-500 tracking-wider flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5 text-indigo-600" /> AI Proctoring HUD
                  </span>
                  <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    Active Vision
                  </span>
                </div>

                <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-200">
                  <LiveProctoringWebcam
                    stageKey={activeStageKey}
                    schoolId={candidate.school_id}
                    candidateId={candidate.id}
                    onViolation={(type, details) => handleProctoringAnomaly(type, details)}
                  />
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-50 rounded-2xl border border-slate-200 dark:border-slate-200 text-[11.5px] space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-500">Environment:</span>
                    <strong className="text-emerald-700 dark:text-emerald-400 font-bold">Secure Proctored</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-500">Integrity Trust:</span>
                    <strong className="text-emerald-700 dark:text-emerald-400 font-mono">{proctoringTrustScore}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-500">Status:</span>
                    <strong className="text-slate-800 dark:text-zinc-200">{proctoringStatus}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-500">Warnings Logged:</span>
                    <strong className="text-indigo-600 dark:text-indigo-600 font-mono">{proctoringWarnings}</strong>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

      </div>

      {/* Active Tab Violation & Fullscreen Exit Alert Modal */}
      {showTabViolationModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-amber-200 shadow-2xl space-y-5 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900">You left the test window</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {proctoringWarnings <= 1
                  ? "That's okay if it was an accident, like a notification. Please stay on this page until you submit this stage."
                  : `This has happened ${proctoringWarnings} times. Each time is noted for the school, so please stay on this page until you submit.`}
              </p>
              <p className="text-[11px] text-slate-500">
                The school sees these notes alongside your answers. A person reviews them, so one slip will not cost you the job.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowTabViolationModal(false);
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(() => {});
                }
              }}
              className="w-full py-3.5 rounded-2xl font-bold text-xs brand-primary-btn shadow-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Back to my test</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Interstitial Fullscreen Enforcement Modal */}
      {showFullscreenModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
          <div className="max-w-3xl w-full bg-white p-8 sm:p-10 rounded-[28px] border border-slate-200 shadow-2xl space-y-6 my-6">
            <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-200">
              <Monitor className="w-8 h-8" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">Before you start</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900">Your five-stage teacher test</h3>
              <p className="text-sm text-slate-600 leading-relaxed max-w-xl mx-auto">
                Profile is saved. The next four stages take about 45–60 minutes, in fullscreen with your camera on. You can take a break between stages — each one is saved when you submit it.
              </p>
            </div>
            <ol className="grid sm:grid-cols-2 gap-3 text-left text-xs">
              <li className="p-4 rounded-2xl bg-slate-50 border border-slate-100"><strong className="block text-slate-900">Stage 2 — Written</strong> About 25 MCQs, then a lesson plan. No score is given until you submit.</li>
              <li className="p-4 rounded-2xl bg-slate-50 border border-slate-100"><strong className="block text-slate-900">Stage 3 — Teaching demo</strong> One minute to prepare. Recording starts on its own. Speak to the camera as if it is a class.</li>
              <li className="p-4 rounded-2xl bg-slate-50 border border-slate-100"><strong className="block text-slate-900">Stage 4 — Classroom scenario</strong> Same live-camera rule. Answer the situation out loud.</li>
              <li className="p-4 rounded-2xl bg-slate-50 border border-slate-100"><strong className="block text-slate-900">Stage 5 — School policies</strong> Confirm this school’s notice, hours, and safeguarding. This stage is not scored.</li>
            </ol>
            <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100 text-left text-xs space-y-2">
              <div className="flex items-center gap-2 text-indigo-800 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>Rules while the camera is on</span>
              </div>
              <ul className="list-disc list-inside text-slate-700 space-y-1.5 leading-relaxed">
                <li>Stay in fullscreen. Do not switch tabs or open another window.</li>
                <li>Keep your face clearly in the frame. Sit in a quiet, well-lit room.</li>
                <li>Put phones, notes, and extra screens away. Do not read from another device.</li>
                <li>No other person should be in the room or speaking off-camera.</li>
                <li>Use a laptop or desktop with a working webcam and microphone. Headphones are fine.</li>
                <li>Leaving the test or covering the camera is logged on your report.</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={handleEnterFullscreenAndBeginStage2}
              className="w-full brand-primary-btn py-4 rounded-2xl font-bold text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>I understand — start the proctored test</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
