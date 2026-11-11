import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../src/generated/prisma/client";
import { ApiTestClient } from "./helpers";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const SUFFIX = Math.random().toString(36).substring(2, 6).toUpperCase();

describe("Phase 3a Structure Management RBAC & API Suite", { timeout: 60000 }, () => {
  const superAdmin = new ApiTestClient();
  const deptAdmin = new ApiTestClient();
  const lecturer = new ApiTestClient();
  const student = new ApiTestClient();
  const anon = new ApiTestClient();

  const createdFacultyIds: string[] = [];
  const createdDepartmentIds: string[] = [];
  const createdProgramIds: string[] = [];
  const createdLevelIds: string[] = [];
  const createdSessionIds: string[] = [];
  let originalSessionId: string | null = null;
  let originalSemesterId: string | null = null;

  beforeAll(async () => {
    const saRes = await superAdmin.login("superadmin@uemp.demo", "Uemp@Demo2026");
    const daRes = await deptAdmin.login("deptadmin.csc@uemp.demo", "Uemp@Demo2026");
    const lecRes = await lecturer.login("lecturer1@uemp.demo", "Uemp@Demo2026");
    const stuRes = await student.login("student01@uemp.demo", "Uemp@Demo2026");
    expect(saRes.status).toBe(200);
    expect(daRes.status).toBe(200);
    expect(lecRes.status).toBe(200);
    expect(stuRes.status).toBe(200);

    const currentSession = await prisma.academicSession.findFirst({
      where: { isCurrent: true },
    });
    const currentSemester = await prisma.semester.findFirst({
      where: { isCurrent: true },
    });
    originalSessionId = currentSession?.id ?? null;
    originalSemesterId = currentSemester?.id ?? null;
  }, 30000);

  afterAll(async () => {
    // Restore original current session & semester
    if (originalSessionId) {
      await prisma.academicSession.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });
      await prisma.academicSession.update({
        where: { id: originalSessionId },
        data: { isCurrent: true },
      });
    }
    if (originalSemesterId) {
      await prisma.semester.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });
      await prisma.semester.update({
        where: { id: originalSemesterId },
        data: { isCurrent: true },
      });
    }

    // Restore standard 6-band grade scale
    await prisma.$transaction(async (tx) => {
      await tx.gradeScale.deleteMany({});
      await tx.gradeScale.createMany({
        data: [
          { grade: "A", minScore: 70, maxScore: 100, gradePoint: 5, remark: "Excellent" },
          { grade: "B", minScore: 60, maxScore: 69, gradePoint: 4, remark: "Very Good" },
          { grade: "C", minScore: 50, maxScore: 59, gradePoint: 3, remark: "Good" },
          { grade: "D", minScore: 45, maxScore: 49, gradePoint: 2, remark: "Fair" },
          { grade: "E", minScore: 40, maxScore: 44, gradePoint: 1, remark: "Pass" },
          { grade: "F", minScore: 0, maxScore: 39, gradePoint: 0, remark: "Fail" },
        ],
      });
    });

    // Clean up test rows in reverse dependency order
    const allEntityIds = [
      ...createdProgramIds,
      ...createdDepartmentIds,
      ...createdFacultyIds,
      ...createdLevelIds,
      ...createdSessionIds,
    ];

    if (createdSessionIds.length > 0) {
      const sems = await prisma.semester.findMany({
        where: { sessionId: { in: createdSessionIds } },
        select: { id: true },
      });
      allEntityIds.push(...sems.map((s) => s.id));
      await prisma.semester.deleteMany({
        where: { sessionId: { in: createdSessionIds } },
      });
      await prisma.academicSession.deleteMany({
        where: { id: { in: createdSessionIds } },
      });
    }
    if (createdProgramIds.length > 0) {
      await prisma.program.deleteMany({
        where: { id: { in: createdProgramIds } },
      });
    }
    if (createdDepartmentIds.length > 0) {
      await prisma.department.deleteMany({
        where: { id: { in: createdDepartmentIds } },
      });
    }
    if (createdFacultyIds.length > 0) {
      await prisma.faculty.deleteMany({
        where: { id: { in: createdFacultyIds } },
      });
    }
    if (createdLevelIds.length > 0) {
      await prisma.academicLevel.deleteMany({
        where: { id: { in: createdLevelIds } },
      });
    }
    if (allEntityIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { entityId: { in: allEntityIds } },
      });
    }

    await prisma.$disconnect();
  }, 30000);

  describe("Authorization & Origin checks on SUPER_ADMIN mutations", () => {
    const mutationEndpoints = [
      { method: "POST", path: "/api/v1/faculties", body: { code: "T1", name: "Test Fac" } },
      { method: "PATCH", path: "/api/v1/faculties/dummy-id", body: { name: "Updated" } },
      { method: "POST", path: "/api/v1/departments", body: { code: "D1", name: "Test Dept", facultyId: "f1" } },
      { method: "PATCH", path: "/api/v1/departments/dummy-id", body: { name: "Updated" } },
      { method: "POST", path: "/api/v1/programs", body: { code: "P1", name: "Test Prog", durationYears: 4, departmentId: "d1" } },
      { method: "PATCH", path: "/api/v1/programs/dummy-id", body: { name: "Updated" } },
      { method: "POST", path: "/api/v1/levels", body: { levelNumber: 700, name: "700 Level" } },
      { method: "POST", path: "/api/v1/sessions", body: { name: "2090/2091", startDate: "2090-09-01", endDate: "2091-07-01" } },
      { method: "PATCH", path: "/api/v1/sessions/dummy-id", body: { isCurrent: true } },
      { method: "PATCH", path: "/api/v1/semesters/dummy-id", body: { isCurrent: true } },
      {
        method: "PUT",
        path: "/api/v1/grade-scale",
        body: {
          bands: [
            { grade: "A", minScore: 50, gradePoint: 5 },
            { grade: "F", minScore: 0, gradePoint: 0 },
          ],
        },
      },
    ];

    it.each(mutationEndpoints)(
      "returns 401 for unauthenticated on $method $path",
      async ({ method, path, body }) => {
        const res = await anon.request(path, {
          method,
          body: JSON.stringify(body),
        });
        expect(res.status).toBe(401);
      }
    );

    it.each(mutationEndpoints)(
      "returns 403 for STUDENT, LECTURER, and DEPARTMENT_ADMIN on $method $path",
      async ({ method, path, body }) => {
        for (const client of [student, lecturer, deptAdmin]) {
          const res = await client.request(path, {
            method,
            body: JSON.stringify(body),
          });
          expect(res.status).toBe(403);
        }
      }
    );

    it("rejects foreign Origin header on POST /api/v1/faculties with 403", async () => {
      const res = await superAdmin.request("/api/v1/faculties", {
        method: "POST",
        customOrigin: "https://evil.example.org",
        body: JSON.stringify({ code: "EVIL", name: "Evil Faculty" }),
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error?.code).toBe("FORBIDDEN_ORIGIN");
    });
  });

  describe("Department scoping on GET endpoints", () => {
    it("scopes GET /api/v1/departments, /faculties, and /programs for DEPARTMENT_ADMIN to own department only", async () => {
      const deptRes = await deptAdmin.request("/api/v1/departments");
      expect(deptRes.status).toBe(200);
      const deptBody = await deptRes.json();
      expect(deptBody.data).toHaveLength(1);
      expect(deptBody.data[0].code).toBe("CSC");

      const facRes = await deptAdmin.request("/api/v1/faculties");
      expect(facRes.status).toBe(200);
      const facBody = await facRes.json();
      expect(facBody.data).toHaveLength(1);
      expect(facBody.data[0].code).toBe("FSC");

      const progRes = await deptAdmin.request("/api/v1/programs");
      expect(progRes.status).toBe(200);
      const progBody = await progRes.json();
      expect(progBody.data.length).toBeGreaterThanOrEqual(1);
      for (const prog of progBody.data) {
        expect(prog.department.code).toBe("CSC");
      }
    });

    it("allows all authenticated roles to read /levels, /sessions, and /grade-scale", async () => {
      for (const client of [superAdmin, deptAdmin, lecturer, student]) {
        const [lvlRes, sesRes, gsRes] = await Promise.all([
          client.request("/api/v1/levels"),
          client.request("/api/v1/sessions"),
          client.request("/api/v1/grade-scale"),
        ]);
        expect(lvlRes.status).toBe(200);
        expect(sesRes.status).toBe(200);
        expect(gsRes.status).toBe(200);
      }
    });
  });

  describe("SUPER_ADMIN CRUD & Duplicate Code (409) checks", () => {
    it("creates and updates faculty, department (moving faculty), program, and level, and returns 409 on duplicate code", async () => {
      // 1. Create two faculties
      const facCode1 = `FA${SUFFIX}`;
      const facCode2 = `FB${SUFFIX}`;

      const f1Res = await superAdmin.request("/api/v1/faculties", {
        method: "POST",
        body: JSON.stringify({
          code: ` ${facCode1.toLowerCase()} `,
          name: `Test Faculty A ${SUFFIX}`,
          description: "Initial desc",
        }),
      });
      expect(f1Res.status).toBe(201);
      const f1 = (await f1Res.json()).data;
      createdFacultyIds.push(f1.id);
      expect(f1.code).toBe(facCode1);

      const f2Res = await superAdmin.request("/api/v1/faculties", {
        method: "POST",
        body: JSON.stringify({
          code: facCode2,
          name: `Test Faculty B ${SUFFIX}`,
        }),
      });
      expect(f2Res.status).toBe(201);
      const f2 = (await f2Res.json()).data;
      createdFacultyIds.push(f2.id);

      // Duplicate faculty code -> 409
      const dupFacRes = await superAdmin.request("/api/v1/faculties", {
        method: "POST",
        body: JSON.stringify({
          code: facCode1,
          name: `Duplicate Faculty ${SUFFIX}`,
        }),
      });
      expect(dupFacRes.status).toBe(409);

      // Update faculty 1
      const patchF1Res = await superAdmin.request(`/api/v1/faculties/${f1.id}`, {
        method: "PATCH",
        body: JSON.stringify({ description: "Updated desc" }),
      });
      expect(patchF1Res.status).toBe(200);
      expect((await patchF1Res.json()).data.description).toBe("Updated desc");

      // 2. Create department under Faculty A, then move to Faculty B on PATCH
      const deptCode = `DP${SUFFIX}`;
      const dRes = await superAdmin.request("/api/v1/departments", {
        method: "POST",
        body: JSON.stringify({
          code: deptCode.toLowerCase(),
          name: `Test Dept ${SUFFIX}`,
          facultyId: f1.id,
        }),
      });
      expect(dRes.status).toBe(201);
      const dept = (await dRes.json()).data;
      createdDepartmentIds.push(dept.id);
      expect(dept.code).toBe(deptCode);
      expect(dept.facultyId).toBe(f1.id);

      // Move department to Faculty B
      const moveDeptRes = await superAdmin.request(`/api/v1/departments/${dept.id}`, {
        method: "PATCH",
        body: JSON.stringify({ facultyId: f2.id, name: `Moved Dept ${SUFFIX}` }),
      });
      expect(moveDeptRes.status).toBe(200);
      const movedDept = (await moveDeptRes.json()).data;
      expect(movedDept.facultyId).toBe(f2.id);
      expect(movedDept.name).toBe(`Moved Dept ${SUFFIX}`);

      // 3. Create and update program
      const progCode = `PR${SUFFIX}`;
      const pRes = await superAdmin.request("/api/v1/programs", {
        method: "POST",
        body: JSON.stringify({
          code: progCode,
          name: `B.Sc. Test Program ${SUFFIX}`,
          durationYears: 4,
          departmentId: dept.id,
        }),
      });
      expect(pRes.status).toBe(201);
      const prog = (await pRes.json()).data;
      createdProgramIds.push(prog.id);

      const patchProgRes = await superAdmin.request(`/api/v1/programs/${prog.id}`, {
        method: "PATCH",
        body: JSON.stringify({ durationYears: 5 }),
      });
      expect(patchProgRes.status).toBe(200);
      expect((await patchProgRes.json()).data.durationYears).toBe(5);

      // 4. Create level
      const randLevel = 800;
      await prisma.academicLevel.deleteMany({ where: { levelNumber: randLevel } });
      const lvlRes = await superAdmin.request("/api/v1/levels", {
        method: "POST",
        body: JSON.stringify({
          levelNumber: randLevel,
          name: `${randLevel} Level (${SUFFIX})`,
        }),
      });
      expect(lvlRes.status).toBe(201);
      const lvl = (await lvlRes.json()).data;
      createdLevelIds.push(lvl.id);

      // Duplicate levelNumber -> 409
      const dupLvlRes = await superAdmin.request("/api/v1/levels", {
        method: "POST",
        body: JSON.stringify({
          levelNumber: randLevel,
          name: `Duplicate ${randLevel} Level`,
        }),
      });
      expect(dupLvlRes.status).toBe(409);
    });
  });

  describe("Academic Sessions & Semesters ('Make current' invariant)", () => {
    it("creates a session with FIRST & SECOND semesters and enforces single isCurrent session & semester", async () => {
      const startYear = 2040 + Math.floor(Math.random() * 40);
      const sessionName = `${startYear}/${startYear + 1}`;

      const createSesRes = await superAdmin.request("/api/v1/sessions", {
        method: "POST",
        body: JSON.stringify({
          name: sessionName,
          startDate: `${startYear}-09-01`,
          endDate: `${startYear + 1}-07-15`,
          isCurrent: false,
        }),
      });
      expect(createSesRes.status).toBe(201);
      const createdSes = (await createSesRes.json()).data;
      createdSessionIds.push(createdSes.id);
      expect(createdSes.semesters).toHaveLength(2);

      // Rejects invalid YYYY/YYYY+1 name with 400
      const badSesRes = await superAdmin.request("/api/v1/sessions", {
        method: "POST",
        body: JSON.stringify({
          name: "2030/2032",
          startDate: "2030-09-01",
          endDate: "2031-07-01",
        }),
      });
      expect(badSesRes.status).toBe(400);

      // Make new session current
      const makeCurrSesRes = await superAdmin.request(
        `/api/v1/sessions/${createdSes.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ isCurrent: true }),
        }
      );
      expect(makeCurrSesRes.status).toBe(200);

      const currentSessionsCount = await prisma.academicSession.count({
        where: { isCurrent: true },
      });
      expect(currentSessionsCount).toBe(1);

      // Rejects { isCurrent: false } with 400
      const falseSesRes = await superAdmin.request(
        `/api/v1/sessions/${createdSes.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ isCurrent: false }),
        }
      );
      expect(falseSesRes.status).toBe(400);

      // Make new semester current
      const targetSemesterId = createdSes.semesters[1].id;
      const makeCurrSemRes = await superAdmin.request(
        `/api/v1/semesters/${targetSemesterId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ isCurrent: true }),
        }
      );
      expect(makeCurrSemRes.status).toBe(200);

      const currentSemestersCount = await prisma.semester.count({
        where: { isCurrent: true },
      });
      expect(currentSemestersCount).toBe(1);

      // Restore original session and semester immediately
      if (originalSessionId) {
        await superAdmin.request(`/api/v1/sessions/${originalSessionId}`, {
          method: "PATCH",
          body: JSON.stringify({ isCurrent: true }),
        });
      }
      if (originalSemesterId) {
        await superAdmin.request(`/api/v1/semesters/${originalSemesterId}`, {
          method: "PATCH",
          body: JSON.stringify({ isCurrent: true }),
        });
      }
    });
  });

  describe("Grade Scale replacement & validation", () => {
    it("rejects fewer than 2 bands or missing minScore=0 band with 400, and derives maxScore on valid PUT", async () => {
      const oneBandRes = await superAdmin.request("/api/v1/grade-scale", {
        method: "PUT",
        body: JSON.stringify({
          rows: [{ grade: "A", minScore: 0, gradePoint: 5, remark: "Pass" }],
        }),
      });
      expect(oneBandRes.status).toBe(400);

      const noZeroBandRes = await superAdmin.request("/api/v1/grade-scale", {
        method: "PUT",
        body: JSON.stringify({
          rows: [
            { grade: "A", minScore: 70, gradePoint: 5, remark: "Excellent" },
            { grade: "B", minScore: 40, gradePoint: 4, remark: "Good" },
          ],
        }),
      });
      expect(noZeroBandRes.status).toBe(400);

      // Valid 6-band scale
      const validRes = await superAdmin.request("/api/v1/grade-scale", {
        method: "PUT",
        body: JSON.stringify({
          rows: [
            { grade: "A", minScore: 70, gradePoint: 5, remark: "Excellent" },
            { grade: "B", minScore: 60, gradePoint: 4, remark: "Very Good" },
            { grade: "C", minScore: 50, gradePoint: 3, remark: "Good" },
            { grade: "D", minScore: 45, gradePoint: 2, remark: "Fair" },
            { grade: "E", minScore: 40, gradePoint: 1, remark: "Pass" },
            { grade: "F", minScore: 0, gradePoint: 0, remark: "Fail" },
          ],
        }),
      });
      expect(validRes.status).toBe(200);
      const bands = (await validRes.json()).data;
      expect(bands).toHaveLength(6);
      expect(bands[0].grade).toBe("A");
      expect(bands[0].maxScore).toBe(100);
      expect(bands[1].grade).toBe("B");
      expect(bands[1].maxScore).toBe(69);
      expect(bands[5].grade).toBe("F");
      expect(bands[5].maxScore).toBe(39);
    });
  });
});

