import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function RootNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <FileQuestion className="h-7 w-7" />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">404 - Page Not Found</h1>
        <p className="text-sm text-muted-foreground">
          The page or resource you requested could not be found. It may have been
          moved or deleted.
        </p>
        <div className="pt-2">
          <Link href="/login" className={buttonVariants()}>
            Return to Portal
          </Link>
        </div>
      </div>
    </div>
  );
}

