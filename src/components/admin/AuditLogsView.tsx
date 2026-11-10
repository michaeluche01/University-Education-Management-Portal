"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  History,
  RotateCcw,
} from "lucide-react";
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

interface AuditLogActor {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  actorRole: string;
  departmentId: string | null;
  beforeSummary: unknown;
  afterSummary: unknown;
  reason: string | null;
  createdAt: string;
  actor: AuditLogActor;
}

interface AuditLogsViewProps {
  role: "DEPARTMENT_ADMIN" | "SUPER_ADMIN";
  departmentName?: string;
}

const COMMON_ACTIONS = [
  "RESULT_SUBMITTED",
  "RESULT_APPROVED",
  "RESULT_RETURNED",
  "RESULT_REOPENED",
  "REGISTRATION_CREATED",
  "REGISTRATION_DELETED",
  "COURSE_CREATED",
  "COURSE_UPDATED",
  "COURSE_ASSIGNED",
  "USER_LOGIN",
  "USER_PASSWORD_CHANGED",
  "ENTITY_CREATED",
  "ENTITY_UPDATED",
];

const ENTITY_TYPES = [
  "Result",
  "CourseRegistration",
  "Course",
  "CourseAssignment",
  "Student",
  "Lecturer",
  "User",
  "Department",
  "Faculty",
  "Program",
  "AcademicSession",
  "Semester",
  "GradeScale",
];

export function AuditLogsView({ role, departmentName }: AuditLogsViewProps) {
  const isSuperAdmin = role === "SUPER_ADMIN";

  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [actionFilter, setActionFilter] = useState<string>("");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>(
    isSuperAdmin ? "" : "Result"
  );
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Inspect Modal
  const [inspectDialogOpen, setInspectDialogOpen] = useState(false);
  const [inspectedLog, setInspectedLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = useCallback(
    async (currentPage = page) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(currentPage));
        params.set("pageSize", "20");

        if (actionFilter) params.set("action", actionFilter);
        if (entityTypeFilter) params.set("entityType", entityTypeFilter);
        if (fromDate) params.set("fromDate", fromDate);
        if (toDate) params.set("toDate", toDate);

        const res = await fetch(`/api/v1/audit-logs?${params.toString()}`);
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error?.message ?? "Failed to load audit logs");
        }

        setLogs(json.data.items ?? []);
        setPage(json.data.pagination.page);
        setTotalPages(json.data.pagination.totalPages);
        setTotalCount(json.data.pagination.totalCount);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Network error loading audit logs";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [actionFilter, entityTypeFilter, fromDate, toDate, page]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchLogs(1);
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchLogs]);

  function handleResetFilters() {
    setActionFilter("");
    if (isSuperAdmin) setEntityTypeFilter("");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  function handleOpenInspect(log: AuditLogItem) {
    setInspectedLog(log);
    setInspectDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs & Activity Trail"
        description={
          isSuperAdmin
            ? "Comprehensive immutable audit trail of all academic, result, user, and administrative actions."
            : `Departmental result lifecycle and approval audit trail for ${departmentName ?? "your department"}.`
        }
      />

      {/* Filter Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filter Audit Trail
          </CardTitle>
          <CardDescription className="text-xs">
            Filter immutable event records by action, entity type, and date range.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="flt-action" className="text-xs">
                Action Type
              </Label>
              <select
                id="flt-action"
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(1);
                }}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs"
              >
                <option value="">All Actions</option>
                {COMMON_ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {isSuperAdmin && (
              <div>
                <Label htmlFor="flt-entity" className="text-xs">
                  Entity Type
                </Label>
                <select
                  id="flt-entity"
                  value={entityTypeFilter}
                  onChange={(e) => {
                    setEntityTypeFilter(e.target.value);
                    setPage(1);
                  }}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs"
                >
                  <option value="">All Entities</option>
                  {ENTITY_TYPES.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <Label htmlFor="flt-from" className="text-xs">
                From Date
              </Label>
              <Input
                id="flt-from"
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                className="mt-1 h-9 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="flt-to" className="text-xs">
                To Date
              </Label>
              <Input
                id="flt-to"
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="mt-1 h-9 text-xs"
              />
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      {loading ? (
        <LoadingSkeleton rows={8} label="Loading audit log entries..." />
      ) : error ? (
        <ErrorState
          title="Failed to load audit logs"
          message={error}
          onRetry={() => {
            void fetchLogs(page);
          }}
        />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<History className="h-6 w-6" />}
          title="No audit logs found"
          description="No activity matches the selected criteria."
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">Timestamp</TableHead>
                  <TableHead className="w-48">Action</TableHead>
                  <TableHead className="w-44">Actor</TableHead>
                  <TableHead className="w-32">Entity</TableHead>
                  <TableHead>Reason / Notes</TableHead>
                  <TableHead className="text-right w-24">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-semibold text-primary">
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-medium">
                        {log.actor.fullName}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {log.actorRole}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      <div>{log.entityType}</div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                        {log.entityId}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {log.reason ? (
                        <span className="italic">&ldquo;{log.reason}&rdquo;</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenInspect(log)}
                        className="h-7 w-7 p-0"
                        title="Inspect change payload"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted-foreground">
            <div>
              Showing {logs.length} of {totalCount} log entries (Page {page} of{" "}
              {totalPages || 1})
            </div>
            <div className="flex items-center gap-1.5 self-end">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => {
                  const p = page - 1;
                  setPage(p);
                  fetchLogs(p);
                }}
                className="h-8 text-xs gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => {
                  const p = page + 1;
                  setPage(p);
                  fetchLogs(p);
                }}
                className="h-8 text-xs gap-1"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Payload Modal */}
      <Dialog open={inspectDialogOpen} onOpenChange={setInspectDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Event Details</DialogTitle>
            <DialogDescription>
              Inspection of state changes recorded for event{" "}
              <code className="text-xs font-mono">{inspectedLog?.id}</code>.
            </DialogDescription>
          </DialogHeader>

          {inspectedLog && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3 bg-muted/20">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">
                    Action
                  </span>
                  <span className="font-mono font-semibold text-primary">
                    {inspectedLog.action}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">
                    Timestamp
                  </span>
                  <span>{new Date(inspectedLog.createdAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">
                    Actor
                  </span>
                  <span>
                    {inspectedLog.actor.fullName} ({inspectedLog.actorRole})
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">
                    Entity Target
                  </span>
                  <span className="font-mono">
                    {inspectedLog.entityType}: {inspectedLog.entityId}
                  </span>
                </div>
              </div>

              {inspectedLog.reason && (
                <div className="border rounded-md p-3 bg-amber-500/10 text-amber-900 dark:text-amber-200">
                  <span className="font-semibold block text-[11px]">
                    Reason / Justification:
                  </span>
                  <p className="italic mt-0.5">&ldquo;{inspectedLog.reason}&rdquo;</p>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="font-semibold mb-1 text-muted-foreground">
                    State Before Change
                  </div>
                  <pre className="rounded-md border p-3 bg-muted/40 font-mono text-[11px] overflow-x-auto max-h-48">
                    {inspectedLog.beforeSummary
                      ? JSON.stringify(inspectedLog.beforeSummary, null, 2)
                      : "None (Created)"}
                  </pre>
                </div>
                <div>
                  <div className="font-semibold mb-1 text-muted-foreground">
                    State After Change
                  </div>
                  <pre className="rounded-md border p-3 bg-muted/40 font-mono text-[11px] overflow-x-auto max-h-48">
                    {inspectedLog.afterSummary
                      ? JSON.stringify(inspectedLog.afterSummary, null, 2)
                      : "None"}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
