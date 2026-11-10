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

interface FacultyItem {
  id: string;
  name: string;
  code: string;
  description: string | null;
  _count: { departments: number };
}

export default function SuperAdminFacultiesPage() {
  const [faculties, setFaculties] = useState<FacultyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FacultyItem | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchFaculties = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/faculties");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Failed to load faculties");
      }
      setFaculties(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load faculties");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchFaculties();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchFaculties]);

  function openCreateDialog() {
    setEditing(null);
    setName("");
    setCode("");
    setDescription("");
    setFormError(null);
    setDialogOpen(true);
  }

  function openEditDialog(item: FacultyItem) {
    setEditing(item);
    setName(item.name);
    setCode(item.code);
    setDescription(item.description ?? "");
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const url = editing
        ? `/api/v1/faculties/${editing.id}`
        : "/api/v1/faculties";
      const method = editing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          description: description.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Failed to save faculty";
        setFormError(msg);
        toast.error(msg);
        return;
      }

      toast.success(
        editing ? "Faculty updated successfully" : "Faculty created successfully"
      );
      setDialogOpen(false);
      await fetchFaculties();
    } catch {
      const msg = "Network error while saving faculty.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faculties"
        description="Create and manage university faculties."
        actions={
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            New Faculty
          </Button>
        }
      />

      {loading ? (
        <LoadingSkeleton rows={4} label="Loading faculties..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchFaculties} />
      ) : faculties.length === 0 ? (
        <EmptyState
          title="No faculties found"
          description="Create your first university faculty to get started."
          action={
            <Button onClick={openCreateDialog} size="sm">
              Create Faculty
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Faculty Name</TableHead>
                <TableHead className="hidden sm:table-cell">
                  Description
                </TableHead>
                <TableHead>Departments</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {faculties.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono font-semibold">
                    {item.code}
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground max-w-xs truncate">
                    {item.description ?? "—"}
                  </TableCell>
                  <TableCell>{item._count.departments}</TableCell>
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
              {editing ? "Edit Faculty" : "Create Faculty"}
            </DialogTitle>
            <DialogDescription>
              Faculty codes are automatically uppercased and must be unique.
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
              <Label htmlFor="fac-code">Faculty Code</Label>
              <Input
                id="fac-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. FSC"
                disabled={submitting}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fac-name">Faculty Name</Label>
              <Input
                id="fac-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Faculty of Science"
                disabled={submitting}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fac-desc">Description (Optional)</Label>
              <Input
                id="fac-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief faculty description"
                disabled={submitting}
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
                  "Create Faculty"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

