"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
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

interface LecturerRow {
  id: string;
  userId: string;
  staffId: string;
  departmentId: string;
  title: string | null;
  specialization: string | null;
  user: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    role: string;
    status: string;
  };
  department: { id: string; code: string; name: string };
  _count: { assignments: number };
}

interface LecturersManagerProps {
  role: "SUPER_ADMIN" | "DEPARTMENT_ADMIN";
  departmentName?: string | null;
}

export function LecturersManager({
  role,
  departmentName,
}: LecturersManagerProps) {
  const [lecturers, setLecturers] = useState<LecturerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [filterStatus, setFilterStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLecturer, setEditingLecturer] = useState<LecturerRow | null>(
    null
  );
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [staffId, setStaffId] = useState("");
  const [title, setTitle] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchLecturers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", "20");
      if (filterStatus) params.set("status", filterStatus);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/v1/lecturers?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Failed to load lecturers");
      }
      setLecturers(json.data.items);
      setTotal(json.data.total);
      setTotalPages(json.data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load lecturers");
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchLecturers();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchLecturers]);

  function openCreateDialog() {
    setEditingLecturer(null);
    setFullName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setStaffId("");
    setTitle("");
    setSpecialization("");
    setFormError(null);
    setDialogOpen(true);
  }

  function openEditDialog(row: LecturerRow) {
    setEditingLecturer(row);
    setFullName(row.user.fullName);
    setEmail(row.user.email);
    setPhone(row.user.phone ?? "");
    setPassword("");
    setStaffId(row.staffId);
    setTitle(row.title ?? "");
    setSpecialization(row.specialization ?? "");
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const url = editingLecturer
        ? `/api/v1/lecturers/${editingLecturer.id}`
        : "/api/v1/lecturers";
      const method = editingLecturer ? "PATCH" : "POST";

      const payload: Record<string, unknown> = editingLecturer
        ? {
            fullName: fullName.trim(),
            phone: phone.trim() || null,
            title: title.trim() || null,
            specialization: specialization.trim() || null,
          }
        : {
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim() || null,
            password,
            staffId: staffId.trim().toUpperCase(),
            title: title.trim() || null,
            specialization: specialization.trim() || null,
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Failed to save lecturer";
        setFormError(msg);
        toast.error(msg);
        return;
      }

      toast.success(
        editingLecturer
          ? "Lecturer profile updated"
          : "Lecturer account & profile created"
      );
      setDialogOpen(false);
      await fetchLecturers();
    } catch {
      const msg = "Network error while saving lecturer.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lecturers"
        description={
          role === "DEPARTMENT_ADMIN"
            ? `Academic staff in ${departmentName ?? "your department"} (${total} total).`
            : `University lecturers (${total} total).`
        }
        actions={
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            New Lecturer
          </Button>
        }
      />

      {/* Filter Bar */}
      <div className="grid gap-3 sm:grid-cols-2 rounded-lg border bg-card p-3.5">
        <div className="space-y-1">
          <Label htmlFor="flt-lec-status" className="text-xs">
            Status
          </Label>
          <select
            id="flt-lec-status"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
            className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="DEACTIVATED">DEACTIVATED</option>
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
          <Label htmlFor="flt-lec-search" className="text-xs">
            Search
          </Label>
          <div className="flex gap-1.5">
            <Input
              id="flt-lec-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Staff ID, name or email..."
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
        <LoadingSkeleton rows={5} label="Loading lecturers..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchLecturers} />
      ) : lecturers.length === 0 ? (
        <EmptyState
          title="No lecturers found"
          description="No lecturers match the selected filters."
          action={
            <Button onClick={openCreateDialog} size="sm">
              New Lecturer
            </Button>
          }
        />
      ) : (
        <>
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff ID</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Specialization</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Allocations
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lecturers.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono font-semibold whitespace-nowrap">
                      {row.staffId}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>
                        {row.title ? `${row.title} ` : ""}
                        {row.user.fullName}
                      </div>
                      <div className="text-xs text-muted-foreground md:hidden">
                        {row.user.email}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {row.user.email}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.specialization ?? "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs">
                      {row._count.assignments}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.user.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(row)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Page {page} of {totalPages} ({total} lecturers)
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

      {/* Create / Edit Lecturer Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLecturer ? "Edit Lecturer Profile" : "Create New Lecturer"}
            </DialogTitle>
            <DialogDescription>
              {editingLecturer
                ? `Update profile details for ${editingLecturer.staffId}.`
                : "Create a lecturer account and academic profile."}
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

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="lec-staff-id">Staff ID</Label>
                <Input
                  id="lec-staff-id"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value.toUpperCase())}
                  placeholder="e.g. LEC-CSC-010"
                  disabled={Boolean(editingLecturer) || submitting}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lec-email">Email</Label>
                <Input
                  id="lec-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="lecturer@uemp.demo"
                  disabled={Boolean(editingLecturer) || submitting}
                  required
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="lec-title">Title (Optional)</Label>
                <Input
                  id="lec-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Dr. / Prof."
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lec-name">Full Name</Label>
                <Input
                  id="lec-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full legal name"
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="lec-phone">Phone (Optional)</Label>
                <Input
                  id="lec-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234..."
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lec-spec">Specialization (Optional)</Label>
                <Input
                  id="lec-spec"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="e.g. Distributed Systems"
                  disabled={submitting}
                />
              </div>
            </div>

            {!editingLecturer ? (
              <div className="space-y-1.5">
                <Label htmlFor="lec-pass">Temporary Password</Label>
                <Input
                  id="lec-pass"
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  disabled={submitting}
                  required
                />
              </div>
            ) : null}

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
                ) : editingLecturer ? (
                  "Save Changes"
                ) : (
                  "Create Lecturer"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

