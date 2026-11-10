import { Metadata } from "next";
import { requireRole } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";
import { getStudentAcademicHistory } from "@/server/services/student-results.service";
import { PrintButton } from "@/components/shared/PrintButton";

export const metadata: Metadata = {
  title: "Academic Result Statement - UEMP",
};

export default async function PrintStudentResultsPage() {
  const session = await requireRole(["STUDENT"]);
  const history = await getStudentAcademicHistory(session);

  const gradeScale = await prisma.gradeScale.findMany({
    orderBy: { minScore: "desc" },
  });

  const { student, semesters, careerSummary } = history;
  const printDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8 print:p-0">
      {/* Screen toolbar (hidden in print) */}
      <div className="mb-6 flex items-center justify-between print:hidden max-w-4xl mx-auto">
        <a
          href="/student/results"
          className="text-sm text-muted-foreground hover:underline"
        >
          &larr; Back to Academic Results
        </a>
        <PrintButton />
      </div>

      <div className="max-w-4xl mx-auto bg-card p-6 sm:p-8 rounded-lg border shadow-xs print:border-none print:shadow-none print:p-0 space-y-6 text-foreground">
        {/* Header */}
        <div className="text-center border-b pb-4 space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight uppercase">
            University Examination Management Portal
          </h1>
          <h2 className="text-sm sm:text-base font-semibold text-muted-foreground uppercase tracking-wide">
            Statement of Academic Examination Results
          </h2>
          <p className="text-xs text-muted-foreground">
            Issued on: {printDate}
          </p>
        </div>

        {/* Bio-data */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs sm:text-sm border rounded-md p-4 bg-muted/20 print:bg-transparent">
          <div>
            <span className="text-muted-foreground block text-[11px] uppercase">
              Student Full Name
            </span>
            <span className="font-semibold">{student.fullName}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px] uppercase">
              Matriculation Number
            </span>
            <span className="font-mono font-semibold">
              {student.matricNumber}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px] uppercase">
              Academic Level
            </span>
            <span className="font-semibold">{student.level}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px] uppercase">
              Faculty
            </span>
            <span className="font-semibold">{student.faculty}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px] uppercase">
              Department
            </span>
            <span className="font-semibold">{student.department}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px] uppercase">
              Degree Program
            </span>
            <span className="font-semibold">{student.program}</span>
          </div>
        </div>

        {/* Semesters */}
        {semesters.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground border rounded-md">
            No approved examination results have been recorded for this student.
          </div>
        ) : (
          <div className="space-y-6">
            {semesters.map((sem) => (
              <div
                key={sem.semesterId}
                className="space-y-2 border rounded-md p-3 sm:p-4 print:border-black"
              >
                <div className="flex items-center justify-between border-b pb-2 text-xs sm:text-sm font-semibold">
                  <span>
                    {sem.sessionName} — {sem.semesterName} Semester
                  </span>
                  <div className="space-x-4">
                    <span>
                      GPA:{" "}
                      <strong>
                        {sem.semesterGpa !== null
                          ? sem.semesterGpa.toFixed(2)
                          : "—"}
                      </strong>
                    </span>
                    <span>
                      Cumulative CGPA:{" "}
                      <strong>
                        {sem.cumulativeGpa !== null
                          ? sem.cumulativeGpa.toFixed(2)
                          : "—"}
                      </strong>
                    </span>
                  </div>
                </div>

                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b text-muted-foreground font-semibold">
                      <th className="py-1.5 w-24">Course Code</th>
                      <th className="py-1.5">Course Title</th>
                      <th className="py-1.5 text-center w-14">Units</th>
                      <th className="py-1.5 text-center w-14">Total</th>
                      <th className="py-1.5 text-center w-14">Grade</th>
                      <th className="py-1.5 text-center w-14">GP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sem.courses.map((c) => (
                      <tr key={c.id} className="border-b last:border-b-0">
                        <td className="py-1.5 font-mono">{c.courseCode}</td>
                        <td className="py-1.5">{c.courseTitle}</td>
                        <td className="py-1.5 text-center">{c.creditUnits}</td>
                        <td className="py-1.5 text-center font-mono">
                          {c.totalScore.toFixed(2)}
                        </td>
                        <td className="py-1.5 text-center font-bold">
                          {c.grade}
                        </td>
                        <td className="py-1.5 text-center font-mono">
                          {c.gradePoint.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                  <span>Registered Units: {sem.registeredUnits}</span>
                  <span>Earned Units: {sem.earnedUnits}</span>
                  <span>
                    Cumulative Units Registered: {sem.cumulativeRegisteredUnits}
                  </span>
                  <span>Cumulative Units Earned: {sem.cumulativeEarnedUnits}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Career Summary */}
        <div className="border rounded-md p-4 bg-muted/10 print:bg-transparent space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
            Overall Career Academic Summary
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs sm:text-sm">
            <div>
              <span className="text-muted-foreground block text-[11px]">
                Total Units Registered
              </span>
              <span className="font-bold">
                {careerSummary.totalUnitsRegistered}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">
                Total Units Earned
              </span>
              <span className="font-bold">
                {careerSummary.totalUnitsEarned}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">
                Final Cumulative GPA (CGPA)
              </span>
              <span className="text-base font-bold text-primary">
                {careerSummary.cgpa !== null
                  ? careerSummary.cgpa.toFixed(2)
                  : "—"}{" "}
                / 5.00
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">
                Academic Standing
              </span>
              <span className="font-bold">
                {careerSummary.academicStanding}
              </span>
            </div>
          </div>
        </div>

        {/* Grade Scale Legend */}
        <div className="text-[11px] text-muted-foreground border-t pt-3">
          <div className="font-semibold mb-1">Grading Scale (5.0 System):</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {gradeScale.map((g) => (
              <span key={g.id}>
                <strong>{g.grade}</strong>: {g.minScore}–{g.maxScore}% (
                {g.gradePoint.toFixed(1)} GP - {g.remark})
              </span>
            ))}
          </div>
        </div>

        {/* Official Disclaimer */}
        <div className="border-t-2 border-dashed pt-4 text-center space-y-1">
          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
            *** STUDENT COPY — NOT AN OFFICIAL TRANSCRIPT ***
          </p>
          <p className="text-[10px] text-muted-foreground">
            This document is generated by the University Examination Management Portal (UEMP) for the student&rsquo;s personal reference. It does not replace an official stamped and sealed university transcript.
          </p>
        </div>
      </div>
    </div>
  );
}
