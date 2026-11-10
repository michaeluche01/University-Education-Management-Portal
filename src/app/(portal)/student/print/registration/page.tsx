"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, GraduationCap, Printer } from "lucide-react";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SlipRegistrationRow {
  id: string;
  registeredAt: string;
  assignedLecturerName: string | null;
  course: {
    id: string;
    code: string;
    title: string;
    creditUnits: number;
    semesterName: string;
  };
  semester: {
    id: string;
    name: string;
    session: { id: string; name: string };
  };
}

interface SlipProfileData {
  fullName: string;
  email: string;
  studentProfile: {
    matricNumber: string;
    department: {
      name: string;
      code: string;
      faculty: { name: string; code: string };
    };
    program: { name: string; code: string };
    level: { name: string };
  } | null;
}

export default function StudentPrintRegistrationSlipPage() {
  const [profile, setProfile] = useState<SlipProfileData | null>(null);
  const [registrations, setRegistrations] = useState<SlipRegistrationRow[]>([]);
  const [totalUnits, setTotalUnits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSlipData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profRes, regRes] = await Promise.all([
        fetch("/api/v1/profile"),
        fetch("/api/v1/registrations?page=1&pageSize=100"),
      ]);
      const profJson = await profRes.json();
      const regJson = await regRes.json();

      if (!profRes.ok) {
        throw new Error(profJson?.error?.message ?? "Failed to load profile");
      }
      if (!regRes.ok) {
        throw new Error(
          regJson?.error?.message ?? "Failed to load registrations"
        );
      }

      setProfile(profJson.data);
      setRegistrations(regJson.data.items);
      setTotalUnits(regJson.data.totalCreditUnits ?? 0);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load registration slip"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchSlipData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchSlipData]);

  const firstRowSem = registrations[0]?.semester ?? null;
  const sessionLabel = firstRowSem
    ? `${firstRowSem.session.name} Academic Session — ${firstRowSem.name} Semester`
    : "Current Semester";

  return (
    <div className="space-y-6">
      {/* Screen-only toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href="/student/courses"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Registration
        </Link>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1.5" />
          Print Registration Slip
        </Button>
      </div>

      {loading ? (
        <LoadingSkeleton rows={6} label="Preparing registration slip..." />
      ) : error || !profile ? (
        <ErrorState
          message={error ?? "Unable to load slip"}
          onRetry={fetchSlipData}
        />
      ) : (
        <div className="rounded-lg border bg-card p-6 sm:p-8 print:border-none print:shadow-none print:p-0 space-y-6">
          {/* University Header */}
          <div className="border-b pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <GraduationCap className="h-8 w-8 text-primary shrink-0" />
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                  UNIVERSITY EDUCATION MANAGEMENT PORTAL (UEMP)
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Official Course Registration Slip · {sessionLabel}
                </p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground sm:text-right">
              <div>Date Printed: {new Date().toISOString().slice(0, 10)}</div>
              <div>Status: Officially Registered</div>
            </div>
          </div>

          {/* Student Bio-data Grid */}
          <div className="grid gap-3 sm:grid-cols-3 rounded-md border p-4 text-xs sm:text-sm">
            <div>
              <span className="text-muted-foreground block">Student Name</span>
              <span className="font-semibold">{profile.fullName}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">
                Matriculation Number
              </span>
              <span className="font-mono font-semibold">
                {profile.studentProfile?.matricNumber ?? "—"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">
                Academic Level
              </span>
              <span className="font-semibold">
                {profile.studentProfile?.level.name ?? "—"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Faculty</span>
              <span className="font-medium">
                {profile.studentProfile?.department.faculty.name ?? "—"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Department</span>
              <span className="font-medium">
                {profile.studentProfile?.department.name ?? "—"} (
                {profile.studentProfile?.department.code ?? "—"})
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">
                Degree Program
              </span>
              <span className="font-medium">
                {profile.studentProfile?.program.name ?? "—"}
              </span>
            </div>
          </div>

          {/* Registered Courses Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Course Code</TableHead>
                  <TableHead>Course Title</TableHead>
                  <TableHead>Credit Units</TableHead>
                  <TableHead>Lecturer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-6 text-muted-foreground"
                    >
                      No courses registered for this semester.
                    </TableCell>
                  </TableRow>
                ) : (
                  registrations.map((row, idx) => (
                    <TableRow key={row.id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell className="font-mono font-semibold">
                        {row.course.code}
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.course.title}
                      </TableCell>
                      <TableCell>{row.course.creditUnits}</TableCell>
                      <TableCell className="text-xs">
                        {row.assignedLecturerName ?? "TBA"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Total Credit Units Summary */}
          <div className="flex items-center justify-between rounded-md bg-muted/50 px-4 py-3 text-sm font-semibold">
            <span>Total Registered Courses: {registrations.length}</span>
            <span>Total Credit Units: {totalUnits}</span>
          </div>

          {/* Signatures */}
          <div className="grid gap-8 sm:grid-cols-2 pt-8 text-xs text-muted-foreground">
            <div className="border-t pt-2">
              Student Signature &amp; Date
            </div>
            <div className="border-t pt-2">
              Departmental Academic Adviser Signature &amp; Stamp
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

