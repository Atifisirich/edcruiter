import SchoolIdGate from '@/components/auth/SchoolIdGate';
import HelpAssistant from '@/components/shared/HelpAssistant';

export default function ReviewerLayout({ children }: { children: React.ReactNode }) {
  return (
    <SchoolIdGate>
      {children}
      <HelpAssistant audience="staff" />
    </SchoolIdGate>
  );
}
