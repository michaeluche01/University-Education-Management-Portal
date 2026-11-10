"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Printer,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button, buttonVariants } from "@/components/ui/button";
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

interface AvailableCourseItem {
  id: string;
  code: string;
  title: string;
  creditUnits: number;
  description: string | null;
  semesterName: "FIRST" | "SECOND";
  assignedLecturerName: string | null;
  alreadyRegistered: boolean;
  registrationId: string | null;
  hasResult: boolean;
}

interface AvailableResponse {
  state: "open" | "registrationClosed" | "noCurrentSemester";
  registrationOpen: boolean;
  currentSemester: {
    id: string;
    name: "FIRST" | "SECOND";
    registrationOpen: boolean;
    session: { id: string; name: string };
  } | null;
  courses: AvailableCourseItem[];
}

interface RegisteredRow {
  id: string;
  courseId: string;
  semesterId: string;
  registeredAt: string;
  hasResult: boolean;
  canDrop: boolean;
  assignedLecturerName: string | null;
  course: {
    id: string;
    code: string;
    title: string;
    creditUnits: number;
    semesterName: "FIRST" | "SECOND";
  };
}

export default function StudentCoursesRegistrationPage() {
  const [availableData, setAvailableData] = useState<AvailableResponse | null>(
    null
  );
  const [registeredRows, setRegisteredRows] = useState<RegisteredRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [droppingId, setDroppingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [availRes, regRes] = await Promise.all([
        fetch("/api/v1/registrations/available"),
        fetch("/api/v1/registrations"),
      ]);
      const availJson = await availRes.json();
      const regJson = await regRes.json();

      if (!availRes.ok) {
        throw new Error(
          availJson?.error?.message ?? "Failed to load available courses"
        );
      }
      if (!regRes.ok) {
        throw new Error(
          regJson?.error?.message ?? "Failed to load registered courses"
        );
      }

      setAvailableData(availJson.data);
      setRegisteredRows(regJson.data.items);
      setSelectedIds(new Set());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load course registration"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchAll();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchAll]);

  function toggleCourse(courseId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  }

  const registeredUnits = useMemo(
    () =>
      registeredRows.reduce((sum, r) => sum + (r.course?.creditUnits ?? 0), 0),
    [registeredRows]
  );

  const selectedUnits = useMemo(() => {
    if (!availableData) return 0;
    return availableData.courses
      .filter((c) => selectedIds.has(c.id))
      .reduce((sum, c) => sum + c.creditUnits, 0);
  }, [availableData, selectedIds]);

  async function handleRegisterSelected() {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseIds: Array.from(selectedIds),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Failed to register courses");
        return;
      }

      toast.success(
        `Registered ${selectedIds.size} course${selectedIds.size === 1 ? "" : "s"} successfully`
      );
      await fetchAll();
    } catch {
      toast.error("Network error while registering courses.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDropCourse(registrationId: string, courseCode: string) {
    setDroppingId(registrationId);
    try {
      const res = await fetch(`/api/v1/registrations/${registrationId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? `Failed to drop ${courseCode}`);
        return;
      }
      toast.success(`Dropped ${courseCode}`);
      await fetchAll();
    } catch {
      toast.error("Network error while dropping course.");
    } finally {
      setDroppingId(null);
    }
  }

  const currentSem = availableData?.currentSemester ?? null;
  const isRegistrationOpen = Boolean(availableData?.registrationOpen);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course Registration"
        description={
          currentSem
            ? `${currentSem.session.name} Academic Session · ${currentSem.name} Semester`
            : "Current semester course registration"
        }
        actions={
          <Link
            href="/student/print/registration"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Print Registration Slip
          </Link>
        }
      />

      {loading ? (
        <LoadingSkeleton rows={6} label="Loading course registration..." />
      ) : error || !availableData ? (
        <ErrorState
          message={error ?? "Unable to load registration data"}
          onRetry={fetchAll}
        />
      ) : (
        <>
          {/* Credit Unit Summary & Action Bar */}
          <div className="rounded-lg border bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Status: </span>
                <span
                  className={
                    isRegistrationOpen
                      ? "font-semibold text-emerald-700 dark:text-emerald-400"
                      : "font-semibold text-amber-700 dark:text-amber-400"
                  }
                >
                  {availableData.state === "noCurrentSemester"
                    ? "No Active Semester"
                    : isRegistrationOpen
                      ? "OPEN"
                      : "CLOSED"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Registered Load: </span>
                <span className="font-semibold">
                  {registeredRows.length} courses ({registeredUnits} units)
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Selected to Add: </span>
                <span className="font-semibold text-primary">
                  {selectedIds.size} courses (+{selectedUnits} units)
                </span>
              </div>
            </div>

            <Button
              size="sm"
              disabled={!isRegistrationOpen || selectedIds.size === 0 || submitting}
              onClick={handleRegisterSelected}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registering...
                </>
              ) : (
                <>
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  Register Selected ({selectedIds.size})
                </>
              )}
            </Button>
          </div>

          {/* Available Courses for Student's Dept / Program / Level / Semester */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Available Courses for Your Program & Level
              </CardTitle>
              <CardDescription>
                Select courses below and click &ldquo;Register Selected&rdquo; to
                enroll for this semester.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {availableData.courses.length === 0 ? (
                <EmptyState
                  title="No eligible courses found"
                  description="No active courses match your department, program, level, and current semester."
                />
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Select</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Units</TableHead>
                        <TableHead className="hidden md:table-cell">
                          Lecturer
                        </TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {availableData.courses.map((c) => {
                        const checked = selectedIds.has(c.id);
                        const disabled =
                          c.alreadyRegistered || !isRegistrationOpen || submitting;
                        return (
                          <TableRow key={c.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                aria-label={`Select ${c.code}`}
                                checked={checked}
                                disabled={disabled}
                                onChange={() => toggleCourse(c.id)}
                                className="h-4 w-4 rounded border-input accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                              />
                            </TableCell>
                            <TableCell className="font-mono font-semibold whitespace-nowrap">
                              {c.code}
                            </TableCell>
                            <TableCell className="font-medium">
                              <div>{c.title}</div>
                              {c.description ? (
                                <div className="text-xs text-muted-foreground line-clamp-1">
                                  {c.description}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell>{c.creditUnits}</TableCell>
                            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                              {c.assignedLecturerName ?? "Unassigned"}
                            </TableCell>
                            <TableCell className="text-right">
                              {c.alreadyRegistered ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Registered
                                </span>
                              ) : isRegistrationOpen ? (
                                <span className="text-xs text-muted-foreground">
                                  Available
                                </span>
                              ) : (
                                <span className="text-xs text-amber-600">
                                  Closed
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Registered Courses List with Drop Action */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Your Registered Courses ({registeredUnits} Total Credit Units)
              </CardTitle>
              <CardDescription>
                You may drop a registered course only while registration is open
                and before a result record exists for that course.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {registeredRows.length === 0 ? (
                <EmptyState
                  title="No registered courses"
                  description="Select courses from the list above to register for this semester."
                />
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Units</TableHead>
                        <TableHead className="hidden sm:table-cell">
                          Lecturer
                        </TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {registeredRows.map((row) => {
                        const dropBlockedReason = row.hasResult
                          ? "Cannot drop: a result record already exists for this course"
                          : !isRegistrationOpen
                            ? "Cannot drop: course registration is closed"
                            : undefined;

                        return (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono font-semibold whitespace-nowrap">
                              {row.course.code}
                            </TableCell>
                            <TableCell className="font-medium">
                              {row.course.title}
                            </TableCell>
                            <TableCell>{row.course.creditUnits}</TableCell>
                            <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                              {row.assignedLecturerName ?? "Unassigned"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={
                                  !row.canDrop || droppingId === row.id
                                }
                                title={dropBlockedReason ?? "Drop this course"}
                                onClick={() =>
                                  handleDropCourse(row.id, row.course.code)
                                }
                              >
                                {droppingId === row.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                                    Drop
                                  </>
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

