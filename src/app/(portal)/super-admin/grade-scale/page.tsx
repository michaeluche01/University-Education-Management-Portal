"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
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
  validateAndDeriveGradeScale,
  type GradeScaleInputRow,
} from "@/lib/validators/structure";

export default function SuperAdminGradeScalePage() {
  const [rows, setRows] = useState<GradeScaleInputRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchScale = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/grade-scale");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Failed to load grade scale");
      }
      setRows(
        json.data.map(
          (item: {
            grade: string;
            minScore: number;
            gradePoint: number;
            remark: string;
          }) => ({
            grade: item.grade,
            minScore: item.minScore,
            gradePoint: item.gradePoint,
            remark: item.remark,
          })
        )
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load grade scale"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchScale();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchScale]);

  const validation = useMemo(() => validateAndDeriveGradeScale(rows), [rows]);

  const derivedMaxByGrade = useMemo(() => {
    if (!validation.valid) return new Map<number, number>();
    const map = new Map<number, number>();
    for (const r of validation.rows) {
      map.set(r.minScore, r.maxScore);
    }
    return map;
  }, [validation]);

  function updateRow(index: number, patch: Partial<GradeScaleInputRow>) {
    setRows((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row))
    );
  }

  function addBand() {
    setRows((prev) => [
      ...prev,
      { grade: "", minScore: 30, gradePoint: 0.5, remark: "Pass" },
    ]);
  }

  function removeBand(index: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function handleSave() {
    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/v1/grade-scale", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Failed to update grade scale");
        return;
      }

      toast.success("Grading scale updated and audited");
      setRows(
        json.data.map(
          (item: {
            grade: string;
            minScore: number;
            gradePoint: number;
            remark: string;
          }) => ({
            grade: item.grade,
            minScore: item.minScore,
            gradePoint: item.gradePoint,
            remark: item.remark,
          })
        )
      );
    } catch {
      toast.error("Network error while saving grade scale.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="5.0 Grading Scale Configuration"
        description="Configure score bands and grade points used for result grading and GPA/CGPA computation."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={addBand}
              disabled={loading || saving}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Band
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={loading || saving || !validation.valid}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-1.5 h-4 w-4" />
                  Save Scale
                </>
              )}
            </Button>
          </div>
        }
      />

      {/* Decision D4 Warning Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <div>
          <span className="font-semibold">
            Important Policy Notice (Decision D4):
          </span>{" "}
          Existing <strong>APPROVED</strong> results are locked and are{" "}
          <strong>never recomputed</strong> when the grading scale changes. Only
          draft, newly saved, submitted, or reopened results use the updated
          grading scale.
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton rows={6} label="Loading grading scale..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchScale} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No grade bands configured"
          description="Add at least 2 grade bands including a band starting at minScore = 0."
          action={
            <Button onClick={addBand} size="sm">
              Add Band
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {!validation.valid ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 p-3.5 text-xs sm:text-sm text-destructive space-y-1"
            >
              <div className="font-semibold">
                Please resolve the following validation errors before saving:
              </div>
              <ul className="list-disc list-inside space-y-0.5">
                {validation.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Grade</TableHead>
                  <TableHead className="w-32">Min Score</TableHead>
                  <TableHead className="w-32">Derived Max</TableHead>
                  <TableHead className="w-32">Grade Point (0–5)</TableHead>
                  <TableHead>Remark</TableHead>
                  <TableHead className="w-16 text-right">Remove</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Input
                        value={row.grade}
                        onChange={(e) =>
                          updateRow(idx, {
                            grade: e.target.value.toUpperCase(),
                          })
                        }
                        placeholder="A"
                        className="h-8 w-20 font-mono uppercase"
                        disabled={saving}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={row.minScore}
                        onChange={(e) =>
                          updateRow(idx, {
                            minScore:
                              e.target.value === ""
                                ? 0
                                : Number(e.target.value),
                          })
                        }
                        className="h-8 w-24"
                        disabled={saving}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono">
                      {derivedMaxByGrade.get(row.minScore) ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={5}
                        step="0.5"
                        value={row.gradePoint}
                        onChange={(e) =>
                          updateRow(idx, {
                            gradePoint:
                              e.target.value === ""
                                ? 0
                                : Number(e.target.value),
                          })
                        }
                        className="h-8 w-24"
                        disabled={saving}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.remark}
                        onChange={(e) =>
                          updateRow(idx, { remark: e.target.value })
                        }
                        placeholder="e.g. Excellent"
                        className="h-8 min-w-[120px]"
                        disabled={saving}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeBand(idx)}
                        disabled={saving || rows.length <= 2}
                        aria-label={`Remove grade band ${row.grade}`}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

