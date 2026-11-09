import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-8">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-tight">
            University Education Management Portal (UEMP)
          </CardTitle>
          <CardDescription>
            Academic administration, student course registration, and result
            management portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Phase 1 scaffold and database schema are initialized. Role-based
            portals for Students, Lecturers, Department Administrators, and
            Super Administrators are enabled in Phase 2.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
