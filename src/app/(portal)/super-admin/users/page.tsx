"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyRound,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  UserCog,
  Users,
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

type RoleType = "STUDENT" | "LECTURER" | "DEPARTMENT_ADMIN" | "SUPER_ADMIN";
type StatusType = "ACTIVE" | "SUSPENDED" | "DEACTIVATED";

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

interface UserListItem {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: RoleType;
  status: StatusType;
  createdAt: string;
  profile: {
    department: DepartmentOption | null;
    departmentId: string | null;
    matricNumber: string | null;
    staffId: string | null;
    program: { id: string; code: string; name: string } | null;
    programId: string | null;
    level: { id: string; levelNumber: number; name: string } | null;
    levelId: string | null;
    title: string | null;
    specialization: string | null;
  };
}

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [deptFilter, setDeptFilter] = useState<string>("");

  // Reference options
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [levels, setLevels] = useState<LevelOption[]>([]);

  // 1. Create User dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createRole, setCreateRole] = useState<RoleType>("STUDENT");
  const [createEmail, setCreateEmail] = useState("");
  const [createFullName, setCreateFullName] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createDeptId, setCreateDeptId] = useState("");
  const [createProgId, setCreateProgId] = useState("");
  const [createLevelId, setCreateLevelId] = useState("");
  const [createMatric, setCreateMatric] = useState("");
  const [createStaffId, setCreateStaffId] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createSpec, setCreateSpec] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // 2. Edit User dialog state
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDeptId, setEditDeptId] = useState("");
  const [editProgId, setEditProgId] = useState("");
  const [editLevelId, setEditLevelId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editSpec, setEditSpec] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // 3. Status dialog state
  const [statusUser, setStatusUser] = useState<UserListItem | null>(null);
  const [nextStatus, setNextStatus] = useState<StatusType>("ACTIVE");
  const [statusReason, setStatusReason] = useState("");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  // 4. Role dialog state (non-STUDENT only)
  const [roleUser, setRoleUser] = useState<UserListItem | null>(null);
  const [nextRole, setNextRole] = useState<
    "LECTURER" | "DEPARTMENT_ADMIN" | "SUPER_ADMIN"
  >("LECTURER");
  const [roleDeptId, setRoleDeptId] = useState("");
  const [roleStaffId, setRoleStaffId] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [roleSpec, setRoleSpec] = useState("");
  const [roleError, setRoleError] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState(false);

  // 5. Password Reset dialog state
  const [pwdUser, setPwdUser] = useState<UserListItem | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [savingPwd, setSavingPwd] = useState(false);

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
      // Non-fatal; users fetch handles primary error state
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", "20");
      if (roleFilter) params.set("role", roleFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (deptFilter) params.set("departmentId", deptFilter);
      if (appliedSearch) params.set("search", appliedSearch);

      const res = await fetch(`/api/v1/users?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Failed to load users");
      }
      setUsers(json.data.items);
      setTotal(json.data.total);
      setTotalPages(json.data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, statusFilter, deptFilter, appliedSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadReferenceData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadReferenceData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchUsers();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const filteredCreatePrograms = useMemo(
    () => programs.filter((p) => p.departmentId === createDeptId),
    [programs, createDeptId]
  );

  const filteredEditPrograms = useMemo(
    () => programs.filter((p) => p.departmentId === editDeptId),
    [programs, editDeptId]
  );

  function openCreateDialog() {
    const defaultDept = departments[0]?.id ?? "";
    const defaultProg =
      programs.find((p) => p.departmentId === defaultDept)?.id ?? "";
    const defaultLvl = levels[0]?.id ?? "";

    setCreateRole("STUDENT");
    setCreateEmail("");
    setCreateFullName("");
    setCreatePhone("");
    setCreatePassword("");
    setCreateDeptId(defaultDept);
    setCreateProgId(defaultProg);
    setCreateLevelId(defaultLvl);
    setCreateMatric("");
    setCreateStaffId("");
    setCreateTitle("");
    setCreateSpec("");
    setCreateError(null);
    setCreateOpen(true);
  }

  function handleCreateDepartmentChange(newDeptId: string) {
    setCreateDeptId(newDeptId);
    const matchingProg =
      programs.find((p) => p.departmentId === newDeptId)?.id ?? "";
    setCreateProgId(matchingProg);
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        email: createEmail,
        fullName: createFullName,
        phone: createPhone,
        password: createPassword,
        role: createRole,
      };
      if (createRole === "STUDENT") {
        payload.departmentId = createDeptId;
        payload.programId = createProgId;
        payload.levelId = createLevelId;
        payload.matricNumber = createMatric;
      } else if (createRole === "LECTURER") {
        payload.departmentId = createDeptId;
        payload.staffId = createStaffId;
        payload.title = createTitle;
        payload.specialization = createSpec;
      } else if (createRole === "DEPARTMENT_ADMIN") {
        payload.departmentId = createDeptId;
        payload.staffId = createStaffId;
      }

      const res = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Failed to create user";
        setCreateError(msg);
        toast.error(msg);
        return;
      }
      toast.success(`Created ${json.data.fullName} (${json.data.role})`);
      setCreateOpen(false);
      await fetchUsers();
    } catch {
      setCreateError("Network error while creating user");
      toast.error("Network error while creating user");
    } finally {
      setCreating(false);
    }
  }

  function openEditDialog(user: UserListItem) {
    setEditingUser(user);
    setEditFullName(user.fullName);
    setEditPhone(user.phone ?? "");
    setEditDeptId(user.profile.departmentId ?? departments[0]?.id ?? "");
    setEditProgId(user.profile.programId ?? "");
    setEditLevelId(user.profile.levelId ?? levels[0]?.id ?? "");
    setEditTitle(user.profile.title ?? "");
    setEditSpec(user.profile.specialization ?? "");
    setEditError(null);
  }

  function handleEditDepartmentChange(newDeptId: string) {
    setEditDeptId(newDeptId);
    const matchingProg =
      programs.find((p) => p.departmentId === newDeptId)?.id ?? "";
    setEditProgId(matchingProg);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);
    setSavingEdit(true);
    try {
      const payload: Record<string, unknown> = {
        fullName: editFullName,
        phone: editPhone || null,
      };
      if (editingUser.role === "STUDENT") {
        payload.departmentId = editDeptId;
        payload.programId = editProgId;
        payload.levelId = editLevelId;
      } else if (editingUser.role === "LECTURER") {
        payload.departmentId = editDeptId;
        payload.title = editTitle || null;
        payload.specialization = editSpec || null;
      } else if (editingUser.role === "DEPARTMENT_ADMIN") {
        payload.departmentId = editDeptId;
      }

      const res = await fetch(`/api/v1/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Failed to update user";
        setEditError(msg);
        toast.error(msg);
        return;
      }
      toast.success("User updated");
      setEditingUser(null);
      await fetchUsers();
    } catch {
      setEditError("Network error while updating user");
      toast.error("Network error while updating user");
    } finally {
      setSavingEdit(false);
    }
  }

  function openStatusDialog(user: UserListItem) {
    setStatusUser(user);
    setNextStatus(user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE");
    setStatusReason("");
    setStatusError(null);
  }

  async function handleStatusSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!statusUser) return;
    setStatusError(null);
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/v1/users/${statusUser.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          reason: statusReason,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Failed to update account status";
        setStatusError(msg);
        toast.error(msg);
        return;
      }
      toast.success(
        `${statusUser.fullName} status set to ${json.data.status}`
      );
      setStatusUser(null);
      await fetchUsers();
    } catch {
      setStatusError("Network error while updating status");
      toast.error("Network error while updating status");
    } finally {
      setSavingStatus(false);
    }
  }

  function openRoleDialog(user: UserListItem) {
    setRoleUser(user);
    const defaultNextRole =
      user.role === "LECTURER" ? "DEPARTMENT_ADMIN" : "LECTURER";
    setNextRole(defaultNextRole);
    setRoleDeptId(user.profile.departmentId ?? departments[0]?.id ?? "");
    setRoleStaffId(user.profile.staffId ?? "");
    setRoleTitle(user.profile.title ?? "");
    setRoleSpec(user.profile.specialization ?? "");
    setRoleError(null);
  }

  async function handleRoleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roleUser) return;
    setRoleError(null);
    setSavingRole(true);
    try {
      const payload: Record<string, unknown> = {
        role: nextRole,
      };
      if (nextRole === "LECTURER" || nextRole === "DEPARTMENT_ADMIN") {
        payload.departmentId = roleDeptId;
        payload.staffId = roleStaffId;
      }
      if (nextRole === "LECTURER") {
        payload.title = roleTitle;
        payload.specialization = roleSpec;
      }

      const res = await fetch(`/api/v1/users/${roleUser.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Failed to update role";
        setRoleError(msg);
        toast.error(msg);
        return;
      }
      toast.success(`${roleUser.fullName} role changed to ${json.data.role}`);
      setRoleUser(null);
      await fetchUsers();
    } catch {
      setRoleError("Network error while updating role");
      toast.error("Network error while updating role");
    } finally {
      setSavingRole(false);
    }
  }

  function openPasswordDialog(user: UserListItem) {
    setPwdUser(user);
    setNewPassword("");
    setPwdError(null);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pwdUser) return;
    setPwdError(null);
    setSavingPwd(true);
    try {
      const res = await fetch(`/api/v1/users/${pwdUser.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Failed to reset password";
        setPwdError(msg);
        toast.error(msg);
        return;
      }
      toast.success(`Password reset for ${pwdUser.email}`);
      setPwdUser(null);
    } catch {
      setPwdError("Network error while resetting password");
      toast.error("Network error while resetting password");
    } finally {
      setSavingPwd(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users Management"
        description="Create and manage student, lecturer, department admin, and super admin accounts."
        actions={
          <Button onClick={openCreateDialog}>
            <Plus className="mr-1.5 h-4 w-4" />
            Create User
          </Button>
        }
      />

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
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
              placeholder="Search name, email, matric or staff ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        <select
          aria-label="Filter by role"
          value={roleFilter}
          onChange={(e) => {
            setPage(1);
            setRoleFilter(e.target.value);
          }}
          className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          <option value="">All Roles</option>
          <option value="STUDENT">Student</option>
          <option value="LECTURER">Lecturer</option>
          <option value="DEPARTMENT_ADMIN">Department Admin</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>

        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
          className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="DEACTIVATED">Deactivated</option>
        </select>

        <select
          aria-label="Filter by department"
          value={deptFilter}
          onChange={(e) => {
            setPage(1);
            setDeptFilter(e.target.value);
          }}
          className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.code} — {d.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchUsers} />
      ) : users.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No matching users"
          description="Adjust your search or filters, or create a new user account."
          action={
            <Button onClick={openCreateDialog}>
              <Plus className="mr-1.5 h-4 w-4" />
              Create User
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name & Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Identifier</TableHead>
                  <TableHead>Department / Program</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium text-slate-900">
                        {u.fullName}
                      </div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">
                        {u.role}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-700">
                      {u.profile.matricNumber ?? u.profile.staffId ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {u.profile.department ? (
                        <div>
                          <span className="font-medium text-slate-800">
                            {u.profile.department.code}
                          </span>{" "}
                          — {u.profile.department.name}
                          {u.profile.program && (
                            <div className="text-slate-500">
                              {u.profile.program.code}
                              {u.profile.level
                                ? ` • ${u.profile.level.levelNumber}L`
                                : ""}
                            </div>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          u.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700"
                            : u.status === "SUSPENDED"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-red-50 text-red-700"
                        }`}
                      >
                        {u.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex flex-wrap justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(u)}
                          title="Edit details"
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openStatusDialog(u)}
                          title="Change status"
                        >
                          <ShieldAlert className="mr-1 h-3.5 w-3.5" />
                          Status
                        </Button>
                        {u.role !== "STUDENT" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openRoleDialog(u)}
                            title="Change role"
                          >
                            <UserCog className="mr-1 h-3.5 w-3.5" />
                            Role
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openPasswordDialog(u)}
                          title="Reset password"
                        >
                          <KeyRound className="mr-1 h-3.5 w-3.5" />
                          Password
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col items-center justify-between gap-2 text-xs text-slate-600 sm:flex-row">
            <div>
              Showing page <span className="font-semibold">{page}</span> of{" "}
              <span className="font-semibold">{totalPages}</span> ({total} total
              users)
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

      {/* 1. Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create User Account</DialogTitle>
            <DialogDescription>
              Creates the user account and role-specific profile in one atomic
              transaction.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            {createError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {createError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="create-role">Role</Label>
              <select
                id="create-role"
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value as RoleType)}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm"
              >
                <option value="STUDENT">STUDENT</option>
                <option value="LECTURER">LECTURER</option>
                <option value="DEPARTMENT_ADMIN">DEPARTMENT_ADMIN</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="create-fullname">Full Name</Label>
                <Input
                  id="create-fullname"
                  value={createFullName}
                  onChange={(e) => setCreateFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-email">Email</Label>
                <Input
                  id="create-email"
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="create-phone">Phone (optional)</Label>
                <Input
                  id="create-phone"
                  value={createPhone}
                  onChange={(e) => setCreatePhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-password">
                  Temporary Password (min 8 chars)
                </Label>
                <Input
                  id="create-password"
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
            </div>

            {createRole !== "SUPER_ADMIN" && (
              <div className="space-y-1.5">
                <Label htmlFor="create-dept">Department</Label>
                <select
                  id="create-dept"
                  value={createDeptId}
                  onChange={(e) =>
                    handleCreateDepartmentChange(e.target.value)
                  }
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

            {createRole === "STUDENT" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="create-matric">Matriculation Number</Label>
                  <Input
                    id="create-matric"
                    placeholder="e.g. UEMP/2026/CSC/099"
                    value={createMatric}
                    onChange={(e) =>
                      setCreateMatric(e.target.value.toUpperCase())
                    }
                    required
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="create-prog">Program</Label>
                    <select
                      id="create-prog"
                      value={createProgId}
                      onChange={(e) => setCreateProgId(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm"
                      required
                    >
                      <option value="">Select program...</option>
                      {filteredCreatePrograms.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} — {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="create-level">Academic Level</Label>
                    <select
                      id="create-level"
                      value={createLevelId}
                      onChange={(e) => setCreateLevelId(e.target.value)}
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
              </>
            )}

            {(createRole === "LECTURER" ||
              createRole === "DEPARTMENT_ADMIN") && (
              <div className="space-y-1.5">
                <Label htmlFor="create-staffid">Staff ID</Label>
                <Input
                  id="create-staffid"
                  placeholder="e.g. STAFF/CSC/099"
                  value={createStaffId}
                  onChange={(e) =>
                    setCreateStaffId(e.target.value.toUpperCase())
                  }
                  required
                />
              </div>
            )}

            {createRole === "LECTURER" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="create-title">Title (optional)</Label>
                  <Input
                    id="create-title"
                    placeholder="e.g. Dr., Prof."
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-spec">
                    Specialization (optional)
                  </Label>
                  <Input
                    id="create-spec"
                    placeholder="e.g. Distributed Systems"
                    value={createSpec}
                    onChange={(e) => setCreateSpec(e.target.value)}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Edit User Dialog */}
      <Dialog
        open={Boolean(editingUser)}
        onOpenChange={(o) => !o && setEditingUser(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit User Details</DialogTitle>
            <DialogDescription>
              {editingUser?.email} ({editingUser?.role})
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {editError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {editError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="edit-fullname">Full Name</Label>
              <Input
                id="edit-fullname"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
              />
            </div>

            {editingUser && editingUser.role !== "SUPER_ADMIN" && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-dept">Department</Label>
                <select
                  id="edit-dept"
                  value={editDeptId}
                  onChange={(e) =>
                    handleEditDepartmentChange(e.target.value)
                  }
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {editingUser?.role === "STUDENT" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-prog">Program</Label>
                  <select
                    id="edit-prog"
                    value={editProgId}
                    onChange={(e) => setEditProgId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm"
                  >
                    {filteredEditPrograms.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-level">Academic Level</Label>
                  <select
                    id="edit-level"
                    value={editLevelId}
                    onChange={(e) => setEditLevelId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm"
                  >
                    {levels.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {editingUser?.role === "LECTURER" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-spec">Specialization</Label>
                  <Input
                    id="edit-spec"
                    value={editSpec}
                    onChange={(e) => setEditSpec(e.target.value)}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingUser(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 3. Change Status Dialog */}
      <Dialog
        open={Boolean(statusUser)}
        onOpenChange={(o) => !o && setStatusUser(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Account Status</DialogTitle>
            <DialogDescription>
              {statusUser?.fullName} ({statusUser?.email})
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleStatusSubmit} className="space-y-4">
            {statusError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {statusError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="status-select">New Status</Label>
              <select
                id="status-select"
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as StatusType)}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="DEACTIVATED">DEACTIVATED</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status-reason">Reason (recorded in audit log)</Label>
              <Input
                id="status-reason"
                placeholder="Optional reason for status change..."
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStatusUser(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingStatus}>
                {savingStatus ? "Updating..." : "Confirm Status Change"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 4. Change Role Dialog (non-STUDENT only) */}
      <Dialog
        open={Boolean(roleUser)}
        onOpenChange={(o) => !o && setRoleUser(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Convert {roleUser?.fullName} ({roleUser?.role}) to another staff
              or admin role.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRoleSubmit} className="space-y-4">
            {roleError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {roleError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="role-select">Target Role</Label>
              <select
                id="role-select"
                value={nextRole}
                onChange={(e) =>
                  setNextRole(
                    e.target.value as
                      | "LECTURER"
                      | "DEPARTMENT_ADMIN"
                      | "SUPER_ADMIN"
                  )
                }
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm"
              >
                <option value="LECTURER">LECTURER</option>
                <option value="DEPARTMENT_ADMIN">DEPARTMENT_ADMIN</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              </select>
            </div>

            {(nextRole === "LECTURER" ||
              nextRole === "DEPARTMENT_ADMIN") && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="role-dept">Department</Label>
                  <select
                    id="role-dept"
                    value={roleDeptId}
                    onChange={(e) => setRoleDeptId(e.target.value)}
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
                <div className="space-y-1.5">
                  <Label htmlFor="role-staffid">Staff ID</Label>
                  <Input
                    id="role-staffid"
                    value={roleStaffId}
                    onChange={(e) =>
                      setRoleStaffId(e.target.value.toUpperCase())
                    }
                    required
                  />
                </div>
              </>
            )}

            {nextRole === "LECTURER" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="role-title">Title (optional)</Label>
                  <Input
                    id="role-title"
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role-spec">Specialization (optional)</Label>
                  <Input
                    id="role-spec"
                    value={roleSpec}
                    onChange={(e) => setRoleSpec(e.target.value)}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRoleUser(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingRole}>
                {savingRole ? "Converting..." : "Change Role"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 5. Reset Password Dialog */}
      <Dialog
        open={Boolean(pwdUser)}
        onOpenChange={(o) => !o && setPwdUser(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Temporary Password</DialogTitle>
            <DialogDescription>
              Set a new temporary password for {pwdUser?.fullName} (
              {pwdUser?.email}). Also clears any login lockout.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {pwdError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {pwdError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="reset-pwd">New Temporary Password</Label>
              <Input
                id="reset-pwd"
                type="password"
                minLength={8}
                placeholder="Minimum 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPwdUser(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingPwd}>
                {savingPwd ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

