import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/layout/PortalShell";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { AppError } from "@/lib/errors";
import { requireAuth } from "@/server/auth/rbac";

async function AuthenticatedPortalContent({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await requireAuth();
  } catch (error) {
    if (error instanceof AppError && error.status === 401) {
      redirect("/api/v1/auth/clear-session");
    }
    throw error;
  }

  return (
    <PortalShell
      user={{
        fullName: session.fullName,
        email: session.email,
        role: session.role,
        departmentName: session.departmentName,
      }}
    >
      {children}
    </PortalShell>
  );
}

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <LoadingSkeleton rows={4} label="Loading portal..." />
        </div>
      }
    >
      <AuthenticatedPortalContent>{children}</AuthenticatedPortalContent>
    </Suspense>
  );
}

