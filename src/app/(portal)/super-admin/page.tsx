import Link from "next/link";
import {
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Landmark,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { requireRole } from "@/server/auth/rbac";
import { getSuperAdminDashboardStats } from "@/server/services/admin-dashboard.service";

export default async function SuperAdminDashboardPage() {
  const session = await requireRole(["SUPER_ADMIN"]);
  const stats = await getSuperAdminDashboardStats(session);

  const statCards = [
    {
      label: "Faculties",
      value: stats.facultiesCount,
      subtext: "Academic faculties",
      icon: Landmark,
    },
    {
      label: "Departments",
      value: stats.departmentsCount,
      subtext: "Across all faculties",
      icon: Building2,
    },
    {
      label: "Programs",
      value: stats.programsCount,
      subtext: "Degree programs",
      icon: BookOpen,
    },
    {
      label: "Students",
      value: stats.studentsCount,
      subtext: "Enrolled students",
      icon: GraduationCap,
    },
    {
      label: "Lecturers",
      value: stats.lecturersCount,
      subtext: "Academic staff",
      icon: Users,
    },
    {
      label: "Current Session & Semester",
      value: `${stats.currentSessionName} (${stats.currentSemesterName})`,
      subtext: stats.registrationOpen
        ? "Course registration OPEN"
        : "Course registration CLOSED",
      icon: Calendar,
    },
    {
      label: "Registrations This Semester",
      value: stats.registrationsThisSemester,
      subtext: `In ${stats.currentSessionName} ${stats.currentSemesterName}`,
      icon: ClipboardList,
    },
    {
      label: "Results Awaiting Approval",
      value: stats.resultsAwaitingApproval,
      subtext: "Submitted results pending review",
      icon: CheckCircle2,
      href: "/super-admin/approvals",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${session.fullName}`}
        description="University-wide academic structure and operational overview."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((item) => {
          const Icon = item.icon;
          const cardContent = (
            <Card
              key={item.label}
              className={item.href ? "hover:border-primary/50 transition-colors" : undefined}
            >
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

          if (item.href) {
            return (
              <Link key={item.label} href={item.href} className="block">
                {cardContent}
              </Link>
            );
          }
          return cardContent;
        })}
      </div>
    </div>
  );
}
