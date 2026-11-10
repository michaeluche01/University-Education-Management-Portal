"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Save,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  lookupGrade,
  type GradeScaleBand,
} from "@/server/services/grading.service";

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

interface SheetResponseData {
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

interface ScoreDraftEntry {
  caText: string;
  examText: string;
}

interface LecturerScoreSheetProps {
  courseId: string;
  semesterId: string;
  assignmentId: string;
}

export function LecturerScoreSheet({
  courseId,
  semesterId,
}: LecturerScoreSheetProps) {
  const [data, setData] = useState<SheetResponseData | null>(null);
  const [scaleRows, setScaleRows] = useState<GradeScaleBand[]>([]);
  const [draftInputs, setDraftInputs] = useState<
    Record<string, ScoreDraftEntry>
  >({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  const fetchSheet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sheetRes, scaleRes] = await Promise.all([
        fetch(
          `/api/v1/results/sheet?courseId=${encodeURIComponent(courseId)}&semesterId=${encodeURIComponent(semesterId)}`
        ),
        fetch("/api/v1/grade-scale"),
      ]);

      const sheetJson = await sheetRes.json();
      const scaleJson = await scaleRes.json();

      if (!sheetRes.ok) {
        throw new Error(sheetJson?.error?.message ?? "Failed to load sheet");
      }
      if (!scaleRes.ok) {
        throw new Error(scaleJson?.error?.message ?? "Failed to load grade scale");
      }

      const sheetData = sheetJson.data as SheetResponseData;
      setData(sheetData);
      setScaleRows(scaleJson.data ?? []);

      // Populate draft inputs from existing results
      const initialInputs: Record<string, ScoreDraftEntry> = {};
      for (const row of sheetData.rows) {
        initialInputs[row.registrationId] = {
          caText:
            row.result?.caScore !== undefined ? String(row.result.caScore) : "",
          examText:
            row.result?.examScore !== undefined
              ? String(row.result.examScore)
              : "",
        };
      }
      setDraftInputs(initialInputs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scores sheet");
    } finally {
      setLoading(false);
    }
  }, [courseId, semesterId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchSheet();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchSheet]);

  const handleInputChange = (
    registrationId: string,
    field: "caText" | "examText",
    value: string
  ) => {
    setDraftInputs((prev) => ({
      ...prev,
      [registrationId]: {
        ...prev[registrationId],
        [field]: value,
      },
    }));
  };

  // Determine overall course status
  const overallStatus = useMemo(() => {
    if (!data || data.rows.length === 0) return "NOT_ENTERED";
    const statuses = data.rows
      .map((r) => r.result?.status)
      .filter(Boolean) as string[];

    if (statuses.includes("RETURNED")) return "RETURNED";
    if (statuses.includes("SUBMITTED")) return "SUBMITTED";
    if (
      statuses.length === data.rows.length &&
      statuses.every((s) => s === "APPROVED")
    ) {
      return "APPROVED";
    }
    if (statuses.length > 0) return "DRAFT";
    return "NOT_ENTERED";
  }, [data]);

  const isReadOnly =
    overallStatus === "SUBMITTED" || overallStatus === "APPROVED";

  const returnedRow = data?.rows.find((r) => r.result?.status === "RETURNED");
  const returnFeedback = returnedRow?.result?.feedback ?? null;

