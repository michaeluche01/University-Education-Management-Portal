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

interface FacultyOption {
  id: string;
  name: string;
  code: string;
}

interface DepartmentItem {
  id: string;
  name: string;
  code: string;
  facultyId: string;
  faculty: FacultyOption;
  _count: {
    programs: number;
    courses: number;
    students: number;
    lecturers: number;
  };
}

export default function SuperAdminDepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [faculties, setFaculties] = useState<FacultyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentItem | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [deptRes, facRes] = await Promise.all([
        fetch("/api/v1/departments"),
        fetch("/api/v1/faculties"),
      ]);
      const deptJson = await deptRes.json();
      const facJson = await facRes.json();

      if (!deptRes.ok) {
        throw new Error(
          deptJson?.error?.message ?? "Failed to load departments"
        );
      }
      if (!facRes.ok) {
        throw new Error(facJson?.error?.message ?? "Failed to load faculties");
      }

      setDepartments(deptJson.data);
      setFaculties(facJson.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load departments"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  function openCreateDialog() {
    setEditing(null);
    setName("");
    setCode("");
    setFacultyId(faculties[0]?.id ?? "");
    setFormError(null);
    setDialogOpen(true);
  }

  function openEditDialog(item: DepartmentItem) {
    setEditing(item);
    setName(item.name);
    setCode(item.code);
    setFacultyId(item.facultyId);
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const url = editing
        ? `/api/v1/departments/${editing.id}`
        : "/api/v1/departments";
      const method = editing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          facultyId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Failed to save department";
        setFormError(msg);
        toast.error(msg);
        return;
      }

      toast.success(
        editing
          ? "Department updated successfully"
          : "Department created successfully"
      );
      setDialogOpen(false);
      await fetchData();
    } catch {
      const msg = "Network error while saving department.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Create and manage academic departments under faculties."
        actions={
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            New Department
          </Button>
        }
      />

      {loading ? (
        <LoadingSkeleton rows={4} label="Loading departments..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : departments.length === 0 ? (
        <EmptyState
          title="No departments found"
          description="Create a department and assign it to a faculty."
          action={
            <Button onClick={openCreateDialog} size="sm">
              Create Department
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Department Name</TableHead>
                <TableHead>Faculty</TableHead>
                <TableHead className="hidden sm:table-cell">Programs</TableHead>
                <TableHead className="hidden md:table-cell">Students</TableHead>
                <TableHead className="hidden md:table-cell">
                  Lecturers
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono font-semibold">
                    {item.code}
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    {item.faculty.name} ({item.faculty.code})
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {item._count.programs}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {item._count.students}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {item._count.lecturers}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(item)}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Department" : "Create Department"}
            </DialogTitle>
            <DialogDescription>
              Assign the department to a faculty and provide a unique code.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {formError}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="dept-faculty">Faculty</Label>
              <select
                id="dept-faculty"
                value={facultyId}
                onChange={(e) => setFacultyId(e.target.value)}
                disabled={submitting}
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="" disabled>
                  Select a faculty
                </option>
                {faculties.map((fac) => (
                  <option key={fac.id} value={fac.id}>
                    {fac.name} ({fac.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dept-code">Department Code</Label>
              <Input
                id="dept-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. CSC"
                disabled={submitting}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dept-name">Department Name</Label>
              <Input
                id="dept-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Computer Science"
                disabled={submitting}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : editing ? (
                  "Save Changes"
                ) : (
                  "Create Department"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

