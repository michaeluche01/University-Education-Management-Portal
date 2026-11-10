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

function assertNoSensitiveFields(obj: unknown) {
  const json = JSON.stringify(obj);
  expect(json).not.toContain("passwordHash");
  expect(json).not.toContain("failedLoginCount");
  expect(json).not.toContain("lockedUntil");
}

describe("Phase 4a & 4b Department Scope, Courses, Assignments & Members RBAC Suite", { timeout: 90000 }, () => {
  const superAdmin = new ApiTestClient();
  const cscAdmin = new ApiTestClient();
  const mthAdmin = new ApiTestClient();
  const lecturer1 = new ApiTestClient();
  const student1 = new ApiTestClient();
  const anon = new ApiTestClient();

  let cscDeptId = "";
  let mthDeptId = "";
  let cscProgramId = "";
  let mthProgramId = "";
  let level300Id = "";
  let level200Id = "";
  let currentFirstSemesterId = "";
  let currentSecondSemesterId = "";
  let cscLecturer1Id = "";
  let cscLecturer2Id = "";
  let mthLecturer4Id = "";
  let mthStudentId = "";
  let mthCourseId = "";
  let csc301CourseId = "";
  let csc301AssignmentId = "";

  const createdCourseIds: string[] = [];
  const createdProgramIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdStudentIds: string[] = [];
  const createdLecturerIds: string[] = [];
  const createdAssignmentIds: string[] = [];

  beforeAll(async () => {
    const [saRes, cscRes, mthRes, lecRes, stuRes] = await Promise.all([
      superAdmin.login("superadmin@uemp.demo", "Uemp@Demo2026"),
      cscAdmin.login("deptadmin.csc@uemp.demo", "Uemp@Demo2026"),
      mthAdmin.login("deptadmin.mth@uemp.demo", "Uemp@Demo2026"),
      lecturer1.login("lecturer1@uemp.demo", "Uemp@Demo2026"),
      student1.login("student01@uemp.demo", "Uemp@Demo2026"),
    ]);
    expect(saRes.status).toBe(200);
    expect(cscRes.status).toBe(200);
    expect(mthRes.status).toBe(200);
    expect(lecRes.status).toBe(200);
    expect(stuRes.status).toBe(200);

    const [
      cscDept,
      mthDept,
      cscProg,
      mthProg,
      lvl300,
      lvl200,
      currentSession,
      lec1,
      lec2,
      lec4,
      mthStu,
      mth201,
      csc301,
    ] = await Promise.all([
      prisma.department.findUniqueOrThrow({ where: { code: "CSC" } }),
      prisma.department.findUniqueOrThrow({ where: { code: "MTH" } }),
      prisma.program.findUniqueOrThrow({ where: { code: "BSC-CSC" } }),
      prisma.program.findUniqueOrThrow({ where: { code: "BSC-MTH" } }),
      prisma.academicLevel.findUniqueOrThrow({ where: { levelNumber: 300 } }),
      prisma.academicLevel.findUniqueOrThrow({ where: { levelNumber: 200 } }),
      prisma.academicSession.findFirstOrThrow({
        where: { isCurrent: true },
        include: { semesters: true },
      }),
      prisma.lecturer.findFirstOrThrow({
        where: { user: { email: "lecturer1@uemp.demo" } },
      }),
      prisma.lecturer.findFirstOrThrow({
        where: { user: { email: "lecturer2@uemp.demo" } },
      }),
      prisma.lecturer.findFirstOrThrow({
        where: { user: { email: "lecturer4@uemp.demo" } },
      }),
      prisma.student.findFirstOrThrow({
        where: { department: { code: "MTH" } },
      }),
      prisma.course.findUniqueOrThrow({ where: { code: "MTH 201" } }),
      prisma.course.findUniqueOrThrow({ where: { code: "CSC 301" } }),
    ]);

    cscDeptId = cscDept.id;
    mthDeptId = mthDept.id;
    cscProgramId = cscProg.id;
    mthProgramId = mthProg.id;
    level300Id = lvl300.id;
    level200Id = lvl200.id;
    currentFirstSemesterId =
      currentSession.semesters.find((s) => s.name === "FIRST")?.id ?? "";
    currentSecondSemesterId =
      currentSession.semesters.find((s) => s.name === "SECOND")?.id ?? "";
    cscLecturer1Id = lec1.id;
    cscLecturer2Id = lec2.id;
    mthLecturer4Id = lec4.id;
    mthStudentId = mthStu.id;
    mthCourseId = mth201.id;
    csc301CourseId = csc301.id;

    const csc301Assign = await prisma.courseAssignment.findFirstOrThrow({
      where: {
        courseId: csc301CourseId,
        semesterId: currentFirstSemesterId,
      },
    });
    csc301AssignmentId = csc301Assign.id;
  }, 30000);

  afterAll(async () => {
    const allEntityIds = [
      ...createdCourseIds,
      ...createdProgramIds,
      ...createdUserIds,
      ...createdStudentIds,
      ...createdLecturerIds,
      ...createdAssignmentIds,
    ];

    if (allEntityIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { entityId: { in: allEntityIds } },
            ...(createdUserIds.length > 0
              ? [{ actorId: { in: createdUserIds } }]
              : []),
          ],
        },
      });
    }

    if (createdAssignmentIds.length > 0) {
      await prisma.courseAssignment.deleteMany({
        where: { id: { in: createdAssignmentIds } },
      });
    }
    if (createdCourseIds.length > 0) {
      await prisma.course.deleteMany({
        where: { id: { in: createdCourseIds } },
      });
    }
    if (createdProgramIds.length > 0) {
      await prisma.program.deleteMany({
        where: { id: { in: createdProgramIds } },
      });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }

    const strayLec = await prisma.user.findUnique({
      where: { email: "unauth.lec@uemp.demo" },
      include: { lecturerProfile: true },
    });
    if (strayLec) {
      const strayIds = [
        strayLec.id,
        ...(strayLec.lecturerProfile ? [strayLec.lecturerProfile.id] : []),
      ];
      await prisma.auditLog.deleteMany({
        where: { entityId: { in: strayIds } },
      });
      await prisma.user.delete({ where: { id: strayLec.id } });
    }

    await prisma.$disconnect();
  }, 30000);

  describe("1. Authentication, Role Authorization & Foreign Origin checks", () => {
    const mutations = [
      {
        method: "POST",
        path: "/api/v1/courses",
        body: {
          code: "CSC 999",
          title: "Unauth Course",
          creditUnits: 3,
          programId: "prog-1",
          levelId: "lvl-1",
          semesterName: "FIRST",
        },
      },
      {
        method: "PATCH",
        path: "/api/v1/courses/dummy-id",
        body: { title: "Updated Title" },
      },
      {
        method: "POST",
        path: "/api/v1/course-assignments",
        body: {
          courseId: "c-1",
          lecturerId: "l-1",
          semesterId: "s-1",
        },
      },
      {
        method: "DELETE",
        path: "/api/v1/course-assignments/dummy-id",
      },
      {
        method: "POST",
        path: "/api/v1/students",
        body: {
          email: "unauth.stu@uemp.demo",
          fullName: "Unauth Student",
          password: "Password123!",
          matricNumber: "UEMP/UNAUTH/01",
          programId: "prog-1",
          levelId: "lvl-1",
        },
      },
      {
        method: "PATCH",
        path: "/api/v1/students/dummy-id",
        body: { fullName: "Updated Student" },
      },
      {
        method: "POST",
        path: "/api/v1/lecturers",
        body: {
          email: "unauth.lec@uemp.demo",
          fullName: "Unauth Lecturer",
          password: "Password123!",
          staffId: "LEC-UNAUTH-01",
        },
      },
      {
        method: "PATCH",
        path: "/api/v1/lecturers/dummy-id",
        body: { fullName: "Updated Lecturer" },
      },
    ];

    it.each(mutations)(
      "returns 401 for unauthenticated on $method $path",
      async ({ method, path, body }) => {
        const res = await anon.request(path, {
          method,
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        expect(res.status).toBe(401);
      }
    );

    it.each(mutations)(
      "returns 403 for STUDENT and LECTURER on $method $path",
      async ({ method, path, body }) => {
        for (const client of [student1, lecturer1]) {
          const res = await client.request(path, {
            method,
            ...(body ? { body: JSON.stringify(body) } : {}),
          });
          expect(res.status).toBe(403);
        }
      }
    );

    it.each(mutations)(
      "returns 403 for foreign Origin on $method $path",
      async ({ method, path, body }) => {
        const res = await cscAdmin.request(path, {
          method,
          customOrigin: "https://evil.example.com",
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        expect(res.status).toBe(403);
      }
    );
  });

  describe("2. Courses, Department Scope, Duplicate Code, Structural Immutability & Lecturer View", () => {
    let createdCscCourseId = "";
    const testCourseCode = `CSC 39${SUFFIX.slice(0, 1)}`;

    it("CSC admin can create a course in CSC (normalised code), gets 409 on duplicate code, and gets 403 creating or editing a course in MTH", async () => {
      // 1. CSC admin creates a course in CSC (with lowercase + extra spaces in code)
      const rawCode = `  ${testCourseCode.toLowerCase().replace(" ", "   ")}  `;
      const createRes = await cscAdmin.request("/api/v1/courses", {
        method: "POST",
        body: JSON.stringify({
          code: rawCode,
          title: `Special Topics ${SUFFIX}`,
          creditUnits: 3,
          description: "Departmental special topics course",
          programId: cscProgramId,
          levelId: level300Id,
          semesterName: "FIRST",
        }),
      });
      expect(createRes.status).toBe(201);
      const created = (await createRes.json()).data;
      createdCscCourseId = created.id;
      createdCourseIds.push(created.id);
      expect(created.code).toBe(testCourseCode);
      expect(created.departmentId).toBe(cscDeptId);

      // 2. Duplicate course code -> 409
      const dupRes = await cscAdmin.request("/api/v1/courses", {
        method: "POST",
        body: JSON.stringify({
          code: testCourseCode,
          title: "Duplicate Code Course",
          creditUnits: 2,
          programId: cscProgramId,
          levelId: level300Id,
          semesterName: "FIRST",
        }),
      });
      expect(dupRes.status).toBe(409);

      // 3. CSC admin creating a course in MTH -> 403
      const mthCreateRes = await cscAdmin.request("/api/v1/courses", {
        method: "POST",
        body: JSON.stringify({
          code: `MTH 39${SUFFIX.slice(0, 1)}`,
          title: "Out of Scope MTH Course",
          creditUnits: 3,
          departmentId: mthDeptId,
          programId: mthProgramId,
          levelId: level200Id,
          semesterName: "FIRST",
        }),
      });
      expect(mthCreateRes.status).toBe(403);

      // 4. CSC admin editing an MTH course -> 403
      const mthPatchRes = await cscAdmin.request(
        `/api/v1/courses/${mthCourseId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ title: "Hijacked Title" }),
        }
      );
      expect(mthPatchRes.status).toBe(403);
    });

    it("blocks editing structural fields (levelId/programId/semesterName/creditUnits) on a course with registrations/results with 409", async () => {
      // CSC 301 has registrations and SUBMITTED results in seed
      const structRes = await cscAdmin.request(
        `/api/v1/courses/${csc301CourseId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            levelId: level200Id,
          }),
        }
      );
      expect(structRes.status).toBe(409);

      const creditRes = await cscAdmin.request(
        `/api/v1/courses/${csc301CourseId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            creditUnits: 4,
          }),
        }
      );
      expect(creditRes.status).toBe(409);
    });

    it("LECTURER GET /api/v1/courses returns only assigned courses", async () => {
      const res = await lecturer1.request("/api/v1/courses");
      expect(res.status).toBe(200);
      const body = await res.json();
      const courses = body.data.items as Array<{
        id: string;
        code: string;
      }>;
      expect(courses.length).toBeGreaterThan(0);

      // Lecturer 1 is assigned CSC 301, CSC 303, CSC 201, CSC 401 — NOT CSC 305 or MTH 201 or the newly created unassigned course
      const codes = courses.map((c) => c.code);
      expect(codes).toContain("CSC 301");
      expect(codes).not.toContain("CSC 305");
      expect(codes).not.toContain("MTH 201");
      expect(codes).not.toContain(testCourseCode);

      // Verify CreatedCscCourseId is usable in next test
      expect(createdCscCourseId).toBeTruthy();
    });
  });

  describe("3. Course Assignments (D12, Cross-Department Guard, Semester Mismatch & Result Guard)", () => {
    it("enforces cross-dept lecturer guard (403/400), semester-name mismatch (400), second lecturer conflict (409), and result-in-use delete block (409)", async () => {
      const targetCourseId = createdCourseIds[0];

      // 1. CSC admin cannot assign an MTH lecturer to a CSC course -> 403
      const crossDeptAssign = await cscAdmin.request(
        "/api/v1/course-assignments",
        {
          method: "POST",
          body: JSON.stringify({
            courseId: targetCourseId,
            lecturerId: mthLecturer4Id,
            semesterId: currentFirstSemesterId,
          }),
        }
      );
      expect([400, 403]).toContain(crossDeptAssign.status);

      // 2. Semester-name mismatch (FIRST course assigned to SECOND semester) -> 400
      const mismatchAssign = await cscAdmin.request(
        "/api/v1/course-assignments",
        {
          method: "POST",
          body: JSON.stringify({
            courseId: targetCourseId,
            lecturerId: cscLecturer1Id,
            semesterId: currentSecondSemesterId,
          }),
        }
      );
      expect(mismatchAssign.status).toBe(400);

      // 3. Valid assignment in FIRST semester -> 201
      const validAssign = await cscAdmin.request("/api/v1/course-assignments", {
        method: "POST",
        body: JSON.stringify({
          courseId: targetCourseId,
          lecturerId: cscLecturer1Id,
          semesterId: currentFirstSemesterId,
        }),
      });
      expect(validAssign.status).toBe(201);
      const assigned = (await validAssign.json()).data;
      createdAssignmentIds.push(assigned.id);

      // 4. Second lecturer for the same course and semester -> 409 (D12)
      const secondLecturerAssign = await cscAdmin.request(
        "/api/v1/course-assignments",
        {
          method: "POST",
          body: JSON.stringify({
            courseId: targetCourseId,
            lecturerId: cscLecturer2Id,
            semesterId: currentFirstSemesterId,
          }),
        }
      );
      expect(secondLecturerAssign.status).toBe(409);

      // 5. Deleting an assignment for a seeded course that has results (CSC 301) -> 409
      const delSeededRes = await cscAdmin.request(
        `/api/v1/course-assignments/${csc301AssignmentId}`,
        { method: "DELETE" }
      );
      expect(delSeededRes.status).toBe(409);

      // 6. Deleting the new test assignment (which has 0 results) -> 200
      const delTestRes = await cscAdmin.request(
        `/api/v1/course-assignments/${assigned.id}`,
        { method: "DELETE" }
      );
      expect(delTestRes.status).toBe(200);
      createdAssignmentIds.pop();
    });
  });

  describe("4. Department Admin Programs, Students & Lecturers Scope Isolation", () => {
    it("allows CSC admin to create/edit a CSC program and rejects MTH program creation/edit with 403", async () => {
      // Create CSC program (omitting departmentId forces CSC)
      const createProgRes = await cscAdmin.request("/api/v1/programs", {
        method: "POST",
        body: JSON.stringify({
          name: `B.Sc. Software Engineering ${SUFFIX}`,
          code: `BSC-SWE-${SUFFIX}`,
          durationYears: 4,
        }),
      });
      expect(createProgRes.status).toBe(201);
      const createdProg = (await createProgRes.json()).data;
      createdProgramIds.push(createdProg.id);
      expect(createdProg.departmentId).toBe(cscDeptId);

      // CSC admin creating program in MTH -> 403
      const mthProgCreate = await cscAdmin.request("/api/v1/programs", {
        method: "POST",
        body: JSON.stringify({
          name: `Out of Scope MTH Program ${SUFFIX}`,
          code: `BSC-MTH-${SUFFIX}`,
          durationYears: 4,
          departmentId: mthDeptId,
        }),
      });
      expect(mthProgCreate.status).toBe(403);

      // CSC admin editing MTH program -> 403
      const mthProgPatch = await cscAdmin.request(
        `/api/v1/programs/${mthProgramId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ durationYears: 5 }),
        }
      );
      expect(mthProgPatch.status).toBe(403);
    });

    it("scopes /api/v1/students and /api/v1/lecturers to CSC for CSC admin, blocks GET/PATCH of MTH student/lecturer with 403, and never leaks passwordHash", async () => {
      // 1. CSC admin lists students -> 0 MTH records, no passwordHash
      const stuListRes = await cscAdmin.request(
        "/api/v1/students?page=1&pageSize=100"
      );
      expect(stuListRes.status).toBe(200);
      const stuListBody = await stuListRes.json();
      assertNoSensitiveFields(stuListBody);
      expect(stuListBody.data.items.length).toBeGreaterThan(0);
      for (const s of stuListBody.data.items) {
        expect(s.departmentId).toBe(cscDeptId);
        expect(s.department.code).toBe("CSC");
      }

      // 2. CSC admin lists lecturers -> 0 MTH records, no passwordHash
      const lecListRes = await cscAdmin.request(
        "/api/v1/lecturers?page=1&pageSize=100"
      );
      expect(lecListRes.status).toBe(200);
      const lecListBody = await lecListRes.json();
      assertNoSensitiveFields(lecListBody);
      expect(lecListBody.data.items.length).toBeGreaterThan(0);
      for (const l of lecListBody.data.items) {
        expect(l.departmentId).toBe(cscDeptId);
        expect(l.department.code).toBe("CSC");
      }

      // 3. CSC admin gets 403 on GET and PATCH of MTH student
      const getMthStu = await cscAdmin.request(
        `/api/v1/students/${mthStudentId}`
      );
      expect(getMthStu.status).toBe(403);

      const patchMthStu = await cscAdmin.request(
        `/api/v1/students/${mthStudentId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ fullName: "Unauthorized Edit" }),
        }
      );
      expect(patchMthStu.status).toBe(403);

      // 4. CSC admin gets 403 on GET and PATCH of MTH lecturer
      const getMthLec = await cscAdmin.request(
        `/api/v1/lecturers/${mthLecturer4Id}`
      );
      expect(getMthLec.status).toBe(403);

      const patchMthLec = await cscAdmin.request(
        `/api/v1/lecturers/${mthLecturer4Id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ title: "Prof." }),
        }
      );
      expect(patchMthLec.status).toBe(403);

      // 5. CSC admin creates a CSC student & lecturer, updates them, and strict Zod rejects forbidden fields (role, matricNumber, email, status) with 400
      const createStuRes = await cscAdmin.request("/api/v1/students", {
        method: "POST",
        body: JSON.stringify({
          email: `da.stu.${SUFFIX.toLowerCase()}@uemp.demo`,
          fullName: `Dept Admin Student ${SUFFIX}`,
          password: "TempPassword123!",
          matricNumber: `UEMP/2026/CSC/DA${SUFFIX}`,
          programId: cscProgramId,
          levelId: level300Id,
          gender: "Female",
        }),
      });
      expect(createStuRes.status).toBe(201);
      const createdStu = (await createStuRes.json()).data;
      assertNoSensitiveFields(createdStu);
      createdStudentIds.push(createdStu.id);
      createdUserIds.push(createdStu.userId);
      expect(createdStu.departmentId).toBe(cscDeptId);

      // Strict schema rejects smuggling matricNumber or role in PATCH /api/v1/students/[id] -> 400
      const smuggleStuRes = await cscAdmin.request(
        `/api/v1/students/${createdStu.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            fullName: "Attempted Smuggle",
            matricNumber: "UEMP/HACKED/001",
          }),
        }
      );
      expect(smuggleStuRes.status).toBe(400);

      // Valid PATCH on CSC student -> 200
      const validPatchStu = await cscAdmin.request(
        `/api/v1/students/${createdStu.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            fullName: `Updated Dept Student ${SUFFIX}`,
            address: "Block B, Campus Hostel",
          }),
        }
      );
      expect(validPatchStu.status).toBe(200);
      const patchedStu = (await validPatchStu.json()).data;
      assertNoSensitiveFields(patchedStu);
      expect(patchedStu.user.fullName).toBe(`Updated Dept Student ${SUFFIX}`);
      expect(patchedStu.address).toBe("Block B, Campus Hostel");

      // Create CSC lecturer via Dept Admin
      const createLecRes = await cscAdmin.request("/api/v1/lecturers", {
        method: "POST",
        body: JSON.stringify({
          email: `da.lec.${SUFFIX.toLowerCase()}@uemp.demo`,
          fullName: `Dept Admin Lecturer ${SUFFIX}`,
          password: "TempPassword123!",
          staffId: `STAFF/CSC/DA${SUFFIX}`,
          title: "Dr.",
          specialization: "Software Verification",
        }),
      });
      expect(createLecRes.status).toBe(201);
      const createdLec = (await createLecRes.json()).data;
      assertNoSensitiveFields(createdLec);
      createdLecturerIds.push(createdLec.id);
      createdUserIds.push(createdLec.userId);
      expect(createdLec.departmentId).toBe(cscDeptId);

      // Strict schema rejects smuggling role or staffId in PATCH /api/v1/lecturers/[id] -> 400
      const smuggleLecRes = await cscAdmin.request(
        `/api/v1/lecturers/${createdLec.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: "Prof.",
            role: "SUPER_ADMIN",
          }),
        }
      );
      expect(smuggleLecRes.status).toBe(400);
    });
  });
});

