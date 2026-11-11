"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  BarChart2,
  BookOpen,
  Download,
  Printer,
  Search,
  Users,
} from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { downloadCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Program {
  id: string;
  name: string;
  code: string;
}

interface Level {
  id: string;
  name: string;
  levelNumber: number;
}

interface Semester {
  id: string;
  name: string;
  sessionName: string;
  isCurrent: boolean;
}

interface StudentItem {
  id: string;
  matricNumber: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  departmentName: string;
  programName: string;
  levelName: string;
}

interface CourseRegItem {
  courseId: string;
  courseCode: string;
  courseTitle: string;
  creditUnits: number;
  departmentName: string;
  programName: string;
  levelName: string;
  lecturers: string;
  registeredCount: number;
}

interface LevelTotal {
  levelId: string;
  levelName: string;
  levelNumber: number;
  count: number;
}

interface CoursePerfItem {
  courseId: string;
  courseCode: string;
  courseTitle: string;
  creditUnits: number;
  departmentName: string;
  programName: string;
  levelName: string;
  lecturers: string;
  resultsCount: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passRate: number;
  gradeDistribution: {
    A: number;
    B: number;
    C: number;
    D: number;
    E: number;
    F: number;
  };
}

interface ProgramPerfItem {
  programId: string;
  programName: string;
  programCode: string;
  resultsCount: number;
  weightedGpa: number;
}

export function ReportsView({
  userRole,
  userDepartmentName,
}: {
  userRole: Role;
  userDepartmentName?: string | null;
}) {
  const isLecturer = userRole === "LECTURER";
  const isSuperAdmin = userRole === "SUPER_ADMIN";

  const [activeTab, setActiveTab] = useState<"students" | "registrations" | "performance">(
    isLecturer ? "registrations" : "students"
  );

  // Common metadata for filters
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);

  // Filter states
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedProg, setSelectedProg] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [studentStatus, setStudentStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Data states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Student list data
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [studentPage, setStudentPage] = useState(1);
  const [studentTotalPages, setStudentTotalPages] = useState(1);
  const [studentTotalCount, setStudentTotalCount] = useState(0);

  // Registration report data
  const [regSemester, setRegSemester] = useState<Semester | null>(null);
  const [regCourses, setRegCourses] = useState<CourseRegItem[]>([]);
  const [regLevelTotals, setRegLevelTotals] = useState<LevelTotal[]>([]);
  const [regTotalCount, setRegTotalCount] = useState(0);

  // Performance report data
  const [perfSemester, setPerfSemester] = useState<Semester | null>(null);
  const [perfCourses, setPerfCourses] = useState<CoursePerfItem[]>([]);
  const [perfPrograms, setPerfPrograms] = useState<ProgramPerfItem[]>([]);

  // Fetch filter options once
  useEffect(() => {
    async function loadMetadata() {
      try {
        const [progRes, lvlRes, semRes] = await Promise.all([
          fetch("/api/v1/programs"),
          fetch("/api/v1/levels"),
          fetch("/api/v1/sessions"),
        ]);

        if (progRes.ok) {
          const json = await progRes.json();
          setPrograms(json.data ?? []);
        }
        if (lvlRes.ok) {
          const json = await lvlRes.json();
          setLevels(json.data ?? []);
        }
        if (semRes.ok) {
          const json = await semRes.json();
          const sessList = json.data ?? [];
          const allSems: Semester[] = [];
          for (const s of sessList) {
            if (s.semesters) {
              for (const sem of s.semesters) {
                allSems.push({
                  id: sem.id,
                  name: sem.name,
                  sessionName: s.name,
                  isCurrent: sem.isCurrent,
                });
              }
            }
          }
          setSemesters(allSems);
          const current = allSems.find((s) => s.isCurrent);
          if (current) {
            setSelectedSemester(current.id);
          }
        }

        if (isSuperAdmin) {
          const deptRes = await fetch("/api/v1/departments");
          if (deptRes.ok) {
            const json = await deptRes.json();
            setDepartments(json.data ?? []);
          }
        }
      } catch (err) {
        console.error("Failed to load metadata", err);
      }
    }

    void loadMetadata();
  }, [isSuperAdmin]);

  // Fetch Student Report
  const fetchStudents = useCallback(
    async (pageToFetch: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(pageToFetch),
          pageSize: "20",
        });
        if (selectedDept) params.set("departmentId", selectedDept);
        if (selectedProg) params.set("programId", selectedProg);
        if (selectedLevel) params.set("levelId", selectedLevel);
        if (studentStatus) params.set("status", studentStatus);
        if (searchQuery.trim()) params.set("search", searchQuery.trim());

        const res = await fetch(`/api/v1/reports/students?${params.toString()}`);
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error?.message || "Failed to load student report");
        }
        const json = await res.json();
        setStudents(json.data.items);
        setStudentPage(json.data.pagination.page);
        setStudentTotalPages(json.data.pagination.totalPages);
        setStudentTotalCount(json.data.pagination.total);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    },
    [selectedDept, selectedProg, selectedLevel, studentStatus, searchQuery]
  );

  // Fetch Registration Report
  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedSemester) params.set("semesterId", selectedSemester);
      if (selectedDept) params.set("departmentId", selectedDept);
      if (selectedProg) params.set("programId", selectedProg);
      if (selectedLevel) params.set("levelId", selectedLevel);

      const res = await fetch(`/api/v1/reports/registrations?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error?.message || "Failed to load registration report");
      }
      const json = await res.json();
      setRegSemester(json.data.semester);
      setRegCourses(json.data.courses);
      setRegLevelTotals(json.data.totalsByLevel);
      setRegTotalCount(json.data.totalRegistrations);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [selectedSemester, selectedDept, selectedProg, selectedLevel]);

  // Fetch Performance Report
  const fetchPerformance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedSemester) params.set("semesterId", selectedSemester);
      if (selectedDept) params.set("departmentId", selectedDept);
      if (selectedProg) params.set("programId", selectedProg);
      if (selectedLevel) params.set("levelId", selectedLevel);

      const res = await fetch(`/api/v1/reports/performance?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error?.message || "Failed to load performance report");
      }
      const json = await res.json();
      setPerfSemester(json.data.semester);
      setPerfCourses(json.data.courses);
      setPerfPrograms(json.data.programs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [selectedSemester, selectedDept, selectedProg, selectedLevel]);

  // Trigger load when tab or key filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === "students" && !isLecturer) {
        void fetchStudents(1);
      } else if (activeTab === "registrations") {
        void fetchRegistrations();
      } else if (activeTab === "performance") {
        void fetchPerformance();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [activeTab, isLecturer, fetchStudents, fetchRegistrations, fetchPerformance]);

  // CSV Export functions
  function exportStudentsCsv() {
    const headers = [
      "Matric Number",
      "Full Name",
      "Email",
      "Phone",
      "Status",
      "Department",
      "Program",
      "Level",
    ];
    const rows = students.map((s) => [
      s.matricNumber,
      s.fullName,
      s.email,
      s.phone || "",
      s.status,
      s.departmentName,
      s.programName,
      s.levelName,
    ]);
    downloadCsv("student-list-report", headers, rows);
  }

  function exportRegistrationsCsv() {
    const headers = [
      "Course Code",
      "Course Title",
      "Units",
      "Level",
      "Department",
      "Lecturer",
      "Registered Count",
    ];
    const rows = regCourses.map((c) => [
      c.courseCode,
      c.courseTitle,
      c.creditUnits,
      c.levelName,
      c.departmentName,
      c.lecturers,
      c.registeredCount,
    ]);
    downloadCsv("course-registrations-report", headers, rows);
  }

  function exportPerformanceCsv() {
    const headers = [
      "Course Code",
      "Course Title",
      "Units",
      "Level",
      "Department",
      "Lecturer",
      "Approved Results",
      "Average Score",
      "Highest Score",
      "Lowest Score",
      "Pass Rate (%)",
      "Grade A",
      "Grade B",
      "Grade C",
      "Grade D",
      "Grade E",
      "Grade F",
    ];
    const rows = perfCourses.map((c) => [
      c.courseCode,
      c.courseTitle,
      c.creditUnits,
      c.levelName,
      c.departmentName,
      c.lecturers,
      c.resultsCount,
      c.averageScore,
      c.highestScore,
      c.lowestScore,
      `${c.passRate}%`,
      c.gradeDistribution.A,
      c.gradeDistribution.B,
      c.gradeDistribution.C,
      c.gradeDistribution.D,
      c.gradeDistribution.E,
      c.gradeDistribution.F,
    ]);
    downloadCsv("academic-performance-report", headers, rows);
  }

  function exportProgramsCsv() {
    const headers = [
      "Program Code",
      "Program Name",
      "Approved Results",
      "Credit-Weighted GPA",
    ];
    const rows = perfPrograms.map((p) => [
      p.programCode,
      p.programName,
      p.resultsCount,
      p.weightedGpa.toFixed(2),
    ]);
    downloadCsv("program-performance-report", headers, rows);
  }

  const generatedDateStr = new Date().toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-6">
      {/* Print-only institution header */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          University Education Management Portal (UEMP)
        </h1>
        <h2 className="text-lg font-semibold text-neutral-800 mt-1">
          {activeTab === "students" && "Student List Report"}
          {activeTab === "registrations" && "Course Registration Report"}
          {activeTab === "performance" && "Academic Performance Summary"}
        </h2>
        <div className="text-xs text-neutral-600 mt-2 space-y-0.5">
          <p>
            <strong>Generated:</strong> {generatedDateStr} | <strong>Role:</strong> {userRole}
            {userDepartmentName && ` | Department: ${userDepartmentName}`}
          </p>
          {(activeTab === "registrations" || activeTab === "performance") && (
            <p>
              <strong>Session / Semester:</strong>{" "}
              {activeTab === "registrations"
                ? `${regSemester?.sessionName ?? ""} - ${regSemester?.name ?? ""}`
                : `${perfSemester?.sessionName ?? ""} - ${perfSemester?.name ?? ""}`}
            </p>
          )}
        </div>
      </div>

      {/* Screen Header */}
      <div className="print:hidden">
        <PageHeader
          title="Reports & Analytics"
          description="View student rosters, course registration summaries, and academic performance metrics."
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Print Report
            </Button>
          }
        />
      </div>

      {/* Navigation Tabs (Screen only) */}
      <div className="print:hidden border-b flex gap-2 overflow-x-auto">
        {!isLecturer && (
          <button
            type="button"
            onClick={() => setActiveTab("students")}
            className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === "students"
                ? "border-primary text-primary"
                : "border-transparent text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <Users className="h-4 w-4" />
            Student List
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab("registrations")}
          className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === "registrations"
              ? "border-primary text-primary"
              : "border-transparent text-neutral-600 hover:text-neutral-900"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Course Registrations
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("performance")}
          className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === "performance"
              ? "border-primary text-primary"
              : "border-transparent text-neutral-600 hover:text-neutral-900"
          }`}
        >
          <BarChart2 className="h-4 w-4" />
          Academic Performance
        </button>
      </div>

      {/* Filter Bar (Screen only) */}
      <Card className="print:hidden">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(activeTab === "registrations" || activeTab === "performance") && (
              <div>
                <Label htmlFor="rep-semester" className="text-xs">
                  Academic Semester
                </Label>
                <select
                  id="rep-semester"
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sessionName} — {s.name} {s.isCurrent ? "(Current)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isSuperAdmin && (
              <div>
                <Label htmlFor="rep-dept" className="text-xs">
                  Department
                </Label>
                <select
                  id="rep-dept"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <Label htmlFor="rep-prog" className="text-xs">
                Program
              </Label>
              <select
                id="rep-prog"
                value={selectedProg}
                onChange={(e) => setSelectedProg(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All Programs</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="rep-level" className="text-xs">
                Level
              </Label>
              <select
                id="rep-level"
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All Levels</option>
                {levels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.name}
                  </option>
                ))}
              </select>
            </div>

            {activeTab === "students" && (
              <>
                <div>
                  <Label htmlFor="rep-status" className="text-xs">
                    Status
                  </Label>
                  <select
                    id="rep-status"
                    value={studentStatus}
                    onChange={(e) => setStudentStatus(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">All Statuses</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="DEACTIVATED">DEACTIVATED</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="rep-search" className="text-xs">
                    Search Student
                  </Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                    <Input
                      id="rep-search"
                      placeholder="Name, Matric, Email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 text-sm h-8"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content Area */}
      {error && (
        <ErrorState
          title="Failed to Load Report"
          message={error}
          onRetry={() => {
            if (activeTab === "students") void fetchStudents(studentPage);
            else if (activeTab === "registrations") void fetchRegistrations();
            else void fetchPerformance();
          }}
        />
      )}

      {loading && !error && <LoadingSkeleton rows={6} />}

      {!loading && !error && (
        <>
          {/* TAB 1: Student List Report */}
          {activeTab === "students" && !isLecturer && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Enrolled Students ({studentTotalCount})
                  </CardTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportStudentsCsv}
                  disabled={students.length === 0}
                  className="gap-2 print:hidden"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                {students.length === 0 ? (
                  <EmptyState
                    icon={<Users className="h-6 w-6 text-neutral-400" />}
                    title="No Students Found"
                    description="No student records match the selected filter criteria."
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Matric Number</TableHead>
                            <TableHead>Full Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Program</TableHead>
                            <TableHead>Level</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {students.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell className="font-mono text-xs font-semibold">
                                {s.matricNumber}
                              </TableCell>
                              <TableCell className="font-medium">{s.fullName}</TableCell>
                              <TableCell className="text-xs text-neutral-600">
                                {s.email}
                              </TableCell>
                              <TableCell className="text-xs">{s.departmentName}</TableCell>
                              <TableCell className="text-xs">{s.programName}</TableCell>
                              <TableCell className="text-xs">{s.levelName}</TableCell>
                              <TableCell>
                                <StatusBadge status={s.status} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination (Screen only) */}
                    {studentTotalPages > 1 && (
                      <div className="flex items-center justify-between text-xs text-neutral-600 pt-2 print:hidden">
                        <span>
                          Page {studentPage} of {studentTotalPages}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={studentPage <= 1}
                            onClick={() => void fetchStudents(studentPage - 1)}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={studentPage >= studentTotalPages}
                            onClick={() => void fetchStudents(studentPage + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* TAB 2: Course Registrations Report */}
          {activeTab === "registrations" && (
            <div className="space-y-6">
              {/* Level totals cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <p className="text-xs text-neutral-500 font-medium">
                      Total Course Registrations
                    </p>
                    <p className="text-2xl font-bold text-neutral-900 mt-1">
                      {regTotalCount}
                    </p>
                  </CardContent>
                </Card>
                {regLevelTotals.map((lvl) => (
                  <Card key={lvl.levelId}>
                    <CardContent className="pt-4 pb-4">
                      <p className="text-xs text-neutral-500 font-medium">
                        {lvl.levelName}
                      </p>
                      <p className="text-2xl font-bold text-neutral-900 mt-1">
                        {lvl.count}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Course registrations table */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Course Enrolments — {regSemester?.sessionName} {regSemester?.name}
                    </CardTitle>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportRegistrationsCsv}
                    disabled={regCourses.length === 0}
                    className="gap-2 print:hidden"
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  {regCourses.length === 0 ? (
                    <EmptyState
                      icon={<BookOpen className="h-6 w-6 text-neutral-400" />}
                      title="No Course Registrations"
                      description="No registration records match the selected semester and filters."
                    />
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Course Code</TableHead>
                            <TableHead>Course Title</TableHead>
                            <TableHead className="text-center">Units</TableHead>
                            <TableHead>Level</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Lecturer</TableHead>
                            <TableHead className="text-right">Registered Students</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {regCourses.map((c) => (
                            <TableRow key={c.courseId}>
                              <TableCell className="font-mono text-xs font-semibold">
                                {c.courseCode}
                              </TableCell>
                              <TableCell className="font-medium text-xs">
                                {c.courseTitle}
                              </TableCell>
                              <TableCell className="text-center text-xs">
                                {c.creditUnits}
                              </TableCell>
                              <TableCell className="text-xs">{c.levelName}</TableCell>
                              <TableCell className="text-xs">{c.departmentName}</TableCell>
                              <TableCell className="text-xs text-neutral-600">
                                {c.lecturers}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-xs">
                                {c.registeredCount}
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
          )}

          {/* TAB 3: Academic Performance Report */}
          {activeTab === "performance" && (
            <div className="space-y-6">
              {/* Brief requirement alert note */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Approved Results Only</p>
                  <p className="mt-0.5 text-amber-800">
                    Per institution policy, academic performance summaries and grade
                    distributions reflect ONLY fully approved results. Unsubmitted drafts,
                    pending submissions, and results returned for correction are strictly
                    excluded.
                  </p>
                </div>
              </div>

              {/* Program weighted GPAs */}
              {perfPrograms.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold">
                        Program Performance Summary (Credit-Weighted GPA)
                      </CardTitle>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportProgramsCsv}
                      className="gap-2 print:hidden"
                    >
                      <Download className="h-4 w-4" />
                      Export Programs CSV
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Program Code</TableHead>
                            <TableHead>Program Name</TableHead>
                            <TableHead className="text-center">Approved Results</TableHead>
                            <TableHead className="text-right">Credit-Weighted Average GPA</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {perfPrograms.map((p) => (
                            <TableRow key={p.programId}>
                              <TableCell className="font-mono text-xs font-semibold">
                                {p.programCode}
                              </TableCell>
                              <TableCell className="font-medium text-xs">
                                {p.programName}
                              </TableCell>
                              <TableCell className="text-center text-xs">
                                {p.resultsCount}
                              </TableCell>
                              <TableCell className="text-right font-bold text-xs text-primary">
                                {p.weightedGpa.toFixed(2)} / 5.00
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Course-level performance table */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Course Performance Breakdown — {perfSemester?.sessionName}{" "}
                      {perfSemester?.name}
                    </CardTitle>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportPerformanceCsv}
                    disabled={perfCourses.length === 0}
                    className="gap-2 print:hidden"
                  >
                    <Download className="h-4 w-4" />
                    Export Courses CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  {perfCourses.length === 0 ? (
                    <EmptyState
                      icon={<BarChart2 className="h-6 w-6 text-neutral-400" />}
                      title="No Approved Results Found"
                      description="No approved examination results match the selected semester and filters."
                    />
                  ) : (
                    <div className="space-y-4">
                      {/* Grade Bar Legend */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-600 print:hidden border-b pb-2">
                        <span className="font-semibold">Grade Legend:</span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-xs bg-emerald-600 inline-block" /> A
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-xs bg-blue-600 inline-block" /> B
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block" /> C
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-xs bg-orange-500 inline-block" /> D
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-xs bg-purple-500 inline-block" /> E
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-xs bg-rose-600 inline-block" /> F
                        </span>
                      </div>

                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Course</TableHead>
                              <TableHead className="text-center">Units</TableHead>
                              <TableHead>Lecturer</TableHead>
                              <TableHead className="text-center">Results</TableHead>
                              <TableHead className="text-center">Avg</TableHead>
                              <TableHead className="text-center">High / Low</TableHead>
                              <TableHead className="text-center">Pass Rate</TableHead>
                              <TableHead className="w-56">Grade Distribution</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {perfCourses.map((c) => {
                              const total = c.resultsCount;
                              const pA = total > 0 ? (c.gradeDistribution.A / total) * 100 : 0;
                              const pB = total > 0 ? (c.gradeDistribution.B / total) * 100 : 0;
                              const pC = total > 0 ? (c.gradeDistribution.C / total) * 100 : 0;
                              const pD = total > 0 ? (c.gradeDistribution.D / total) * 100 : 0;
                              const pE = total > 0 ? (c.gradeDistribution.E / total) * 100 : 0;
                              const pF = total > 0 ? (c.gradeDistribution.F / total) * 100 : 0;

                              return (
                                <TableRow key={c.courseId}>
                                  <TableCell>
                                    <div className="font-mono text-xs font-semibold">
                                      {c.courseCode}
                                    </div>
                                    <div className="text-xs text-neutral-500 truncate max-w-44">
                                      {c.courseTitle}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center text-xs">
                                    {c.creditUnits}
                                  </TableCell>
                                  <TableCell className="text-xs text-neutral-600 truncate max-w-36">
                                    {c.lecturers}
                                  </TableCell>
                                  <TableCell className="text-center text-xs font-semibold">
                                    {c.resultsCount}
                                  </TableCell>
                                  <TableCell className="text-center text-xs">
                                    {c.averageScore.toFixed(1)}
                                  </TableCell>
                                  <TableCell className="text-center text-xs">
                                    {c.highestScore} / {c.lowestScore}
                                  </TableCell>
                                  <TableCell className="text-center text-xs font-semibold">
                                    <span
                                      className={
                                        c.passRate >= 70
                                          ? "text-emerald-700 font-bold"
                                          : c.passRate >= 50
                                          ? "text-neutral-800"
                                          : "text-rose-700 font-bold"
                                      }
                                    >
                                      {c.passRate}%
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    {total === 0 ? (
                                      <span className="text-neutral-400 text-xs">—</span>
                                    ) : (
                                      <div className="space-y-1">
                                        {/* Pure CSS distribution bar */}
                                        <div
                                          className="h-3 w-full bg-neutral-100 rounded-xs overflow-hidden flex"
                                          title={`A: ${c.gradeDistribution.A}, B: ${c.gradeDistribution.B}, C: ${c.gradeDistribution.C}, D: ${c.gradeDistribution.D}, E: ${c.gradeDistribution.E}, F: ${c.gradeDistribution.F}`}
                                        >
                                          {pA > 0 && (
                                            <div
                                              style={{ width: `${pA}%` }}
                                              className="bg-emerald-600 h-full"
                                            />
                                          )}
                                          {pB > 0 && (
                                            <div
                                              style={{ width: `${pB}%` }}
                                              className="bg-blue-600 h-full"
                                            />
                                          )}
                                          {pC > 0 && (
                                            <div
                                              style={{ width: `${pC}%` }}
                                              className="bg-amber-500 h-full"
                                            />
                                          )}
                                          {pD > 0 && (
                                            <div
                                              style={{ width: `${pD}%` }}
                                              className="bg-orange-500 h-full"
                                            />
                                          )}
                                          {pE > 0 && (
                                            <div
                                              style={{ width: `${pE}%` }}
                                              className="bg-purple-500 h-full"
                                            />
                                          )}
                                          {pF > 0 && (
                                            <div
                                              style={{ width: `${pF}%` }}
                                              className="bg-rose-600 h-full"
                                            />
                                          )}
                                        </div>
                                        {/* Micro labels */}
                                        <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
                                          <span>A:{c.gradeDistribution.A}</span>
                                          <span>B:{c.gradeDistribution.B}</span>
                                          <span>C:{c.gradeDistribution.C}</span>
                                          <span>D:{c.gradeDistribution.D}</span>
                                          <span>E:{c.gradeDistribution.E}</span>
                                          <span className="text-rose-600">
                                            F:{c.gradeDistribution.F}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

