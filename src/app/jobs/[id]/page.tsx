'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Building2, Sparkles, MapPin, Award, CheckCircle2, ArrowRight, 
  ShieldCheck, Clock, Briefcase, GraduationCap, Video, Users, Loader2,
  ArrowLeft, Check, BookOpen, AlertCircle, Share2, DollarSign
} from 'lucide-react';

const JOB_DETAILS_DATABASE: Record<string, any> = {
  job_001: {
    id: 'job_001',
    title: 'Senior PGT Physics Faculty (Grades 11–12)',
    school_name: 'Sample School',
    school_type: 'CBSE & Cambridge International',
    subject: 'Physics',
    segment: 'Senior Secondary (Grades 11-12)',
    board: 'CBSE / Cambridge IGCSE & A-Level',
    location: 'Hyderabad, Telangana',
    branch: 'Manneguda Campus',
    experience_required: '3 – 6 Years',
    salary_range: '₹7.8 LPA – ₹9.5 LPA',
    posted_date: 'Posted 2 days ago',
    overview: 'Sample School is seeking an experienced, visionary PGT Physics faculty member for our Senior Secondary wing at Manneguda Campus. The educator will teach advanced mechanics, electromagnetism, and modern physics for CBSE Class 11-12 board exams and Cambridge A-Levels.',
    responsibilities: [
      'Deliver engaging 35-45 minute physics lectures emphasizing conceptual first-principles.',
      'Supervise senior physics laboratory practical experiments adhering to board safety protocols.',
      'Diagnose and remediate student misconceptions in vector calculus, thermodynamics, and circuit analysis.',
      'Design formative exit tickets and calibrated term examinations.'
    ],
    requirements: [
      'Master of Science (M.Sc) in Physics / Applied Physics with minimum 60% aggregate.',
      'Bachelor of Education (B.Ed) from an NCTE recognized university.',
      'Minimum 3 years of classroom teaching experience in CBSE or Cambridge senior cohorts.',
      'Strong communication and chalkboard pedagogical projection.'
    ],
    perks: [
      'Subsidized AC Campus Housing & Staff Quarters',
      '100% Tuition Fee Waiver for up to 2 Children',
      'Comprehensive Medical & Health Insurance Cover',
      'Annual Performance & Board Results Bonus',
      'Free Daily Staff Transport (AC Bus)'
    ]
  },
  job_002: {
    id: 'job_002',
    title: 'TGT Mathematics Lead & Olympiad Mentor',
    school_name: 'Sample School',
    school_type: 'CBSE Affiliated Senior School',
    subject: 'Mathematics',
    segment: 'Secondary (Grades 9-10)',
    board: 'CBSE Curriculum',
    location: 'Hyderabad, Telangana',
    branch: 'Tukkuguda Campus',
    experience_required: '4 – 7 Years',
    salary_range: '₹6.5 LPA – ₹8.2 LPA',
    posted_date: 'Posted 3 days ago',
    overview: 'Sample School invites applications for a passionate Secondary Mathematics Teacher (TGT) to mentor grade 9-10 students in geometric proofs, algebraic reasoning, and competitive olympiad problems.',
    responsibilities: [
      'Teach CBSE class 9-10 mathematics with concrete-to-abstract pedagogical scaffolding.',
      'Conduct interactive math lab activities to visualize trigonometric ratios and coordinate geometry.',
      'Provide targeted remedial support for struggling learners while mentoring gifted students.'
    ],
    requirements: [
      'M.Sc or B.Sc in Mathematics with B.Ed degree.',
      'Minimum 4 years teaching experience in recognized CBSE/ICSE schools.',
      'Demonstrated track record of strong student board examination performance.'
    ],
    perks: [
      'Free AC Staff Transport',
      'Provident Fund + Gratuity Benefits',
      'Annual National Math Conclave Sponsorship',
      'Daily Nutritious Lunch on Campus'
    ]
  },
  job_003: {
    id: 'job_003',
    title: 'Cambridge IGCSE Biology & Life Sciences Specialist',
    school_name: 'Sample School',
    school_type: 'Cambridge International School',
    subject: 'Biology',
    segment: 'Secondary (Grades 9-10)',
    board: 'Cambridge IGCSE',
    location: 'Vikarabad, Telangana',
    branch: 'Vikarabad Campus',
    experience_required: '2 – 5 Years',
    salary_range: '₹6.0 LPA – ₹7.5 LPA',
    posted_date: 'Posted 5 days ago',
    overview: 'Join Sample School as an IGCSE Biology Specialist. Foster an environment of scientific inquiry, microscopic investigations, and ecological awareness.',
    responsibilities: [
      'Teach Cambridge 0610 Biology syllabus with emphasis on experimental analysis.',
      'Guide students in microscope slide preparation, osmosis experiments, and enzyme kinetics.',
      'Facilitate biology club and environmental science exhibitions.'
    ],
    requirements: [
      'M.Sc or B.Sc in Botany / Zoology / Life Sciences + B.Ed.',
      'Familiarity with Cambridge assessment rubrics and practical paper 6.',
      '2+ years of international curriculum experience.'
    ],
    perks: [
      'Relocation Allowance for outstation candidates',
      'Cambridge Professional Development Certification',
      'Campus Dining & Health Insurance'
    ]
  }
};

