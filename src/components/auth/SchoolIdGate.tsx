'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Admin and reviewer pages read their school from localStorage
 * ('edcruiter_school_id'), which was only ever written during first-time
 * school setup. Anyone who signed in later — another browser, a cleared
 * profile, a staff member invited after setup — had nothing stored, so every
 * page silently fell back to the seeded demo school's id: lists loaded for
 * the wrong school, and calls like GET /api/schools were refused with a 403
 * that those pages swallowed. The WhatsApp page, for one, would save
 * credentials successfully and then never see them, leaving the Verify step
 * permanently locked.
 *
 * This resolves the signed-in user's real school once, from the session
 * itself, writes it where those pages already look, and only then renders
 * them — so the first render reads the right value instead of racing it.
 * A platform super admin has no school of their own, so nothing is
 * overwritten for them.
 */
export default function SchoolIdGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (me?.school_id) {
          try { localStorage.setItem('edcruiter_school_id', me.school_id); } catch { /* storage blocked — pages fall back as before */ }
        }
      })
      .catch(() => { /* not signed in or offline — the pages' own auth handling takes over */ })
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  return <>{children}</>;
}
