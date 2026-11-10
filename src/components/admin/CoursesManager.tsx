"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Pencil,
  Plus,
  Power,
  Search,
  UserCheck,
  UserMinus,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export interface CoursesManagerProps {
  role: "SUPER_ADMIN" | "DEPARTMENT_ADMIN";
}

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

interface LecturerOption {
  id: string;
  staffId: string;
  title: string | null;
  departmentId: string;
  user: {
    id: string;
    fullName: string;
    email: string;
  };
}

interface CurrentSemesterInfo {
  id: string;
  name: "FIRST" | "SECOND";
  registrationOpen: boolean;
  sessionId: string;
  sessionName: string;
}

interface CourseItem {
  id: string;
  code: string;
  title: string;
  creditUnits: number;
  description: string | null;
  departmentId: string;
  programId: string;
  levelId: string;
  semesterName: "FIRST" | "SECOND";
  isActive: boolean;
  department: DepartmentOption;
  program: { id: string; code: string; name: string };
  level: LevelOption;
  _count: {
    registrations: number;
    results: number;
    assignments: number;
  };
  currentAssignment: {
    id: string;
    semesterId: string;
    lecturerId: string;
    lecturer: LecturerOption;
  } | null;
}

export function CoursesManager({ role }: CoursesManagerProps) {
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [currentSemester, setCurrentSemester] =
    useState<CurrentSemesterInfo | null>(null);
  const [availableLecturers, setAvailableLecturers] = useState<
    LecturerOption[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reference options
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [levels, setLevels] = useState<LevelOption[]>([]);

  // Filters
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [progFilter, setProgFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [semFilter, setSemFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");

  // Create / Edit Course Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseItem | null>(null);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [creditUnits, setCreditUnits] = useState("3");
  const [description, setDescription] = useState("");
  const [formDeptId, setFormDeptId] = useState("");
  const [formProgId, setFormProgId] = useState("");
  const [formLevelId, setFormLevelId] = useState("");
  const [formSemesterName, setFormSemesterName] = useState<"FIRST" | "SECOND">(
    "FIRST"
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Active Toggle Confirm Dialog
  const [toggleCourse, setToggleCourse] = useState<CourseItem | null>(null);
  const [toggling, setToggling] = useState(false);

  // Assignment Dialog
  const [assignCourse, setAssignCourse] = useState<CourseItem | null>(null);
  const [selectedLecturerId, setSelectedLecturerId] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSaving, setAssignSaving] = useState(false);

  const loadReferenceData = useCallback(async () => {
    try {
      const [deptRes, progRes, lvlRes] = await Promise.all([
        fetch("/api/v1/departments"),
        fetch("/api/v1/programs"),
        fetch("/api/v1/levels"),
      ]);
      if (deptRes.ok) {
        const d = await deptRes.json();
        setDepartments(d.data ?? []);
      }
      if (progRes.ok) {
        const p = await progRes.json();
        setPrograms(p.data ?? []);
      }
      if (lvlRes.ok) {
        const l = await lvlRes.json();
        setLevels(l.data ?? []);
      }
    } catch {
      // Non-fatal; primary error state handled in fetchCourses
    }
  }, []);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", "20");
      if (role === "SUPER_ADMIN" && deptFilter) {
        params.set("departmentId", deptFilter);
      }
      if (progFilter) params.set("programId", progFilter);
      if (levelFilter) params.set("levelId", levelFilter);
      if (semFilter) params.set("semesterName", semFilter);
      if (activeFilter) params.set("isActive", activeFilter);
      if (appliedSearch) params.set("search", appliedSearch);

      const res = await fetch(`/api/v1/courses?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Failed to load courses");
      }

      setCourses(json.data.items);
      setTotal(json.data.total);
      setTotalPages(json.data.totalPages);
      setCurrentSemester(json.data.currentSemester ?? null);
      setAvailableLecturers(json.data.availableLecturers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load courses");
    } finally {
      setLoading(false);
    }
  }, [
    page,
    role,
    deptFilter,
    progFilter,
    levelFilter,
    semFilter,
    activeFilter,
    appliedSearch,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadReferenceData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadReferenceData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchCourses();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchCourses]);

  const filteredFilterPrograms = useMemo(() => {
    if (role === "SUPER_ADMIN" && deptFilter) {
      return programs.filter((p) => p.departmentId === deptFilter);
    }
    return programs;
  }, [programs, role, deptFilter]);

  const filteredFormPrograms = useMemo(() => {
    if (role === "SUPER_ADMIN" && formDeptId) {
      return programs.filter((p) => p.departmentId === formDeptId);
    }
    return programs;
  }, [programs, role, formDeptId]);

  const eligibleLecturersForAssign = useMemo(() => {
    if (!assignCourse) return [];
    return availableLecturers.filter(
      (l) => l.departmentId === assignCourse.departmentId
    );
  }, [availableLecturers, assignCourse]);

  function openCreateDialog() {
    const defaultDept = departments[0]?.id ?? "";
    const defaultProg =
      (role === "SUPER_ADMIN"
        ? programs.find((p) => p.departmentId === defaultDept)?.id
        : programs[0]?.id) ?? "";
    const defaultLvl = levels[0]?.id ?? "";

    setEditingCourse(null);
    setCode("");
    setTitle("");
    setCreditUnits("3");
    setDescription("");
    setFormDeptId(defaultDept);
    setFormProgId(defaultProg);
    setFormLevelId(defaultLvl);
    setFormSemesterName(currentSemester?.name ?? "FIRST");
    setFormError(null);
    setDialogOpen(true);
  }

  function openEditDialog(course: CourseItem) {
    setEditingCourse(course);
    setCode(course.code);
    setTitle(course.title);
    setCreditUnits(String(course.creditUnits));
    setDescription(course.description ?? "");
    setFormDeptId(course.departmentId);
    setFormProgId(course.programId);
    setFormLevelId(course.levelId);
    setFormSemesterName(course.semesterName);
    setFormError(null);
    setDialogOpen(true);
  }

  function handleFormDepartmentChange(newDeptId: string) {
    setFormDeptId(newDeptId);
    const matchingProg =
      programs.find((p) => p.departmentId === newDeptId)?.id ?? "";
    setFormProgId(matchingProg);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const unitsNum = Number(creditUnits);
      const payload: Record<string, unknown> = {
        code,
        title,
        creditUnits: unitsNum,
        description: description.trim() || null,
        programId: formProgId,
        levelId: formLevelId,
        semesterName: formSemesterName,
      };
      if (role === "SUPER_ADMIN") {
        payload.departmentId = formDeptId;
      }

      const url = editingCourse
        ? `/api/v1/courses/${editingCourse.id}`
        : "/api/v1/courses";
      const method = editingCourse ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Failed to save course";
        setFormError(msg);
        toast.error(msg);
        return;
      }

      toast.success(editingCourse ? "Course updated" : "Course created");
      setDialogOpen(false);
      await fetchCourses();
    } catch {
      setFormError("Network error while saving course");
      toast.error("Network error while saving course");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmToggleActive() {
    if (!toggleCourse) return;
    setToggling(true);
    try {
      const nextActive = !toggleCourse.isActive;
      const res = await fetch(`/api/v1/courses/${toggleCourse.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Failed to update course status");
        return;
      }
      toast.success(
        `${toggleCourse.code} ${nextActive ? "activated" : "deactivated"}`
      );
      setToggleCourse(null);
      await fetchCourses();
    } catch {
      toast.error("Network error while toggling course status");
    } finally {
      setToggling(false);
    }
  }

  function openAssignDialog(course: CourseItem) {
    setAssignCourse(course);
    const deptLecturers = availableLecturers.filter(
      (l) => l.departmentId === course.departmentId
    );
    const initialLec =
      course.currentAssignment?.lecturerId ?? deptLecturers[0]?.id ?? "";
    setSelectedLecturerId(initialLec);
    setAssignError(null);
  }

  async function handleAssignSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!assignCourse || !currentSemester) return;
    if (!selectedLecturerId) {
      setAssignError("Please select a lecturer.");
      return;
    }

    setAssignError(null);
    setAssignSaving(true);
    try {
      // If a lecturer is already assigned (Change Lecturer flow), unassign first per D12
      if (
        assignCourse.currentAssignment &&
        assignCourse.currentAssignment.lecturerId !== selectedLecturerId
      ) {
        const unassignRes = await fetch(
          `/api/v1/course-assignments/${assignCourse.currentAssignment.id}`,
          { method: "DELETE" }
        );
        const unassignJson = await unassignRes.json();
        if (!unassignRes.ok) {
          const msg =
            unassignJson?.error?.message ??
            "Cannot unassign current lecturer";
          setAssignError(msg);
          toast.error(msg);
          return;
        }
      }

      const res = await fetch("/api/v1/course-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: assignCourse.id,
          lecturerId: selectedLecturerId,
          semesterId: currentSemester.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Failed to assign lecturer";
        setAssignError(msg);
        toast.error(msg);
        return;
      }

      toast.success(`Assigned lecturer to ${assignCourse.code}`);
      setAssignCourse(null);
      await fetchCourses();
    } catch {
      setAssignError("Network error while assigning lecturer");
      toast.error("Network error while assigning lecturer");
    } finally {
      setAssignSaving(false);
    }
  }

  async function handleUnassign() {
    if (!assignCourse?.currentAssignment) return;
    setAssignError(null);
    setAssignSaving(true);
    try {
      const res = await fetch(
        `/api/v1/course-assignments/${assignCourse.currentAssignment.id}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Failed to unassign lecturer";
        setAssignError(msg);
        toast.error(msg);
        return;
      }
      toast.success(`Unassigned lecturer from ${assignCourse.code}`);
      setAssignCourse(null);
      await fetchCourses();
    } catch {
      setAssignError("Network error while unassigning lecturer");
      toast.error("Network error while unassigning lecturer");
    } finally {
      setAssignSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Courses & Allocations"
        description={
          currentSemester
            ? `Manage courses and lecturer assignments for ${currentSemester.sessionName} (${currentSemester.name} Semester).`
            : "Manage academic courses and current-semester lecturer allocations."
        }
        actions={
          <Button onClick={openCreateDialog}>
            <Plus className="mr-1.5 h-4 w-4" />
            Create Course
          </Button>
        }
      />

      {/* Filter Bar */}
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setAppliedSearch(searchInput.trim());
          }}
          className="flex gap-2 sm:col-span-2"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search code or title..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        {role === "SUPER_ADMIN" && (
          <select
            aria-label="Filter by department"
            value={deptFilter}
            onChange={(e) => {
              setPage(1);
              setDeptFilter(e.target.value);
              setProgFilter("");
            }}
            className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-xs"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>
        )}

        <select
          aria-label="Filter by program"
          value={progFilter}
          onChange={(e) => {
            setPage(1);
            setProgFilter(e.target.value);
          }}
          className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-xs"
        >
          <option value="">All Programs</option>
          {filteredFilterPrograms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by level"
          value={levelFilter}
          onChange={(e) => {
            setPage(1);
            setLevelFilter(e.target.value);
          }}
          className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-xs"
        >
          <option value="">All Levels</option>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <select
            aria-label="Filter by semester"
            value={semFilter}
            onChange={(e) => {
              setPage(1);
              setSemFilter(e.target.value);
            }}
            className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm shadow-xs"
          >
            <option value="">All Semesters</option>
            <option value="FIRST">FIRST</option>
            <option value="SECOND">SECOND</option>
          </select>

          <select
            aria-label="Filter by status"
            value={activeFilter}
            onChange={(e) => {
              setPage(1);
              setActiveFilter(e.target.value);
            }}
            className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm shadow-xs"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchCourses} />
      ) : courses.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title="No courses found"
          description="Adjust your filters or create a new course."
          action={
            <Button onClick={openCreateDialog}>
              <Plus className="mr-1.5 h-4 w-4" />
              Create Course
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code & Title</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>Dept / Program / Level</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead>Current Lecturer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((c) => {
                  const isCurrentSemMatch =
                    currentSemester && c.semesterName === currentSemester.name;
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-mono text-xs font-semibold text-slate-900">
                          {c.code}
                        </div>
                        <div className="text-sm font-medium text-slate-800">
                          {c.title}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {c.creditUnits}U
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        <div>
                          <span className="font-medium text-slate-900">
                            {c.department.code}
                          </span>{" "}
                          • {c.program.code}
                        </div>
                        <div className="text-slate-500">
                          {c.level.levelNumber} Level
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {c.semesterName}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.currentAssignment ? (
                          <div>
                            <div className="font-medium text-slate-900">
                              {c.currentAssignment.lecturer.title
                                ? `${c.currentAssignment.lecturer.title} `
                                : ""}
                              {c.currentAssignment.lecturer.user.fullName}
                            </div>
                            <div className="font-mono text-slate-500">
                              {c.currentAssignment.lecturer.staffId}
                            </div>
                          </div>
                        ) : isCurrentSemMatch ? (
                          <span className="text-amber-700 font-medium">
                            Unassigned
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            Not active semester
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            c.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {c.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex flex-wrap justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(c)}
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!isCurrentSemMatch || !c.isActive}
                            onClick={() => openAssignDialog(c)}
                            title={
                              !isCurrentSemMatch
                                ? `Only ${currentSemester?.name ?? "current"} semester courses can be assigned right now`
                                : "Manage lecturer assignment"
                            }
                          >
                            <UserCheck className="mr-1 h-3.5 w-3.5" />
                            {c.currentAssignment ? "Change/Unassign" : "Assign"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setToggleCourse(c)}
                          >
                            <Power className="mr-1 h-3.5 w-3.5" />
                            {c.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col items-center justify-between gap-2 text-xs text-slate-600 sm:flex-row">
            <div>
              Showing page <span className="font-semibold">{page}</span> of{" "}
              <span className="font-semibold">{totalPages}</span> ({total} total
              courses)
            </div>
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
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Course Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCourse ? "Edit Course" : "Create Course"}
            </DialogTitle>
            <DialogDescription>
              Course codes are normalized (e.g. &quot;csc 301&quot; becomes
              &quot;CSC 301&quot;). Structural fields lock once assignments or
              registrations exist.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            {formError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="course-code">Course Code</Label>
                <Input
                  id="course-code"
                  placeholder="CSC 301"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  required
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="course-title">Course Title</Label>
                <Input
                  id="course-title"
                  placeholder="Data Structures and Algorithms"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
            </div>

            {role === "SUPER_ADMIN" && (
              <div className="space-y-1.5">
                <Label htmlFor="course-dept">Department</Label>
                <select
                  id="course-dept"
                  value={formDeptId}
                  onChange={(e) => handleFormDepartmentChange(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm"
                  required
                >
                  <option value="">Select department...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="course-prog">Program</Label>
                <select
                  id="course-prog"
                  value={formProgId}
                  onChange={(e) => setFormProgId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm"
                  required
                >
                  <option value="">Select program...</option>
                  {filteredFormPrograms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="course-level">Academic Level</Label>
                <select
                  id="course-level"
                  value={formLevelId}
                  onChange={(e) => setFormLevelId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm"
                  required
                >
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="course-sem">Semester</Label>
                <select
                  id="course-sem"
                  value={formSemesterName}
                  onChange={(e) =>
                    setFormSemesterName(e.target.value as "FIRST" | "SECOND")
                  }
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm"
                >
                  <option value="FIRST">FIRST</option>
                  <option value="SECOND">SECOND</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="course-units">Credit Units (1–6)</Label>
                <Input
                  id="course-units"
                  type="number"
                  min={1}
                  max={6}
                  value={creditUnits}
                  onChange={(e) => setCreditUnits(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="course-desc">Description (optional)</Label>
              <Input
                id="course-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingCourse
                    ? "Save Changes"
                    : "Create Course"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Active Toggle Confirm Dialog */}
      <Dialog
        open={Boolean(toggleCourse)}
        onOpenChange={(o) => !o && setToggleCourse(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {toggleCourse?.isActive
                ? "Deactivate Course"
                : "Activate Course"}
            </DialogTitle>
            <DialogDescription>
              {toggleCourse?.isActive
                ? `Deactivating ${toggleCourse.code} preserves existing registrations and results, but blocks new student registrations and lecturer assignments.`
                : `Activating ${toggleCourse?.code} makes it available for student registrations and lecturer assignments.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setToggleCourse(null)}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmToggleActive} disabled={toggling}>
              {toggling ? "Updating..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lecturer Assignment Dialog */}
      <Dialog
        open={Boolean(assignCourse)}
        onOpenChange={(o) => !o && setAssignCourse(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Lecturer Allocation — {assignCourse?.code}
            </DialogTitle>
            <DialogDescription>
              {currentSemester
                ? `Assign a lecturer from ${assignCourse?.department.code} for ${currentSemester.sessionName} (${currentSemester.name} Semester).`
                : "Assign a lecturer from the course's department."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAssignSubmit} className="space-y-4">
            {assignError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {assignError}
              </div>
            )}

            {assignCourse?.currentAssignment && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="font-semibold text-slate-700">
                  Currently Assigned:
                </div>
                <div className="mt-0.5 text-slate-900">
                  {assignCourse.currentAssignment.lecturer.title
                    ? `${assignCourse.currentAssignment.lecturer.title} `
                    : ""}
                  {assignCourse.currentAssignment.lecturer.user.fullName} (
                  {assignCourse.currentAssignment.lecturer.staffId})
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="assign-lecturer">
                Select Lecturer ({assignCourse?.department.code})
              </Label>
              <select
                id="assign-lecturer"
                value={selectedLecturerId}
                onChange={(e) => setSelectedLecturerId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm"
              >
                <option value="">Select lecturer...</option>
                {eligibleLecturersForAssign.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title ? `${l.title} ` : ""}
                    {l.user.fullName} ({l.staffId})
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              {assignCourse?.currentAssignment ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={assignSaving}
                  onClick={handleUnassign}
                >
                  <UserMinus className="mr-1.5 h-4 w-4" />
                  Unassign
                </Button>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAssignCourse(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    assignSaving ||
                    !selectedLecturerId ||
                    assignCourse?.currentAssignment?.lecturerId ===
                      selectedLecturerId
                  }
                >
                  {assignSaving
                    ? "Saving..."
                    : assignCourse?.currentAssignment
                      ? "Change Lecturer"
                      : "Assign Lecturer"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

