"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NavItem {
  label: string;
  href: string;
}

const ROLE_NAVIGATION: Record<Role, NavItem[]> = {
  STUDENT: [
    { label: "Dashboard", href: "/student" },
    { label: "Academic Results", href: "/student/results" },
    { label: "Course Registration", href: "/student/courses" },
    { label: "Registration Slip", href: "/student/print/registration" },
    { label: "My Profile", href: "/student/profile" },
  ],
  LECTURER: [
    { label: "Dashboard", href: "/lecturer" },
    { label: "My Courses", href: "/lecturer/courses" },
  ],
  DEPARTMENT_ADMIN: [
    { label: "Dashboard", href: "/dept-admin" },
    { label: "Approvals", href: "/dept-admin/approvals" },
    { label: "Programs", href: "/dept-admin/programs" },
    { label: "Courses", href: "/dept-admin/courses" },
    { label: "Students", href: "/dept-admin/students" },
    { label: "Lecturers", href: "/dept-admin/lecturers" },
    { label: "Registrations", href: "/dept-admin/registrations" },
    { label: "Audit Logs", href: "/dept-admin/audit-logs" },
  ],
  SUPER_ADMIN: [
    { label: "Dashboard", href: "/super-admin" },
    { label: "Approvals", href: "/super-admin/approvals" },
    { label: "Faculties", href: "/super-admin/faculties" },
    { label: "Departments", href: "/super-admin/departments" },
    { label: "Programs & Levels", href: "/super-admin/programs" },
    { label: "Courses", href: "/super-admin/courses" },
    { label: "Registrations", href: "/super-admin/registrations" },
    { label: "Sessions & Semesters", href: "/super-admin/sessions" },
    { label: "Grade Scale", href: "/super-admin/grade-scale" },
    { label: "Users", href: "/super-admin/users" },
    { label: "Audit Logs", href: "/super-admin/audit-logs" },
  ],
};

const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "Student",
  LECTURER: "Lecturer",
  DEPARTMENT_ADMIN: "Department Admin",
  SUPER_ADMIN: "Super Admin",
};

export interface PortalShellProps {
  user: {
    fullName: string;
    email: string;
    role: Role;
    departmentName: string | null;
  };
  children: React.ReactNode;
}

export function PortalShell({ user, children }: PortalShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const navItems = ROLE_NAVIGATION[user.role] ?? [];

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const res = await fetch("/api/v1/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        throw new Error("Failed to log out");
      }
      toast.success("Signed out successfully");
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    } catch {
      toast.error("Could not sign out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r bg-card shrink-0">
        <div className="flex h-16 items-center gap-2.5 px-6 border-b">
          <GraduationCap className="h-6 w-6 text-primary shrink-0" />
          <span className="font-bold text-lg tracking-tight">UEMP Portal</span>
        </div>

        <nav className="flex-1 space-y-1 p-4" aria-label="Sidebar Navigation">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <LayoutDashboard className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t text-xs text-muted-foreground">
          <div className="font-medium text-foreground truncate">
            {user.fullName}
          </div>
          <div className="truncate">{user.email}</div>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-50 md:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation Menu"
        >
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 flex w-64 max-w-[80vw] flex-col bg-card border-r h-full">
            <div className="flex h-16 items-center justify-between px-4 border-b">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                <span className="font-bold text-base">UEMP Portal</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="flex-1 space-y-1 p-4">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <LayoutDashboard className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      ) : null}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex h-16 items-center justify-between gap-2 border-b bg-card px-4 sm:px-6">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden shrink-0"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="font-semibold text-sm sm:text-base truncate">
              {user.fullName}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {ROLE_LABELS[user.role]}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <LogOut className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">
                {loggingOut ? "Signing out..." : "Logout"}
              </span>
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

