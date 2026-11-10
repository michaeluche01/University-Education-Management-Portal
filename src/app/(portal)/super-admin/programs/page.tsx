"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { PageHeader } from "@/components/shared/PageHeader";
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
  name: string;
  code: string;
}

interface ProgramItem {
  id: string;
  name: string;
  code: string;
  durationYears: number;
  departmentId: string;
  department: DepartmentOption;
  _count: { students: number; courses: number };
}

interface LevelItem {
  id: string;
  levelNumber: number;
  name: string;
  _count: { students: number; courses: number };
}

export default function SuperAdminProgramsPage() {
  const [programs, setPrograms] = useState<ProgramItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [levels, setLevels] = useState<LevelItem[]>([]);
  const [filterDepartmentId, setFilterDepartmentId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Program dialog state
  const [programDialogOpen, setProgramDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<ProgramItem | null>(
    null
  );
  const [progName, setProgName] = useState("");
  const [progCode, setProgCode] = useState("");
  const [durationYears, setDurationYears] = useState("4");
  const [departmentId, setDepartmentId] = useState("");
  const [progFormError, setProgFormError] = useState<string | null>(null);
  const [progSubmitting, setProgSubmitting] = useState(false);

  // Level dialog state
  const [levelDialogOpen, setLevelDialogOpen] = useState(false);
  const [levelNumber, setLevelNumber] = useState("500");
  const [levelFormError, setLevelFormError] = useState<string | null>(null);
  const [levelSubmitting, setLevelSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const progQuery = filterDepartmentId
        ? `?departmentId=${encodeURIComponent(filterDepartmentId)}`
        : "";
      const [progRes, deptRes, lvlRes] = await Promise.all([
        fetch(`/api/v1/programs${progQuery}`),
        fetch("/api/v1/departments"),
        fetch("/api/v1/levels"),
      ]);

      const progJson = await progRes.json();
      const deptJson = await deptRes.json();
      const lvlJson = await lvlRes.json();

      if (!progRes.ok) {
        throw new Error(progJson?.error?.message ?? "Failed to load programs");
      }
      if (!deptRes.ok) {
        throw new Error(
          deptJson?.error?.message ?? "Failed to load departments"
        );
      }
      if (!lvlRes.ok) {
        throw new Error(lvlJson?.error?.message ?? "Failed to load levels");
      }

      setPrograms(progJson.data);
      setDepartments(deptJson.data);
      setLevels(lvlJson.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load programs");
    } finally {
      setLoading(false);
    }
  }, [filterDepartmentId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  function openCreateProgram() {
    setEditingProgram(null);
    setProgName("");
    setProgCode("");
    setDurationYears("4");
    setDepartmentId(filterDepartmentId || departments[0]?.id || "");
    setProgFormError(null);
    setProgramDialogOpen(true);
  }

  function openEditProgram(item: ProgramItem) {
    setEditingProgram(item);
    setProgName(item.name);
    setProgCode(item.code);
    setDurationYears(String(item.durationYears));
    setDepartmentId(item.departmentId);
    setProgFormError(null);
    setProgramDialogOpen(true);
  }

  async function handleProgramSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProgFormError(null);
    setProgSubmitting(true);

    try {
      const url = editingProgram
        ? `/api/v1/programs/${editingProgram.id}`
        : "/api/v1/programs";
      const method = editingProgram ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: progName.trim(),
          code: progCode.trim().toUpperCase(),
          durationYears: Number(durationYears),
          departmentId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Failed to save program";
        setProgFormError(msg);
        toast.error(msg);
        return;
      }

      toast.success(
        editingProgram
          ? "Program updated successfully"
          : "Program created successfully"
      );
      setProgramDialogOpen(false);
      await fetchData();
    } catch {
      const msg = "Network error while saving program.";
      setProgFormError(msg);
      toast.error(msg);
    } finally {
      setProgSubmitting(false);
    }
  }

  async function handleLevelSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLevelFormError(null);
    setLevelSubmitting(true);

    try {
      const res = await fetch("/api/v1/levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          levelNumber: Number(levelNumber),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Failed to create academic level";
        setLevelFormError(msg);
        toast.error(msg);
        return;
      }

      toast.success(`Academic level ${json.data.name} created`);
      setLevelDialogOpen(false);
      await fetchData();
    } catch {
      const msg = "Network error while creating level.";
      setLevelFormError(msg);
      toast.error(msg);
    } finally {
      setLevelSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Programs & Academic Levels"
        description="Manage degree programs by department and global academic levels."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLevelFormError(null);
                setLevelDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              New Level
            </Button>
            <Button onClick={openCreateProgram} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              New Program
            </Button>
          </div>
        }
      />

      {/* Department Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <Label htmlFor="filter-dept" className="text-sm shrink-0">
          Filter by Department:
        </Label>
        <select
          id="filter-dept"
          value={filterDepartmentId}
          onChange={(e) => setFilterDepartmentId(e.target.value)}
          className="flex h-9 w-full sm:w-72 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.code})
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingSkeleton rows={4} label="Loading programs and levels..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : (
        <>
          {programs.length === 0 ? (
            <EmptyState
              title="No programs found"
              description="No academic programs match the selected department filter."
              action={
                <Button onClick={openCreateProgram} size="sm">
                  Create Program
                </Button>
              }
            />
          ) : (
            <div className="rounded-lg border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Program Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Students
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {programs.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono font-semibold">
                        {item.code}
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        {item.department.name} ({item.department.code})
                      </TableCell>
                      <TableCell>{item.durationYears} yrs</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {item._count.students}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditProgram(item)}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Global Academic Levels */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Global Academic Levels (D5)
              </CardTitle>
              <CardDescription>
                Levels are shared university-wide across all programs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {levels.map((lvl) => (
                  <div
                    key={lvl.id}
                    className="rounded-md border bg-muted/40 px-3.5 py-2 text-sm"
                  >
                    <div className="font-semibold">{lvl.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {lvl._count.students} students · {lvl._count.courses}{" "}
                      courses
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Program Create/Edit Dialog */}
      <Dialog open={programDialogOpen} onOpenChange={setProgramDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingProgram ? "Edit Program" : "Create Program"}
            </DialogTitle>
            <DialogDescription>
              Configure program details and department assignment.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleProgramSubmit} className="space-y-4">
            {progFormError ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {progFormError}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="prog-dept">Department</Label>
              <select
                id="prog-dept"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                disabled={progSubmitting}
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="" disabled>
                  Select department
                </option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prog-code">Program Code</Label>
              <Input
                id="prog-code"
                value={progCode}
                onChange={(e) => setProgCode(e.target.value.toUpperCase())}
                placeholder="e.g. BSC-CSC"
                disabled={progSubmitting}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prog-name">Program Name</Label>
              <Input
                id="prog-name"
                value={progName}
                onChange={(e) => setProgName(e.target.value)}
                placeholder="e.g. B.Sc. Computer Science"
                disabled={progSubmitting}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prog-duration">Duration (Years)</Label>
              <Input
                id="prog-duration"
                type="number"
                min={1}
                max={10}
                value={durationYears}
                onChange={(e) => setDurationYears(e.target.value)}
                disabled={progSubmitting}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setProgramDialogOpen(false)}
                disabled={progSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={progSubmitting}>
                {progSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : editingProgram ? (
                  "Save Changes"
                ) : (
                  "Create Program"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Level Create Dialog */}
      <Dialog open={levelDialogOpen} onOpenChange={setLevelDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Academic Level</DialogTitle>
            <DialogDescription>
              Level number must be a multiple of 100 between 100 and 900.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleLevelSubmit} className="space-y-4">
            {levelFormError ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {levelFormError}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="lvl-num">Level Number</Label>
              <Input
                id="lvl-num"
                type="number"
                step={100}
                min={100}
                max={900}
                value={levelNumber}
                onChange={(e) => setLevelNumber(e.target.value)}
                disabled={levelSubmitting}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLevelDialogOpen(false)}
                disabled={levelSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={levelSubmitting}>
                {levelSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Level"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

