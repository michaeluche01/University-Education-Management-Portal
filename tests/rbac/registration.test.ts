import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../src/generated/prisma/client";
import { ApiTestClient } from "./helpers";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

describe("Phase 5 Student Course Registration, Class List & Profile RBAC Suite", { timeout: 90000 }, () => {
  const superAdmin = new ApiTestClient();
  const cscAdmin = new ApiTestClient();
  const mthAdmin = new ApiTestClient();
  const lecturer1 = new ApiTestClient();
  const student10 = new ApiTestClient(); // Scenario S7: CSC 300L with 0 current registrations
  const student01 = new ApiTestClient(); // CSC 300L with seeded registrations & results
  const anon = new ApiTestClient();

  let student10ProfileId = "";
  let student01ProfileId = "";
  let currentSemesterId = "";
  let csc301Id = "";
  let csc303Id = "";
  let csc305Id = "";
  let csc201Id = ""; // 200L course (level mismatch for 300L student10)
  let mth201Id = ""; // MTH course (dept/program/level mismatch)
  let student01Csc301RegId = ""; // has SUBMITTED result
  let student01Csc303RegId = ""; // has NO result, belongs to student01

  const createdRegIds: string[] = [];

  beforeAll(async () => {
    const saRes = await superAdmin.login("superadmin@uemp.demo", "Uemp@Demo2026");
    const cscRes = await cscAdmin.login("deptadmin.csc@uemp.demo", "Uemp@Demo2026");
    const mthRes = await mthAdmin.login("deptadmin.mth@uemp.demo", "Uemp@Demo2026");
    const lecRes = await lecturer1.login("lecturer1@uemp.demo", "Uemp@Demo2026");
    const s10Res = await student10.login("student10@uemp.demo", "Uemp@Demo2026");
    const s01Res = await student01.login("student01@uemp.demo", "Uemp@Demo2026");
    expect(saRes.status).toBe(200);
    expect(cscRes.status).toBe(200);
    expect(mthRes.status).toBe(200);
    expect(lecRes.status).toBe(200);
    expect(s10Res.status).toBe(200);
    expect(s01Res.status).toBe(200);

    const [
      stu10,
      stu01,
      currentSem,
      c301,
      c303,
      c305,
      c201,
      m201,
    ] = await Promise.all([
      prisma.student.findFirstOrThrow({
        where: { user: { email: "student10@uemp.demo" } },
      }),
      prisma.student.findFirstOrThrow({
        where: { user: { email: "student01@uemp.demo" } },
      }),
      prisma.semester.findFirstOrThrow({
        where: { isCurrent: true },
      }),
      prisma.course.findUniqueOrThrow({ where: { code: "CSC 301" } }),
      prisma.course.findUniqueOrThrow({ where: { code: "CSC 303" } }),
      prisma.course.findUniqueOrThrow({ where: { code: "CSC 305" } }),
      prisma.course.findUniqueOrThrow({ where: { code: "CSC 201" } }),
      prisma.course.findUniqueOrThrow({ where: { code: "MTH 201" } }),
    ]);

    student10ProfileId = stu10.id;
    student01ProfileId = stu01.id;
    currentSemesterId = currentSem.id;
    csc301Id = c301.id;
    csc303Id = c303.id;
    csc305Id = c305.id;
    csc201Id = c201.id;
    mth201Id = m201.id;

    // Ensure registrationOpen is true at start of suite
    if (!currentSem.registrationOpen) {
      await prisma.semester.update({
        where: { id: currentSemesterId },
        data: { registrationOpen: true },
      });
    }

    // Clean any stray current-semester registrations on student10 before starting
    await prisma.courseRegistration.deleteMany({
      where: {
        studentId: student10ProfileId,
        semesterId: currentSemesterId,
      },
    });

    const [s01Reg301, s01Reg303] = await Promise.all([
      prisma.courseRegistration.findFirstOrThrow({
        where: {
          studentId: student01ProfileId,
          courseId: csc301Id,
          semesterId: currentSemesterId,
        },
      }),
      prisma.courseRegistration.findFirstOrThrow({
        where: {
          studentId: student01ProfileId,
          courseId: csc303Id,
          semesterId: currentSemesterId,
        },
      }),
    ]);
    student01Csc301RegId = s01Reg301.id;
    student01Csc303RegId = s01Reg303.id;
  }, 30000);

  afterAll(async () => {
    // Ensure registrationOpen is restored to true
    if (currentSemesterId) {
      await prisma.semester.update({
        where: { id: currentSemesterId },
        data: { registrationOpen: true },
      });
    }

    // Clean up any registrations created for student10 during test and their audit logs
    const s10Regs = await prisma.courseRegistration.findMany({
      where: {
        studentId: student10ProfileId,
        semesterId: currentSemesterId,
      },
      select: { id: true },
    });
    const allRegIds = Array.from(
      new Set([...createdRegIds, ...s10Regs.map((r) => r.id)])
    );

    if (allRegIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          entityType: "CourseRegistration",
          entityId: { in: allRegIds },
        },
      });
      await prisma.courseRegistration.deleteMany({
        where: { id: { in: allRegIds } },
      });
    }

    await prisma.$disconnect();
  }, 30000);

  describe("1. Authentication & Role Guard on Registration & Profile Endpoints", () => {
    it("returns 401 for unauthenticated requests and 403 for non-students on student-only registration routes", async () => {
      const availAnon = await anon.request("/api/v1/registrations/available");
      expect(availAnon.status).toBe(401);

      const postAnon = await anon.request("/api/v1/registrations", {
        method: "POST",
        body: JSON.stringify({ courseIds: [csc301Id] }),
      });
      expect(postAnon.status).toBe(401);

      const delAnon = await anon.request("/api/v1/registrations/dummy-id", {
        method: "DELETE",
      });
      expect(delAnon.status).toBe(401);

      // Non-students get 403 on /api/v1/registrations/available, POST /api/v1/registrations, DELETE /api/v1/registrations/[id]
      for (const client of [lecturer1, cscAdmin, superAdmin]) {
        const r1 = await client.request("/api/v1/registrations/available");
        expect(r1.status).toBe(403);

        const r2 = await client.request("/api/v1/registrations", {
          method: "POST",
          body: JSON.stringify({ courseIds: [csc301Id] }),
        });
        expect(r2.status).toBe(403);

        const r3 = await client.request("/api/v1/registrations/dummy-id", {
          method: "DELETE",
        });
        expect(r3.status).toBe(403);
      }
    });
  });

  describe("2. Student Registration Workflow, Visibility, Eligibility, Atomic Batch, Race Condition & Closed Window", () => {
    it("registers an eligible course (201) and makes it visible to student10, CSC admin, and SUPER_ADMIN, but NOT MTH admin", async () => {
      const regRes = await student10.request("/api/v1/registrations", {
        method: "POST",
        body: JSON.stringify({ courseIds: [csc301Id] }),
      });
      expect(regRes.status).toBe(201);
      const created = (await regRes.json()).data as Array<{
        id: string;
        courseId: string;
      }>;
      expect(created).toHaveLength(1);
      const regId = created[0].id;
      createdRegIds.push(regId);

      // Visible to student10 (and student10 sees ONLY their own rows)
      const stuListRes = await student10.request("/api/v1/registrations");
      expect(stuListRes.status).toBe(200);
      const stuList = (await stuListRes.json()).data.items as Array<{
        id: string;
        studentId: string;
      }>;
      expect(stuList.map((r) => r.id)).toContain(regId);
      for (const row of stuList) {
        expect(row.studentId).toBe(student10ProfileId);
      }

      // Visible to CSC admin
      const cscListRes = await cscAdmin.request(
        `/api/v1/registrations?courseId=${csc301Id}&search=student10`
      );
      expect(cscListRes.status).toBe(200);
      const cscItems = (await cscListRes.json()).data.items as Array<{
        id: string;
      }>;
      expect(cscItems.map((r) => r.id)).toContain(regId);

      // Visible to SUPER_ADMIN
      const saListRes = await superAdmin.request(
        `/api/v1/registrations?courseId=${csc301Id}&search=student10`
      );
      expect(saListRes.status).toBe(200);
      const saItems = (await saListRes.json()).data.items as Array<{
        id: string;
      }>;
      expect(saItems.map((r) => r.id)).toContain(regId);

      // NOT visible to MTH admin
      const mthListRes = await mthAdmin.request(
        `/api/v1/registrations?search=student10`
      );
      expect(mthListRes.status).toBe(200);
      const mthItems = (await mthListRes.json()).data.items as Array<{
        id: string;
      }>;
      expect(mthItems).toHaveLength(0);
    });

    it("rejects duplicate registration with 409, rejects wrong level/dept/program with 400, and rejects mixed valid+invalid batch atomically (400, nothing created)", async () => {
      // 1. Duplicate registration of CSC 301 -> 409
      const dupRes = await student10.request("/api/v1/registrations", {
        method: "POST",
        body: JSON.stringify({ courseIds: [csc301Id] }),
      });
      expect(dupRes.status).toBe(409);

      // 2. Wrong level (CSC 201 is 200L, student10 is 300L) -> 400
      const wrongLevelRes = await student10.request("/api/v1/registrations", {
        method: "POST",
        body: JSON.stringify({ courseIds: [csc201Id] }),
      });
      expect(wrongLevelRes.status).toBe(400);

      // 3. Wrong department/program (MTH 201) -> 400
      const wrongDeptRes = await student10.request("/api/v1/registrations", {
        method: "POST",
        body: JSON.stringify({ courseIds: [mth201Id] }),
      });
      expect(wrongDeptRes.status).toBe(400);

      // 4. Batch with one valid (CSC 303) + one invalid (CSC 201) rejects the WHOLE batch with 400 and creates nothing
      const mixedBatchRes = await student10.request("/api/v1/registrations", {
        method: "POST",
        body: JSON.stringify({ courseIds: [csc303Id, csc201Id] }),
      });
      expect(mixedBatchRes.status).toBe(400);

      // Verify CSC 303 was NOT registered
      const checkCsc303 = await prisma.courseRegistration.findFirst({
        where: {
          studentId: student10ProfileId,
          courseId: csc303Id,
          semesterId: currentSemesterId,
        },
      });
      expect(checkCsc303).toBeNull();
    });

    it("handles two simultaneous POSTs for the same course (Promise.all) with one 201 and one 409", async () => {
      const [resA, resB] = await Promise.all([
        student10.request("/api/v1/registrations", {
          method: "POST",
          body: JSON.stringify({ courseIds: [csc303Id] }),
        }),
        student10.request("/api/v1/registrations", {
          method: "POST",
          body: JSON.stringify({ courseIds: [csc303Id] }),
        }),
      ]);

      const statuses = [resA.status, resB.status].sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409]);

      const winnerRes = resA.status === 201 ? resA : resB;
      const winnerBody = await winnerRes.json();
      createdRegIds.push(winnerBody.data[0].id);
    });

    it("rejects registration with 409 when registrationOpen is false on the current semester", async () => {
      const closeRes = await superAdmin.request(
        `/api/v1/semesters/${currentSemesterId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ registrationOpen: false }),
        }
      );
      expect(closeRes.status).toBe(200);

      try {
        const regWhileClosed = await student10.request(
          "/api/v1/registrations",
          {
            method: "POST",
            body: JSON.stringify({ courseIds: [csc305Id] }),
          }
        );
        expect(regWhileClosed.status).toBe(409);
      } finally {
        const reopenRes = await superAdmin.request(
          `/api/v1/semesters/${currentSemesterId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ registrationOpen: true }),
          }
        );
        expect(reopenRes.status).toBe(200);
      }
    });

    it("allows dropping own registration without result (200), blocks dropping a registration with a result (409), and blocks dropping another student's registration (403)", async () => {
      // 1. Dropping someone else's registration (student10 trying to drop student01's CSC 303 registration) -> 403
      const dropOtherRes = await student10.request(
        `/api/v1/registrations/${student01Csc303RegId}`,
        { method: "DELETE" }
      );
      expect(dropOtherRes.status).toBe(403);

      // 2. Dropping own registration that has a result (student01 trying to drop CSC 301 which has a SUBMITTED result) -> 409
      const dropWithResultRes = await student01.request(
        `/api/v1/registrations/${student01Csc301RegId}`,
        { method: "DELETE" }
      );
      expect(dropWithResultRes.status).toBe(409);

      // 3. Dropping own registration without result (student10 dropping their CSC 301 and CSC 303 registrations) -> 200
      for (const regId of [...createdRegIds]) {
        const dropOwnRes = await student10.request(
          `/api/v1/registrations/${regId}`,
          { method: "DELETE" }
        );
        expect(dropOwnRes.status).toBe(200);
      }
    });
  });

  describe("3. Lecturer Class List & Profile Strict Validation", () => {
    it("allows LECTURER to fetch class list for assigned course (200) and returns 403 for unassigned course", async () => {
      // Lecturer 1 is assigned CSC 301 in current semester -> 200
      const assignedRes = await lecturer1.request(
        `/api/v1/registrations?courseId=${csc301Id}&semesterId=${currentSemesterId}`
      );
      expect(assignedRes.status).toBe(200);
      const classList = (await assignedRes.json()).data.items as Array<
        Record<string, unknown>
      >;
      expect(classList.length).toBeGreaterThan(0);
      // Verify no score/result fields leak in class list
      expect(JSON.stringify(classList)).not.toContain("caScore");
      expect(JSON.stringify(classList)).not.toContain("examScore");

      // Lecturer 1 is NOT assigned CSC 305 (assigned to Lecturer 2) -> 403
      const unassignedRes = await lecturer1.request(
        `/api/v1/registrations?courseId=${csc305Id}&semesterId=${currentSemesterId}`
      );
      expect(unassignedRes.status).toBe(403);
    });

    it("rejects PATCH /api/v1/profile with role or matricNumber in body with 400 and leaves profile unchanged", async () => {
      const beforeRes = await student10.request("/api/v1/profile");
      expect(beforeRes.status).toBe(200);
      const beforeProfile = (await beforeRes.json()).data;

      // Smuggling role -> 400
      const roleSmuggle = await student10.request("/api/v1/profile", {
        method: "PATCH",
        body: JSON.stringify({
          phone: "08099999999",
          role: "SUPER_ADMIN",
        }),
      });
      expect(roleSmuggle.status).toBe(400);

      // Smuggling matricNumber -> 400
      const matricSmuggle = await student10.request("/api/v1/profile", {
        method: "PATCH",
        body: JSON.stringify({
          address: "New Hostel",
          matricNumber: "UEMP/HACK/000",
        }),
      });
      expect(matricSmuggle.status).toBe(400);

      // Verify profile is unchanged
      const afterRes = await student10.request("/api/v1/profile");
      expect(afterRes.status).toBe(200);
      const afterProfile = (await afterRes.json()).data;
      expect(afterProfile.role).toBe("STUDENT");
      expect(afterProfile.studentProfile.matricNumber).toBe(
        beforeProfile.studentProfile.matricNumber
      );
    });
  });
});

