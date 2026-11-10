import {
  AlertCircle,
  BookMarked,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/server/auth/rbac";
import { getDeptAdminDashboardStats } from "@/server/services/admin-dashboard.service";

export default async function DeptAdminDashboardPage() {
  const session = await requireRole(["DEPARTMENT_ADMIN"]);
  const stats = await getDeptAdminDashboardStats(session);

  const statCards = [
    {
      label: "Students",
      value: stats.studentsCount,
      subtext: `Enrolled in ${session.departmentName ?? "department"}`,
      icon: GraduationCap,
    },
    {
      label: "Lecturers",
      value: stats.lecturersCount,
      subtext: "Department academic staff",
      icon: Users,
    },
    {
      label: "Active Courses",
      value: stats.activeCoursesCount,
      subtext: "Active curriculum courses",
      icon: BookMarked,
    },
    {
      label: "Programs",
      value: stats.programsCount,
      subtext: "Department degree programs",
      icon: BookOpen,
    },
    {
      label: "Registrations This Semester",
      value: stats.registrationsThisSemester,
      subtext: `${stats.currentSessionName} (${stats.currentSemesterName})`,
      icon: ClipboardList,
    },
    {
      label: "Submitted Results Awaiting Approval",
      value: stats.submittedResultsAwaitingApproval,
      subtext: "Pending departmental review",
      icon: CheckCircle2,
    },
    {
      label: "Unassigned Courses This Semester",
      value: stats.unassignedCoursesThisSemester,
      subtext: `Active ${stats.currentSemesterName} semester courses without a lecturer`,
      icon: AlertCircle,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${session.fullName}`}
        description={`${session.departmentName ?? "Department"} Administration Portal · ${stats.currentSessionName} (${stats.currentSemesterName})`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Department Scope</CardTitle>
          <CardDescription>
            Your administrative scope is restricted to the department below.
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardDescription className="text-xs font-medium">
                  {item.label}
                </CardDescription>
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold tracking-tight truncate">
                  {item.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {item.subtext}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