export default function PublicJobApplicationPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = (params.id as string) || 'job_001';
  const [job, setJob] = useState<any>(JOB_DETAILS_DATABASE[rawId] || null);
  const [jobLoading, setJobLoading] = useState(!JOB_DETAILS_DATABASE[rawId]);

  useEffect(() => {
    fetch(`/api/jobs/${rawId}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        const j = data.job;
        if (!j) return;
        setJob({
          id: j.id,
          title: j.title,
          school_name: j.school_name,
          school_type: j.school_type || '',
          subject: j.subject,
          segment: j.segment,
          board: j.board,
          location: j.location || 'Hyderabad, Telangana',
          branch: j.branch,
          experience_required: j.experience_required,
          salary_range: j.salary_range,
          posted_date: j.posted_date || 'Just now',
          overview: j.description,
          responsibilities: j.responsibilities || [],
          requirements: j.requirements || [],
          perks: j.perks || []
        });
      })
      .catch(() => {})
      .finally(() => setJobLoading(false));
  }, [rawId]);

  const [showApplyModal, setShowApplyModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [whatsappConsent, setWhatsappConsent] = useState(false);

  // Application Form State. Every field starts genuinely blank — this used
  // to pre-fill a fake birthdate (1996-05-20), a fake age (28), a specific
  // qualification and experience band, and a fake city, all silently
  // submittable as a real applicant's own data if they didn't happen to
  // notice and overwrite every field before hitting submit. This is the
  // public application form real candidates use — the highest-traffic
  // single place this pattern could bite someone.
  //
  // applied_subject / applied_segment / target_branch_id are deliberately
  // not tracked here at all: they're never rendered as inputs, only ever
  // carried from the job listing, and `job` itself loads asynchronously
  // after this state's initial value is fixed — capturing them here would
  // freeze on whatever `job` was (usually still null) at first render and
  // never update. handleApply reads them straight from `job` instead,
  // by which point its own `if (!job) return` guard has already confirmed
  // it's loaded.
  const [applicantData, setApplicantData] = useState({
    name: '',
    email: '',
    phone: '',
    dob: '',
    age: '',
    qualification: '',
    experience_band: '',
    prior_org: '',
    current_location: ''
  });

  const handleDobChange = (newDob: string) => {
    if (!newDob) {
      setApplicantData(prev => ({ ...prev, dob: '', age: '' }));
      return;
    }
    const birthDate = new Date(newDob);
    const today = new Date();
    let calculatedAge = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      calculatedAge--;
    }
    setApplicantData(prev => ({ ...prev, dob: newDob, age: calculatedAge > 0 ? calculatedAge.toString() : '0' }));
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicantData.name.trim() || !applicantData.email.trim() || !applicantData.phone.trim()) {
      alert('Please fill out your Name, Email, and WhatsApp Phone number.');
      return;
    }

    if (!job) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // The job being applied to already carries its own school_id — a
          // hardcoded default here meant every applicant, to any school's
          // posting, silently landed in the seeded demo school's pipeline
          // instead of the school that actually posted the job.
          school_id: job.school_id,
          name: applicantData.name.trim(),
          email: applicantData.email.trim(),
          phone: applicantData.phone.trim(),
          dob: applicantData.dob,
          age: applicantData.age ? parseInt(applicantData.age) : undefined,
          qualification: applicantData.qualification,
          experience_band: applicantData.experience_band,
          prior_org: applicantData.prior_org.trim(),
          current_location: applicantData.current_location,
          applied_subject: job.subject,
          applied_segment: job.segment,
          target_branch_id: job.target_branch_id,
          status: 'in_progress',
          whatsapp_consent: whatsappConsent
        })
      });

      const data = await res.json();
      if (data.candidate?.id) {
        // Vacancy-portal applicants start the test immediately (no invite link required).
        // Invited leads still use WhatsApp / code links from the recruiter workspace.
        router.push(`/candidate/${data.candidate.id}`);
      } else {
        throw new Error(data.error || 'Failed to submit application');
      }
    } catch (err: any) {
      alert(err.message || 'Application submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (jobLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-sm text-slate-500">Loading vacancy…</div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-2 text-sm text-slate-500">
        <p>This vacancy is not available.</p>
        <Link href="/jobs" className="text-indigo-600 font-semibold">Back to teaching jobs</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 py-10 sm:py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/jobs"
            className="text-xs font-bold text-slate-600 hover:text-indigo-600 flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>← Back to Teaching Jobs</span>
          </Link>

          <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            ✓ Actively Hiring
          </span>
        </div>

        {/* Hero Header Card */}
        <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {job.subject}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                  {job.segment}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
                {job.title}
              </h1>
              <div className="flex items-center gap-2 text-sm text-slate-600 font-bold">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>{job.school_name}</span>
                <span>•</span>
                <span className="text-slate-500 font-normal">{job.school_type}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowApplyModal(true)}
              className="brand-primary-btn px-7 py-3.5 rounded-2xl text-xs font-bold shadow-md shadow-indigo-600/25 flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
            >
              <span>Apply for this role</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Campus Location</span>
              <strong className="text-slate-900 font-bold">{job.branch}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Curriculum Board</span>
              <strong className="text-slate-900 font-bold">{job.board}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Experience</span>
              <strong className="text-slate-900 font-bold">{job.experience_required}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">CTC Salary Package</span>
              <strong className="text-emerald-700 font-mono font-bold">{job.salary_range}</strong>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Job Description & Responsibilities */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Overview */}
            <div className="bg-white p-7 rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>About this Teaching Opportunity</span>
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                {job.overview}
              </p>
            </div>

            {/* Key Responsibilities */}
            <div className="bg-white p-7 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-600" />
                <span>Key Pedagogical Responsibilities</span>
              </h2>
              <ul className="space-y-2.5 text-xs text-slate-600">
                {job.responsibilities.map((resp: string, i: number) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span>{resp}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Eligibility & Qualifications */}
            <div className="bg-white p-7 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-indigo-600" />
                <span>Qualifications &amp; Eligibility Criteria</span>
              </h2>
              <ul className="space-y-2.5 text-xs text-slate-600">
                {job.requirements.map((req: string, i: number) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* Right Column: Perks & Assessment Fast-Track Card */}
          <div className="space-y-6">
            
            {/* Compensation & Perks */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <span>Institutional Benefits</span>
              </h3>
              <ul className="space-y-2 text-xs text-slate-700">
                {job.perks.map((perk: string, i: number) => (
                  <li key={i} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 5-Step Evaluation Fast-Track Explainer */}
            <div className="bg-indigo-50/70 p-6 rounded-3xl border border-indigo-200 space-y-4">
              <h3 className="text-sm font-extrabold text-indigo-950 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>How the Hiring Process Works</span>
              </h3>
              <div className="space-y-2.5 text-[11.5px] text-indigo-900">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">1</span>
                  <span>Fill application &amp; upload CV</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">2</span>
                  <span>Write a free-form lesson plan</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">3</span>
                  <span>Record 5-min chalkboard demo</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">4</span>
                  <span>HOD &amp; Principal final clearance</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowApplyModal(true)}
                className="w-full brand-primary-btn py-3 rounded-xl text-xs font-bold shadow-md cursor-pointer text-center block"
              >
                Apply for this Role Now
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* 1-Click Application Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Apply for {job.title}
                </h3>
                <span className="text-xs text-slate-500">{job.school_name} • {job.branch}</span>
              </div>
              <button 
                type="button"
                onClick={() => setShowApplyModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApply} className="space-y-4 text-xs">
              <div className="space-y-3.5">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Priya Nair"
                    value={applicantData.name}
                    onChange={e => setApplicantData({...applicantData, name: e.target.value})}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:border-indigo-600 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. priya.science@gmail.com"
                      value={applicantData.email}
                      onChange={e => setApplicantData({...applicantData, email: e.target.value})}
                      className="w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">WhatsApp Phone *</label>
                    <input
                      type="text"
                      required
                      placeholder="+91 98765 11223"
                      value={applicantData.phone}
                      onChange={e => setApplicantData({...applicantData, phone: e.target.value})}
                      className="w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Date of Birth &amp; Age *</label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        required
                        value={applicantData.dob}
                        onChange={e => handleDobChange(e.target.value)}
                        className="w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:border-indigo-600 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={applicantData.age ? `Age: ${applicantData.age}` : 'Age: —'}
                        readOnly
                        className="w-24 p-3 rounded-xl bg-slate-100 border border-slate-200 text-indigo-700 font-bold text-center text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Highest Qualification *</label>
                    <select
                      required
                      value={applicantData.qualification}
                      onChange={e => setApplicantData({...applicantData, qualification: e.target.value})}
                      className="w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:border-indigo-600 focus:outline-none"
                    >
                      <option value="" disabled>Select your qualification…</option>
                      <option value="M.Sc + B.Ed (Post Graduate)">M.Sc + B.Ed (Post Graduate)</option>
                      <option value="B.Sc + B.Ed (Graduate Teacher)">B.Sc + B.Ed (Graduate Teacher)</option>
                      <option value="M.A + B.Ed (Literature / Social)">M.A + B.Ed (Literature / Social)</option>
                      <option value="B.A + B.Ed">B.A + B.Ed</option>
                      <option value="Ph.D / Doctorate">Ph.D / Doctorate in Subject</option>
                      <option value="B.Tech + B.Ed">B.Tech + B.Ed (Computer Science)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Teaching Experience *</label>
                  <select
                    required
                    value={applicantData.experience_band}
                    onChange={e => setApplicantData({...applicantData, experience_band: e.target.value})}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:border-indigo-600 focus:outline-none"
                  >
                    <option value="" disabled>Select your experience…</option>
                    <option value="Fresher (0 - 1 Year)">Fresher (0 - 1 Year)</option>
                    <option value="1 – 2 Years">1 – 2 Years</option>
                    <option value="3 – 5 Years">3 – 5 Years</option>
                    <option value="5 – 8 Years">5 – 8 Years</option>
                    <option value="8+ Years">8+ Years (Senior Faculty / HOD)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Previous School / Organization</label>
                  <input
                    type="text"
                    placeholder="e.g. Delhi Public School, Hyderabad"
                    value={applicantData.prior_org}
                    onChange={e => setApplicantData({...applicantData, prior_org: e.target.value})}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 pt-2 text-[11px] text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={whatsappConsent}
                  onChange={(e) => setWhatsappConsent(e.target.checked)}
                  className="mt-0.5"
                />
                <span>Send me updates about this application on WhatsApp (invite link, reminders, and the outcome). You can reply STOP at any time.</span>
              </label>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="brand-primary-btn px-6 py-3 rounded-xl text-xs font-bold text-white shadow-md cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Profile...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Application &amp; Start Test</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
