'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Film, Loader2, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import type { PolicyQuestion } from '@/lib/types';
import { MAX_POLICY_QUESTIONS, STARTER_POLICY_QUESTIONS } from '@/lib/policyVideo';

type VideoInfo = { id: string; title: string; size: number; mime: string; uploaded_at: string; uploaded_by: string };

function mb(bytes: number): string {
  return bytes >= 1024 * 1024 * 1024 ? `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`;
}

/**
 * Stage 5, school side: a video explaining the school's policies, and the
 * "Do you agree…?" questions candidates answer after watching it to the end.
 */
export default function PolicyVideoCard({ schoolId }: { schoolId: string }) {
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [questions, setQuestions] = useState<PolicyQuestion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const q = `school_id=${encodeURIComponent(schoolId)}`;

  useEffect(() => {
    fetch(`/api/policy-video?${q}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Could not load the policy video.');
        setVideo(d.video);
        setQuestions(d.questions || []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the policy video.'))
      .finally(() => setLoaded(true));
  }, [q]);

  const call = async (method: string, url: string, body?: BodyInit, json = true) => {
    const res = await fetch(url, {
      method,
      headers: json && body ? { 'Content-Type': 'application/json' } : body ? { 'Content-Type': 'application/octet-stream' } : undefined,
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
  };

  const upload = async () => {
    if (!file) return;
    setError('');
    setNotice('');
    setProgress(0);
    try {
      const start = await call('POST', `/api/policy-video/upload?${q}`, JSON.stringify({ action: 'start', title, size: file.size, type: file.type }));
      const { upload_id, chunk_size, chunks } = start as { upload_id: string; chunk_size: number; chunks: number };
      for (let i = 0; i < chunks; i++) {
        const piece = file.slice(i * chunk_size, Math.min(file.size, (i + 1) * chunk_size));
        // A piece that fails (a network blip) is tried again a few times before giving up.
        for (let attempt = 1; ; attempt++) {
          try {
            await call('PUT', `/api/policy-video/upload?${q}&upload_id=${upload_id}&index=${i}`, piece, false);
            break;
          } catch (e) {
            if (attempt >= 3) throw e;
            await new Promise((r) => setTimeout(r, 1500 * attempt));
          }
        }
        setProgress(Math.round(((i + 1) / chunks) * 100));
      }
      const done = await call('POST', `/api/policy-video/upload?${q}`, JSON.stringify({ action: 'finish', upload_id }));
      setVideo(done.video);
      setFile(null);
      setTitle('');
      if (fileInput.current) fileInput.current.value = '';
      setNotice('Video uploaded. Candidates will watch it in stage 5, then answer the questions below.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload the video.');
    } finally {
      setProgress(null);
    }
  };

  const removeVideo = async () => {
    if (!video || !window.confirm(`Remove "${video.title}"? Candidates will no longer see a policy video.`)) return;
    setError('');
    try {
      await call('DELETE', `/api/policy-video?${q}`);
      setVideo(null);
      setNotice('Video removed.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove the video.');
    }
  };

  const updateQuestion = (id: string, text: string) => {
    setQuestions((qs) => qs.map((x) => (x.id === id ? { ...x, text } : x)));
    setDirty(true);
  };
  const addQuestion = () => {
    setQuestions((qs) => [...qs, { id: `new_${Date.now()}`, text: '' }]);
    setDirty(true);
  };
  const removeQuestion = (id: string) => {
    setQuestions((qs) => qs.filter((x) => x.id !== id));
    setDirty(true);
  };
  const resetQuestions = () => {
    if (!window.confirm('Replace your questions with the starter set?')) return;
    setQuestions(STARTER_POLICY_QUESTIONS);
    setDirty(true);
  };

  const saveQuestions = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const data = await call('PUT', `/api/policy-video?${q}`, JSON.stringify({
        // A question added here has a temporary id; the server gives it a real one.
        questions: questions.map((x) => (x.id.startsWith('new_') ? { text: x.text } : x)),
      }));
      setQuestions(data.questions);
      setDirty(false);
      setNotice('Questions saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the questions.');
    } finally {
      setSaving(false);
    }
  };

  const uploading = progress !== null;

  return (
    <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5" aria-labelledby="policy-video-heading">
      <div>
        <h2 id="policy-video-heading" className="text-sm font-black text-slate-900 flex items-center gap-2">
          <Film className="w-4 h-4 text-indigo-600" /> Policy video and questions (stage 5)
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Upload a video that explains your policies, such as an animated explainer or a talk from your principal.
          Candidates must watch it to the end before the questions appear. They answer each one with agree or don&apos;t agree, and
          any &ldquo;don&apos;t agree&rdquo; is highlighted on their report.
        </p>
      </div>

      {error && <p className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700">{error}</p>}
      {notice && (
        <p className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </p>
      )}

      {!loaded ? (
        <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
      ) : (
        <>
          {video ? (
            <div className="space-y-2">
              <video
                key={video.id}
                src={`/api/policy-video/stream?${q}&v=${video.id}`}
                controls
                preload="metadata"
                className="w-full max-h-80 rounded-2xl bg-black border border-slate-200"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-600">
                  <strong className="text-slate-900">{video.title}</strong> · {mb(video.size)} · added by {video.uploaded_by} on{' '}
                  {new Date(video.uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <button type="button" onClick={removeVideo} disabled={uploading} className="inline-flex items-center gap-1 font-bold text-rose-600 hover:underline cursor-pointer disabled:opacity-50">
                  <Trash2 className="w-3.5 h-3.5" /> Remove video
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 p-3 rounded-2xl bg-slate-50 border border-slate-200">No policy video yet.</p>
          )}

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <p className="text-xs font-bold text-slate-700">{video ? 'Replace the video' : 'Upload a video'}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-slate-600">
                Video title
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  placeholder="e.g. Working at Sloka: our policies"
                  disabled={uploading}
                  className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-slate-600">
                Video file (MP4, WebM or MOV, any length)
                <input
                  ref={fileInput}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  disabled={uploading}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="mt-1 w-full text-sm file:mr-3 file:px-3 file:py-2 file:rounded-xl file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-bold"
                />
              </label>
            </div>
            {uploading ? (
              <div className="space-y-1.5">
                <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-[11px] text-slate-600 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading… {progress}%. Keep this page open until it finishes.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={upload}
                disabled={!file}
                className="brand-primary-btn px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Upload className="w-4 h-4" /> {file ? `Upload ${mb(file.size)}` : 'Choose a video first'}
              </button>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-black text-slate-900">Questions after the video ({questions.length})</h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={resetQuestions} className="text-[11px] font-bold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer">
                  <RotateCcw className="w-3.5 h-3.5" /> Starter set
                </button>
                <button
                  type="button"
                  onClick={saveQuestions}
                  disabled={!dirty || saving}
                  className="brand-primary-btn px-3 py-1.5 rounded-xl text-[11px] font-bold disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving…' : 'Save questions'}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Write each one as a yes-or-no question about something in your video. Candidates answer &ldquo;I agree&rdquo; or &ldquo;I don&apos;t agree&rdquo;, with a reason if they don&apos;t.
              {!video && ' Until you upload a video or save your own questions, candidates are not asked these.'}
            </p>
            <ol className="space-y-2">
              {questions.map((x, i) => (
                <li key={x.id} className="flex items-start gap-2">
                  <span className="text-xs font-bold text-slate-400 w-5 pt-2.5 text-right">{i + 1}.</span>
                  <textarea
                    value={x.text}
                    onChange={(e) => updateQuestion(x.id, e.target.value)}
                    rows={2}
                    maxLength={300}
                    aria-label={`Question ${i + 1}`}
                    placeholder="e.g. Do you agree to the 60-day notice period?"
                    className="flex-1 p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm resize-y"
                  />
                  <button type="button" onClick={() => removeQuestion(x.id)} aria-label={`Remove question ${i + 1}`} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={addQuestion}
              disabled={questions.length >= MAX_POLICY_QUESTIONS}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add a question
            </button>
          </div>
        </>
      )}
    </section>
  );
}
