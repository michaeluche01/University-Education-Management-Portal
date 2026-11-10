import { PageHeader } from "@/components/shared/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/server/auth/rbac";

export default async function StudentDashboardPage() {
  const session = await requireRole(["STUDENT"]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${session.fullName}`}
        description="Student Academic Portal"
      />

      <Card>
        <CardHeader>
          <CardTitle>Academic Profile Summary</CardTitle>
          <CardDescription>
            Your enrolled department, program, and academic level.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <div className="text-muted-foreground">Matriculation Number</div>
            <div className="font-semibold mt-0.5">
              {session.matricNumber ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Department</div>
            <div className="font-semibold mt-0.5">
              {session.departmentName ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Program</div>
            <div className="font-semibold mt-0.5">
              {session.programName ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Academic Level</div>
            <div className="font-semibold mt-0.5">
              {session.levelName ?? "—"}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

