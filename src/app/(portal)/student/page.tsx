import Link from "next/link";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Printer,
  UserCircle2,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/server/auth/rbac";
import {
  getAvailableCoursesForStudent,
  listRegistrations,
} from "@/server/services/registration.service";

export default async function StudentDashboardPage() {
  const session = await requireRole(["STUDENT"]);
  const [availableData, regData] = await Promise.all([
    getAvailableCoursesForStudent(session),
    listRegistrations(session, { page: 1, pageSize: 50 }),
  ]);

  const currentSem = availableData.currentSemester;
  const sessionLabel = currentSem
    ? `${currentSem.session.name} (${currentSem.name} Semester)`
    : "No Active Semester";

  const totalCourses = regData.items.length;
  const totalUnits = regData.totalCreditUnits ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${session.fullName}`}
        description={`Student Academic Portal · ${sessionLabel}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/student/profile"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <UserCircle2 className="h-4 w-4 mr-1.5" />
              My Profile
            </Link>
            <Link
              href="/student/print/registration"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Printer className="h-4 w-4 mr-1.5" />
              Print Registration Slip
            </Link>
            <Link
              href="/student/courses"
              className={buttonVariants({ size: "sm" })}
            >
              <ClipboardList className="h-4 w-4 mr-1.5" />
              Register Courses
            </Link>
          </div>
        }
      />

      {/* Registration Status Banner */}
      <div
        className={
          availableData.registrationOpen
            ? "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            : "rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
        }
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            {availableData.state === "noCurrentSemester"
              ? "No current semester is active."
              : availableData.registrationOpen
                ? `Course registration is OPEN for ${sessionLabel}.`
                : `Course registration is currently CLOSED for ${sessionLabel}.`}
          </span>
        </div>
        <Link
          href="/student/courses"
          className="font-semibold underline underline-offset-4 text-xs sm:text-sm shrink-0"
        >
          Manage Course Registration →
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription className="text-xs font-medium">
              Current Session & Semester
            </CardDescription>
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl font-bold tracking-tight truncate">
              {currentSem
                ? `${currentSem.session.name} · ${currentSem.name}`
                : "None"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {availableData.registrationOpen
                ? "Registration window open"
                : "Registration window closed"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription className="text-xs font-medium">
              Registered Courses
            </CardDescription>
            <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {totalCourses}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Courses registered this semester
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription className="text-xs font-medium">
              Total Credit Units
            </CardDescription>
            <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {totalUnits} Units
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Enrolled credit load this semester
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Academic Profile Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Academic Profile Summary</CardTitle>
          <CardDescription>
            Your enrolled department, program, and academic level.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <div className="text-muted-foreground">Matriculation Number</div>
            <div className="font-mono font-semibold mt-0.5">
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

      {/* Registered Courses List */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              Registered Courses ({sessionLabel})
            </CardTitle>
            <CardDescription>
              Courses you have registered for in the current semester.
            </CardDescription>
          </div>
          {totalCourses > 0 ? (
            <Link
              href="/student/print/registration"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Printer className="h-4 w-4 mr-1.5" />
              Print Slip
            </Link>
          ) : null}
        </CardHeader>
        <CardContent>
          {totalCourses === 0 ? (
            <EmptyState
              title="No courses registered yet"
              description="You have not registered for any courses in the current semester."
              action={
                <Link
                  href="/student/courses"
                  className={buttonVariants({ size: "sm" })}
                >
                  Register Courses
                </Link>
              }
            />
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Course Title</TableHead>
                    <TableHead>Credit Units</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Assigned Lecturer
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regData.items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono font-semibold whitespace-nowrap">
                        {row.course.code}
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.course.title}
                      </TableCell>
                      <TableCell>{row.course.creditUnits}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                        {("assignedLecturerName" in row
                          ? row.assignedLecturerName
                          : null) ?? "Not yet assigned"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
