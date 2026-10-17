'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  FileSpreadsheet,
  LayoutGrid,
  Sparkles,
  User,
  Users,
  Video,
} from 'lucide-react';

type SceneId =
  | 'wipe-job'
  | 'job'
  | 'wipe-added'
  | 'upload'
  | 'wipe-invite'
  | 'invite'
  | 'wipe-join'
  | 'join'
  | 'assessment'
  | 'wipe-report'
  | 'report'
  | 'wipe-shortlist'
  | 'shortlist'
  | 'wipe-human'
  | 'human'
  | 'wipe-loop';

const SCRIPT: { id: SceneId; duration: number; title: string; wipe?: [string, string] }[] = [
  { id: 'wipe-job', duration: 2600, title: '', wipe: ['Create a vacancy', 'and post it'] },
  { id: 'job', duration: 9200, title: 'Create & post vacancy' },
  { id: 'wipe-added', duration: 2800, title: '', wipe: ['Add leads', 'to the vacancy'] },
  { id: 'upload', duration: 7800, title: 'Add leads' },
  { id: 'wipe-invite', duration: 2800, title: '', wipe: ['WhatsApp invites', 'are sent'] },
  { id: 'invite', duration: 5900, title: 'WhatsApp invites' },
  { id: 'wipe-join', duration: 2800, title: '', wipe: ['The teacher', 'opens the test'] },
  { id: 'join', duration: 4500, title: 'Teacher sign-in' },
  { id: 'assessment', duration: 18000, title: 'Five-stage AI test' },
  { id: 'wipe-report', duration: 2800, title: '', wipe: ['Reports reach', 'the school'] },
  { id: 'report', duration: 6700, title: 'Teacher report' },
  { id: 'wipe-shortlist', duration: 2800, title: '', wipe: ['Teachers get', 'shortlisted'] },
  { id: 'shortlist', duration: 5900, title: 'Shortlist' },
  { id: 'wipe-human', duration: 2800, title: '', wipe: ['Principal', 'meets the teacher'] },
  { id: 'human', duration: 6200, title: 'Principal interview' },
  { id: 'wipe-loop', duration: 2400, title: '', wipe: ['Create a vacancy', 'Start again'] },
];

const CANDIDATES = [
  { name: 'Dr. Priya Nair', role: 'PGT Physics', phone: '+91 98765 11223', score: '94%', shortlist: true },
  { name: 'Rahul Krishnan', role: 'TGT Maths', phone: '+91 98765 22334', score: '88%', shortlist: true },
  { name: 'Kavita Deshmukh', role: 'PGT Biology', phone: '+91 98765 33445', score: '81%', shortlist: true },
  { name: 'Ananya Sharma', role: 'PGT Chemistry', phone: '+91 98765 88990', score: '76%', shortlist: false },
  { name: 'Rajesh Varma', role: 'TGT Physics', phone: '+91 98765 99001', score: '69%', shortlist: false },
];

const ASSESS_STAGES = [
  { key: 'identity_verification', short: 'Identity & CV' },
  { key: 'written_theory', short: 'Written / Theory' },
  { key: 'micro_teaching_demo', short: 'Teaching Demo' },
  { key: 'situational_scenario', short: 'Scenarios' },
  { key: 'hr_policy_briefing', short: 'HR Policies' },
] as const;

const windowVariants = {
  enter: { scale: 0.22, y: 90, x: 48, rotate: 7, opacity: 0, filter: 'blur(8px)' },
  center: {
    scale: 1,
    y: 0,
    x: 0,
    rotate: 0,
    opacity: 1,
    filter: 'blur(0px)',
    transition: { type: 'spring' as const, stiffness: 260, damping: 16, mass: 0.72 },
  },
  exit: {
    scale: 0.18,
    y: -28,
    x: -110,
    rotate: -8,
    opacity: 0,
    filter: 'blur(6px)',
    transition: { duration: 0.42, ease: [0.4, 0, 0.2, 1] as const },
  },
};

