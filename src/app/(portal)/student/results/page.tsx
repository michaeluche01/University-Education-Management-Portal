import Link from "next/link";
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  FileText,
  Printer,
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
import { getStudentAcademicHistory } from "@/server/services/student-results.service";

export default async function StudentResultsPage() {
  const session = await requireRole(["STUDENT"]);
  const history = await getStudentAcademicHistory(session);

  const { student, semesters, careerSummary } = history;
  const hasResults = semesters.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Academic Results"
          description={`Approved semester examination results for ${student.fullName} (${student.matricNumber}).`}
        />
        {hasResults && (
          <Link
            href="/student/print/results"
            className={buttonVariants({ variant: "outline" })}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print Result Statement
          </Link>
        )}
      </div>

      {/* Career Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription className="text-xs font-medium">
              Cumulative GPA (CGPA)
            </CardDescription>
            <Award className="h-4 w-4 text-primary shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-primary">
              {careerSummary.cgpa !== null
                ? careerSummary.cgpa.toFixed(2)
                : "—"}
            </div>
            <div className="mt-1">
              <StatusBadge
                status={
                  careerSummary.academicStanding === "Good Standing"
                    ? "ACTIVE"
                    : careerSummary.academicStanding === "Academic Probation"
                    ? "SUSPENDED"
                    : "DRAFT"
                }
              />
              <span className="text-xs text-muted-foreground ml-2">
                {careerSummary.academicStanding}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription className="text-xs font-medium">
              Total Units Registered
            </CardDescription>
            <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {careerSummary.totalUnitsRegistered}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Credit units across approved courses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription className="text-xs font-medium">
              Total Units Earned
            </CardDescription>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {careerSummary.totalUnitsEarned}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Passed units (grade point &gt; 0)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription className="text-xs font-medium">
              Semesters Graded
            </CardDescription>
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {semesters.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Completed academic terms
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Semesters List */}
      {!hasResults ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No approved results found"
          description="Your examination scores will appear here once submitted by course lecturers and approved by the department."
        />
      ) : (
        <div className="space-y-6">
          {semesters.map((sem) => (
            <Card key={sem.semesterId}>
              <CardHeader className="border-b bg-muted/20">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <CardTitle className="text-base sm:text-lg">
                      {sem.sessionName} — {sem.semesterName} Semester
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Units Registered: {sem.registeredUnits} · Units Earned:{" "}
                      {sem.earnedUnits}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold">
                      GPA:{" "}
                      {sem.semesterGpa !== null
                        ? sem.semesterGpa.toFixed(2)
                        : "—"}
                    </span>
                    <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2.5 py-1 text-xs font-semibold">
                      CGPA:{" "}
                      {sem.cumulativeGpa !== null
                        ? sem.cumulativeGpa.toFixed(2)
                        : "—"}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-28">Code</TableHead>
                        <TableHead>Course Title</TableHead>
                        <TableHead className="text-center w-16">Units</TableHead>
                        <TableHead className="text-center w-20">CA (30)</TableHead>
                        <TableHead className="text-center w-20">Exam (70)</TableHead>
                        <TableHead className="text-center w-20">Total (100)</TableHead>
                        <TableHead className="text-center w-16">Grade</TableHead>
                        <TableHead className="text-center w-16">GP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sem.courses.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono font-medium">
                            {c.courseCode}
                          </TableCell>
                          <TableCell>{c.courseTitle}</TableCell>
                          <TableCell className="text-center">
                            {c.creditUnits}
                          </TableCell>
                          <TableCell className="text-center font-mono">
                            {c.caScore.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center font-mono">
                            {c.examScore.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center font-mono font-semibold">
                            {c.totalScore.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center font-bold">
                            <span
                              className={
                                c.grade === "F"
                                  ? "text-destructive"
                                  : c.grade === "A"
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-foreground"
                              }
                            >
                              {c.grade}
                            </span>
                          </TableCell>
                          <TableCell className="text-center font-mono">
                            {c.gradePoint.toFixed(1)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
