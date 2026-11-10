"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema } from "@/lib/validators/auth";

const DEMO_ACCOUNTS = [
  {
    label: "Student (CSC 300L)",
    email: "student01@uemp.demo",
    password: "Uemp@Demo2026",
  },
  {
    label: "Lecturer (CSC)",
    email: "lecturer1@uemp.demo",
    password: "Uemp@Demo2026",
  },
  {
    label: "Dept Admin (CSC)",
    email: "deptadmin.csc@uemp.demo",
    password: "Uemp@Demo2026",
  },
  {
    label: "Super Admin",
    email: "superadmin@uemp.demo",
    password: "Uemp@Demo2026",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function handlePageShow() {
      setSubmitting(false);
      setPassword("");
      setErrorMessage(null);
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  function fillDemoCredentials(demoEmail: string, demoPassword: string) {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setErrorMessage(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid login input";
      setErrorMessage(msg);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const payload = await res.json();
      if (!res.ok) {
        const message =
          payload?.error?.message ?? "Unable to sign in. Please try again.";
        setErrorMessage(message);
        setPassword("");
        toast.error(message);
        return;
      }

      const dashboardPath = payload?.data?.dashboardPath ?? "/";
      setEmail("");
      setPassword("");
      toast.success("Signed in successfully");
      router.replace(dashboardPath);
      router.refresh();
    } catch {
      const fallback = "Network error while signing in. Please try again.";
      setErrorMessage(fallback);
      setPassword("");
      toast.error(fallback);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-bold text-xl text-foreground"
          >
            <GraduationCap className="h-7 w-7 text-primary" />
            <span>UEMP Portal</span>
          </Link>
          <p className="text-xs sm:text-sm text-muted-foreground">
            University Education Management Portal
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Sign In</CardTitle>
            <CardDescription>
              Enter your university email and password to access your dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {errorMessage ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs sm:text-sm text-destructive"
              >
                {errorMessage}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@uemp.demo"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="space-y-2.5 pt-3 border-t">
              <div className="text-xs font-medium text-muted-foreground">
                Quick-fill Demo Credentials (Password: Uemp@Demo2026)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((demo) => (
                  <Button
                    key={demo.email}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs justify-start truncate"
                    disabled={submitting}
                    onClick={() =>
                      fillDemoCredentials(demo.email, demo.password)
                    }
                  >
                    {demo.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

