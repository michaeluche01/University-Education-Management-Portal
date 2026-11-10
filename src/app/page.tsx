import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSession, ROLE_DASHBOARD_PATHS } from "@/server/auth/rbac";

async function HomeRedirectCheck() {
  const session = await getSession();
  if (session) {
    redirect(ROLE_DASHBOARD_PATHS[session.role]);
  }
  return null;
}

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-8">
      <Suspense fallback={null}>
        <HomeRedirectCheck />
      </Suspense>
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2.5 mb-1">
            <GraduationCap className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight">
              University Education Management Portal (UEMP)
            </CardTitle>
          </div>
          <CardDescription>
            Role-based academic administration, student course registration, and
            examination result management portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Access your Student, Lecturer, Department Administrator, or Super
            Administrator dashboard using your institutional credentials.
          </p>
          <div>
            <Button
              nativeButton={false}
              render={<Link href="/login" />}
              className="w-full sm:w-auto"
            >
              Sign In to Portal
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
