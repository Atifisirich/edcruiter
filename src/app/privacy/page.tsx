import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDocument } from '@/components/legal/LegalDocument';

export const metadata: Metadata = {
  title: 'Privacy Policy | Edcruiter',
  description:
    'How Edcruiter collects, uses, stores, and shares personal data, including Google Sign-In account data, for school teacher recruitment.',
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument title="Privacy Policy" updated="27 August 2026">
      <p>
        Edcruiter (“we”, “us”) is a teacher recruitment and assessment platform for K-12 schools. This
        policy explains what we collect, why we collect it, and how Google user data is handled when you
        use Sign in with Google.
      </p>
      <p>
        Edcruiter’s use and transfer of information received from Google APIs adheres to the{' '}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noreferrer" target="_blank">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      <h2>1. Who this policy covers</h2>
      <ul>
        <li>Teachers and candidates who create an account or take an assessment</li>
        <li>School recruiters, HODs, and administrators who use the recruiter workspace</li>
        <li>Visitors to our public website</li>
      </ul>

      <h2>2. Information we collect</h2>
      <h3>Account and Google Sign-In</h3>
      <p>
        If you sign in with Google, we request only authentication scopes needed to identify you:{' '}
        <strong>openid</strong>, <strong>email</strong>, and <strong>profile</strong>. From Google we
        receive your Google account name, email address, unique Google user ID, and profile photo (if
        shared). We do <strong>not</strong> request access to Gmail, Drive, Contacts, Calendar, or any
        other Google product data.
      </p>
      <h3>Recruitment and assessment data</h3>
      <ul>
        <li>Name, phone, email, qualifications, experience, salary band, and location</li>
        <li>CV / resume files you upload</li>
        <li>Assessment answers, lesson plans, teaching demo video/audio, and scores</li>
        <li>Proctoring signals generated during a test (camera frames processed in the browser, integrity warnings)</li>
        <li>Job applications and school hiring decisions</li>
      </ul>
      <h3>Technical data</h3>
      <p>
        Browser type, approximate location from IP, device type, and security logs. We use cookies or
        similar storage only for session, security, and essential site function—not for selling ads.
      </p>

      <h2>3. How we use data</h2>
      <ul>
        <li>Authenticate you and keep you signed in</li>
        <li>Match teachers to school vacancies and run assessments</li>
        <li>Show recruiters candidate reports they are authorised to see</li>
        <li>Secure the platform (fraud, cheating, abuse)</li>
        <li>Comply with law and school safeguarding duties</li>
      </ul>
      <p>
        We do not sell personal data. We do not use Google user data for advertising, credit scoring, or
        unrelated AI model training sold to third parties.
      </p>

      <h2>4. Limited Use of Google user data</h2>
      <p>
        Data obtained from Google Sign-In is used only to provide or improve user-facing features of
        Edcruiter (account creation, login, displaying your name/email in the teacher workspace). It is
        not transferred to others except as needed to run the service (for example, hosting providers
        under contract) or if required by law. Human review of Google account data occurs only with your
        permission, for security/abuse, or where required to comply with applicable law.
      </p>

      <h2>5. Storage, encryption, and retention</h2>
      <ul>
        <li>
          Data in transit is protected with TLS (HTTPS). Production OAuth redirect URIs use HTTPS only.
        </li>
        <li>
          Data at rest is stored with provider-managed encryption on the hosting platform we use. Access
          is limited to authorised operators.
        </li>
        <li>
          Assessment recordings and CVs are retained for the hiring cycle of the school that invited you,
          then deleted or anonymised when no longer needed, unless a longer period is required by law or
          a school’s written retention policy.
        </li>
        <li>
          Google Sign-In tokens, when implemented, are stored server-side with secure, HTTP-only cookies
          or equivalent—not in public JavaScript storage.
        </li>
      </ul>

      <h2>6. Sharing</h2>
      <p>We share data only with:</p>
      <ul>
        <li>The school that invited or received your application</li>
        <li>Infrastructure vendors (hosting, email delivery, error monitoring) bound by contract</li>
        <li>Authorities when required by law, including child-safeguarding obligations</li>
      </ul>

      <h2>7. Your rights</h2>
      <p>
        Subject to Indian law (including the Digital Personal Data Protection Act, 2023) you may request
        access, correction, or deletion of your personal data. To delete your Edcruiter account and
        associated Google Sign-In linkage, use our{' '}
        <Link href="/data-deletion">Data deletion</Link> page or email privacy@edcruiter.com. You can
        also revoke Edcruiter’s access in your{' '}
        <a href="https://myaccount.google.com/permissions" rel="noreferrer" target="_blank">
          Google Account permissions
        </a>
        .
      </p>

      <h2>8. Children</h2>
      <p>
        Edcruiter is for adult teachers and school staff. We do not knowingly create Google Sign-In
        accounts for children. Assessment content may discuss school students in professional scenarios
        only.
      </p>

      <h2>9. International transfers</h2>
      <p>
        Servers may be located outside India. We take contractual and technical steps appropriate to the
        transfer, including encryption in transit.
      </p>

      <h2>10. Contact</h2>
      <p>
        Privacy requests: <a href="mailto:privacy@edcruiter.com">privacy@edcruiter.com</a>
        <br />
        Operator: Edcruiter (teacher recruitment software)
      </p>
      <p>
        Related:{' '}
        <Link href="/terms">Terms of Service</Link> · <Link href="/security">Security practices</Link>
      </p>
    </LegalDocument>
  );
}
