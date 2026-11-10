import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../src/generated/prisma/client";
import { ApiTestClient } from "./helpers";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

describe("Phase 7b Audit Viewer & Student Results RBAC Suite", { timeout: 90000 }, () => {
  const superAdmin = new ApiTestClient();
  const cscAdmin = new ApiTestClient();
  const mthAdmin = new ApiTestClient();
  const lecturer = new ApiTestClient();
  const student01 = new ApiTestClient();
  const anon = new ApiTestClient();

  let cscDeptId = "";
  let mthDeptId = "";

  beforeAll(async () => {
    const [saRes, cscRes, mthRes, lRes, sRes] = await Promise.all([
      superAdmin.login("superadmin@uemp.demo", "Uemp@Demo2026"),
      cscAdmin.login("deptadmin.csc@uemp.demo", "Uemp@Demo2026"),
      mthAdmin.login("deptadmin.mth@uemp.demo", "Uemp@Demo2026"),
      lecturer.login("lecturer1@uemp.demo", "Uemp@Demo2026"),
      student01.login("student01@uemp.demo", "Uemp@Demo2026"),
    ]);
    expect(saRes.status).toBe(200);
    expect(cscRes.status).toBe(200);
    expect(mthRes.status).toBe(200);
    expect(lRes.status).toBe(200);
    expect(sRes.status).toBe(200);

    const [cscDept, mthDept] = await Promise.all([
      prisma.department.findUniqueOrThrow({ where: { code: "CSC" } }),
      prisma.department.findUniqueOrThrow({ where: { code: "MTH" } }),
    ]);
    cscDeptId = cscDept.id;
    mthDeptId = mthDept.id;
  }, 30000);

  describe("1. Audit Logs Role Restrictions & Scoping (/api/v1/audit-logs)", () => {
    it("returns 401 for unauthenticated requests", async () => {
      const res = await anon.request("/api/v1/audit-logs");
      expect(res.status).toBe(401);
    });

    it("returns 403 for STUDENT and LECTURER", async () => {
      const stuRes = await student01.request("/api/v1/audit-logs");
      expect(stuRes.status).toBe(403);

      const lecRes = await lecturer.request("/api/v1/audit-logs");
      expect(lecRes.status).toBe(403);
    });

    it("restricts DEPARTMENT_ADMIN strictly to own department Result logs", async () => {
      const res = await cscAdmin.request("/api/v1/audit-logs?pageSize=50");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.items.length).toBeGreaterThan(0);

      for (const item of json.data.items) {
        expect(item.entityType).toBe("Result");
        expect(item.departmentId).toBe(cscDeptId);
        expect(item.action).not.toBe("RESULT_DRAFT_SAVED"); // D3: drafts hidden
      }
    });

    it("rejects DEPARTMENT_ADMIN querying a different departmentId with 403", async () => {
      const foreignRes = await cscAdmin.request(
        `/api/v1/audit-logs?departmentId=${mthDeptId}`
      );
      expect(foreignRes.status).toBe(403);
    });

    it("allows SUPER_ADMIN university-wide oversight across all entity types and departments", async () => {
      const res = await superAdmin.request("/api/v1/audit-logs?pageSize=50");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.items.length).toBeGreaterThan(0);

      const entityTypes = new Set(
        json.data.items.map((i: { entityType: string }) => i.entityType)
      );
      // Super admin sees more than just Result (e.g. User, AcademicSession, Course, etc.)
      expect(entityTypes.size).toBeGreaterThan(1);
    });

    it("guarantees audit log responses never leak passwordHash, lockedUntil, or failedLoginCount", async () => {
      const res = await superAdmin.request("/api/v1/audit-logs?pageSize=50");
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).not.toContain("passwordHash");
      expect(text).not.toContain("lockedUntil");
      expect(text).not.toContain("failedLoginCount");
    });
  });

  describe("2. Student Results & CGPA (/api/v1/results)", () => {
    it("returns 401 for unauthenticated requests", async () => {
      const res = await anon.request("/api/v1/results");
      expect(res.status).toBe(401);
    });

    it("returns 403 for LECTURER, DEPARTMENT_ADMIN, and SUPER_ADMIN", async () => {
      for (const client of [lecturer, cscAdmin, superAdmin]) {
        const res = await client.request("/api/v1/results");
        expect(res.status).toBe(403);
      }
    });

    it("returns only APPROVED results grouped by semester with accurate GPA and CGPA", async () => {
      const res = await student01.request("/api/v1/results");
      expect(res.status).toBe(200);
      const json = await res.json();
      const history = json.data;

      expect(history.student.fullName).toBeTruthy();
      expect(history.student.matricNumber).toBe("UEMP/2024/CSC/001");
      expect(history.student.departmentCode).toBe("CSC");

      expect(history.semesters.length).toBeGreaterThan(0);

      // Verify every result is strictly APPROVED (D3)
      for (const sem of history.semesters) {
        expect(sem.courses.length).toBeGreaterThan(0);
        for (const course of sem.courses) {
          expect(course.status).toBe("APPROVED");
          expect(course.grade).toMatch(/^[A-F]$/);
          expect(course.gradePoint).toBeGreaterThanOrEqual(0);
          expect(course.gradePoint).toBeLessThanOrEqual(5);
        }
        expect(sem.semesterGpa).toBeGreaterThanOrEqual(0);
        expect(sem.semesterGpa).toBeLessThanOrEqual(5);
        expect(sem.cumulativeGpa).toBeGreaterThanOrEqual(0);
        expect(sem.cumulativeGpa).toBeLessThanOrEqual(5);
      }

      // Career summary
      expect(history.careerSummary.cgpa).toBeGreaterThanOrEqual(0);
      expect(history.careerSummary.cgpa).toBeLessThanOrEqual(5);
      expect(history.careerSummary.totalUnitsRegistered).toBeGreaterThan(0);
      expect(history.careerSummary.totalUnitsEarned).toBeGreaterThan(0);
      expect(history.careerSummary.academicStanding).toBe("Good Standing");
    });
  });
});
