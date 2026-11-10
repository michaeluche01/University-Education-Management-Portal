import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import {
  getSession,
  requireRole,
  ROLE_DASHBOARD_PATHS,
} from "@/server/auth/rbac";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireRole(["STUDENT"]);
  } catch (error) {
    if (error instanceof AppError && error.status === 401) {
      redirect("/api/v1/auth/clear-session");
    }
    if (error instanceof AppError && error.status === 403) {
      const session = await getSession();
      if (session) {
        redirect(ROLE_DASHBOARD_PATHS[session.role]);
      }
      redirect("/login");
    }
    throw error;
  }

  return <>{children}</>;
}

