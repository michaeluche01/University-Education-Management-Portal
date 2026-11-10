"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  History,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SubmissionItem {
  courseId: string;
  courseCode: string;
  courseTitle: string;
  creditUnits: number;
  semesterName: string;
  department: { id: string; code: string; name: string };
  program: { id: string; code: string; name: string };
  level: { id: string; levelNumber: number; name: string };
  assignedLecturer: {
    id: string;
    staffId: string;
    fullName: string | null;
  } | null;
  registeredCount: number;
  submittedCount: number;
  approvedCount: number;
  returnedCount: number;
  overallStatus: "NO_RESULTS" | "SUBMITTED" | "APPROVED" | "RETURNED";
}

interface SheetRowItem {
  registrationId: string;
  studentId: string;
  matricNumber: string;
  fullName: string;
  email: string;
  level: string;
  program: string;
  result: {
    id: string;
    caScore: number;
    examScore: number;
    totalScore: number;
    grade: string;
    gradePoint: number;
    status: "DRAFT" | "SUBMITTED" | "APPROVED" | "RETURNED";
    feedback: string | null;
    submittedAt: string | null;
    reviewedAt: string | null;
    reopenedAt: string | null;
    reopenReason: string | null;
  } | null;
}

interface SheetData {
  course: {
    id: string;
    code: string;
    title: string;
    creditUnits: number;
    semesterName: string;
    department: { id: string; code: string; name: string };
    program: { id: string; code: string; name: string };
    level: { id: string; levelNumber: number; name: string };
  };
  semester: {
    id: string;
    name: string;
    isCurrent: boolean;
    sessionName: string;
  };
  summary: {
    registeredCount: number;
    enteredCount: number;
    averageTotalScore: number | null;
    highestScore: number | null;
    lowestScore: number | null;
    passCount: number;
    failCount: number;
    gradeDistribution: Record<string, number>;
  };
  rows: SheetRowItem[];
}

interface AuditHistoryItem {
  id: string;
  action: string;
  actor: { id: string; fullName: string; role: string };
  reason: string | null;
  beforeSummary: unknown;
  afterSummary: unknown;
  createdAt: string;
}

interface ApprovalsViewProps {
  role: "SUPER_ADMIN" | "DEPARTMENT_ADMIN";
  departmentName?: string | null;
}

