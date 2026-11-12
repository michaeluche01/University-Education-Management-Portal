import dotenv from "dotenv";
// Ensure script's own dotenv loading does NOT override existing environment variables
dotenv.config({ override: false });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { seed } from "../prisma/seed";

function extractHost(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname;
  } catch {
    return "unknown-host";
  }
}

function isProductionHost(host: string): boolean {
  const prodHostsRaw = process.env.PROD_DB_HOST;
  if (!prodHostsRaw) return false;
  const prodHosts = prodHostsRaw
    .split(/[,\s]+/)
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return prodHosts.some((ph) => host === ph || host.includes(ph));
}

async function getTableCounts(prisma: PrismaClient): Promise<Record<string, number>> {
  const [
    user,
    faculty,
    department,
    departmentAdmin,
    program,
    academicLevel,
    academicSession,
    semester,
    student,
    lecturer,
    course,
    courseAssignment,
    courseRegistration,
    result,
    gradeScale,
    auditLog,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.faculty.count(),
    prisma.department.count(),
    prisma.departmentAdmin.count(),
    prisma.program.count(),
    prisma.academicLevel.count(),
    prisma.academicSession.count(),
    prisma.semester.count(),
    prisma.student.count(),
    prisma.lecturer.count(),
    prisma.course.count(),
    prisma.courseAssignment.count(),
    prisma.courseRegistration.count(),
    prisma.result.count(),
    prisma.gradeScale.count(),
    prisma.auditLog.count(),
  ]);

  return {
    User: user,
    Faculty: faculty,
    Department: department,
    DepartmentAdmin: departmentAdmin,
    Program: program,
    AcademicLevel: academicLevel,
    AcademicSession: academicSession,
    Semester: semester,
    Student: student,
    Lecturer: lecturer,
    Course: course,
    CourseAssignment: courseAssignment,
    CourseRegistration: courseRegistration,
    Result: result,
    GradeScale: gradeScale,
    AuditLog: auditLog,
  };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[reset-demo] DATABASE_URL is not set.");
    process.exit(1);
  }

  const host = extractHost(connectionString);
  const isProd =
    isProductionHost(host) ||
    process.env.npm_lifecycle_event === "db:reset-demo:prod" ||
    process.env.NODE_ENV === "production";

  // Safety Guard 1: EXPECTED_DB_HOST Substring Check
  if (isProd && !process.env.EXPECTED_DB_HOST) {
    console.error(
      `[reset-demo] Refusing to run in production mode: EXPECTED_DB_HOST must be set and match target database host.`
    );
    process.exit(1);
  }

  if (process.env.EXPECTED_DB_HOST) {
    const expected = process.env.EXPECTED_DB_HOST.trim().toLowerCase();
    if (!host.toLowerCase().includes(expected)) {
      console.error(
        `[reset-demo] Refusing to run: EXPECTED_DB_HOST "${process.env.EXPECTED_DB_HOST}" is not a substring of target database host "${host}".`
      );
      process.exit(1);
    }
  }

  // Safety Guard 2: Confirmation requirements
  if (isProd) {
    if (
      process.env.CONFIRM_PROD !== "yes" ||
      process.env.RESET_CONFIRM !== "wipe-all-data"
    ) {
      console.error(
        `[reset-demo] Refusing to run: Production reset requires both CONFIRM_PROD=yes and RESET_CONFIRM=wipe-all-data.`
      );
      process.exit(1);
    }
  } else {
    if (process.env.RESET_CONFIRM !== "wipe-all-data") {
      console.error(
        `[reset-demo] Refusing to run: resetting demo data requires RESET_CONFIRM=wipe-all-data.`
      );
      process.exit(1);
    }
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log(`[reset-demo] Connected to database host: ${host}`);

    // Safety Guard 3: Pre-reset row counts
    const beforeCounts = await getTableCounts(prisma);
    console.log(`[reset-demo] Target Host: ${host}`);
    console.log(`[reset-demo] Pre-wipe User count: ${beforeCounts.User}`);
    console.log(`[reset-demo] Pre-wipe Result count: ${beforeCounts.Result}`);
    console.log("\n[reset-demo] Current row counts across all 16 tables:");
    console.table(beforeCounts);

    // Safety Guard 4: Check for non-demo users
    const nonDemoUsers = await prisma.user.findMany({
      where: {
        NOT: {
          email: {
            endsWith: "@uemp.demo",
            mode: "insensitive",
          },
        },
      },
      select: { email: true },
      take: 5,
    });

    if (nonDemoUsers.length > 0 && process.env.ALLOW_NON_DEMO_USERS !== "yes") {
      console.error(
        `[reset-demo] Refusing to wipe: found non-demo user accounts in database (e.g. ${nonDemoUsers
          .map((u) => u.email)
          .join(", ")}).\n` +
          `Set ALLOW_NON_DEMO_USERS=yes if you really intended to wipe non-demo users.`
      );
      process.exit(1);
    }

    // Safety Guard 5: Truncate all 16 application tables in CASCADE order
    console.log("\n[reset-demo] Truncating all 16 application tables...");
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE 
        "AuditLog",
        "Result",
        "CourseRegistration",
        "CourseAssignment",
        "Course",
        "Student",
        "Lecturer",
        "DepartmentAdmin",
        "Program",
        "AcademicLevel",
        "Semester",
        "AcademicSession",
        "Department",
        "Faculty",
        "GradeScale",
        "User"
      CASCADE;
    `);
    console.log("[reset-demo] All 16 application tables truncated successfully.");

    // Safety Guard 6: Run seed script logic
    console.log("\n[reset-demo] Reseeding database with pristine demo data...");
    await seed(prisma);
    console.log("[reset-demo] Seeding completed.");

    // Safety Guard 7: Post-reset row counts
    const afterCounts = await getTableCounts(prisma);
    console.log("\n[reset-demo] Post-reset row counts across all 16 tables:");
    console.table(afterCounts);
    console.log("\n[reset-demo] Database successfully reset to pristine demo state!");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[reset-demo] Fatal error during demo reset:", err);
  process.exit(1);
});
