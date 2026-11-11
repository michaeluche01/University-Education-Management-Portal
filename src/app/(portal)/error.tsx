"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isForbidden =
    error.message?.includes("403") ||
    error.message?.toLowerCase().includes("forbidden") ||
    error.message?.toLowerCase().includes("permission");

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </div>
        </div>
        <h2 className="text-xl font-bold tracking-tight">
          {isForbidden ? "Access Denied" : "Portal Error"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isForbidden
            ? "You do not have permission to view this section with your current account role. Please use the sidebar to return to your authorized pages."
            : "An unexpected error occurred while loading this section. Please try again or return to your dashboard."}
        </p>
        <div className="pt-2 flex flex-wrap justify-center gap-2">
          {!isForbidden && (
            <Button variant="outline" size="sm" onClick={() => reset()}>
              Try Again
            </Button>
          )}
          <Link href="/login" className={buttonVariants({ size: "sm" })}>
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

