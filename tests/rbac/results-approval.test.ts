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

describe("Phase 7a Results Approval & Audit Trail RBAC Suite", { timeout: 90000 }, () => {
  const superAdmin = new ApiTestClient();
  const cscAdmin = new ApiTestClient();
  const mthAdmin = new ApiTestClient();
  const lecturer1 = new ApiTestClient();
  const student = new ApiTestClient();
  const anon = new ApiTestClient();

  let cscDeptId = "";
  let cscProgramId = "";
  let level300Id = "";
  let currentSemesterId = "";
  let lecturer1Id = "";
  let fixtureCourseId = "";
  let fixtureAssignmentId = "";
  let mthCourseId = "";

  const fixtureCourseCode = `CSC 39${SUFFIX.slice(0, 1)}`;
  const fixtureRegIds: string[] = [];
  let fixtureResultId0 = "";

  beforeAll(async () => {
    const saRes = await superAdmin.login("superadmin@uemp.demo", "Uemp@Demo2026");
    const cscRes = await cscAdmin.login("deptadmin.csc@uemp.demo", "Uemp@Demo2026");
    const mthRes = await mthAdmin.login("deptadmin.mth@uemp.demo", "Uemp@Demo2026");
    const l1Res = await lecturer1.login("lecturer1@uemp.demo", "Uemp@Demo2026");
    const sRes = await student.login("student01@uemp.demo", "Uemp@Demo2026");
    expect(saRes.status).toBe(200);
    expect(cscRes.status).toBe(200);
    expect(mthRes.status).toBe(200);
    expect(l1Res.status).toBe(200);
    expect(sRes.status).toBe(200);

    const [cscDept, cscProg, lvl300, currentSem, l1, mthCourse, seededStudents] =
      await Promise.all([
        prisma.department.findUniqueOrThrow({ where: { code: "CSC" } }),
        prisma.program.findUniqueOrThrow({ where: { code: "BSC-CSC" } }),
        prisma.academicLevel.findUniqueOrThrow({ where: { levelNumber: 300 } }),
        prisma.semester.findFirstOrThrow({ where: { isCurrent: true } }),
        prisma.lecturer.findFirstOrThrow({
          where: { user: { email: "lecturer1@uemp.demo" } },
        }),
        prisma.course.findUniqueOrThrow({ where: { code: "MTH 201" } }),
        prisma.student.findMany({
          where: { department: { code: "CSC" }, level: { levelNumber: 300 } },
          take: 2,
        }),
      ]);

    cscDeptId = cscDept.id;
    cscProgramId = cscProg.id;
    level300Id = lvl300.id;
    currentSemesterId = currentSem.id;
    lecturer1Id = l1.id;
    mthCourseId = mthCourse.id;

    // Create fixture course
    const course = await prisma.course.create({
      data: {
        code: fixtureCourseCode,
        title: `Results Approval Test Course ${SUFFIX}`,
        creditUnits: 3,
        departmentId: cscDeptId,
        programId: cscProgramId,
        levelId: level300Id,
        semesterName: currentSem.name,
        isActive: true,
      },
    });
    fixtureCourseId = course.id;

    // Assign to lecturer1
    const assign = await prisma.courseAssignment.create({
      data: {
        courseId: fixtureCourseId,
        lecturerId: lecturer1Id,
        semesterId: currentSemesterId,
      },
    });
    fixtureAssignmentId = assign.id;

    // Register 2 students
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
    it("returns 401 for unauthenticated requests", async () => {
      const subRes = await anon.request("/api/v1/results/submissions");
      expect(subRes.status).toBe(401);

      const appRes = await anon.request("/api/v1/results/approve", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
        }),
      });
      expect(appRes.status).toBe(401);
    });

    it("returns 403 for STUDENT and LECTURER on approval endpoints", async () => {
      for (const client of [student, lecturer1]) {
        const subRes = await client.request("/api/v1/results/submissions");
        expect(subRes.status).toBe(403);

        const appRes = await client.request("/api/v1/results/approve", {
          method: "POST",
          body: JSON.stringify({
            courseId: fixtureCourseId,
            semesterId: currentSemesterId,
          }),
        });
        expect(appRes.status).toBe(403);

        const retRes = await client.request("/api/v1/results/return", {
          method: "POST",
          body: JSON.stringify({
            courseId: fixtureCourseId,
            semesterId: currentSemesterId,
            feedback: "Please fix scores",
          }),
        });
        expect(retRes.status).toBe(403);

        const reoRes = await client.request("/api/v1/results/reopen", {
          method: "POST",
          body: JSON.stringify({
            courseId: fixtureCourseId,
            semesterId: currentSemesterId,
            reason: "Audit recheck required",
          }),
        });
        expect(reoRes.status).toBe(403);
      }
    });

    it("returns 403 on foreign Origin header for mutating approval routes", async () => {
      const res = await cscAdmin.request("/api/v1/results/approve", {
        method: "POST",
        customOrigin: "https://evil.external.com",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
        }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("2. Decision D3 (Hidden Drafts) & Submissions Query", () => {
    it("draft results do not appear in admin submissions list or admin sheet", async () => {
      // Lecturer saves drafts for the 2 students
      const saveDraft = await lecturer1.request("/api/v1/results/draft", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
          entries: [
            { registrationId: fixtureRegIds[0], caScore: 28, examScore: 62 },
            { registrationId: fixtureRegIds[1], caScore: 22, examScore: 48 },
          ],
        }),
      });
      expect(saveDraft.status).toBe(200);

      // Dept Admin inspects sheet: D3 -> draft scores are NULL / hidden
      const adminSheet = await cscAdmin.request(
        `/api/v1/results/sheet?courseId=${fixtureCourseId}&semesterId=${currentSemesterId}`
      );
      expect(adminSheet.status).toBe(200);
      const sheetBody = (await adminSheet.json()).data;
      expect(sheetBody.summary.enteredCount).toBe(0);
      for (const row of sheetBody.rows) {
        expect(row.result).toBeNull();
      }

      // Dept Admin checks submissions: overallStatus is NOT_SUBMITTED (or pending submission)
      const subsRes = await cscAdmin.request(
        `/api/v1/results/submissions?semesterId=${currentSemesterId}`
      );
      expect(subsRes.status).toBe(200);
      const subsBody = (await subsRes.json()).data;
      const subItem = subsBody.submissions.find(
        (s: { courseId: string }) => s.courseId === fixtureCourseId
      );
      expect(subItem).toBeTruthy();
      expect(subItem.submittedCount).toBe(0);
      expect(subItem.overallStatus).toBe("NO_RESULTS");
    });
  });

  describe("3. Department Scoping & Approval Rules", () => {
    it("submitting results transitions them to SUBMITTED; Dept Admin now sees them", async () => {
      const subRes = await lecturer1.request("/api/v1/results/submit", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
        }),
      });
      expect(subRes.status).toBe(200);

      // Dept Admin sheet now shows results with status SUBMITTED
      const adminSheet = await cscAdmin.request(
        `/api/v1/results/sheet?courseId=${fixtureCourseId}&semesterId=${currentSemesterId}`
      );
      expect(adminSheet.status).toBe(200);
      const sheetBody = (await adminSheet.json()).data;
      expect(sheetBody.summary.enteredCount).toBe(2);
      expect(sheetBody.rows[0].result.status).toBe("SUBMITTED");
      fixtureResultId0 = sheetBody.rows[0].result.id;
    });

    it("rejects approval by an out-of-scope department admin (MTH admin on CSC course) with 403", async () => {
      const outOfScopeRes = await mthAdmin.request("/api/v1/results/approve", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
        }),
      });
      expect(outOfScopeRes.status).toBe(403);
    });

    it("rejects approval by CSC admin on MTH course with 403", async () => {
      const foreignCourseRes = await cscAdmin.request("/api/v1/results/approve", {
        method: "POST",
        body: JSON.stringify({
          courseId: mthCourseId,
          semesterId: currentSemesterId,
        }),
      });
      expect(foreignCourseRes.status).toBe(403);
    });
  });

  describe("4. Return for Correction & Lecturer Resubmission", () => {
    it("rejects return without valid feedback (< 3 chars) with 400", async () => {
      const badRet = await cscAdmin.request("/api/v1/results/return", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
          feedback: "no",
        }),
      });
      expect(badRet.status).toBe(400);
    });

    it("returns results for correction with feedback; status transitions to RETURNED", async () => {
      const retRes = await cscAdmin.request("/api/v1/results/return", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
          feedback: "Please verify CA scores for student 1.",
        }),
      });
      expect(retRes.status).toBe(200);
      const retBody = await retRes.json();
      expect(retBody.data.returnedCount).toBe(2);

      // Verify lecturer sees RETURNED and feedback
      const sheetRes = await lecturer1.request(
        `/api/v1/results/sheet?courseId=${fixtureCourseId}&semesterId=${currentSemesterId}`
      );
      expect(sheetRes.status).toBe(200);
      const sheet = (await sheetRes.json()).data;
      expect(sheet.rows[0].result.status).toBe("RETURNED");
      expect(sheet.rows[0].result.feedback).toContain("verify CA scores");
    });

    it("lecturer can modify returned results and resubmit", async () => {
      // Modify score
      const modDraft = await lecturer1.request("/api/v1/results/draft", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
          entries: [
            { registrationId: fixtureRegIds[0], caScore: 29, examScore: 65 },
          ],
        }),
      });
      expect(modDraft.status).toBe(200);

      // Resubmit
      const resubRes = await lecturer1.request("/api/v1/results/submit", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
        }),
      });
      expect(resubRes.status).toBe(200);
    });
  });

  describe("5. Approval, Concurrent Race Safety & Reopening", () => {
    it("concurrent approval requests (Promise.all) result in exactly 1 success and 1 conflict 409", async () => {
      const [call1, call2] = await Promise.all([
        cscAdmin.request("/api/v1/results/approve", {
          method: "POST",
          body: JSON.stringify({
            courseId: fixtureCourseId,
            semesterId: currentSemesterId,
          }),
        }),
        cscAdmin.request("/api/v1/results/approve", {
          method: "POST",
          body: JSON.stringify({
            courseId: fixtureCourseId,
            semesterId: currentSemesterId,
          }),
        }),
      ]);

      const statuses = [call1.status, call2.status].sort();
      expect(statuses).toEqual([200, 409]);
    });

    it("approving an already APPROVED sheet returns 409", async () => {
      const repeatApprove = await cscAdmin.request("/api/v1/results/approve", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
        }),
      });
      expect(repeatApprove.status).toBe(409);
    });

    it("reopening requires valid reason (3-500 chars) and transitions status back to RETURNED", async () => {
      const badReopen = await cscAdmin.request("/api/v1/results/reopen", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
          reason: "ab",
        }),
      });
      expect(badReopen.status).toBe(400);

      const goodReopen = await cscAdmin.request("/api/v1/results/reopen", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
          reason: "Senate audit committee requested recalculation.",
        }),
      });
      expect(goodReopen.status).toBe(200);
      const reoBody = await goodReopen.json();
      expect(reoBody.data.reopenedCount).toBe(2);

      // Verify status is now RETURNED
      const sheetRes = await lecturer1.request(
        `/api/v1/results/sheet?courseId=${fixtureCourseId}&semesterId=${currentSemesterId}`
      );
      expect(sheetRes.status).toBe(200);
      const sheet = (await sheetRes.json()).data;
      expect(sheet.rows[0].result.status).toBe("RETURNED");
      expect(sheet.rows[0].result.reopenReason).toContain("Senate audit committee");
    });

    it("super admin can approve reopened results university-wide", async () => {
      // Lecturer resubmits
      await lecturer1.request("/api/v1/results/submit", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
        }),
      });

      // Super Admin approves
      const saApprove = await superAdmin.request("/api/v1/results/approve", {
        method: "POST",
        body: JSON.stringify({
          courseId: fixtureCourseId,
          semesterId: currentSemesterId,
        }),
      });
      expect(saApprove.status).toBe(200);
    });
  });

  describe("6. Result Lifecycle Audit Trail (/api/v1/results/[id]/history)", () => {
    it("returns 403 for STUDENT and out-of-scope admin", async () => {
      const studentHistory = await student.request(
        `/api/v1/results/${fixtureResultId0}/history`
      );
      expect(studentHistory.status).toBe(403);

      const mthAdminHistory = await mthAdmin.request(
        `/api/v1/results/${fixtureResultId0}/history`
      );
      expect(mthAdminHistory.status).toBe(403);
    });

    it("returns complete chronological audit history for Dept Admin and Super Admin", async () => {
      const historyRes = await cscAdmin.request(
        `/api/v1/results/${fixtureResultId0}/history`
      );
      expect(historyRes.status).toBe(200);
      const histData = (await historyRes.json()).data;
      expect(histData.resultId).toBe(fixtureResultId0);
      expect(histData.courseCode).toBe(fixtureCourseCode);

      const actions = histData.history.map((h: { action: string }) => h.action);
      // Lifecycle sequence includes RESULT_SUBMITTED, RESULT_RETURNED, RESULT_SUBMITTED, RESULT_APPROVED, RESULT_REOPENED, RESULT_SUBMITTED, RESULT_APPROVED
      expect(actions).toContain("RESULT_SUBMITTED");
      expect(actions).toContain("RESULT_RETURNED");
      expect(actions).toContain("RESULT_APPROVED");
      expect(actions).toContain("RESULT_REOPENED");
    });
  });
});
