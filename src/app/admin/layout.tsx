import SchoolIdGate from '@/components/auth/SchoolIdGate';
import AdminShell from '@/components/admin/AdminShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SchoolIdGate>
      <AdminShell>{children}</AdminShell>
    </SchoolIdGate>
  );
}
