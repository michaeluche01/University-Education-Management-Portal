import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";

export default function RootLoading() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <LoadingSkeleton rows={4} label="Loading portal..." />
      </div>
    </div>
  );
}

