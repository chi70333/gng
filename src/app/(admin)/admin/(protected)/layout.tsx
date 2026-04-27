import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdmin } from '@/server/admin/auth';

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  return <AdminShell admin={admin}>{children}</AdminShell>;
}
