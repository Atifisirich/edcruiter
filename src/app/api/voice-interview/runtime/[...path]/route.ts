import { NextRequest, NextResponse } from 'next/server';
import { getStaffContext } from '@/lib/auth';
import { getCandidateSession } from '@/lib/session';
import { fetchSignedUrl, interviewRuntime } from '@/lib/aiInterview';

/**
 * Stands in for Sarvam's "signed address" request, so the browser can open the
 * voice session without ever holding the API key. The browser SDK asks
 * /api/voice-interview/runtime/orgs/{org}/workspaces/{ws}/apps/{app}/url; only our
 * own interview agent can be asked for, and only by a signed-in candidate or
 * a member of a school.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const rt = interviewRuntime();
  if (!rt) return NextResponse.json({ error: 'The AI interview is not switched on.' }, { status: 503 });

  const [a, org, b, ws, c, app, d, ...rest] = path;
  const ok = a === 'orgs' && b === 'workspaces' && c === 'apps' && d === 'url' && rest.length === 0
    && org === rt.orgId && ws === rt.workspaceId && app === rt.appId;
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const signedIn = (await getCandidateSession().catch(() => null)) || (await getStaffContext().catch(() => null));
  if (!signedIn) return NextResponse.json({ error: 'Sign in to start the interview.' }, { status: 401 });

  // Only the settings a session needs are passed on.
  const incoming = new URL(req.url).searchParams;
  const query = new URLSearchParams();
  for (const key of ['interaction_type', 'version']) {
    const v = incoming.get(key);
    if (v) query.set(key, v);
  }
  if (!query.has('interaction_type')) query.set('interaction_type', 'call');
  if (!query.has('version') && rt.version) query.set('version', String(rt.version));

  try {
    const res = await fetchSignedUrl(rt, query);
    const text = await res.text();
    return new NextResponse(text, { status: res.status, headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json', 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not reach the voice service. Try again.' }, { status: 502 });
  }
}
