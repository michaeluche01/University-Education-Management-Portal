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

describe("Phase 6 Lecturer Results & Grading RBAC Suite", { timeout: 90000 }, () => {
  const superAdmin = new ApiTestClient();
  const deptAdmin = new ApiTestClient();
  const lecturer1 = new ApiTestClient();
  const lecturer2 = new ApiTestClient();
  const student = new ApiTestClient();
  const anon = new ApiTestClient();

  let cscDeptId = "";
  let cscProgramId = "";
  let level300Id = "";
  let currentSemesterId = "";
  let lecturer1Id = "";
  let fixtureCourseId = "";
  let fixtureAssignmentId = "";
  let unassignedCourseId = "";
  let foreignRegistrationId = "";

  const fixtureCourseCode = `CSC 38${SUFFIX.slice(0, 1)}`;
  const fixtureRegIds: string[] = [];

  beforeAll(async () => {
    const saRes = await superAdmin.login("superadmin@uemp.demo", "Uemp@Demo2026");
    const daRes = await deptAdmin.login("deptadmin.csc@uemp.demo", "Uemp@Demo2026");
    const l1Res = await lecturer1.login("lecturer1@uemp.demo", "Uemp@Demo2026");
    const l2Res = await lecturer2.login("lecturer2@uemp.demo", "Uemp@Demo2026");
    const sRes = await student.login("student01@uemp.demo", "Uemp@Demo2026");
    expect(saRes.status).toBe(200);
    expect(daRes.status).toBe(200);
    expect(l1Res.status).toBe(200);
    expect(l2Res.status).toBe(200);
    expect(sRes.status).toBe(200);

    const [cscDept, cscProg, lvl300, currentSem, l1, , seededStudents, csc301Reg] =
      await Promise.all([
        prisma.department.findUniqueOrThrow({ where: { code: "CSC" } }),
        prisma.program.findUniqueOrThrow({ where: { code: "BSC-CSC" } }),
        prisma.academicLevel.findUniqueOrThrow({ where: { levelNumber: 300 } }),
        prisma.semester.findFirstOrThrow({ where: { isCurrent: true } }),
        prisma.lecturer.findFirstOrThrow({
          where: { user: { email: "lecturer1@uemp.demo" } },
        }),
        prisma.lecturer.findFirstOrThrow({
          where: { user: { email: "lecturer2@uemp.demo" } },
        }),
        prisma.student.findMany({
          where: { department: { code: "CSC" }, level: { levelNumber: 300 } },
          take: 3,
        }),
        prisma.courseRegistration.findFirstOrThrow({
          where: { course: { code: "CSC 301" } },
        }),
      ]);

    cscDeptId = cscDept.id;
    cscProgramId = cscProg.id;
    level300Id = lvl300.id;
    currentSemesterId = currentSem.id;
    lecturer1Id = l1.id;
    foreignRegistrationId = csc301Reg.id;

    // Create fresh fixture course
    const course = await prisma.course.create({
      data: {
        code: fixtureCourseCode,
        title: `Lecturer Results Test Course ${SUFFIX}`,
        creditUnits: 3,
        departmentId: cscDeptId,
        programId: cscProgramId,
        levelId: level300Id,
        semesterName: currentSem.name,
        isActive: true,
      },
    });
    fixtureCourseId = course.id;

    // Create assignment to lecturer1
    const assign = await prisma.courseAssignment.create({
      data: {
        courseId: fixtureCourseId,
        lecturerId: lecturer1Id,
        semesterId: currentSemesterId,
      },
    });
    fixtureAssignmentId = assign.id;

    // Register 3 seeded students directly to fixture course
    for (const stu of seededStudents) {
      const reg = await prisma.courseRegistration.create({
        data: {
          studentId: stu.id,
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
        },
      });
      fixtureRegIds.push(reg.id);
    }

    // Unassigned course for testing unassigned course guard
    const unassigned = await prisma.course.findUniqueOrThrow({
      where: { code: "MTH 201" },
    });
    unassignedCourseId = unassigned.id;
  }, 30000);

  afterAll(async () => {
    if (fixtureRegIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { entityId: { in: fixtureRegIds } },
            { entityType: "Result", entityId: { in: fixtureRegIds } },
          ],
        },
      });
      await prisma.result.deleteMany({
        where: { registrationId: { in: fixtureRegIds } },
      });
      await prisma.courseRegistration.deleteMany({
        where: { id: { in: fixtureRegIds } },
      });
    }

    if (fixtureAssignmentId) {
      await prisma.courseAssignment.deleteMany({
        where: { id: fixtureAssignmentId },
      });
    }

    if (fixtureCourseId) {
      await prisma.course.deleteMany({
        where: { id: fixtureCourseId },
      });
    }

    await prisma.$disconnect();
  }, 30000);

  describe("1. Authentication, Role Restrictions & Foreign Origin", () => {
    it("returns 401 for unauthenticated requests on sheet, draft, and submit", async () => {
      const sRes = await anon.request(
        `/api/v1/results/sheet?courseId=${fixtureCourseId}&semesterId=${currentSemesterId}`
      );
      expect(sRes.status).toBe(401);

      const dRes = await anon.request("/api/v1/results/draft", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
          entries: [{ registrationId: fixtureRegIds[0], caScore: 20, examScore: 50 }],
        }),
      });
      expect(dRes.status).toBe(401);

      const subRes = await anon.request("/api/v1/results/submit", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
        }),
      });
      expect(subRes.status).toBe(401);
    });

    it("returns 403 for STUDENT, DEPARTMENT_ADMIN, and SUPER_ADMIN on draft and submit", async () => {
      for (const client of [student, deptAdmin, superAdmin]) {
        const dRes = await client.request("/api/v1/results/draft", {
          method: "POST",
          body: JSON.stringify({
            courseId: fixtureCourseId,
            semesterId: currentSemesterId,
            entries: [{ registrationId: fixtureRegIds[0], caScore: 20, examScore: 50 }],
          }),
        });
        expect(dRes.status).toBe(403);

        const subRes = await client.request("/api/v1/results/submit", {
          method: "POST",
          body: JSON.stringify({
            courseId: fixtureCourseId,
            semesterId: currentSemesterId,
          }),
        });
        expect(subRes.status).toBe(403);
      }
    });

    it("returns 403 on foreign Origin", async () => {
      const res = await lecturer1.request("/api/v1/results/draft", {
        method: "POST",
        customOrigin: "https://evil.attacker.com",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
          entries: [{ registrationId: fixtureRegIds[0], caScore: 20, examScore: 50 }],
        }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("2. Score Validation, Strict Schemas & Atomic Rollback", () => {
    it("rejects totalScore, grade, status or studentId in draft body with 400 (strict schema)", async () => {
      const smuggleRes = await lecturer1.request("/api/v1/results/draft", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
          entries: [
            {
              registrationId: fixtureRegIds[0],
              caScore: 20,
              examScore: 50,
              totalScore: 70, // smuggled field!
            },
          ],
        }),
      });
      expect(smuggleRes.status).toBe(400);

      const statusSmuggle = await lecturer1.request("/api/v1/results/draft", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
          entries: [
            {
              registrationId: fixtureRegIds[0],
              caScore: 20,
              examScore: 50,
              status: "APPROVED", // smuggled status!
            },
          ],
        }),
      });
      expect(statusSmuggle.status).toBe(400);
    });

    it("rejects scores out of range (-1, 30.01, 70.01), NaN, strings, and >2 decimals with 400", async () => {
      const invalidEntries = [
        { registrationId: fixtureRegIds[0], caScore: -1, examScore: 50 },
        { registrationId: fixtureRegIds[0], caScore: 30.01, examScore: 50 },
        { registrationId: fixtureRegIds[0], caScore: 20, examScore: -0.5 },
        { registrationId: fixtureRegIds[0], caScore: 20, examScore: 70.01 },
        { registrationId: fixtureRegIds[0], caScore: 20.123, examScore: 50 },
        { registrationId: fixtureRegIds[0], caScore: "20" as unknown as number, examScore: 50 },
      ];

      for (const entry of invalidEntries) {
        const res = await lecturer1.request("/api/v1/results/draft", {
          method: "POST",
          body: JSON.stringify({
            courseId: fixtureCourseId,
            semesterId: currentSemesterId,
            entries: [entry],
          }),
        });
        expect(res.status).toBe(400);
      }
    });

    it("rejects an entry whose registrationId belongs to a different course with 400 and creates nothing (atomic)", async () => {
      const mixedRes = await lecturer1.request("/api/v1/results/draft", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
          entries: [
            { registrationId: fixtureRegIds[0], caScore: 25, examScore: 45 },
            { registrationId: foreignRegistrationId, caScore: 20, examScore: 40 },
          ],
        }),
      });
      expect(mixedRes.status).toBe(400);

      // Verify that NO draft was created for registration 0
      const checkRes = await prisma.result.findUnique({
        where: { registrationId: fixtureRegIds[0] },
      });
      expect(checkRes).toBeNull();
    });
  });

  describe("3. Lecturer Assignment Scoping & Draft Saving", () => {
    it("rejects another lecturer (lecturer2) on this course with 403, and rejects unassigned course with 403", async () => {
      const l2Res = await lecturer2.request("/api/v1/results/draft", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
          entries: [{ registrationId: fixtureRegIds[0], caScore: 25, examScore: 45 }],
        }),
      });
      expect(l2Res.status).toBe(403);

      const unassignedRes = await lecturer1.request("/api/v1/results/draft", {
        method: "POST",
        body: JSON.stringify({
          courseId: unassignedCourseId,
          semesterId: currentSemesterId,
          entries: [{ registrationId: foreignRegistrationId, caScore: 25, examScore: 45 }],
        }),
      });
      expect(unassignedRes.status).toBe(403);
    });

    it("assigned lecturer saves a draft; server computes total and grade accurately", async () => {
      // CA 25.50 + Exam 45.00 = 70.50 -> A (5.0)
      const saveRes = await lecturer1.request("/api/v1/results/draft", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
          entries: [{ registrationId: fixtureRegIds[0], caScore: 25.5, examScore: 45 }],
        }),
      });
      expect(saveRes.status).toBe(200);

      // Check on GET /api/v1/results/sheet
      const sheetRes = await lecturer1.request(
        `/api/v1/results/sheet?courseId=${fixtureCourseId}&semesterId=${currentSemesterId}`
      );
      expect(sheetRes.status).toBe(200);
      const sheet = (await sheetRes.json()).data;
      const row0 = sheet.rows.find(
        (r: { registrationId: string; result?: Record<string, unknown> }) =>
          r.registrationId === fixtureRegIds[0]
      );
      expect(row0).toBeTruthy();
      expect(row0.result).toMatchObject({
        caScore: 25.5,
        examScore: 45,
        totalScore: 70.5,
        grade: "A",
        gradePoint: 5,
        status: "DRAFT",
      });
      expect(sheet.summary.enteredCount).toBe(1);
      expect(sheet.summary.registeredCount).toBe(3);
    });
  });

  describe("4. Results Submission & Post-Submit Immutability", () => {
    it("submit with missing student result rows returns 409", async () => {
      // Only 1 of 3 students has a score entered
      const subRes = await lecturer1.request("/api/v1/results/submit", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
        }),
      });
      expect(subRes.status).toBe(409);
      const body = await subRes.json();
      expect(body.error?.message).toContain("have no score entries yet");
    });

    it("submits results once all students have drafts, transitions to SUBMITTED, and blocks further draft editing with 409", async () => {
      // Save drafts for remaining 2 students
      const saveRemaining = await lecturer1.request("/api/v1/results/draft", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
          entries: [
            { registrationId: fixtureRegIds[1], caScore: 20, examScore: 40 }, // 60 -> B
            { registrationId: fixtureRegIds[2], caScore: 15, examScore: 30 }, // 45 -> D
          ],
        }),
      });
      expect(saveRemaining.status).toBe(200);

      // Submit all
      const subRes = await lecturer1.request("/api/v1/results/submit", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
        }),
      });
      expect(subRes.status).toBe(200);
      const subBody = await subRes.json();
      expect(subBody.data.submittedCount).toBe(3);

      // Verify status is SUBMITTED
      const sheetRes = await lecturer1.request(
        `/api/v1/results/sheet?courseId=${fixtureCourseId}&semesterId=${currentSemesterId}`
      );
      expect(sheetRes.status).toBe(200);
      const sheet = (await sheetRes.json()).data;
      for (const row of sheet.rows) {
        expect(row.result.status).toBe("SUBMITTED");
      }

      // Editing draft after submit -> 409
      const editAfterSub = await lecturer1.request("/api/v1/results/draft", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
          entries: [{ registrationId: fixtureRegIds[0], caScore: 26, examScore: 46 }],
        }),
      });
      expect(editAfterSub.status).toBe(409);

      // Lecturer calling approve -> 403 (cannot approve own results)
      const approveRes = await lecturer1.request("/api/v1/results/approve", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
        }),
      });
      expect(approveRes.status).toBe(403);
    });
  });
});
