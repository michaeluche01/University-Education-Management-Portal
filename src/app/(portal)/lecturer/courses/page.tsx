import Link from "next/link";
import { ExternalLink } from "lucide-react";
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

export default async function LecturerCoursesListPage() {
  const session = await requireRole(["LECTURER"]);
  const data = await getLecturerDashboardData(session);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Assigned Courses"
        description={
          data.currentSemester
            ? `Teaching assignments for ${data.currentSemester.sessionName} (${data.currentSemester.name} Semester).`
            : "Teaching assignments"
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Courses List</CardTitle>
          <CardDescription>
            Select a course to view registered students, enter continuous assessment and exam scores, and submit results.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.assignments.length === 0 ? (
            <EmptyState
              title="No courses assigned"
              description="You have no assigned courses for the current semester."
            />
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course Code</TableHead>
                    <TableHead>Course Title</TableHead>
                    <TableHead>Credit Units</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Entered</TableHead>
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
                        {asgn.enteredCount} / {asgn.registeredCount}
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
    </div>
  );
}