function TypeText({ text, playing, speed = 22 }: { text: string; playing: boolean; speed?: number }) {
  const [shown, setShown] = useState('');

  useEffect(() => {
    if (!playing) {
      setShown('');
      return;
    }
    setShown('');
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(timer);
    }, speed);
    return () => window.clearInterval(timer);
  }, [text, playing, speed]);

  return (
    <span>
      {shown}
      {playing && shown.length < text.length && (
        <span className="inline-block w-[1px] h-[0.85em] bg-current align-[-1px] ml-0.5 animate-pulse" />
      )}
    </span>
  );
}

function KineticTitle({ line1, line2 }: { line1: string; line2: string }) {
  const words = [...line1.split(' '), ...line2.split(' ')];
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#0c101d]">
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-indigo-600/40 via-transparent to-pink-500/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className="absolute left-0 top-0 h-full w-1/3 bg-white/20"
        initial={{ x: '-120%' }}
        animate={{ x: '420%' }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      />
      <div className="relative px-6 text-center">
        <div className="flex flex-wrap justify-center gap-x-2.5 gap-y-1">
          {words.map((word, i) => (
            <motion.span
              key={`${word}-${i}`}
              initial={{ y: 56, opacity: 0, rotateX: 70, filter: 'blur(10px)' }}
              animate={{ y: 0, opacity: 1, rotateX: 0, filter: 'blur(0px)' }}
              exit={{ y: -36, opacity: 0, filter: 'blur(8px)' }}
              transition={{ delay: 0.08 + i * 0.09, type: 'spring', stiffness: 320, damping: 18 }}
              className="text-2xl sm:text-4xl font-black tracking-tight text-white"
            >
              {word}
            </motion.span>
          ))}
        </div>
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.45 }}
          className="mx-auto mt-4 h-1 w-24 origin-left rounded-full bg-indigo-400"
        />
      </div>
    </div>
  );
}

