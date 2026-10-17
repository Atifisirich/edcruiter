'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Award,
  Briefcase,
  Check,
  Clock,
  FileSpreadsheet,
  Send,
  Users,
  UserRoundCheck,
  Video,
  XCircle,
} from 'lucide-react';

const STEPS = 8;
const STEP_MS = 1600;

function TypeText({
  text,
  playing,
  speed = 28,
}: {
  text: string;
  playing: boolean;
  speed?: number;
}) {
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
        <span className="inline-block w-[1px] h-[0.9em] bg-current align-[-1px] ml-0.5 animate-pulse" />
      )}
    </span>
  );
}

function CountUp({ value, playing, className }: { value: number; playing: boolean; className?: string }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!playing) {
      setN(0);
      return;
    }
    const start = performance.now();
    const dur = 900;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      setN(Math.round(value * t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, playing]);

  return <span className={className}>{n}</span>;
}

export default function HeroProductCard() {
  const [step, setStep] = useState(1);
  const [paused, setPaused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    setMounted(true);
    setReduce(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    if (!mounted || reduce || paused) return;
    const timer = window.setInterval(() => {
      setStep((s) => (s >= STEPS - 1 ? 1 : s + 1));
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [mounted, reduce, paused]);

  const live = reduce ? STEPS : step;
  const show = (n: number) => live >= n;

  return (
    <div
      className="w-full max-w-[400px] mx-auto lg:mx-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <p className="text-[11px] font-bold text-slate-600 min-h-[36px] mb-3">
        <TypeText
          playing={mounted}
          text={
            live < 2
              ? 'Creating PGT Physics vacancy and posting it to the jobs board...'
              : live < 4
                ? 'Leads uploaded. Sending WhatsApp test codes now...'
                : live < 6
                  ? 'Teacher on the five-stage AI proctored test...'
                  : 'Shortlist ready. Principal interview next...'
          }
          speed={18}
        />
      </p>

      <div className="relative font-sans text-[11px] flex flex-col items-center">
        <AnimatePresence>
          {show(1) && (
            <motion.div
              key="vacancy"
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="w-full flex justify-center z-10"
            >
              <div className="px-3.5 py-2 rounded-xl bg-sky-50 border-2 border-sky-400 text-sky-950 font-bold flex items-center gap-2 shadow-sm">
                <div className="w-5 h-5 rounded-md bg-sky-600 text-white flex items-center justify-center">
                  <Briefcase className="w-3 h-3" />
                </div>
                <span>Create vacancy &amp; post it live</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {show(2) && (
          <>
            <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} className="w-0.5 h-4 bg-slate-400 origin-top" />
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-white p-3 rounded-2xl border border-slate-300 shadow-sm space-y-2 z-10"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center">
                    <FileSpreadsheet className="w-3 h-3" />
                  </div>
                  <div>
                    <strong className="text-slate-900 block font-bold text-[11px]">Add teacher leads</strong>
                    <span className="text-[9px] text-slate-500 font-medium">Excel roster · Recruiter workspace</span>
                  </div>
                </div>
                {show(3) && (
                  <span className="font-mono font-black text-indigo-600 text-xs">
                    <CountUp value={5} playing={show(3)} /> leads
                  </span>
                )}
              </div>

              {show(3) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="grid grid-cols-2 gap-1.5 pt-0.5"
                >
                  <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-300 text-center">
                    <span className="text-[10px] font-bold text-emerald-800 flex items-center justify-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" /> Priya · Physics
                    </span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-violet-50 border border-violet-200 text-center">
                    <span className="text-[10px] font-bold text-violet-800 flex items-center justify-center gap-1">
                      <Users className="w-3 h-3 text-violet-600" /> 4 more imported
                    </span>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </>
        )}

        {show(4) && (
          <>
            <div className="w-full grid grid-cols-2 gap-3 h-4">
              <div className="flex justify-center">
                <div className="w-0.5 h-full bg-emerald-500" />
              </div>
              <div className="flex justify-center">
                <div className="w-0.5 h-full bg-amber-400" />
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full grid grid-cols-2 gap-3 z-10"
            >
              <div className="p-2 bg-white rounded-xl border-2 border-emerald-400 shadow-sm space-y-1.5">
                <div className="flex items-center gap-1">
                  <Send className="w-3 h-3 text-emerald-600" />
                  <strong className="text-slate-900 text-[10px]">WhatsApp test invite</strong>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                  {live >= 5 ? 'Code sent' : 'Sending...'}
                </span>
              </div>
              <div className="space-y-1">
                <div className="p-1.5 bg-amber-50 rounded-lg border border-amber-200 flex items-center gap-1 text-[9px] text-amber-800 font-bold">
                  <Clock className="w-3 h-3 text-amber-600" />
                  <span>Queued reminder</span>
                </div>
                <div className="p-1.5 bg-rose-50 rounded-lg border border-rose-200 flex items-center gap-1 text-[9px] text-rose-700 font-bold">
                  <XCircle className="w-3 h-3 text-rose-500" />
                  <span>Hold · no code yet</span>
                </div>
              </div>
            </motion.div>
          </>
        )}

        {show(5) && (
          <>
            <div className="w-full flex justify-start pl-[25%] h-4">
              <div className="w-0.5 h-full bg-emerald-500" />
            </div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-white p-2.5 rounded-2xl border-2 border-pink-300 shadow-sm flex items-center justify-between z-10 gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-5 h-5 rounded-md bg-pink-500 text-white flex items-center justify-center shrink-0">
                  <Video className="w-3 h-3" />
                </div>
                <span className="font-bold text-slate-900 text-[10px] leading-tight">Five-stage AI proctored test</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[9px] font-bold shrink-0 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                {live >= 6 ? 'Completed' : 'Live'}
              </span>
            </motion.div>
          </>
        )}

        {show(6) && (
          <>
            <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} className="w-0.5 h-4 bg-violet-400 origin-top" />
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full grid grid-cols-2 gap-2 z-10"
            >
              <div className="p-2 rounded-xl bg-emerald-50 border-2 border-emerald-400 shadow-sm">
                <div className="flex items-center gap-1 mb-1">
                  <Award className="w-3 h-3 text-emerald-600" />
                  <strong className="text-[10px] text-slate-900">Shortlist</strong>
                </div>
                <span className="text-[9px] font-bold text-emerald-800">Priya 94% · Rahul 88%</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[9px] font-bold text-slate-500">Hold below 80%</span>
                <p className="text-[10px] font-bold text-slate-700 mt-0.5">Ananya · Rajesh</p>
              </div>
            </motion.div>
          </>
        )}

        {show(7) && (
          <>
            <div className="w-full flex justify-start pl-[25%] h-4">
              <div className="w-0.5 h-full bg-indigo-400" />
            </div>
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="w-full p-2.5 bg-indigo-50 border-2 border-indigo-300 rounded-2xl flex items-center justify-between shadow-sm gap-2"
            >
              <span className="text-[10px] font-bold text-indigo-950 flex items-center gap-1.5">
                <UserRoundCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Principal interview</span>
              </span>
              <span className="text-[9px] text-indigo-700 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-indigo-200 shrink-0">
                Subject lead → Principal
              </span>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
