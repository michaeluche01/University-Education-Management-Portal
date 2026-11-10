export interface LoadingSkeletonProps {
  rows?: number;
  label?: string;
}

export function LoadingSkeleton({
  rows = 3,
  label = "Loading content...",
}: LoadingSkeletonProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className="w-full space-y-3 rounded-lg border p-4 sm:p-6"
    >
      <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="h-10 w-full animate-pulse rounded bg-muted/70"
        />
      ))}
    </div>
  );
}

