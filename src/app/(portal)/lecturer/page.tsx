import Link from "next/link";
import {
  AlertTriangle,
  BookMarked,
  CheckCircle2,
  Clock,
  ExternalLink,
  Users,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
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
import { getLecturerDashboardData } from "@/server/services/lecturer-dashboard.service";

export default async function LecturerDashboardPage() {
  const session = await requireRole(["LECTURER"]);
  const data = await getLecturerDashboardData(session);

  const returnedCourses = data.assignments.filter(
    (a) => a.status === "RETURNED"
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${session.fullName}`}
        description={
          data.currentSemester
            ? `Lecturer Academic Portal · ${data.currentSemester.sessionName} (${data.currentSemester.name} Semester)`
            : "Lecturer Academic Portal"
        }
        actions={
          <Link
            href="/lecturer/courses"
            className={buttonVariants({ size: "sm" })}
          >
            <BookMarked className="h-4 w-4 mr-1.5" />
            My Courses
          </Link>
        }
      />

      {/* Prominent Returned Notice Banner */}
      {returnedCourses.length > 0 ? (
        <div className="space-y-3">
          {returnedCourses.map((rc) => (
            <div
              key={rc.id}
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">
                    Action Required: Results for {rc.course.code} returned for correction
                  </div>
                  <div className="text-xs mt-1 text-destructive/90">
                    Feedback: &ldquo;{rc.returnFeedback}&rdquo;
                  </div>
                </div>
              </div>
              <Link
                href={`/lecturer/courses/${rc.id}`}
                className={buttonVariants({
                  variant: "destructive",
                  size: "sm",
                  className: "shrink-0",
                })}
              >
                Correct Scores →
              </Link>
            </div>
          ))}
        </div>
      ) : null}

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription className="text-xs font-medium">
              Assigned Courses
            </CardDescription>
            <BookMarked className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {data.stats.totalAssignedCourses}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active teaching assignments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription className="text-xs font-medium">
              Registered Students
            </CardDescription>
            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {data.stats.totalRegisteredStudents}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all assigned courses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription className="text-xs font-medium">
              Awaiting Approval
            </CardDescription>
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {data.stats.awaitingReviewCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Submissions under review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription className="text-xs font-medium">
              Returned For Correction
            </CardDescription>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-destructive">
              {data.stats.returnedCoursesCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Courses requiring revision
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Assigned Courses Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assigned Courses &amp; Result Status</CardTitle>
          <CardDescription>
            Manage students and enter continuous assessment &amp; examination scores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.assignments.length === 0 ? (
            <EmptyState
              title="No courses assigned"
              description="You have not been assigned to any courses for the current semester."
            />
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course Code</TableHead>
                    <TableHead>Course Title</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Scores Entered</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.assignments.map((asgn) => (
                    <TableRow key={asgn.id}>
                      <TableCell className="font-mono font-semibold whitespace-nowrap">
                        {asgn.course.code}
                      </TableCell>
                      <TableCell className="font-medium">
                        {asgn.course.title}
                      </TableCell>
                      <TableCell>{asgn.course.creditUnits}</TableCell>
                      <TableCell>{asgn.course.level.name}</TableCell>
                      <TableCell>{asgn.registeredCount}</TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {asgn.enteredCount} / {asgn.registeredCount}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={asgn.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/lecturer/courses/${asgn.id}`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                          })}
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1" />
                          Scores Sheet
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Staff Bio-data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff Details</CardTitle>
          <CardDescription>
            Your official lecturer profile and departmental assignment.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <div className="text-muted-foreground">Staff ID</div>
            <div className="font-mono font-semibold mt-0.5">
              {session.staffId ?? "—"}
            </div>
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
