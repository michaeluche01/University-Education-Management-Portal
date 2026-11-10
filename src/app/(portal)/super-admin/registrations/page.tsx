import { RegistrationsView } from "@/components/admin/RegistrationsView";
import { requireRole } from "@/server/auth/rbac";

export default async function SuperAdminRegistrationsPage() {
  await requireRole(["SUPER_ADMIN"]);
  return <RegistrationsView role="SUPER_ADMIN" />;
}

