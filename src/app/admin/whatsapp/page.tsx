'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle2, Loader2, MessageCircle, Radio, ShieldCheck, Send, AlertTriangle,
  ExternalLink, ChevronDown, Circle, CheckCircle
} from 'lucide-react';
import { School, WhatsAppHiringConfig } from '@/lib/types';
import { SLOKA_SCHOOL_ID } from '@/lib/defaultData';

type Provider = 'platform_shared' | 'school_waba';

const STATUS_LABEL: Record<WhatsAppHiringConfig['status'], string> = {
  not_connected: 'Not connected',
  credentials_saved: 'Credentials saved — not verified yet',
  verified: 'Verified with Meta — send a test message',
  live: 'Live — a real message has been delivered',
  restricted: 'Restricted by Meta',
};

const STATUS_TONE: Record<WhatsAppHiringConfig['status'], string> = {
  not_connected: 'bg-slate-100 text-slate-600',
  credentials_saved: 'bg-amber-50 text-amber-700',
  verified: 'bg-indigo-50 text-indigo-700',
  live: 'bg-emerald-50 text-emerald-700',
  restricted: 'bg-rose-50 text-rose-700',
};

/** 1 = credentials saved, 2 = verified, 3 = live. Drives the step tracker. */
function stepReached(status: WhatsAppHiringConfig['status'] | undefined): number {
  if (status === 'live') return 3;
  if (status === 'verified') return 2;
  if (status === 'credentials_saved') return 1;
  return 0;
}

function StepDot({ done, current }: { done: boolean; current: boolean }) {
  if (done) return <CheckCircle className="w-4 h-4 text-emerald-600" />;
  return <Circle className={`w-4 h-4 ${current ? 'text-indigo-600' : 'text-slate-300'}`} />;
}

