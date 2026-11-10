import { PageHeader } from "@/components/shared/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/server/auth/rbac";

export default async function LecturerDashboardPage() {
  const session = await requireRole(["LECTURER"]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${session.fullName}`}
        description="Lecturer Course & Result Portal"
      />

      <Card>
        <CardHeader>
          <CardTitle>Departmental Assignment</CardTitle>
          <CardDescription>
            Your academic staff details and assigned department.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <div className="text-muted-foreground">Staff ID</div>
            <div className="font-semibold mt-0.5">{session.staffId ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Department</div>
            <div className="font-semibold mt-0.5">
              {session.departmentName ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Faculty</div>
            <div className="font-semibold mt-0.5">
              {session.facultyName ?? "—"}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

