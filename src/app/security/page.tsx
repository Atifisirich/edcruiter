import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDocument } from '@/components/legal/LegalDocument';

export const metadata: Metadata = {
  title: 'Security practices | Edcruiter',
  description: 'How Edcruiter protects accounts, assessments, and Google Sign-In data.',
};

export default function SecurityPage() {
  return (
    <LegalDocument title="Security practices" updated="27 August 2026">
      <p>
        This page summarises controls Google and schools can expect when Edcruiter uses Sign in with
        Google for authentication only (email, name, profile). We do not access Gmail or other Google
        Workspace APIs.
      </p>

      <h2>Transport security</h2>
      <ul>
        <li>Production traffic is served over HTTPS / TLS</li>
        <li>HTTP Strict Transport Security (HSTS) is enabled</li>
        <li>OAuth authorised JavaScript origins and redirect URIs will be HTTPS on a domain we own</li>
      </ul>

      <h2>Application security</h2>
      <ul>
        <li>Security headers: nosniff, frame controls, referrer policy, permissions policy</li>
        <li>OAuth client secrets and API keys are kept in server environment variables, never in the browser bundle</li>
        <li>When Google Sign-In is connected, session cookies will be Secure, HttpOnly, and SameSite</li>
        <li>Scopes requested: openid, email, profile only</li>
      </ul>

      <h2>Assessment media</h2>
      <p>
        Camera and microphone are used only during a candidate assessment, with in-browser integrity
        checks. Media is uploaded over HTTPS to our backend for scoring by the inviting school.
      </p>

      <h2>Access control</h2>
      <p>
        School staff see only candidates for their organisation. Teachers see their own applications and
        assessments. Super-admin access is restricted to operators.
      </p>

      <h2>Incident contact</h2>
      <p>
        Report a vulnerability or data incident to{' '}
        <a href="mailto:privacy@edcruiter.com">privacy@edcruiter.com</a>.
      </p>

      <p>
        See also <Link href="/privacy">Privacy Policy</Link> and <Link href="/terms">Terms of Service</Link>.
      </p>
    </LegalDocument>
  );
}
