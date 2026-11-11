"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export default function RootError({
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
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <AlertTriangle className="h-7 w-7" />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {isForbidden ? "Access Denied" : "Something Went Wrong"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isForbidden
            ? "You do not have permission to access this area with your current account role. Please return to your designated dashboard."
            : "An unexpected error occurred while processing your request. Please try again or return to the portal."}
        </p>
        <div className="pt-2 flex flex-wrap justify-center gap-2">
          {!isForbidden && (
            <Button variant="outline" onClick={() => reset()}>
              Try Again
            </Button>
          )}
          <Link href="/login" className={buttonVariants()}>
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

