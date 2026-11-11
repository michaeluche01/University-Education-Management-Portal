import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function PortalNotFound() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <FileQuestion className="h-6 w-6" />
          </div>
        </div>
        <h2 className="text-xl font-bold tracking-tight">Portal Section Not Found</h2>
        <p className="text-sm text-muted-foreground">
          The module or resource you requested does not exist or you do not have permission
          to view it.
        </p>
        <div className="pt-2">
          <Link href="/login" className={buttonVariants()}>
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

