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

interface StudentRow {
  id: string;
  userId: string;
  matricNumber: string;
  departmentId: string;
  programId: string;
  levelId: string;
  gender: string | null;
  dateOfBirth: string | null;
  address: string | null;
  user: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    role: string;
    status: string;
  };
  department: { id: string; code: string; name: string };
  program: { id: string; code: string; name: string };
  level: { id: string; levelNumber: number; name: string };
  _count: { registrations: number; results: number };
}

interface StudentsManagerProps {
  role: "SUPER_ADMIN" | "DEPARTMENT_ADMIN";
  departmentName?: string | null;
}

export function StudentsManager({
  role,
  departmentName,
}: StudentsManagerProps) {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [levels, setLevels] = useState<LevelOption[]>([]);

  const [filterProgramId, setFilterProgramId] = useState("");
  const [filterLevelId, setFilterLevelId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [matricNumber, setMatricNumber] = useState("");
  const [programId, setProgramId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [address, setAddress] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchLookups = useCallback(async () => {
    try {
      const [progRes, lvlRes] = await Promise.all([
        fetch("/api/v1/programs"),
        fetch("/api/v1/levels"),
      ]);
      if (progRes.ok) {
        const j = await progRes.json();
        setPrograms(j.data);
      }
      if (lvlRes.ok) {
        const j = await lvlRes.json();
        setLevels(j.data);
      }
    } catch {
      // Handled in main fetch
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", "20");
      if (filterProgramId) params.set("programId", filterProgramId);
      if (filterLevelId) params.set("levelId", filterLevelId);
      if (filterStatus) params.set("status", filterStatus);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/v1/students?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Failed to load students");
      }
      setStudents(json.data.items);
      setTotal(json.data.total);
      setTotalPages(json.data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load students");
    } finally {
      setLoading(false);
    }
  }, [page, filterProgramId, filterLevelId, filterStatus, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchLookups();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchLookups]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchStudents();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchStudents]);

  function openCreateDialog() {
    setEditingStudent(null);
    setFullName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setMatricNumber("");
    setProgramId(filterProgramId || programs[0]?.id || "");
    setLevelId(filterLevelId || levels[0]?.id || "");
    setGender("");
    setDateOfBirth("");
    setAddress("");
    setFormError(null);
    setDialogOpen(true);
  }

  function openEditDialog(row: StudentRow) {
    setEditingStudent(row);
    setFullName(row.user.fullName);
    setEmail(row.user.email);
    setPhone(row.user.phone ?? "");
    setPassword("");
    setMatricNumber(row.matricNumber);
    setProgramId(row.programId);
    setLevelId(row.levelId);
    setGender(row.gender ?? "");
    setDateOfBirth(row.dateOfBirth ? row.dateOfBirth.slice(0, 10) : "");
    setAddress(row.address ?? "");
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const url = editingStudent
        ? `/api/v1/students/${editingStudent.id}`
        : "/api/v1/students";
      const method = editingStudent ? "PATCH" : "POST";

      const payload: Record<string, unknown> = editingStudent
        ? {
            fullName: fullName.trim(),
            phone: phone.trim() || null,
            programId,
            levelId,
            gender: gender.trim() || null,
            dateOfBirth: dateOfBirth || null,
            address: address.trim() || null,
          }
        : {
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim() || null,
            password,
            matricNumber: matricNumber.trim().toUpperCase(),
            programId,
            levelId,
            gender: gender.trim() || null,
            dateOfBirth: dateOfBirth || null,
            address: address.trim() || null,
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Failed to save student";
        setFormError(msg);
        toast.error(msg);
        return;
      }

      toast.success(
        editingStudent
          ? "Student profile updated"
          : "Student account & profile created"
      );
      setDialogOpen(false);
      await fetchStudents();
    } catch {
      const msg = "Network error while saving student.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description={
          role === "DEPARTMENT_ADMIN"
            ? `Enrolled students in ${departmentName ?? "your department"} (${total} total).`
            : `University students (${total} total).`
        }
        actions={
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            New Student
          </Button>
        }
      />

      {/* Filter Bar */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-lg border bg-card p-3.5">
        <div className="space-y-1">
          <Label htmlFor="flt-stu-prog" className="text-xs">
            Program
          </Label>
          <select
            id="flt-stu-prog"
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
          <Label htmlFor="flt-stu-lvl" className="text-xs">
            Academic Level
          </Label>
          <select
            id="flt-stu-lvl"
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

        <div className="space-y-1">
          <Label htmlFor="flt-stu-status" className="text-xs">
            Status
          </Label>
          <select
            id="flt-stu-status"
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
          <Label htmlFor="flt-stu-search" className="text-xs">
            Search
          </Label>
          <div className="flex gap-1.5">
            <Input
              id="flt-stu-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Matric no, name or email..."
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
        <LoadingSkeleton rows={6} label="Loading students..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchStudents} />
      ) : students.length === 0 ? (
        <EmptyState
          title="No students found"
          description="No students match the selected filters."
          action={
            <Button onClick={openCreateDialog} size="sm">
              New Student
            </Button>
          }
        />
      ) : (
        <>
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matric No.</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono font-semibold whitespace-nowrap">
                      {row.matricNumber}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>{row.user.fullName}</div>
                      <div className="text-xs text-muted-foreground md:hidden">
                        {row.user.email}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {row.user.email}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.program.code}
                    </TableCell>
                    <TableCell className="text-xs">{row.level.name}</TableCell>
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
                Page {page} of {totalPages} ({total} students)
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

      {/* Create / Edit Student Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingStudent ? "Edit Student Profile" : "Create New Student"}
            </DialogTitle>
            <DialogDescription>
              {editingStudent
                ? `Update profile details for ${editingStudent.matricNumber}.`
                : "Create a student user account and academic profile."}
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
                <Label htmlFor="stu-matric">Matriculation Number</Label>
                <Input
                  id="stu-matric"
                  value={matricNumber}
                  onChange={(e) =>
                    setMatricNumber(e.target.value.toUpperCase())
                  }
                  placeholder="e.g. UEMP/2026/CSC/050"
                  disabled={Boolean(editingStudent) || submitting}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stu-email">Email</Label>
                <Input
                  id="stu-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@uemp.demo"
                  disabled={Boolean(editingStudent) || submitting}
                  required
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="stu-name">Full Name</Label>
                <Input
                  id="stu-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full legal name"
                  disabled={submitting}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stu-phone">Phone (Optional)</Label>
                <Input
                  id="stu-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234..."
                  disabled={submitting}
                />
              </div>
            </div>

            {!editingStudent ? (
              <div className="space-y-1.5">
                <Label htmlFor="stu-pass">Temporary Password</Label>
                <Input
                  id="stu-pass"
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

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="stu-prog">Program</Label>
                <select
                  id="stu-prog"
                  value={programId}
                  onChange={(e) => setProgramId(e.target.value)}
                  disabled={submitting}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                >
                  <option value="" disabled>
                    Select program
                  </option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="stu-lvl">Academic Level</Label>
                <select
                  id="stu-lvl"
                  value={levelId}
                  onChange={(e) => setLevelId(e.target.value)}
                  disabled={submitting}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                >
                  <option value="" disabled>
                    Select level
                  </option>
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="stu-gender">Gender (Optional)</Label>
                <Input
                  id="stu-gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  placeholder="e.g. Female / Male"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stu-dob">Date of Birth (Optional)</Label>
                <Input
                  id="stu-dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="stu-addr">Address (Optional)</Label>
              <Input
                id="stu-addr"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Residential or hostel address"
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
                ) : editingStudent ? (
                  "Save Changes"
                ) : (
                  "Create Student"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

