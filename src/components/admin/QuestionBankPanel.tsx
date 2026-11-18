'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, CheckCircle2, Loader2, Search } from 'lucide-react';
import type { CatalogQuestion, SubjectSummary } from '@/lib/bankCatalog';
import { ENOUGH_FOR_A_DRAW } from '@/lib/bankCatalog';

function gradeName(g: string): string {
  if (g === '*') return 'All grades';
  if (/^\d+$/.test(g)) return `Grade ${g}`;
  return g.toUpperCase();
}

/** Green: enough for every candidate's own random draw. Amber: some, not enough yet. */
function readiness(count: number): { label: string; cls: string } {
  if (count >= ENOUGH_FOR_A_DRAW) return { label: 'Ready', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (count > 0) return { label: 'Too few', cls: 'bg-amber-50 text-amber-800 border-amber-200' };
  return { label: 'Empty', cls: 'bg-slate-50 text-slate-500 border-slate-200' };
}

/**
 * The platform question bank, read-only: subject, then grade, then every
 * question by topic with its answer. Candidates each get their own random
 * draw from here, so this is what a school's test can contain.
 */
export default function QuestionBankPanel({ schoolId }: { schoolId: string }) {
  const [subjects, setSubjects] = useState<SubjectSummary[] | null>(null);
  const [error, setError] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [questions, setQuestions] = useState<CatalogQuestion[] | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [search, setSearch] = useState('');
  const [showAnswers, setShowAnswers] = useState(true);

  useEffect(() => {
    fetch(`/api/question-bank?school_id=${encodeURIComponent(schoolId)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || `Could not load the question bank (${r.status}).`);
        const list: SubjectSummary[] = d.subjects || [];
        setSubjects(list);
        const first = list.find((s) => s.total > 0);
        if (first) {
          setSubject(first.key);
          setGrade(first.grades[0]?.grade || '');
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the question bank.'));
  }, [schoolId]);

  useEffect(() => {
    if (!subject || !grade) return;
    let cancelled = false;
    const start = window.setTimeout(() => {
      setLoadingQuestions(true);
      fetch(`/api/question-bank?school_id=${encodeURIComponent(schoolId)}&subject=${encodeURIComponent(subject)}&grade=${encodeURIComponent(grade)}`)
        .then(async (r) => {
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || 'Could not load these questions.');
          if (!cancelled) setQuestions(d.questions || []);
        })
        .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load these questions.'); })
        .finally(() => { if (!cancelled) setLoadingQuestions(false); });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(start); };
  }, [schoolId, subject, grade]);

  const current = subjects?.find((s) => s.key === subject);
  const total = subjects?.reduce((n, s) => n + s.total, 0) ?? 0;

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (questions || []).filter((x) =>
      !q || `${x.question} ${x.answer} ${x.wrong.join(' ')} ${x.topic}`.toLowerCase().includes(q)
    );
    const byTopic = new Map<string, CatalogQuestion[]>();
    for (const x of list) byTopic.set(x.topic, [...(byTopic.get(x.topic) || []), x]);
    return { count: list.length, topics: [...byTopic.entries()] };
  }, [questions, search]);

  if (error && !subjects) {
    return <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-sm text-rose-700">{error}</div>;
  }
  if (!subjects) {
    return <div className="p-10 flex justify-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-sm text-slate-700 flex gap-3">
        <BookOpenCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <p>
          <strong className="text-slate-900">{total.toLocaleString('en-IN')} questions</strong> written and checked by Edcruiter.
          Every candidate gets their own random {ENOUGH_FOR_A_DRAW} subject questions for their grades, plus 5 on teaching practice, so no two papers match.
          Where a grade shows <em>Too few</em> or <em>Empty</em>, candidates take your school&apos;s own AI test (the School tests tab) instead.
          Only your admin and HR can see this page.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <nav aria-label="Subjects" className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-3 shadow-sm">
          <ul className="space-y-1">
            {subjects.map((s) => {
              const ready = s.grades.filter((g) => g.count >= ENOUGH_FOR_A_DRAW).length;
              const active = s.key === subject;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => { setSubject(s.key); setGrade(s.grades[0]?.grade || ''); setQuestions(null); setSearch(''); }}
                    className={`w-full text-left px-3 py-2.5 rounded-2xl border text-sm cursor-pointer ${
                      active ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{s.label}</span>
                      <span className="text-xs font-semibold text-slate-500">{s.total.toLocaleString('en-IN')}</span>
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      {s.total === 0 ? 'No questions yet' : s.key === 'pedagogy' ? 'Used in every subject' : `${ready} of ${s.grades.length} grades ready`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4 min-w-0">
          {!current || current.total === 0 ? (
            <p className="text-sm text-slate-500">{current ? `${current.label} has no questions yet. Candidates for it take your school's own AI test.` : 'Choose a subject.'}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Grades">
                {current.grades.map((g) => {
                  const r = readiness(g.count);
                  const active = g.grade === grade;
                  return (
                    <button
                      key={g.grade}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => { setGrade(g.grade); setSearch(''); }}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                        active ? 'bg-indigo-600 border-indigo-600 text-white' : r.cls
                      }`}
                      title={`${g.count} questions over ${g.topics} topics · ${r.label}`}
                    >
                      {gradeName(g.grade)} · {g.count}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[12rem]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search questions, answers or topics"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                    aria-label="Search questions"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} className="accent-indigo-600" />
                  Show answers
                </label>
              </div>

              {loadingQuestions || !questions ? (
                <div className="p-8 flex justify-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : grouped.count === 0 ? (
                <p className="text-sm text-slate-500">No questions match.</p>
              ) : (
                <div className="space-y-5">
                  <p className="text-xs text-slate-500">
                    {grouped.count} {grouped.count === 1 ? 'question' : 'questions'} in {grouped.topics.length} {grouped.topics.length === 1 ? 'topic' : 'topics'}
                  </p>
                  {grouped.topics.map(([topic, list]) => (
                    <div key={topic} className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-indigo-700">{topic} <span className="text-slate-400 font-semibold">· {list.length}</span></h3>
                      <ol className="space-y-2">
                        {list.map((q) => (
                          <li key={q.id} className={`p-3 rounded-xl border text-sm ${q.retired ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-slate-50 border-slate-100'}`}>
                            <p className="font-medium text-slate-900 whitespace-pre-line">{q.question}</p>
                            <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {[q.answer, ...q.wrong].sort().map((o) => {
                                const right = showAnswers && o === q.answer;
                                return (
                                  <li key={o} className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-start gap-1.5 ${right ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold' : 'bg-white border-slate-200 text-slate-700'}`}>
                                    {right && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-px" />}
                                    <span>{o}</span>
                                  </li>
                                );
                              })}
                            </ul>
                            {showAnswers && q.explanation && <p className="mt-2 text-xs text-slate-600">{q.explanation}</p>}
                            <p className="mt-1.5 text-[11px] text-slate-400">
                              {q.id} · {q.used === 0 ? 'not used yet' : `given to ${q.used} ${q.used === 1 ? 'candidate' : 'candidates'}`}{q.retired ? ' · retired' : ''}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