function PointerCursor({ x, y, clicking = false }: { x: number; y: number; clicking?: boolean }) {
  return (
    <motion.div
      className="absolute left-0 top-0 z-30 pointer-events-none drop-shadow-md"
      initial={false}
      animate={{ x, y, scale: clicking ? 0.78 : 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
        <path
          d="M5 3.5l14.5 8.2-6.4 1.2-2.6 7.2L5 3.5z"
          fill="#0f172a"
          stroke="#fff"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </motion.div>
  );
}

function aimAt(
  container: HTMLElement | null,
  target: HTMLElement | null,
): { x: number; y: number } {
  if (!container || !target) return { x: 24, y: 24 };
  const c = container.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  return {
    x: t.left - c.left + t.width * 0.65,
    y: t.top - c.top + t.height * 0.55,
  };
}

function LiveCallTile({
  name,
  role,
  initials,
  speaking,
  rec,
}: {
  name: string;
  role: string;
  initials: string;
  speaking?: boolean;
  rec?: string;
}) {
  return (
    <div className="relative h-full min-h-[168px] overflow-hidden rounded-2xl bg-[#0b1220] border border-slate-800">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(79,70,229,0.28),transparent_58%)]" />
      <div className="absolute inset-0 opacity-[0.12] bg-[linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[length:100%_7px] animate-pulse" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-3 text-center">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-black text-white shadow-lg ${
            speaking ? 'bg-indigo-500 ring-4 ring-indigo-400/40' : 'bg-slate-600'
          }`}
        >
          <User className="h-7 w-7" />
        </div>
        <p className="mt-2 text-[12px] font-black text-white">{name}</p>
        <p className="text-[10px] font-semibold text-slate-400">{role}</p>
        {speaking && (
          <div className="mt-2 flex h-5 items-end gap-[3px]">
            {[8, 16, 11, 18, 9].map((h, i) => (
              <motion.span
                key={i}
                className="w-[3px] rounded-full bg-emerald-400"
                animate={{ height: [6, h, 7, h - 4, 6] }}
                transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.08 }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-bold text-white">
        {rec ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
            REC {rec}
          </>
        ) : (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {speaking ? 'Speaking' : 'Muted'}
          </>
        )}
      </div>
      <span className="absolute right-2 top-2 text-[9px] font-black text-white/80">{initials}</span>
    </div>
  );
}

function WindowChrome({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50">
      <div className="flex items-center gap-2">
        <div className="flex gap-1 mr-1">
          <span className="w-2 h-2 rounded-full bg-rose-400" />
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
        </div>
        <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center">
          E
        </div>
        <div>
          <p className="text-[11px] font-black text-slate-900 leading-none">
            <span className="text-indigo-600">Ed</span>cruiter workspace
          </p>
          <p className="text-[9px] text-slate-500 font-medium">
            {title || 'Recruiter workspace'}
          </p>
        </div>
      </div>
      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Live session
      </span>
    </div>
  );
}

export default function HeroWorkspaceCard() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const scene = SCRIPT[index];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % SCRIPT.length);
    }, scene.duration);
    return () => window.clearTimeout(timer);
  }, [mounted, paused, index, scene.duration]);

  const isWipe = Boolean(scene.wipe);

  return (
    <div
      className="hero-product-frame relative w-full max-w-4xl mx-auto"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="hero-product-beam" aria-hidden />

      <div className="relative rounded-[22px] overflow-hidden bg-[#eef2ff]">
        <div className="hero-mesh-layer" aria-hidden />

        <div className="relative z-10 p-3 sm:p-4">
          <div className="relative min-h-[420px] sm:min-h-[480px] rounded-2xl overflow-hidden border border-white/80 shadow-xl bg-white/40">
            <AnimatePresence mode="wait">
              {isWipe && scene.wipe ? (
                <motion.div
                  key={scene.id}
                  className="absolute inset-0"
                  initial={{ clipPath: 'inset(0 100% 0 0)' }}
                  animate={{ clipPath: 'inset(0 0% 0 0)' }}
                  exit={{ clipPath: 'inset(0 0 0 100%)' }}
                  transition={{ duration: 0.45, ease: [0.76, 0, 0.24, 1] }}
                >
                  <KineticTitle line1={scene.wipe[0]} line2={scene.wipe[1]} />
                </motion.div>
              ) : (
                <motion.div
                  key={scene.id}
                  variants={windowVariants}
                  initial={mounted ? 'enter' : false}
                  animate="center"
                  exit="exit"
                  className="absolute inset-0 origin-bottom-right overflow-hidden rounded-2xl border border-white bg-white/95 shadow-2xl"
                  style={{ transformPerspective: 900 }}
                >
                  <WindowChrome title={scene.title} />
                  <div className="p-3 sm:p-4 h-[calc(100%-42px)] overflow-hidden">
                    {scene.id === 'job' && <JobsPanel playing={mounted} />}
                    {scene.id === 'upload' && <UploadPanel playing={mounted} />}
                    {scene.id === 'invite' && <InvitePanel playing={mounted} />}
                    {scene.id === 'join' && <JoinPanel playing={mounted} />}
                    {scene.id === 'assessment' && <AssessmentPanel playing={mounted} />}
                    {scene.id === 'report' && <ReportPanel playing={mounted} />}
                    {scene.id === 'shortlist' && <ShortlistPanel playing={mounted} />}
                    {scene.id === 'human' && <HumanInterviewPanel playing={mounted} />}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function JobsPanel({ playing }: { playing: boolean }) {
  const [phase, setPhase] = useState(0);
  const [clicking, setClicking] = useState(false);
  const [cursor, setCursor] = useState({ x: 28, y: 40 });
  const boxRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const salaryRef = useRef<HTMLDivElement>(null);
  const generateRef = useRef<HTMLButtonElement>(null);
  const postRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!playing) return;
    setPhase(0);
    const timers = [200, 1400, 2800, 4200, 5600, 7200, 8400].map((ms, i) =>
      window.setTimeout(() => setPhase(i + 1), ms),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [playing]);

  useLayoutEffect(() => {
    const targets = [titleRef, titleRef, salaryRef, generateRef, generateRef, postRef, postRef, postRef];
    const place = () => {
      const target = targets[Math.min(phase, targets.length - 1)]?.current ?? null;
      setCursor(aimAt(boxRef.current, target));
      setClicking(phase === 4 || phase === 6);
    };
    place();
    const id = window.requestAnimationFrame(place);
    return () => window.cancelAnimationFrame(id);
  }, [phase]);

  return (
    <div ref={boxRef} className="relative h-full overflow-hidden">
      <PointerCursor x={cursor.x} y={cursor.y} clicking={clicking} />
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-black text-slate-900">Create vacancy &amp; post it</h3>
        </div>
        <p className="text-[10px] text-slate-500">Generate the JD in Recruiter, then post it live on the teaching jobs board.</p>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <label className="space-y-1">
            <span className="text-[9px] font-bold text-slate-500 uppercase">Position</span>
            <div
              ref={titleRef}
              className={`p-2 rounded-xl border font-bold min-h-[34px] ${phase >= 1 ? 'bg-indigo-50 border-indigo-300 text-slate-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
            >
              {phase >= 1 ? <TypeText playing={playing} text="Senior PGT Physics Faculty" speed={18} /> : 'Role title'}
            </div>
          </label>
          <label className="space-y-1">
            <span className="text-[9px] font-bold text-slate-500 uppercase">CTC / Campus</span>
            <div
              ref={salaryRef}
              className={`p-2 rounded-xl border font-bold min-h-[34px] ${phase >= 2 ? 'bg-indigo-50 border-indigo-300 text-slate-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
            >
              {phase >= 2 ? '₹7.8–9.5 LPA · Manneguda' : 'Salary & campus'}
            </div>
          </label>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500">CBSE &amp; Cambridge · 3–6 yrs · B.Ed + CTET</span>
          <button
            type="button"
            ref={generateRef}
            className={`brand-primary-btn px-3 py-1.5 rounded-lg text-[10px] font-bold ${phase === 3 || phase === 4 ? 'ring-2 ring-offset-1 ring-indigo-400' : ''}`}
          >
            {phase >= 5 ? 'Generated' : 'Generate with AI'}
          </button>
        </div>
        {phase >= 5 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[10px] space-y-1">
              <p className="font-black text-slate-900">Vacancy ready</p>
              <p className="text-slate-600">JD, MCQs, and 5-stage test are attached. Next: post it so teachers can apply.</p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Live on /jobs for this school</span>
              <button
                type="button"
                ref={postRef}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold ${
                  phase >= 7 ? 'bg-indigo-600 text-white' : 'brand-primary-btn'
                } ${phase === 6 ? 'ring-2 ring-offset-1 ring-indigo-400' : ''}`}
              >
                {phase >= 7 ? 'Posted · Live on jobs board' : 'Post vacancy'}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function UploadPanel({ playing }: { playing: boolean }) {
  const [stage, setStage] = useState<'drop' | 'list'>('drop');

  useEffect(() => {
    if (!playing) return;
    setStage('drop');
    const timer = window.setTimeout(() => setStage('list'), 1400);
    return () => window.clearTimeout(timer);
  }, [playing]);

  return (
    <div className="h-full">
      <AnimatePresence mode="wait">
        {stage === 'drop' ? (
          <motion.div
            key="drop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            className="relative h-[250px] rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/70 overflow-hidden flex items-center justify-center"
          >
            <div className="text-center space-y-1">
              <FileSpreadsheet className="w-8 h-8 text-indigo-500 mx-auto" />
              <p className="text-[11px] font-black text-slate-800">Drop Excel roster here</p>
              <p className="text-[9px] text-slate-500">.xlsx · up to 200 educator rows</p>
            </div>
            <motion.div
              initial={{ y: -160, x: 40, rotate: -22, opacity: 0, scale: 0.7 }}
              animate={{ y: 18, x: 0, rotate: 0, opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 180, damping: 12, delay: 0.2 }}
              className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-xl bg-white border border-emerald-200 shadow-lg px-3 py-2"
            >
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="text-[11px] font-black text-slate-900">Teacher_CV_Roster.xlsx</p>
                <p className="text-[9px] text-slate-500">5 faculty rows · Physics vacancy</p>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1.5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-black text-slate-900">Candidates added to the job</h3>
              <span className="text-[9px] font-bold text-indigo-700">5 imported</span>
            </div>
            {CANDIDATES.map((row, i) => (
              <motion.div
                key={row.name}
                initial={{ y: -70, scale: 1.45, opacity: 0, rotate: -4 }}
                animate={{ y: 0, scale: [1.45, 1.12, 0.94, 1], opacity: 1, rotate: 0 }}
                transition={{
                  delay: i * 0.16,
                  duration: 0.48,
                  times: [0, 0.45, 0.78, 1],
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-white text-[11px] shadow-sm"
              >
                <div>
                  <p className="font-bold text-slate-900">{row.name}</p>
                  <p className="text-[9px] text-slate-500">{row.role}</p>
                </div>
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Added</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InvitePanel({ playing }: { playing: boolean }) {
  const [sent, setSent] = useState(0);

  useEffect(() => {
    if (!playing) return;
    setSent(0);
    const timers = CANDIDATES.map((_, i) => window.setTimeout(() => setSent(i + 1), 280 + i * 420));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [playing]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 h-full">
      <div className="rounded-2xl bg-[#075e54] text-white p-3 space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-200">WhatsApp · Sample School</p>
        <div className="rounded-xl bg-[#128c7e] p-2.5 text-[10px] leading-relaxed space-y-1">
          <p className="font-black">Teacher Assessment Invitation</p>
          <p className="text-emerald-50">
            Complete your 5-stage proctored evaluation for <strong>Senior PGT Physics</strong> (Manneguda).
          </p>
          <p className="font-mono text-[9px] bg-black/20 rounded-lg px-2 py-1">👉 edcruiter.ai/candidate/priya</p>
          <p className="text-emerald-100">30 mins · 5-min video demo &amp; lesson plan</p>
        </div>
      </div>
      <div className="space-y-1.5">
        {CANDIDATES.map((row, i) => (
          <motion.div
            key={row.name}
            animate={sent > i ? { scale: [1.12, 1], backgroundColor: '#ecfdf5' } : { scale: 1 }}
            className="flex items-center justify-between p-2 rounded-xl border border-slate-200 text-[11px]"
          >
            <div>
              <p className="font-bold text-slate-900">{row.name}</p>
              <p className="text-[9px] text-slate-500">{row.phone}</p>
            </div>
            {sent > i ? (
              <span className="text-[9px] font-bold text-emerald-700">Sent</span>
            ) : (
              <span className="text-[9px] font-bold text-slate-400">Queued</span>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function McqPanel({ playing }: { playing: boolean }) {
  const [phase, setPhase] = useState(0);
  const [clicking, setClicking] = useState(false);
  const [cursor, setCursor] = useState({ x: 40, y: 40 });
  const boxRef = useRef<HTMLDivElement>(null);
  const optionRef = useRef<HTMLButtonElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const options = [
    'Rote formula repetition and speed drills',
    'Dual-concept diagrams and Socratic counter-examples',
    'Skip foundations and jump to advanced numericals',
    'Extra homework without in-class debrief',
  ];

  useEffect(() => {
    if (!playing) return;
    setPhase(0);
    const timers = [400, 1400, 2200, 3200, 4000].map((ms, i) => window.setTimeout(() => setPhase(i + 1), ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [playing]);

  useLayoutEffect(() => {
    const place = () => {
      const target = phase <= 2 ? optionRef.current : submitRef.current;
      setCursor(aimAt(boxRef.current, target));
      setClicking(phase === 2 || phase === 4);
    };
    place();
    const id = window.requestAnimationFrame(place);
    return () => window.cancelAnimationFrame(id);
  }, [phase]);

  const selected = phase >= 2 ? 1 : -1;
  const submitted = phase >= 4;

  return (
    <div ref={boxRef} className="relative rounded-xl border border-slate-200 bg-white p-3">
      <PointerCursor x={cursor.x} y={cursor.y} clicking={clicking} />
      <p className="text-[9px] font-bold uppercase text-orange-500 mb-1">Written / Theory · MCQ 1 of 12</p>
      <p className="text-[11px] font-black text-slate-900 leading-snug mb-2">
        Which pedagogical strategy is most effective for remediating Physics misconceptions in Grade 10?
      </p>
      <div className="space-y-1.5">
        {options.map((opt, i) => (
          <button
            type="button"
            key={opt}
            ref={i === 1 ? optionRef : undefined}
            className={`w-full text-left flex items-start gap-2 rounded-lg border px-2 py-1.5 text-[10px] font-semibold ${
              selected === i
                ? 'border-indigo-400 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-300'
                : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            <span className="font-black">{String.fromCharCode(65 + i)}.</span>
            <span>{opt}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          ref={submitRef}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold ${
            submitted ? 'bg-emerald-600 text-white' : 'brand-primary-btn'
          } ${phase === 3 || phase === 4 ? 'ring-2 ring-offset-1 ring-indigo-400' : ''}`}
        >
          {submitted ? 'Submitted · 1/1 correct' : 'Submit answer'}
        </button>
      </div>
    </div>
  );
}

function JoinPanel({ playing }: { playing: boolean }) {
  return (
    <div className="space-y-3">
      <p className="text-[9px] font-bold uppercase text-slate-400">Candidate opens the WhatsApp link</p>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center justify-center">E</div>
          <div>
            <p className="text-[11px] font-black text-slate-900">Enter your 5-stage proctored evaluation</p>
            <p className="text-[9px] text-slate-500">Sample School · Manneguda</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="p-2 rounded-xl bg-white border border-slate-200 font-bold">
            <TypeText playing={playing} text="Dr. Priya Nair" speed={28} />
          </div>
          <div className="p-2 rounded-xl bg-white border border-slate-200 font-bold text-slate-700">Physics</div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Quiet room · webcam · microphone</span>
          <span className="brand-primary-btn px-3 py-1.5 rounded-lg text-[10px] font-bold">Start assessment →</span>
        </div>
      </div>
    </div>
  );
}

function AssessmentPanel({ playing }: { playing: boolean }) {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!playing) return;
    setStep(0);
    setSubmitted(false);
    const timers = [
      window.setTimeout(() => setStep(1), 2200),
      window.setTimeout(() => setStep(2), 7800),
      window.setTimeout(() => setStep(3), 11200),
      window.setTimeout(() => setStep(4), 14600),
    ];
    const submitTimer = window.setTimeout(() => setSubmitted(true), 17000);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(submitTimer);
    };
  }, [playing]);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-bold uppercase text-orange-500">Stage {step + 1} of 5</p>
          <h3 className="text-xs font-black text-slate-900">Dr. Priya Nair · PGT Physics</h3>
        </div>
        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
          {step === 0 ? 'Unproctored setup' : 'Trust 98 · Fullscreen AI'}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {ASSESS_STAGES.map((s, i) => (
          <span
            key={s.key}
            className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
              i === step
                ? 'bg-indigo-600 text-white border-indigo-600'
                : i < step
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}
          >
            {s.short}
          </span>
        ))}
      </div>

      <div>
        {step === 0 && (
          <div className="rounded-xl bg-slate-900 text-white p-3 space-y-2">
            <p className="text-[10px] font-black">1. Basic Identity &amp; PDF CV Upload</p>
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <div className="bg-white/10 rounded-lg p-1.5">M.Sc Physics + B.Ed</div>
              <div className="bg-white/10 rounded-lg p-1.5">4.5 years · DPS</div>
            </div>
            <p className="text-[10px] text-indigo-200">priya_nair_cv.pdf uploaded · Edcruiter AI resume audit running</p>
          </div>
        )}
        {step === 1 && <McqPanel playing={playing} />}
        {step === 2 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-slate-600 inline-flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5 text-indigo-600" />
              AI interview · single teacher on camera
            </p>
            <LiveCallTile
              name="Dr. Priya Nair"
              role="Teaching demo · Faraday’s law"
              initials="PN"
              speaking
              rec="03:42 / 05:00"
            />
          </div>
        )}
        {step === 3 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-slate-600 inline-flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5 text-indigo-600" />
              AI interview · situational scenario
            </p>
            <LiveCallTile
              name="Dr. Priya Nair"
              role="Classroom de-escalation on camera"
              initials="PN"
              speaking
              rec="01:18 / 03:00"
            />
          </div>
        )}
        {step === 4 && (
          <div className="rounded-xl bg-slate-900 text-white p-3 space-y-2">
            <p className="text-[10px] font-black">5. HR Policy Briefing &amp; Code of Conduct</p>
            <div className="space-y-1 text-[10px] text-emerald-200">
              <p>✓ 60-day academic notice period</p>
              <p>✓ Campus hours 7:45 AM – 3:45 PM</p>
              <p>✓ POCSO &amp; child safeguarding zero-tolerance</p>
            </div>
            <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-indigo-500 px-2 py-1 rounded-lg">
              Submit Assessment &amp; View Final Report Card
            </span>
          </div>
        )}
      </div>

      {submitted && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-800 flex items-center gap-2"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Stage saved &amp; submitted. Advancing report to admin…
        </motion.div>
      )}
    </div>
  );
}

function ReportPanel({ playing }: { playing: boolean }) {
  const scores = [
    { label: 'Identity & CV', value: '9.1' },
    { label: 'Written / Theory', value: '9.4' },
    { label: 'Teaching Demo', value: '9.5' },
    { label: 'Scenarios', value: '9.0' },
    { label: 'HR Policies', value: '9.6' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-bold uppercase text-slate-400">Teacher report · Recruiter workspace</p>
          <h3 className="text-xs font-black text-slate-900">Dr. Priya Nair · 360° Report Card</h3>
        </div>
        <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
          9.4 / 10
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {scores.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.08 }}
            className="rounded-xl border border-slate-200 bg-white p-1.5 text-center"
          >
            <span className="block text-[8px] font-bold text-slate-400 leading-tight">{s.label}</span>
            <strong className="text-[12px] text-slate-900">{s.value}</strong>
          </motion.div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 text-[9px] font-bold">
        <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">Trust 98 · Proctor clear</span>
        <span className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200">Danielson L4</span>
        <span className="px-2 py-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-200">B.Ed · CTET Paper 2</span>
      </div>
      <p className="text-[10px] font-bold text-indigo-700">
        <TypeText playing={playing} text="AI recommends shortlist. Ready for principal interview." speed={18} />
      </p>
    </div>
  );
}

function ShortlistPanel({ playing }: { playing: boolean }) {
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (!playing) return;
    setActive(-1);
    const timers = CANDIDATES.map((_, i) => window.setTimeout(() => setActive(i), 220 + i * 380));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [playing]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-black text-slate-900 inline-flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-indigo-600" />
          Campus shortlist · Physics vacancy
        </h3>
        <span className="text-[9px] font-bold text-indigo-700">Filter ≥ 80%</span>
      </div>
      {CANDIDATES.map((row, i) => {
        const isActive = active === i;
        const revealed = active >= i;
        return (
          <motion.div
            key={row.name}
            animate={
              isActive
                ? { scale: 1.08, y: -4, boxShadow: '0 12px 24px rgba(79,70,229,0.18)' }
                : { scale: 1, y: 0, boxShadow: '0 0 0 rgba(0,0,0,0)' }
            }
            transition={{ type: 'spring', stiffness: 380, damping: 16 }}
            className={`flex items-center justify-between p-2 rounded-xl border text-[11px] ${
              revealed && row.shortlist
                ? 'bg-indigo-50 border-indigo-200'
                : revealed
                  ? 'bg-slate-50 border-slate-200 opacity-60'
                  : 'bg-white border-slate-200'
            }`}
          >
            <div>
              <p className="font-bold text-slate-900">{row.name}</p>
              <p className="text-[9px] text-slate-500">{row.role}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-slate-900">{row.score}</span>
              {revealed && (
                <motion.span
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    row.shortlist ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-slate-500'
                  }`}
                >
                  {row.shortlist ? 'Shortlisted' : 'Hold'}
                </motion.span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function HumanInterviewPanel({ playing }: { playing: boolean }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-slate-900 inline-flex items-center gap-1.5">
          <LayoutGrid className="w-4 h-4 text-indigo-600" />
          Leadership interview
        </h3>
        <span className="text-[9px] font-bold text-emerald-700">Thu 4:00 PM · Manneguda</span>
      </div>
      <div className="grid grid-cols-2 gap-2 h-[180px] sm:h-[200px]">
        <LiveCallTile name="Dr. Priya Nair" role="Candidate · PGT Physics" initials="PN" speaking={playing} rec="12:08" />
        <LiveCallTile name="Principal Sharma" role="Interviewer · School leadership" initials="PS" speaking={false} />
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
        <div className="bg-white rounded-lg p-1.5 border border-slate-200">
          <span className="block text-slate-400">Subject lead</span>
          <strong>In room</strong>
        </div>
        <div className="bg-white rounded-lg p-1.5 border border-slate-200">
          <span className="block text-slate-400">Principal</span>
          <strong>Joined</strong>
        </div>
        <div className="bg-white rounded-lg p-1.5 border border-slate-200">
          <span className="block text-slate-400">Board</span>
          <strong>Queued</strong>
        </div>
      </div>
    </div>
  );
}
