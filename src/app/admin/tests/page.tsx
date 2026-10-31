'use client';

import React, { useEffect, useState } from 'react';
import { PageHeader, Badge } from '@/components/admin/ui';
import { Archive, BookOpen, CheckCircle2, Loader2, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { SLOKA_SCHOOL_ID } from '@/lib/defaultData';
import { AssessmentPack } from '@/lib/types';

const SEGMENTS = [
  'Pre-primary (Ages 3–6)',
  'Primary (Grades 1–5)',
  'Middle school (Grades 6–8)',
  'Secondary (Grades 9-10)',
  'Senior secondary (Grades 11–12)'
];
const SUBJECTS = ['Biology', 'Physics', 'Mathematics', 'Chemistry', 'English', 'Computer Science'];
const BOARDS = ['CBSE', 'Cambridge IGCSE', 'ICSE', 'IB', 'State Board'];

export default function AssessmentLibraryPage() {
  const [packs, setPacks] = useState<AssessmentPack[]>([]);
  const [subject, setSubject] = useState('Biology');
  const [segment, setSegment] = useState('Primary (Grades 1–5)');
  const [board, setBoard] = useState('CBSE');
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<AssessmentPack | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'mcqs' | 'lesson' | 'demo' | 'scenario'>('mcqs');
  const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'archived'>('all');

  const schoolId =
    (typeof window !== 'undefined' && localStorage.getItem('edcruiter_school_id')) || SLOKA_SCHOOL_ID;

  const [loadError, setLoadError] = useState('');

  const load = () => {
    // Previously this treated an auth or network failure identically to "no
    // tests exist" — d.packs was undefined either way, so it silently
    // rendered an empty library with no explanation. A generated-and-saved
    // test that then failed to reload for any reason looked exactly like it
    // had never been created.
    fetch(`/api/assessment-packs?school_id=${schoolId}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          setLoadError(d.error || `Could not load the test library (${r.status}).`);
          return;
        }
        setLoadError('');
        setPacks(d.packs || []);
      })
      .catch(() => setLoadError('Could not reach the server to load the test library.'));
  };

  useEffect(() => { load(); }, []);

  const generate = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/assessment-packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: schoolId, subject, segment, board, save: true })
      });
      const data = await res.json();
      if (!res.ok || !data.pack) throw new Error(data.error || 'Could not generate this test');
      setPreview(data.pack);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not generate this test');
    } finally {
      setGenerating(false);
    }
  };

  const setStatus = async (id: string, status: AssessmentPack['status']) => {
    await fetch('/api/assessment-packs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, updates: { status } })
    });
    if (preview?.id === id) setPreview({ ...preview, status });
    load();
  };

  const removePack = async (id: string) => {
    if (!confirm('Remove this test from the school library?')) return;
    await fetch(`/api/assessment-packs?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (preview?.id === id) setPreview(null);
    load();
  };

  const visible = packs.filter((p) => filter === 'all' || p.status === filter);
  const activeCount = packs.filter((p) => p.status === 'active').length;

  return (
    <div>
      <div className="space-y-6">
        <PageHeader
          title="AI tests"
          description="Create a subject test, switch on the ones teachers should take, and archive older versions."
          badge={<Badge tone="indigo">{activeCount} active · {packs.length} in total</Badge>}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-black flex items-center gap-2"><Wand2 className="w-4 h-4 text-indigo-600" /> Create new test</h2>
            <label className="block text-xs font-bold text-slate-600">Grade / sector
              <select value={segment} onChange={(e) => setSegment(e.target.value)} className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                {SEGMENTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="block text-xs font-bold text-slate-600">Subject
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="block text-xs font-bold text-slate-600">Curriculum
              <select value={board} onChange={(e) => setBoard(e.target.value)} className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                {BOARDS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <button type="button" onClick={generate} disabled={generating} className="w-full brand-primary-btn py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? 'Building MCQs and rubrics…' : 'Generate five-stage test'}
            </button>
          </section>

          <section className="lg:col-span-8 space-y-4">
            {loadError && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between gap-3">
                <span>{loadError}</span>
                <button type="button" onClick={load} className="font-bold underline shrink-0">Retry</button>
              </div>
            )}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h2 className="text-sm font-black">Library ({visible.length})</h2>
                <div className="flex flex-wrap gap-1.5">
                  {(['all', 'active', 'draft', 'archived'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border capitalize ${
                        filter === f ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              {visible.length === 0 ? (
                <p className="text-xs text-slate-500">No tests in this filter. Generate one from the left.</p>
              ) : (
                <ul className="space-y-2">
                  {visible.map((p) => (
                    <li key={p.id} className="flex items-stretch gap-2">
                      <button
                        type="button"
                        onClick={() => setPreview(p)}
                        className={`flex-1 text-left p-3 rounded-2xl border text-xs ${
                          preview?.id === p.id ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <span className="font-bold text-slate-900">{p.title}</span>
                        <span className="block text-slate-500 mt-0.5">
                          {p.board} · {p.subject} · {p.mcqs.length} MCQs ·{' '}
                          <span className={p.status === 'active' ? 'text-emerald-700 font-bold' : ''}>{p.status}</span>
                        </span>
                      </button>
                      <div className="flex flex-col gap-1">
                        {p.status !== 'active' && (
                          <button
                            type="button"
                            title="Activate for candidates"
                            onClick={() => setStatus(p.id, 'active')}
                            className="px-2 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold"
                          >
                            Use
                          </button>
                        )}
                        {p.status === 'active' && (
                          <button
                            type="button"
                            title="Archive"
                            onClick={() => setStatus(p.id, 'archived')}
                            className="px-2 py-1.5 rounded-xl bg-slate-50 text-slate-600 border border-slate-200 text-[10px] font-bold inline-flex items-center gap-1"
                          >
                            <Archive className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => removePack(p.id)}
                          className="px-2 py-1.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-bold inline-flex items-center justify-center"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {preview && (
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-black">{preview.title}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {preview.status !== 'active' && (
                      <button
                        type="button"
                        onClick={() => setStatus(preview.id, 'active')}
                        className="px-3 py-1.5 rounded-xl brand-primary-btn text-[11px] font-bold"
                      >
                        Activate for school
                      </button>
                    )}
                    {preview.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => setStatus(preview.id, 'archived')}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-600"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['mcqs', 'lesson', 'demo', 'scenario'] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${tab === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                      {t === 'mcqs' ? 'Stage 2 · MCQs' : t === 'lesson' ? 'Lesson + rubric' : t === 'demo' ? 'Demo + rubric' : 'Scenario + rubric'}
                    </button>
                  ))}
                </div>
                {tab === 'mcqs' && (
                  <ol className="space-y-3 max-h-[420px] overflow-y-auto text-xs">
                    {preview.mcqs.map((q, i) => (
                      <li key={q.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <p className="font-semibold">{i + 1}. {q.question_text}</p>
                        <ul className="mt-1 text-slate-600 list-disc pl-4">
                          {q.options.map((o) => <li key={o} className={o === q.correct_option ? 'font-bold text-indigo-700' : ''}>{o}</li>)}
                        </ul>
                      </li>
                    ))}
                  </ol>
                )}
                {tab === 'lesson' && (
                  <div className="text-xs space-y-3">
                    <p className="font-bold text-slate-800">Candidate task</p>
                    <p className="text-slate-700 leading-relaxed">{preview.lesson_prompt}</p>
                    <p className="font-bold text-slate-800">AI rubric</p>
                    <p className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-slate-800">{preview.lesson_rubric}</p>
                  </div>
                )}
                {tab === 'demo' && (
                  <div className="text-xs space-y-3">
                    <p className="font-bold text-slate-800">Candidate task</p>
                    <p className="text-slate-700 leading-relaxed">{preview.demo_prompt}</p>
                    <p className="font-bold text-slate-800">AI rubric</p>
                    <p className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-slate-800">{preview.demo_rubric}</p>
                  </div>
                )}
                {tab === 'scenario' && (
                  <div className="text-xs space-y-3">
                    <p className="font-bold text-slate-800">Candidate task</p>
                    <p className="text-slate-700 leading-relaxed">{preview.scenario_prompt}</p>
                    <p className="font-bold text-slate-800">AI rubric</p>
                    <p className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-slate-800">{preview.scenario_rubric}</p>
                  </div>
                )}
                <p className="text-[11px] text-slate-500 flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> Stages 1 (profile) and 5 (school policies) stay the same for every test.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