export function ApprovalsView({
  role,
  departmentName,
}: ApprovalsViewProps) {
  const isSuperAdmin = role === "SUPER_ADMIN";

  const [semesters, setSemesters] = useState<
    Array<{ id: string; label: string; isCurrent: boolean }>
  >([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected course detail sheet
  const [selectedCourse, setSelectedCourse] = useState<SubmissionItem | null>(
    null
  );
  const [sheetData, setSheetData] = useState<SheetData | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  // Modals & Action States
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  // History modal
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyStudentLabel, setHistoryStudentLabel] = useState("");
  const [historyLogs, setHistoryLogs] = useState<AuditHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchSemesters = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/sessions");
      if (!res.ok) return;
      const json = await res.json();
      const list: Array<{ id: string; label: string; isCurrent: boolean }> = [];
      let currentId = "";

      for (const s of json.data) {
        for (const sem of s.semesters) {
          const isCurr = Boolean(sem.isCurrent);
          if (isCurr && !currentId) currentId = sem.id;
          list.push({
            id: sem.id,
            label: `${s.name} — ${sem.name} Semester${isCurr ? " (Current)" : ""}`,
            isCurrent: isCurr,
          });
        }
      }
      setSemesters(list);
      setSelectedSemesterId((prev) => prev || currentId || list[0]?.id || "");
    } catch {
      // Fallback
    }
  }, []);

  const fetchSubmissions = useCallback(async () => {
    if (!selectedSemesterId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/results/submissions?semesterId=${encodeURIComponent(selectedSemesterId)}`
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json?.error?.message ?? "Failed to load result submissions"
        );
      }
      setSubmissions(json.data.submissions ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load submissions"
      );
    } finally {
      setLoading(false);
    }
  }, [selectedSemesterId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchSemesters();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchSemesters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchSubmissions();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchSubmissions]);

  const openCourseDetail = useCallback(
    async (item: SubmissionItem) => {
      setSelectedCourse(item);
      setSheetLoading(true);
      setSheetError(null);
      setActionError(null);

      try {
        const res = await fetch(
          `/api/v1/results/sheet?courseId=${encodeURIComponent(item.courseId)}&semesterId=${encodeURIComponent(selectedSemesterId)}`
        );
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error?.message ?? "Failed to load course results");
        }
        setSheetData(json.data);
      } catch (err) {
        setSheetError(
          err instanceof Error ? err.message : "Failed to load sheet"
        );
      } finally {
        setSheetLoading(false);
      }
    },
    [selectedSemesterId]
  );

  async function handleApprove() {
    if (!selectedCourse || !selectedSemesterId) return;
    setActionInProgress(true);
    setActionError(null);
    try {
      const res = await fetch("/api/v1/results/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: selectedCourse.courseId,
          semesterId: selectedSemesterId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Failed to approve results";
        setActionError(msg);
        toast.error(msg);
        return;
      }
      toast.success(
        `Approved ${json.data.approvedCount} result(s) for ${selectedCourse.courseCode}`
      );
      setApproveDialogOpen(false);
      await openCourseDetail(selectedCourse);
      await fetchSubmissions();
    } catch {
      const msg = "Network error while approving results.";
      setActionError(msg);
      toast.error(msg);
    } finally {
      setActionInProgress(false);
    }
  }

  async function handleReturn() {
    if (!selectedCourse || !selectedSemesterId) return;
    if (feedback.trim().length < 3) {
      setActionError("Feedback must be at least 3 characters.");
      return;
    }
    setActionInProgress(true);
    setActionError(null);
    try {
      const res = await fetch("/api/v1/results/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: selectedCourse.courseId,
          semesterId: selectedSemesterId,
          feedback: feedback.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Failed to return results";
        setActionError(msg);
        toast.error(msg);
        return;
      }
      toast.success(
        `Returned results for ${selectedCourse.courseCode} for correction`
      );
      setReturnDialogOpen(false);
      setFeedback("");
      await openCourseDetail(selectedCourse);
      await fetchSubmissions();
    } catch {
      const msg = "Network error while returning results.";
      setActionError(msg);
      toast.error(msg);
    } finally {
      setActionInProgress(false);
    }
  }

  async function handleReopen() {
    if (!selectedCourse || !selectedSemesterId) return;
    if (reason.trim().length < 3) {
      setActionError("Reason must be at least 3 characters.");
      return;
    }
    setActionInProgress(true);
    setActionError(null);
    try {
      const res = await fetch("/api/v1/results/reopen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: selectedCourse.courseId,
          semesterId: selectedSemesterId,
          reason: reason.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Failed to reopen results";
        setActionError(msg);
        toast.error(msg);
        return;
      }
      toast.success(
        `Reopened approved results for ${selectedCourse.courseCode}`
      );
      setReopenDialogOpen(false);
      setReason("");
      await openCourseDetail(selectedCourse);
      await fetchSubmissions();
    } catch {
      const msg = "Network error while reopening results.";
      setActionError(msg);
      toast.error(msg);
    } finally {
      setActionInProgress(false);
    }
  }

  async function openHistory(resultId: string, studentLabel: string) {
    setHistoryStudentLabel(studentLabel);
    setHistoryLogs([]);
    setHistoryLoading(true);
    setHistoryDialogOpen(true);

    try {
      const res = await fetch(`/api/v1/results/${resultId}/history`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Failed to load audit history");
        return;
      }
      setHistoryLogs(json.data.history ?? []);
    } catch {
      toast.error("Network error while loading audit history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  const hasSubmittedRows =
    sheetData?.rows.some((r) => r.result?.status === "SUBMITTED") ?? false;
  const hasApprovedRows =
    sheetData?.rows.some((r) => r.result?.status === "APPROVED") ?? false;

  return (
    <div className="space-y-6">
      {!selectedCourse ? (
        <>
          <PageHeader
            title="Result Submissions & Approvals"
            description={
              isSuperAdmin
                ? "University-wide examination result approval and review oversight."
                : `Review and approve submitted examination results for ${departmentName ?? "your department"}.`
            }
          />

          {/* Semester Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <Label htmlFor="flt-sub-sem" className="text-sm shrink-0">
              Select Semester:
            </Label>
            <select
              id="flt-sub-sem"
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
              className="flex h-9 w-full sm:w-80 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs"
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <LoadingSkeleton rows={6} label="Loading submissions..." />
          ) : error ? (
            <ErrorState message={error} onRetry={fetchSubmissions} />
          ) : submissions.length === 0 ? (
            <EmptyState
              title="No result submissions found"
              description="No courses have submitted examination results for the selected semester."
            />
          ) : (
            <div className="rounded-lg border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course Code</TableHead>
                    <TableHead>Course Title</TableHead>
                    {isSuperAdmin ? <TableHead>Dept</TableHead> : null}
                    <TableHead>Lecturer</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Returned</TableHead>
                    <TableHead>Overall Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((item) => (
                    <TableRow key={item.courseId}>
                      <TableCell className="font-mono font-semibold whitespace-nowrap">
                        {item.courseCode}
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.courseTitle}
                      </TableCell>
                      {isSuperAdmin ? (
                        <TableCell className="text-xs">
                          {item.department.code}
                        </TableCell>
                      ) : null}
                      <TableCell className="text-xs text-muted-foreground">
                        {item.assignedLecturer?.fullName ?? "Unassigned"}
                      </TableCell>
                      <TableCell>{item.registeredCount}</TableCell>
                      <TableCell className="font-semibold text-amber-700 dark:text-amber-400">
                        {item.submittedCount}
                      </TableCell>
                      <TableCell className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {item.approvedCount}
                      </TableCell>
                      <TableCell className="font-semibold text-destructive">
                        {item.returnedCount}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={item.overallStatus} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openCourseDetail(item)}
                        >
                          Review Sheet
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      ) : (
        /* Course Detail Sheet View */
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedCourse(null);
                setSheetData(null);
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to Submissions
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!hasSubmittedRows || actionInProgress}
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  setActionError(null);
                  setReturnDialogOpen(true);
                }}
              >
                <XCircle className="h-4 w-4 mr-1.5" />
                Reject (return for correction)
              </Button>

              <Button
                size="sm"
                disabled={!hasSubmittedRows || actionInProgress}
                onClick={() => {
                  setActionError(null);
                  setApproveDialogOpen(true);
                }}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Approve All Submitted
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={!hasApprovedRows || actionInProgress}
                onClick={() => {
                  setActionError(null);
                  setReopenDialogOpen(true);
                }}
              >
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Reopen Approved Results
              </Button>
            </div>
          </div>

          {actionError ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {actionError}
            </div>
          ) : null}

          {sheetLoading ? (
            <LoadingSkeleton rows={8} label="Loading results sheet..." />
          ) : sheetError || !sheetData ? (
            <ErrorState
              message={sheetError ?? "Unable to load scores"}
              onRetry={() => openCourseDetail(selectedCourse)}
            />
          ) : (
            <>
              <PageHeader
                title={`${sheetData.course.code}: ${sheetData.course.title}`}
                description={`${sheetData.course.creditUnits} Units · ${sheetData.course.department.name} · ${sheetData.semester.sessionName} (${sheetData.semester.name} Semester)`}
              />

              {/* Performance Summary Cards */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="p-4">
                  <div className="text-xs text-muted-foreground font-medium">
                    Total Students
                  </div>
                  <div className="text-2xl font-bold mt-1">
                    {sheetData.summary.enteredCount} /{" "}
                    {sheetData.summary.registeredCount}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Scores submitted/approved
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-xs text-muted-foreground font-medium">
                    Average Score
                  </div>
                  <div className="text-2xl font-bold mt-1">
                    {sheetData.summary.averageTotalScore !== null
                      ? `${sheetData.summary.averageTotalScore}%`
                      : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    High: {sheetData.summary.highestScore ?? "—"} · Low:{" "}
                    {sheetData.summary.lowestScore ?? "—"}
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-xs text-muted-foreground font-medium">
                    Pass / Fail
                  </div>
                  <div className="text-2xl font-bold mt-1">
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {sheetData.summary.passCount}
                    </span>{" "}
                    /{" "}
                    <span className="text-destructive">
                      {sheetData.summary.failCount}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Pass (GP &gt; 0) vs Fail
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-xs text-muted-foreground font-medium mb-1">
                    Grade Distribution
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {Object.entries(sheetData.summary.gradeDistribution).map(
                      ([grade, count]) => (
                        <span
                          key={grade}
                          className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-mono"
                        >
                          {grade}: {count}
                        </span>
                      )
                    )}
                  </div>
                </Card>
              </div>

              {/* Students Result Sheet */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Examination Results
                  </CardTitle>
                  <CardDescription>
                    Review student continuous assessment and exam scores before
                    approval.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Matric No.</TableHead>
                          <TableHead>Student Name</TableHead>
                          <TableHead>CA</TableHead>
                          <TableHead>Exam</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Grade</TableHead>
                          <TableHead>GP</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">History</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sheetData.rows.map((row, idx) => (
                          <TableRow key={row.registrationId}>
                            <TableCell className="text-xs text-muted-foreground">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="font-mono text-xs font-semibold whitespace-nowrap">
                              {row.matricNumber}
                            </TableCell>
                            <TableCell className="font-medium text-xs">
                              <div>{row.fullName}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {row.program} · {row.level}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {row.result
                                ? row.result.caScore.toFixed(2)
                                : "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {row.result
                                ? row.result.examScore.toFixed(2)
                                : "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs font-bold">
                              {row.result
                                ? row.result.totalScore.toFixed(2)
                                : "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs font-semibold">
                              {row.result ? row.result.grade : "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {row.result
                                ? row.result.gradePoint.toFixed(1)
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {row.result ? (
                                <StatusBadge status={row.result.status} />
                              ) : (
                                <span className="text-[11px] text-muted-foreground">
                                  Not Submitted
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {row.result ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    openHistory(
                                      row.result!.id,
                                      `${row.matricNumber} (${row.fullName})`
                                    )
                                  }
                                >
                                  <History className="h-3.5 w-3.5 mr-1" />
                                  Audit
                                </Button>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Approve Dialog */}
          <Dialog
            open={approveDialogOpen}
            onOpenChange={setApproveDialogOpen}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Approve Results?</DialogTitle>
                <DialogDescription>
                  This will approve all SUBMITTED examination results for{" "}
                  <strong>{selectedCourse.courseCode}</strong> and make them
                  immediately visible to students on their portal.
                </DialogDescription>
              </DialogHeader>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setApproveDialogOpen(false)}
                  disabled={actionInProgress}
                >
                  Cancel
                </Button>
                <Button onClick={handleApprove} disabled={actionInProgress}>
                  {actionInProgress ? "Approving..." : "Yes, Approve Results"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Return Dialog */}
          <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Return Results for Correction</DialogTitle>
                <DialogDescription>
                  Provide clear correction feedback for the assigned lecturer.
                  Results will be marked RETURNED and editable by the lecturer.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-1.5">
                <Label htmlFor="ret-fb">Correction Feedback</Label>
                <textarea
                  id="ret-fb"
                  rows={3}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="e.g. Please verify exam score for UEMP/2026/CSC/001 against attendance."
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReturnDialogOpen(false)}
                  disabled={actionInProgress}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReturn}
                  disabled={actionInProgress}
                >
                  {actionInProgress
                    ? "Returning..."
                    : "Reject & Return to Lecturer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Reopen Dialog */}
          <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Reopen Approved Results?</DialogTitle>
                <DialogDescription>
                  Reopening will revert approved results to RETURNED, remove them
                  from student views, and log an audited justification reason.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-1.5">
                <Label htmlFor="reopen-rsn">Justification Reason</Label>
                <textarea
                  id="reopen-rsn"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Authorized grade remarking following student script verification."
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReopenDialogOpen(false)}
                  disabled={actionInProgress}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReopen}
                  disabled={actionInProgress}
                >
                  {actionInProgress
                    ? "Reopening..."
                    : "Yes, Reopen Approved Results"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Audit History Dialog */}
          <Dialog
            open={historyDialogOpen}
            onOpenChange={setHistoryDialogOpen}
          >
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Result Audit Trail</DialogTitle>
                <DialogDescription>
                  Complete immutable lifecycle history for{" "}
                  <strong>{historyStudentLabel}</strong>.
                </DialogDescription>
              </DialogHeader>

              {historyLoading ? (
                <LoadingSkeleton rows={4} label="Loading audit history..." />
              ) : historyLogs.length === 0 ? (
                <EmptyState
                  title="No audit history"
                  description="No audited lifecycle events recorded for this result."
                />
              ) : (
                <div className="space-y-3">
                  {historyLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-md border p-3 text-xs space-y-1 bg-muted/30"
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="font-mono text-primary">
                          {log.action}
                        </span>
                        <span className="text-muted-foreground text-[11px]">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        Actor: {log.actor.fullName} ({log.actor.role})
                      </div>
                      {log.reason ? (
                        <div className="italic text-muted-foreground">
                          Reason/Feedback: &ldquo;{log.reason}&rdquo;
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
