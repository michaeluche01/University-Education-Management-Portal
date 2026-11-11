import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";

export default function PortalLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <LoadingSkeleton rows={6} label="Loading module content..." />
    </div>
  );
}