export default function WhatsAppHiringPage() {
  const [school, setSchool] = useState<School | null>(null);
  const [provider, setProvider] = useState<Provider>('platform_shared');

  // Own-WABA credential fields
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [token, setToken] = useState('');
  const [displayNumber, setDisplayNumber] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const [testTo, setTestTo] = useState('');

  const [loading, setLoading] = useState(true);
  const [savingCreds, setSavingCreds] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // The school this admin actually belongs to — see the identical fix (and
  // fuller explanation) in src/app/admin/page.tsx. This page had the same
  // hardcoded SLOKA_SCHOOL_ID bug in every request.
  const schoolId =
    (typeof window !== 'undefined' && localStorage.getItem('edcruiter_school_id')) || SLOKA_SCHOOL_ID;

  const load = () => {
    setLoading(true);
    fetch(`/api/schools?school_id=${schoolId}`)
      .then((r) => r.json())
      .then((d) => {
        const s: School | undefined = d.school;
        if (!s) {
          setError(d.error || 'Could not load your school.');
          return;
        }
        setSchool(s);
        const wa = s.whatsapp_hiring;
        if (wa) {
          setProvider(wa.provider || 'platform_shared');
          setDisplayNumber(wa.display_number || '');
          setDisplayName(wa.display_name || `${s.name} Hiring`);
        } else {
          setDisplayName(`${s.name} Hiring`);
        }
      })
      .catch(() => setError('Could not load WhatsApp status.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const wa = school?.whatsapp_hiring;
  const status = wa?.status || 'not_connected';
  const step = stepReached(status);

  const saveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCreds(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/whatsapp/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: schoolId,
          provider,
          ...(provider === 'school_waba'
            ? { phone_number_id: phoneNumberId, waba_id: wabaId, token, display_number: displayNumber, display_name: displayName }
            : { display_name: displayName }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save credentials');
      setNotice('Saved. Now click "Verify number" below — nothing can send until Meta confirms these credentials are real.');
      setToken(''); // never keep the plaintext token in the form state after a save
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save credentials');
    } finally {
      setSavingCreds(false);
    }
  };

  const verify = async () => {
    setVerifying(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/whatsapp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: schoolId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      setNotice('Verified with Meta. Now send a test message below to your own phone to confirm delivery.');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const sendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingTest(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/whatsapp/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: schoolId, to: testTo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send test message');
      setNotice(`Sent. Check WhatsApp on that phone now — a message from Meta's sample "hello_world" template should arrive within a few seconds. Once it does, this number is ready for real candidate invites.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send test message');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 py-10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
        <Link href="/admin" className="text-xs font-bold text-slate-600 hover:text-indigo-600 inline-flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Recruiter workspace
        </Link>

        <header className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">Recruiter workspace</p>
          <h1 className="text-2xl font-black mt-1">WhatsApp hiring line</h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Assessment invites, reminders and offer messages go out over WhatsApp. There are two ways to get set up —
            pick whichever matches where you are right now.
          </p>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl border border-indigo-200 bg-indigo-50/60">
              <p className="text-xs font-black text-indigo-900">Just want to try it today?</p>
              <p className="text-[11px] text-indigo-800 mt-1 leading-relaxed">
                Choose <strong>"Use Edcruiter's number"</strong> below, save, and you can send a test message in under a
                minute. Invites will show up as being from "Edcruiter" rather than your school's name — fine for
                testing, worth switching before you invite real candidates.
              </p>
            </div>
            <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50">
              <p className="text-xs font-black text-slate-800">Want invites to say your school's name?</p>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                Choose <strong>"Connect our own number"</strong>. This needs a free Meta developer account and about
                15–20 minutes the first time — the walkthrough below has every click.
              </p>
            </div>
          </div>
        </header>

        {/* Step tracker */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            {[
              { n: 1, label: 'Save credentials' },
              { n: 2, label: 'Verify with Meta' },
              { n: 3, label: 'Send a test' },
            ].map((s, i) => (
              <React.Fragment key={s.n}>
                <div className="flex items-center gap-2">
                  <StepDot done={step >= s.n} current={step === s.n - 1} />
                  <span className={`text-xs font-bold ${step >= s.n ? 'text-emerald-700' : step === s.n - 1 ? 'text-indigo-700' : 'text-slate-400'}`}>
                    {s.label}
                  </span>
                </div>
                {i < 2 && <div className={`flex-1 h-px mx-2 ${step > s.n ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-[10px] uppercase font-bold text-slate-400">Status</p>
            <span className={`inline-flex mt-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_TONE[status]}`}>
              {STATUS_LABEL[status]}
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:col-span-2">
            <p className="text-[10px] uppercase font-bold text-slate-400">Invites will appear from</p>
            <p className="text-sm font-black text-slate-900 mt-1">{wa?.display_number || (wa?.provider === 'platform_shared' ? 'Edcruiter shared number' : '—')}</p>
            <p className="text-xs text-slate-500">
              {wa?.display_name}
              {wa?.quality_rating && wa.quality_rating !== 'UNKNOWN' ? ` · Quality: ${wa.quality_rating}` : ''}
            </p>
          </div>
        </div>

        {wa?.last_error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-700 font-semibold">Last error from Meta: {wa.last_error.title}</p>
          </div>
        )}

        {/* Step 1: choose a mode and save credentials */}
        <form onSubmit={saveCredentials} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-sm font-black">
            <MessageCircle className="w-4 h-4 text-indigo-600" />
            1. Choose a number
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setProvider('platform_shared')}
              className={`text-left p-3 rounded-xl border text-xs font-bold ${provider === 'platform_shared' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}
            >
              Use Edcruiter's number
              <span className="block font-normal text-[11px] text-slate-500 mt-1">Fastest to test. Invites arrive from "Edcruiter", not your school's own name.</span>
            </button>
            <button
              type="button"
              onClick={() => setProvider('school_waba')}
              className={`text-left p-3 rounded-xl border text-xs font-bold ${provider === 'school_waba' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}
            >
              Connect our own number
              <span className="block font-normal text-[11px] text-slate-500 mt-1">Invites arrive from your school's name. Needs a Meta WhatsApp Business Account.</span>
            </button>
          </div>

          <label className="block text-xs font-bold text-slate-700">
            Display name on WhatsApp
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1.5 w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
              placeholder="Sample School Hiring"
            />
            <span className="block mt-1 text-[11px] font-normal text-slate-500">
              The name candidates see next to messages — e.g. "Sample School HR", not a person's name.
            </span>
          </label>

          {provider === 'school_waba' && (
            <>
              <button
                type="button"
                onClick={() => setShowHelp((v) => !v)}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-indigo-200 bg-indigo-50/60 text-xs font-bold text-indigo-800"
              >
                <span>Where do I get these three values?</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showHelp ? 'rotate-180' : ''}`} />
              </button>

              {showHelp && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-[11.5px] text-slate-700 leading-relaxed">
                  <ol className="space-y-2.5 list-decimal list-inside">
                    <li>
                      Go to{' '}
                      <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="text-indigo-600 font-bold underline inline-flex items-center gap-0.5">
                        developers.facebook.com/apps <ExternalLink className="w-3 h-3" />
                      </a>{' '}
                      and sign in with the Facebook account that should own this WhatsApp line (usually the school's own, not a personal one).
                    </li>
                    <li><strong>Create App</strong> → choose the <strong>Business</strong> app type → give it any name (e.g. "Sample School Hiring").</li>
                    <li>On the app's dashboard, find <strong>WhatsApp</strong> in the product list and click <strong>Set up</strong>.</li>
                    <li>
                      You'll land on <strong>WhatsApp → API Setup</strong>. This one screen has all three values:
                      <ul className="mt-1.5 space-y-1 pl-4 list-disc list-outside">
                        <li><strong>Phone number ID</strong> — listed under "From" / the test number Meta gave you.</li>
                        <li><strong>WhatsApp Business Account ID</strong> — a few lines below the phone number.</li>
                        <li>A temporary access token is shown too, but <strong>do not use it</strong> — it expires in 24 hours. See the next step for a permanent one.</li>
                      </ul>
                    </li>
                    <li>
                      For the <strong>System User access token</strong> (the one that doesn't expire): go to your{' '}
                      <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noreferrer" className="text-indigo-600 font-bold underline inline-flex items-center gap-0.5">
                        Business Settings → System Users <ExternalLink className="w-3 h-3" />
                      </a>
                      , add a System User, assign it to this app with <code className="bg-white px-1 rounded border">whatsapp_business_messaging</code> permission, then click <strong>Generate token</strong> and copy it immediately — Meta only shows it once.
                    </li>
                  </ol>
                  <p className="pt-1 border-t border-slate-200 text-slate-500">
                    New to this? The free test number Meta gives you at step 4 works immediately for up to 5 phone
                    numbers you add yourself — enough to fully test this page before doing any paid verification with Meta.
                  </p>
                </div>
              )}

              <label className="block text-xs font-bold text-slate-700">
                WhatsApp number (for display only)
                <input
                  value={displayNumber}
                  onChange={(e) => setDisplayNumber(e.target.value)}
                  className="mt-1.5 w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="+91 98765 43210"
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                Phone number ID
                <input
                  required
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  className="mt-1.5 w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono"
                  placeholder="e.g. 109876543210987"
                />
                <span className="block mt-1 text-[11px] font-normal text-slate-500">
                  From WhatsApp → API Setup in the Meta dashboard (see "Where do I get these" above).
                </span>
              </label>
              <label className="block text-xs font-bold text-slate-700">
                WhatsApp Business Account ID
                <input
                  required
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  className="mt-1.5 w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono"
                  placeholder="e.g. 987654321098765"
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                System User access token
                <input
                  required
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="mt-1.5 w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono"
                  placeholder="Starts with EAAG… — never shown again after saving"
                />
                <span className="block mt-1 text-[11px] font-normal text-slate-500">
                  Not the 24-hour token from the API Setup screen — that one stops working the next day. Use the
                  permanent System User token from Business Settings instead.
                </span>
              </label>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                This token is encrypted before it's stored and is never sent back to this page or shown again — you'll
                need to re-enter it if you ever need to rotate it.
              </p>
            </>
          )}

          {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}
          {notice && (
            <p className="text-xs text-indigo-700 font-semibold inline-flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {notice}
            </p>
          )}

          <button type="submit" disabled={savingCreds} className="brand-primary-btn px-5 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2">
            {savingCreds ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {savingCreds ? 'Saving…' : 'Save'}
          </button>
        </form>

        {/* Step 2: verify with Meta */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-sm font-black">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            2. Verify with Meta
          </div>
          <p className="text-xs text-slate-500">
            Calls Meta directly to confirm these credentials really work and pulls back the number's quality rating —
            this is what catches a typo'd ID or an expired token before you try sending anything to a candidate.
          </p>
          {status === 'not_connected' && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
              Save your details in step 1 first — this button unlocks once something has been saved.
            </p>
          )}
          <button
            onClick={verify}
            disabled={verifying || !wa || wa.status === 'not_connected'}
            className="px-5 py-2.5 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 inline-flex items-center gap-2 disabled:opacity-40"
          >
            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
            {verifying ? 'Verifying…' : 'Verify number'}
          </button>
        </div>

        {/* Step 3: test send */}
        <form onSubmit={sendTest} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-sm font-black">
            <Send className="w-4 h-4 text-indigo-600" />
            3. Send a test message
          </div>
          <p className="text-xs text-slate-500">
            Sends Meta's built-in <code className="font-mono">hello_world</code> template to a phone number of your
            choice — use your own phone so you can see it arrive. This is a real message, not a simulation.
          </p>
          {provider === 'school_waba' && status !== 'live' && (
            <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
              On a brand-new WhatsApp Business Account, only phone numbers you've added as test recipients in the Meta
              dashboard (WhatsApp → API Setup → "To") can receive this until the account is verified — add your own
              number there first if the send below fails.
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              className="flex-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
              placeholder="+91 98765 43210"
            />
            <button
              type="submit"
              disabled={sendingTest || !testTo || status === 'not_connected' || status === 'credentials_saved'}
              className="brand-primary-btn px-5 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {sendingTest ? 'Sending…' : 'Send test'}
            </button>
          </div>
          {status === 'credentials_saved' && (
            <p className="text-[11px] text-amber-700">Verify the number in step 2 first — this button unlocks once Meta confirms it.</p>
          )}
          {status === 'live' && (
            <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 inline-flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              A real message has been delivered on this number — you're set up. Real candidate invites will now send from here.
            </p>
          )}
        </form>

        {loading && <p className="text-xs text-slate-400">Loading…</p>}
      </div>
    </div>
  );
}
