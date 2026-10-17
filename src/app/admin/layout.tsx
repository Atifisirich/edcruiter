import SchoolIdGate from '@/components/auth/SchoolIdGate';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <SchoolIdGate>{children}</SchoolIdGate>;
}
