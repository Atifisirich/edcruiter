import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';

export const metadata: Metadata = {
  title: 'Child safeguarding | Edcruiter',
  description: 'Edcruiter child safeguarding commitments for school hiring assessments.',
};

export default function SafeguardingPage() {
  return (
    <LegalDocument title="Child safeguarding code" updated="27 August 2026">
      <p>
        Edcruiter is used by schools to hire adult teachers. We do not onboard children as platform
        users. Assessment tasks may refer to classroom scenarios involving students.
      </p>
      <ul>
        <li>Users must follow POCSO and their school’s child protection policy</li>
        <li>Do not upload images or recordings of children in CVs or demo videos</li>
        <li>Report safeguarding concerns to the hiring school and to privacy@edcruiter.com</li>
      </ul>
    </LegalDocument>
  );
}
