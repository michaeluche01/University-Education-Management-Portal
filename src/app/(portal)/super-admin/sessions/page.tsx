"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Pencil, Plus } from "lucide-react";
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

interface SemesterItem {
  id: string;
  sessionId: string;
  name: "FIRST" | "SECOND";
  isCurrent: boolean;
  registrationOpen: boolean;
}

interface SessionItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  semesters: SemesterItem[];
}

export default function SuperAdminSessionsPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create/Edit session dialog
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<SessionItem | null>(
    null
  );
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Registration toggle confirm dialog
  const [confirmSem, setConfirmSem] = useState<{
    semester: SemesterItem;
    sessionName: string;
  } | null>(null);
  const [toggling, setToggling] = useState(false);
  const [makingCurrentId, setMakingCurrentId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/sessions");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Failed to load sessions");
      }
      setSessions(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchSessions();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchSessions]);

  function openCreateDialog() {
    setEditingSession(null);
    setName("2027/2028");
    setStartDate("2027-09-01");
    setEndDate("2028-07-31");
    setFormError(null);
    setSessionDialogOpen(true);
  }

  function openEditDialog(session: SessionItem) {
    setEditingSession(session);
    setName(session.name);
    setStartDate(session.startDate.slice(0, 10));
    setEndDate(session.endDate.slice(0, 10));
    setFormError(null);
    setSessionDialogOpen(true);
  }

  async function handleSessionSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const url = editingSession
        ? `/api/v1/sessions/${editingSession.id}`
        : "/api/v1/sessions";
      const method = editingSession ? "PATCH" : "POST";

      const payload = editingSession
        ? { startDate, endDate }
        : { name: name.trim(), startDate, endDate };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Failed to save session";
        setFormError(msg);
        toast.error(msg);
        return;
      }

      toast.success(
        editingSession
          ? "Session dates updated"
          : "Academic session and semesters created"
      );
      setSessionDialogOpen(false);
      await fetchSessions();
    } catch {
      const msg = "Network error while saving session.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMakeSessionCurrent(sessionId: string) {
    setMakingCurrentId(sessionId);
    try {
      const res = await fetch(`/api/v1/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCurrent: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Failed to set current session");
        return;
      }
      toast.success(`Session ${json.data.name} is now the current session`);
      await fetchSessions();
    } catch {
      toast.error("Network error while updating current session.");
    } finally {
      setMakingCurrentId(null);
    }
  }

  async function handleMakeSemesterCurrent(semesterId: string) {
    setMakingCurrentId(semesterId);
    try {
      const res = await fetch(`/api/v1/semesters/${semesterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCurrent: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Failed to set current semester");
        return;
      }
      toast.success(`${json.data.name} semester is now current`);
      await fetchSessions();
    } catch {
      toast.error("Network error while updating current semester.");
    } finally {
      setMakingCurrentId(null);
    }
  }

  async function handleConfirmToggleRegistration() {
    if (!confirmSem) return;
    setToggling(true);
    try {
      const nextOpen = !confirmSem.semester.registrationOpen;
      const res = await fetch(`/api/v1/semesters/${confirmSem.semester.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationOpen: nextOpen }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(
          json?.error?.message ?? "Failed to toggle registration status"
        );
        return;
      }
      toast.success(
        `Course registration ${nextOpen ? "opened" : "closed"} for ${confirmSem.sessionName} (${confirmSem.semester.name})`
      );
      setConfirmSem(null);
      await fetchSessions();
    } catch {
      toast.error("Network error while updating registration status.");
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Sessions & Semesters"
        description="Manage academic sessions, switch the active session/semester, and control course registration windows."
        actions={
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            New Session
          </Button>
        }
      />

      {loading ? (
        <LoadingSkeleton rows={4} label="Loading academic sessions..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchSessions} />
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No academic sessions found"
          description="Create an academic session to initialize FIRST and SECOND semesters."
          action={
            <Button onClick={openCreateDialog} size="sm">
              Create Session
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => (
            <Card
              key={session.id}
              className={
                session.isCurrent ? "border-primary/60 shadow-sm" : undefined
              }
            >
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">
                      {session.name} Academic Session
                    </CardTitle>
                    {session.isCurrent ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Current Session
                      </span>
                    ) : null}
                  </div>
                  <CardDescription className="mt-1">
                    {session.startDate.slice(0, 10)} to{" "}
                    {session.endDate.slice(0, 10)}
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!session.isCurrent ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={makingCurrentId !== null}
                      onClick={() => handleMakeSessionCurrent(session.id)}
                    >
                      {makingCurrentId === session.id
                        ? "Switching..."
                        : "Make Current"}
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(session)}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit Dates
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {session.semesters.map((sem) => (
                    <div
                      key={sem.id}
                      className="flex flex-col justify-between gap-3 rounded-lg border p-3.5 bg-muted/20"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm">
                          {sem.name} Semester
                        </span>
                        <div className="flex items-center gap-1.5">
                          {sem.isCurrent ? (
                            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                              Active Semester
                            </span>
                          ) : null}
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              sem.registrationOpen
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            Reg: {sem.registrationOpen ? "Open" : "Closed"}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {session.isCurrent && !sem.isCurrent ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-8"
                            disabled={makingCurrentId !== null}
                            onClick={() => handleMakeSemesterCurrent(sem.id)}
                          >
                            {makingCurrentId === sem.id
                              ? "Switching..."
                              : "Make Current Semester"}
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-8"
                          onClick={() =>
                            setConfirmSem({
                              semester: sem,
                              sessionName: session.name,
                            })
                          }
                        >
                          {sem.registrationOpen
                            ? "Close Registration"
                            : "Open Registration"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Session Create / Edit Dates Dialog */}
      <Dialog open={sessionDialogOpen} onOpenChange={setSessionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSession
                ? `Edit Dates (${editingSession.name})`
                : "Create Academic Session"}
            </DialogTitle>
            <DialogDescription>
              {editingSession
                ? "Update the start and end dates for this academic session."
                : "Session name must match YYYY/YYYY (e.g. 2027/2028). Creates FIRST and SECOND semesters automatically."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSessionSubmit} className="space-y-4">
            {formError ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {formError}
              </div>
            ) : null}

            {!editingSession ? (
              <div className="space-y-1.5">
                <Label htmlFor="sess-name">Session Name (YYYY/YYYY)</Label>
                <Input
                  id="sess-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="2027/2028"
                  disabled={submitting}
                  required
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="sess-start">Start Date</Label>
              <Input
                id="sess-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={submitting}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sess-end">End Date</Label>
              <Input
                id="sess-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={submitting}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSessionDialogOpen(false)}
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
                ) : editingSession ? (
                  "Save Dates"
                ) : (
                  "Create Session"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Registration Toggle Dialog */}
      <Dialog
        open={confirmSem !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmSem(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmSem?.semester.registrationOpen
                ? "Close Course Registration?"
                : "Open Course Registration?"}
            </DialogTitle>
            <DialogDescription>
              {confirmSem
                ? `Are you sure you want to ${
                    confirmSem.semester.registrationOpen ? "close" : "open"
                  } student course registration for ${confirmSem.sessionName} (${
                    confirmSem.semester.name
                  } Semester)?`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmSem(null)}
              disabled={toggling}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmToggleRegistration}
              disabled={toggling}
            >
              {toggling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

