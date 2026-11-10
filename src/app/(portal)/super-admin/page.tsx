import { PageHeader } from "@/components/shared/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/server/auth/rbac";

export default async function SuperAdminDashboardPage() {
  const session = await requireRole(["SUPER_ADMIN"]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${session.fullName}`}
        description="University-Wide Administration Portal"
      />

      <Card>
        <CardHeader>
          <CardTitle>System Oversight</CardTitle>
          <CardDescription>
            Full university-wide administrative access across all faculties,
            departments, programs, sessions, and users.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <div className="text-muted-foreground">Administrator Email</div>
            <div className="font-semibold mt-0.5">{session.email}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Scope</div>
            <div className="font-semibold mt-0.5">
              University-Wide (All Faculties & Departments)
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