  async function handleSaveDraft() {
    if (!data) return;
    setSavingDraft(true);
    try {
      const entriesToSave = [];

      for (const row of data.rows) {
        const input = draftInputs[row.registrationId];
        if (!input) continue;

        const ca = input.caText.trim() === "" ? 0 : Number(input.caText);
        const exam = input.examText.trim() === "" ? 0 : Number(input.examText);

        if (Number.isNaN(ca) || ca < 0 || ca > 30) {
          toast.error(
            `Invalid CA score for ${row.matricNumber}. Must be between 0 and 30.`
          );
          setSavingDraft(false);
          return;
        }

        if (Number.isNaN(exam) || exam < 0 || exam > 70) {
          toast.error(
            `Invalid Exam score for ${row.matricNumber}. Must be between 0 and 70.`
          );
          setSavingDraft(false);
          return;
        }

        entriesToSave.push({
          registrationId: row.registrationId,
          caScore: Math.round(ca * 100) / 100,
          examScore: Math.round(exam * 100) / 100,
        });
      }

      if (entriesToSave.length === 0) {
        toast.info("No scores entered yet.");
        setSavingDraft(false);
        return;
      }

      const res = await fetch("/api/v1/results/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          semesterId,
          entries: entriesToSave,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Failed to save draft results");
        return;
      }

      toast.success("Draft scores saved successfully");
      await fetchSheet();
    } catch {
      toast.error("Network error while saving draft.");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSubmitForReview() {
    setSubmitting(true);
    try {
      // First save current inputs as draft so latest scores are committed
      await handleSaveDraft();

      const res = await fetch("/api/v1/results/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          semesterId,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Failed to submit results");
        return;
      }

      toast.success("Results submitted for departmental review!");
      setSubmitDialogOpen(false);
      await fetchSheet();
    } catch {
      toast.error("Network error while submitting results.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/lecturer/courses"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Courses
        </Link>
        <div className="flex items-center gap-2">
          {!isReadOnly ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={savingDraft || submitting}
              >
                <Save className="h-4 w-4 mr-1.5" />
                {savingDraft ? "Saving..." : "Save Draft"}
              </Button>
              <Button
                size="sm"
                onClick={() => setSubmitDialogOpen(true)}
                disabled={savingDraft || submitting}
              >
                <Send className="h-4 w-4 mr-1.5" />
                Submit for Review
              </Button>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-md font-medium">
              <Lock className="h-3.5 w-3.5" />
              Locked ({overallStatus})
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton rows={8} label="Loading scores sheet..." />
      ) : error || !data ? (
        <ErrorState
          message={error ?? "Unable to load scores sheet"}
          onRetry={fetchSheet}
        />
      ) : (
        <>
          <PageHeader
            title={`${data.course.code}: ${data.course.title}`}
            description={`${data.course.creditUnits} Units · ${data.course.level.name} · ${data.semester.sessionName} (${data.semester.name} Semester)`}
          />

          {/* Returned notice banner */}
          {returnFeedback ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive flex items-start gap-3"
            >
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">
                  Results Returned for Correction
                </div>
                <div className="text-xs mt-1 text-destructive/90">
                  Department Admin Feedback: &ldquo;{returnFeedback}&rdquo;
                </div>
              </div>
            </div>
          ) : null}

          {/* Read-only notice */}
          {isReadOnly ? (
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                These results are currently <strong>{overallStatus}</strong>.
                Scores cannot be modified unless returned or reopened by the
                Department Admin.
              </span>
            </div>
          ) : null}

          {/* Performance Summary Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground font-medium">
                Registrations
              </div>
              <div className="text-2xl font-bold mt-1">
                {data.summary.enteredCount} / {data.summary.registeredCount}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Students with scores entered
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-xs text-muted-foreground font-medium">
                Average Total Score
              </div>
              <div className="text-2xl font-bold mt-1">
                {data.summary.averageTotalScore !== null
                  ? `${data.summary.averageTotalScore}%`
                  : "—"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                High: {data.summary.highestScore ?? "—"} · Low:{" "}
                {data.summary.lowestScore ?? "—"}
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-xs text-muted-foreground font-medium">
                Pass / Fail
              </div>
              <div className="text-2xl font-bold mt-1">
                <span className="text-emerald-700 dark:text-emerald-400">
                  {data.summary.passCount}
                </span>{" "}
                /{" "}
                <span className="text-destructive">
                  {data.summary.failCount}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Pass (GP &gt; 0) vs Fail
              </div>
            </Card>

            <Card className="p-4 sm:col-span-2">
              <div className="text-xs text-muted-foreground font-medium mb-1">
                Grade Distribution
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(data.summary.gradeDistribution).map(
                  ([grade, count]) => (
                    <span
                      key={grade}
                      className="inline-flex items-center rounded-md bg-muted px-2 py-1 font-mono font-medium"
                    >
                      {grade}: {count}
                    </span>
                  )
                )}
              </div>
            </Card>
          </div>

          {/* Scores Entry Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Student Scores Sheet</CardTitle>
              <CardDescription>
                CA (max 30.00), Exam (max 70.00). Total and Grade are previewed
                in real-time and authoritative when saved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.rows.length === 0 ? (
                <EmptyState
                  title="No registered students"
                  description="There are currently no students registered for this course."
                />
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Matric No.</TableHead>
                        <TableHead>Student Name</TableHead>
                        <TableHead className="w-28">CA (0–30)</TableHead>
                        <TableHead className="w-28">Exam (0–70)</TableHead>
                        <TableHead className="w-24">Total</TableHead>
                        <TableHead className="w-20">Grade</TableHead>
                        <TableHead className="w-24">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.map((row, idx) => {
                        const input = draftInputs[row.registrationId] ?? {
                          caText: "",
                          examText: "",
                        };

                        const caNum =
                          input.caText.trim() === "" ? 0 : Number(input.caText);
                        const examNum =
                          input.examText.trim() === ""
                            ? 0
                            : Number(input.examText);

                        const hasInput =
                          input.caText.trim() !== "" ||
                          input.examText.trim() !== "";

                        const liveTotal = hasInput
                          ? (Math.round(caNum * 100) +
                              Math.round(examNum * 100)) /
                            100
                          : row.result?.totalScore ?? null;

                        const liveGrade =
                          liveTotal !== null
                            ? lookupGrade(liveTotal, scaleRows)
                            : null;

                        return (
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
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                max={30}
                                step="0.01"
                                value={input.caText}
                                disabled={isReadOnly || savingDraft || submitting}
                                onChange={(e) =>
                                  handleInputChange(
                                    row.registrationId,
                                    "caText",
                                    e.target.value
                                  )
                                }
                                placeholder="0.00"
                                className="h-8 text-xs font-mono w-24"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                max={70}
                                step="0.01"
                                value={input.examText}
                                disabled={isReadOnly || savingDraft || submitting}
                                onChange={(e) =>
                                  handleInputChange(
                                    row.registrationId,
                                    "examText",
                                    e.target.value
                                  )
                                }
                                placeholder="0.00"
                                className="h-8 text-xs font-mono w-24"
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs font-bold">
                              {liveTotal !== null ? liveTotal.toFixed(2) : "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs font-semibold">
                              {liveGrade ? (
                                <span>
                                  {liveGrade.grade} ({liveGrade.gradePoint})
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell>
                              {row.result ? (
                                <StatusBadge status={row.result.status} />
                              ) : (
                                <span className="text-[11px] text-muted-foreground">
                                  Not Entered
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

          {/* Submit Confirmation Dialog */}
          <Dialog
            open={submitDialogOpen}
            onOpenChange={setSubmitDialogOpen}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Submit Results for Review?</DialogTitle>
                <DialogDescription>
                  This will transition all draft scores for{" "}
                  <strong>{data.course.code}</strong> to SUBMITTED and lock them
                  for departmental review. Ensure all registered students have
                  accurate scores before submitting.
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-md bg-muted/60 p-3 text-xs space-y-1">
                <div>
                  <strong>Total Registered:</strong>{" "}
                  {data.summary.registeredCount}
                </div>
                <div>
                  <strong>Entered Scores:</strong>{" "}
                  {data.summary.enteredCount}
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSubmitDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitForReview}
                  disabled={submitting}
                >
                  {submitting ? "Submitting..." : "Yes, Submit for Review"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
