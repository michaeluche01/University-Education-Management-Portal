"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
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

interface DepartmentOption {
  id: string;
  code: string;
  name: string;
}

interface ProgramOption {
  id: string;
  code: string;
  name: string;
  departmentId: string;
}

interface LevelOption {
  id: string;
  levelNumber: number;
  name: string;
}

interface CourseOption {
  id: string;
  code: string;
  title: string;
}

interface SessionItem {
  id: string;
  name: string;
  isCurrent: boolean;
  semesters: Array<{
    id: string;
    name: string;
    isCurrent: boolean;
  }>;
}

interface AdminRegistrationRow {
  id: string;
  registeredAt: string;
  student: {
    id: string;
    matricNumber: string;
    user: { fullName: string; email: string };
    department: { id: string; code: string; name: string };
    program: { id: string; code: string; name: string };
    level: { id: string; levelNumber: number; name: string };
  };
  course: {
    id: string;
    code: string;
    title: string;
    creditUnits: number;
    semesterName: string;
  };
  semester: {
    id: string;
    name: string;
    session: { id: string; name: string };
  };
}

interface RegistrationsViewProps {
  role: "SUPER_ADMIN" | "DEPARTMENT_ADMIN";
  departmentName?: string | null;
}

export function RegistrationsView({
  role,
  departmentName,
}: RegistrationsViewProps) {
  const isSuperAdmin = role === "SUPER_ADMIN";

  const [rows, setRows] = useState<AdminRegistrationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [levels, setLevels] = useState<LevelOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [semesters, setSemesters] = useState<
    Array<{ id: string; label: string }>
  >([]);

  const [filterDepartmentId, setFilterDepartmentId] = useState("");
  const [filterSemesterId, setFilterSemesterId] = useState("");
  const [filterProgramId, setFilterProgramId] = useState("");
  const [filterLevelId, setFilterLevelId] = useState("");
  const [filterCourseId, setFilterCourseId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLookups = useCallback(async () => {
    try {
      const [deptRes, progRes, lvlRes, crsRes, sesRes] = await Promise.all([
        isSuperAdmin ? fetch("/api/v1/departments") : Promise.resolve(null),
        fetch("/api/v1/programs"),
        fetch("/api/v1/levels"),
        fetch("/api/v1/courses?page=1&pageSize=100"),
        fetch("/api/v1/sessions"),
      ]);

      if (deptRes && deptRes.ok) {
        const j = await deptRes.json();
        setDepartments(j.data);
      }
      if (progRes.ok) {
        const j = await progRes.json();
        setPrograms(j.data);
      }
      if (lvlRes.ok) {
        const j = await lvlRes.json();
        setLevels(j.data);
      }
      if (crsRes.ok) {
        const j = await crsRes.json();
        setCourses(j.data.items);
      }
      if (sesRes.ok) {
        const j = await sesRes.json();
        const list: Array<{ id: string; label: string }> = [];
        for (const s of j.data as SessionItem[]) {
          for (const sem of s.semesters) {
            list.push({
              id: sem.id,
              label: `${s.name} — ${sem.name}${sem.isCurrent ? " (Current)" : ""}`,
            });
          }
        }
        setSemesters(list);
      }
    } catch {
      // Handled in main fetch
    }
  }, [isSuperAdmin]);

  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", "30");
      if (isSuperAdmin && filterDepartmentId) {
        params.set("departmentId", filterDepartmentId);
      }
      if (filterSemesterId) params.set("semesterId", filterSemesterId);
      if (filterProgramId) params.set("programId", filterProgramId);
      if (filterLevelId) params.set("levelId", filterLevelId);
      if (filterCourseId) params.set("courseId", filterCourseId);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/v1/registrations?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json?.error?.message ?? "Failed to load course registrations"
        );
      }

      setRows(json.data.items);
      setTotal(json.data.total);
      setTotalPages(json.data.totalPages);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load registrations"
      );
    } finally {
      setLoading(false);
    }
  }, [
    page,
    isSuperAdmin,
    filterDepartmentId,
    filterSemesterId,
    filterProgramId,
    filterLevelId,
    filterCourseId,
    searchQuery,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchLookups();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchLookups]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchRegistrations();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchRegistrations]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course Registrations"
        description={
          isSuperAdmin
            ? `University-wide student course registrations (${total} total).`
            : `Student course registrations in ${departmentName ?? "your department"} (${total} total).`
        }
      />

      {/* Filter Bar */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 rounded-lg border bg-card p-3.5">
        {isSuperAdmin ? (
          <div className="space-y-1">
            <Label htmlFor="flt-reg-dept" className="text-xs">
              Department
            </Label>
            <select
              id="flt-reg-dept"
              value={filterDepartmentId}
              onChange={(e) => {
                setFilterDepartmentId(e.target.value);
                setPage(1);
              }}
              className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-1">
          <Label htmlFor="flt-reg-sem" className="text-xs">
            Semester
          </Label>
          <select
            id="flt-reg-sem"
            value={filterSemesterId}
            onChange={(e) => {
              setFilterSemesterId(e.target.value);
              setPage(1);
            }}
            className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs"
          >
            <option value="">All Semesters</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="flt-reg-crs" className="text-xs">
            Course
          </Label>
          <select
            id="flt-reg-crs"
            value={filterCourseId}
            onChange={(e) => {
              setFilterCourseId(e.target.value);
              setPage(1);
            }}
            className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs"
          >
            <option value="">All Courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="flt-reg-prog" className="text-xs">
            Program
          </Label>
          <select
            id="flt-reg-prog"
            value={filterProgramId}
            onChange={(e) => {
              setFilterProgramId(e.target.value);
              setPage(1);
            }}
            className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs"
          >
            <option value="">All Programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="flt-reg-lvl" className="text-xs">
            Level
          </Label>
          <select
            id="flt-reg-lvl"
            value={filterLevelId}
            onChange={(e) => {
              setFilterLevelId(e.target.value);
              setPage(1);
            }}
            className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs"
          >
            <option value="">All Levels</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearchQuery(searchInput.trim());
            setPage(1);
          }}
          className="space-y-1"
        >
          <Label htmlFor="flt-reg-search" className="text-xs">
            Search
          </Label>
          <div className="flex gap-1.5">
            <Input
              id="flt-reg-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Student name, matric, or course..."
              className="h-9 text-xs"
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              className="h-9 px-2.5"
            >
              <Search className="h-3.5 w-3.5" />
            </Button>
          </div>
        </form>
      </div>

      {loading ? (
        <LoadingSkeleton rows={6} label="Loading course registrations..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchRegistrations} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No course registrations found"
          description="No course registrations match the selected filters."
        />
      ) : (
        <>
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Matric No.</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Program / Level
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Session & Semester
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      <div>{row.student.user.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.student.department.code}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold whitespace-nowrap">
                      {row.student.matricNumber}
                    </TableCell>
                    <TableCell>
                      <div className="font-mono font-semibold text-xs">
                        {row.course.code}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.course.title}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.course.creditUnits}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs">
                      {row.student.program.code} · {row.student.level.name}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {row.semester.session.name} ({row.semester.name})
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Page {page} of {totalPages} ({total} registrations)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

