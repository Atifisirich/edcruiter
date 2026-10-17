import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDocument } from '@/components/legal/LegalDocument';

export const metadata: Metadata = {
  title: 'Terms of Service | Edcruiter',
  description: 'Terms of use for the Edcruiter school teacher recruitment and assessment platform.',
};

export default function TermsPage() {
  return (
    <LegalDocument title="Terms of Service" updated="27 August 2026">
      <p>
        These terms govern use of Edcruiter’s website and software. By creating an account, signing in
        with Google, applying for a role, or administering a school workspace, you agree to them.
      </p>

      <h2>1. The service</h2>
      <p>
        Edcruiter helps schools publish teaching vacancies, invite candidates, run structured
        assessments (written, teaching demo, scenarios, HR), and review reports. Edcruiter does not
        employ teachers, guarantee a job, or replace a school’s statutory hiring duties.
      </p>

      <h2>2. Accounts</h2>
      <ul>
        <li>Provide accurate information. Do not share login credentials.</li>
        <li>
          Google Sign-In is offered so you can authenticate with your Google account. You must have the
          right to use that account.
        </li>
        <li>Schools are responsible for who they invite and what roles they assign.</li>
      </ul>

      <h2>3. Assessments and integrity</h2>
      <p>
        Proctored assessments may require camera, microphone, and fullscreen. Cheating, impersonation,
        or sharing assessment content without permission is prohibited. Schools may reject applications
        based on integrity findings. Technical scores are decision-support tools; hiring decisions rest
        with the school.
      </p>

      <h2>4. Acceptable use</h2>
      <ul>
        <li>Do not reverse engineer, scrape, or overload the service</li>
        <li>Do not upload malware or others’ personal data without a lawful basis</li>
        <li>Do not use Edcruiter to discriminate unlawfully in hiring</li>
      </ul>

      <h2>5. Intellectual property</h2>
      <p>
        Edcruiter owns the platform, branding, and software. You retain rights in your CV, videos, and
        written answers. You grant Edcruiter and the receiving school a licence to process that content
        for recruitment. Assessment items created for a school remain that school’s confidential
        material.
      </p>

      <h2>6. Privacy</h2>
      <p>
        Personal data is processed as described in our <Link href="/privacy">Privacy Policy</Link>.
        Google user data is used only as disclosed there and in line with Google’s Limited Use rules.
      </p>

      <h2>7. Availability and liability</h2>
      <p>
        We aim for reliable uptime but do not warrant uninterrupted service. To the extent permitted by
        Indian law, Edcruiter is not liable for hiring outcomes, school decisions, or indirect losses.
        Nothing in these terms limits liability that cannot be limited by law.
      </p>

      <h2>8. Termination</h2>
      <p>
        You may stop using Edcruiter and request deletion via <Link href="/data-deletion">Data deletion</Link>.
        We may suspend accounts that violate these terms or create security risk.
      </p>

      <h2>9. Governing law</h2>
      <p>
        These terms are governed by the laws of India. Courts in India have exclusive jurisdiction,
        except where mandatory consumer protections apply.
      </p>

      <h2>10. Contact</h2>
      <p>
        <a href="mailto:privacy@edcruiter.com">privacy@edcruiter.com</a>
      </p>
    </LegalDocument>
  );
}
