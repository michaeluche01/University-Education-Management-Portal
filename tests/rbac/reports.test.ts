import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../src/generated/prisma/client";
import { ApiTestClient } from "./helpers";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

describe("Phase 8a Reports & Analytics RBAC Suite", { timeout: 90000 }, () => {
  const superAdmin = new ApiTestClient();
  const cscAdmin = new ApiTestClient();
  const mthAdmin = new ApiTestClient();
  const lecturer1 = new ApiTestClient();
  const student01 = new ApiTestClient();
  const anon = new ApiTestClient();

  let cscDeptId = "";
  let mthDeptId = "";
  let currentSemesterId = "";
  let mth101CourseId = "";

  beforeAll(async () => {
    const [saRes, cscRes, mthRes, lRes, sRes] = await Promise.all([
      superAdmin.login("superadmin@uemp.demo", "Uemp@Demo2026"),
      cscAdmin.login("deptadmin.csc@uemp.demo", "Uemp@Demo2026"),
      mthAdmin.login("deptadmin.mth@uemp.demo", "Uemp@Demo2026"),
      lecturer1.login("lecturer1@uemp.demo", "Uemp@Demo2026"),
      student01.login("student01@uemp.demo", "Uemp@Demo2026"),
    ]);

    expect(saRes.status).toBe(200);
    expect(cscRes.status).toBe(200);
    expect(mthRes.status).toBe(200);
    expect(lRes.status).toBe(200);
    expect(sRes.status).toBe(200);

    const [cscDept, mthDept, curSem, mth101] = await Promise.all([
      prisma.department.findUniqueOrThrow({ where: { code: "CSC" } }),
      prisma.department.findUniqueOrThrow({ where: { code: "MTH" } }),
      prisma.semester.findFirstOrThrow({ where: { isCurrent: true } }),
      prisma.course.findUniqueOrThrow({ where: { code: "MTH 101" } }),
    ]);

    cscDeptId = cscDept.id;
    mthDeptId = mthDept.id;
    currentSemesterId = curSem.id;
    mth101CourseId = mth101.id;
  }, 90000);

  describe("1. Role Restrictions & Public Route Protection", () => {
    it("returns 401 for unauthenticated requests on all report endpoints", async () => {
      const [resStu, resReg, resPerf] = await Promise.all([
        anon.request("/api/v1/reports/students"),
        anon.request("/api/v1/reports/registrations"),
        anon.request("/api/v1/reports/performance"),
      ]);

      expect(resStu.status).toBe(401);
      expect(resReg.status).toBe(401);
      expect(resPerf.status).toBe(401);
    });

    it("returns 403 for STUDENT on all report endpoints", async () => {
      const [resStu, resReg, resPerf] = await Promise.all([
        student01.request("/api/v1/reports/students"),
        student01.request("/api/v1/reports/registrations"),
        student01.request("/api/v1/reports/performance"),
      ]);

      expect(resStu.status).toBe(403);
      expect(resReg.status).toBe(403);
      expect(resPerf.status).toBe(403);
    });

    it("returns 403 for LECTURER on /api/v1/reports/students", async () => {
      const res = await lecturer1.request("/api/v1/reports/students");
      expect(res.status).toBe(403);
    });
  });

  describe("2. Student List Report (/api/v1/reports/students)", () => {
    it("scopes DEPARTMENT_ADMIN strictly to their own department", async () => {
      const res = await cscAdmin.request("/api/v1/reports/students?pageSize=50");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.items.length).toBeGreaterThan(0);

      for (const item of json.data.items) {
        expect(item.departmentId).toBe(cscDeptId);
        expect(item.departmentCode).toBe("CSC");
        expect(item).not.toHaveProperty("passwordHash");
        expect(item).not.toHaveProperty("failedLoginCount");
        expect(item).not.toHaveProperty("lockedUntil");
      }
    });

    it("rejects DEPARTMENT_ADMIN filtering by another departmentId with 403", async () => {
      const res = await cscAdmin.request(
        `/api/v1/reports/students?departmentId=${mthDeptId}`
      );
      expect(res.status).toBe(403);
    });

    it("allows SUPER_ADMIN to query all departments and filter by departmentId", async () => {
      const allRes = await superAdmin.request("/api/v1/reports/students?pageSize=100");
      expect(allRes.status).toBe(200);
      const allJson = await allRes.json();
      expect(allJson.data.items.length).toBeGreaterThan(10);

      const mthRes = await superAdmin.request(
        `/api/v1/reports/students?departmentId=${mthDeptId}`
      );
      expect(mthRes.status).toBe(200);
      const mthJson = await mthRes.json();
      for (const item of mthJson.data.items) {
        expect(item.departmentId).toBe(mthDeptId);
      }
    });

    it("filters students by search query (name, matric, email)", async () => {
      const res = await cscAdmin.request("/api/v1/reports/students?search=CSC/001");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.items.length).toBeGreaterThanOrEqual(1);
      expect(json.data.items[0].matricNumber).toContain("CSC/001");
    });
  });

  describe("3. Course Registration Report (/api/v1/reports/registrations)", () => {
    it("scopes LECTURER only to their assigned courses", async () => {
      const res = await lecturer1.request(
        `/api/v1/reports/registrations?semesterId=${currentSemesterId}`
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.courses.length).toBeGreaterThan(0);

      for (const c of json.data.courses) {
        expect(c.lecturers).toContain("Dr. Chinedu Okonkwo");
      }
    });

    it("rejects LECTURER querying an unassigned course with 403", async () => {
      const res = await lecturer1.request(
        `/api/v1/reports/registrations?courseId=${mth101CourseId}&semesterId=${currentSemesterId}`
      );
      expect(res.status).toBe(403);
    });

    it("scopes DEPARTMENT_ADMIN to courses in their own department", async () => {
      const res = await cscAdmin.request(
        `/api/v1/reports/registrations?semesterId=${currentSemesterId}`
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      for (const c of json.data.courses) {
        expect(c.departmentId).toBe(cscDeptId);
      }
    });

    it("returns totals by level and overall registration total", async () => {
      const res = await superAdmin.request(
        `/api/v1/reports/registrations?semesterId=${currentSemesterId}`
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.totalRegistrations).toBeGreaterThan(0);
      expect(json.data.totalsByLevel.length).toBeGreaterThan(0);

      const sumOfLevels = json.data.totalsByLevel.reduce(
        (sum: number, lvl: { count: number }) => sum + lvl.count,
        0
      );
      expect(sumOfLevels).toBe(json.data.totalRegistrations);
    });
  });

  describe("4. Academic Performance Report (/api/v1/reports/performance)", () => {
    it("includes ONLY APPROVED results in performance metrics", async () => {
      const res = await superAdmin.request("/api/v1/reports/performance");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.note).toContain("Only APPROVED results are included");

      // Verify that every course result stats adhere to score boundaries
      for (const c of json.data.courses) {
        expect(c.averageScore).toBeGreaterThanOrEqual(0);
        expect(c.averageScore).toBeLessThanOrEqual(100);
        expect(c.passRate).toBeGreaterThanOrEqual(0);
        expect(c.passRate).toBeLessThanOrEqual(100);

        const distSum =
          c.gradeDistribution.A +
          c.gradeDistribution.B +
          c.gradeDistribution.C +
          c.gradeDistribution.D +
          c.gradeDistribution.E +
          c.gradeDistribution.F;
        expect(distSum).toBe(c.resultsCount);
      }
    });

    it("calculates program credit-weighted average GPAs", async () => {
      const res = await superAdmin.request("/api/v1/reports/performance");
      expect(res.status).toBe(200);
      const json = await res.json();

      for (const p of json.data.programs) {
        expect(p.weightedGpa).toBeGreaterThanOrEqual(0);
        expect(p.weightedGpa).toBeLessThanOrEqual(5.0);
        expect(p.resultsCount).toBeGreaterThan(0);
      }
    });

    it("scopes DEPARTMENT_ADMIN performance to their department", async () => {
      const res = await cscAdmin.request("/api/v1/reports/performance");
      expect(res.status).toBe(200);
      const json = await res.json();

      for (const c of json.data.courses) {
        expect(c.departmentId).toBe(cscDeptId);
      }
    });

    it("scopes LECTURER performance only to assigned courses", async () => {
      const res = await lecturer1.request("/api/v1/reports/performance");
      expect(res.status).toBe(200);
      const json = await res.json();

      for (const c of json.data.courses) {
        expect(c.lecturers).toContain("Dr. Chinedu Okonkwo");
      }
    });
  });
});

