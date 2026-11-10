import { AuditLogsView } from "@/components/admin/AuditLogsView";
import { requireRole } from "@/server/auth/rbac";

export default async function SuperAdminAuditLogsPage() {
  await requireRole(["SUPER_ADMIN"]);
  return <AuditLogsView role="SUPER_ADMIN" />;
}
