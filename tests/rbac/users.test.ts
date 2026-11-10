import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../src/generated/prisma/client";
import { updateUserStatus } from "../../src/server/services/user.service";
import { ApiTestClient } from "./helpers";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const SUFFIX = Math.random().toString(36).substring(2, 6).toUpperCase();

function assertNoSensitiveUserFields(obj: Record<string, unknown>) {
  expect(obj).not.toHaveProperty("passwordHash");
  expect(obj).not.toHaveProperty("failedLoginCount");
  expect(obj).not.toHaveProperty("lockedUntil");
}

describe("Phase 3b Users Management RBAC & API Suite", { timeout: 60000 }, () => {
  const superAdmin = new ApiTestClient();
  const deptAdmin = new ApiTestClient();
  const lecturer = new ApiTestClient();
  const student = new ApiTestClient();
  const anon = new ApiTestClient();

  let superAdminUserId = "";
  let cscDeptId = "";
  let mthDeptId = "";
  let cscProgramId = "";
  let mthProgramId = "";
  let level100Id = "";
  let assignedLecturerUserId = "";

  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const [saRes, daRes, lecRes, stuRes] = await Promise.all([
      superAdmin.login("superadmin@uemp.demo", "Uemp@Demo2026"),
      deptAdmin.login("deptadmin.csc@uemp.demo", "Uemp@Demo2026"),
      lecturer.login("lecturer1@uemp.demo", "Uemp@Demo2026"),
      student.login("student01@uemp.demo", "Uemp@Demo2026"),
    ]);
    expect(saRes.status).toBe(200);
    expect(daRes.status).toBe(200);
    expect(lecRes.status).toBe(200);
    expect(stuRes.status).toBe(200);

    const saMe = await (await superAdmin.me()).json();
    superAdminUserId = saMe.data.userId ?? saMe.data.id;
    expect(superAdminUserId).toBeTruthy();

    const [cscDept, mthDept, cscProg, mthProg, lvl100, lec1User] =
      await Promise.all([
        prisma.department.findUniqueOrThrow({ where: { code: "CSC" } }),
        prisma.department.findUniqueOrThrow({ where: { code: "MTH" } }),
        prisma.program.findUniqueOrThrow({ where: { code: "BSC-CSC" } }),
        prisma.program.findUniqueOrThrow({ where: { code: "BSC-MTH" } }),
        prisma.academicLevel.findUniqueOrThrow({ where: { levelNumber: 100 } }),
        prisma.user.findUniqueOrThrow({
          where: { email: "lecturer1@uemp.demo" },
        }),
      ]);

    cscDeptId = cscDept.id;
    mthDeptId = mthDept.id;
    cscProgramId = cscProg.id;
    mthProgramId = mthProg.id;
    level100Id = lvl100.id;
    assignedLecturerUserId = lec1User.id;
  }, 30000);

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { entityId: { in: createdUserIds } },
            { actorId: { in: createdUserIds } },
          ],
        },
      });
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
    await prisma.$disconnect();
  }, 30000);

  describe("Authorization checks on /api/v1/users*", () => {
    const endpoints = [
      { method: "GET", path: "/api/v1/users" },
      {
        method: "POST",
        path: "/api/v1/users",
        body: {
          email: "unauth@uemp.demo",
          fullName: "Unauth",
          password: "Password123!",
          role: "SUPER_ADMIN",
        },
      },
      {
        method: "PATCH",
        path: "/api/v1/users/dummy-id",
        body: { fullName: "Updated" },
      },
      {
        method: "PATCH",
        path: "/api/v1/users/dummy-id/status",
        body: { status: "SUSPENDED" },
      },
      {
        method: "PATCH",
        path: "/api/v1/users/dummy-id/role",
        body: { role: "SUPER_ADMIN" },
      },
      {
        method: "PATCH",
        path: "/api/v1/users/dummy-id/password",
        body: { password: "NewPassword123!" },
      },
    ];

    it.each(endpoints)(
      "returns 401 for unauthenticated on $method $path",
      async ({ method, path, body }) => {
        const res = await anon.request(path, {
          method,
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        expect(res.status).toBe(401);
      }
    );

    it.each(endpoints)(
      "returns 403 for STUDENT, LECTURER, and DEPARTMENT_ADMIN on $method $path",
      async ({ method, path, body }) => {
        for (const client of [student, lecturer, deptAdmin]) {
          const res = await client.request(path, {
            method,
            ...(body ? { body: JSON.stringify(body) } : {}),
          });
          expect(res.status).toBe(403);
        }
      }
    );
  });

  describe("List, Create, Duplicate & Program/Department Mismatch checks", () => {
    it("lists paginated users without sensitive fields", async () => {
      const res = await superAdmin.request(
        "/api/v1/users?page=1&pageSize=10&role=STUDENT"
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.items.length).toBeGreaterThan(0);
      expect(body.data.total).toBeGreaterThanOrEqual(24);
      for (const user of body.data.items) {
        assertNoSensitiveUserFields(user);
        expect(user.role).toBe("STUDENT");
      }
    });

    it("creates a student and lecturer, rejects duplicate email/matric with 409, and rejects program/department mismatch with 400", async () => {
      // 1. Program/department mismatch -> 400
      const mismatchRes = await superAdmin.request("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({
          email: `mismatch.${SUFFIX.toLowerCase()}@uemp.demo`,
          fullName: `Mismatch Student ${SUFFIX}`,
          password: "TempPassword123!",
          role: "STUDENT",
          departmentId: cscDeptId,
          programId: mthProgramId, // belongs to MTH, not CSC
          levelId: level100Id,
          matricNumber: `UEMP/2026/MIS/${SUFFIX}`,
        }),
      });
      expect(mismatchRes.status).toBe(400);

      // 2. Create valid student
      const stuEmail = `stu.${SUFFIX.toLowerCase()}@uemp.demo`;
      const stuMatric = `UEMP/2026/CSC/T${SUFFIX}`;
      const createStuRes = await superAdmin.request("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({
          email: ` ${stuEmail.toUpperCase()} `,
          fullName: `Test Student ${SUFFIX}`,
          phone: "08011112222",
          password: "TempPassword123!",
          role: "STUDENT",
          departmentId: cscDeptId,
          programId: cscProgramId,
          levelId: level100Id,
          matricNumber: ` ${stuMatric.toLowerCase()} `,
        }),
      });
      expect(createStuRes.status).toBe(201);
      const createdStu = (await createStuRes.json()).data;
      createdUserIds.push(createdStu.id);
      assertNoSensitiveUserFields(createdStu);
      expect(createdStu.email).toBe(stuEmail);
      expect(createdStu.profile.matricNumber).toBe(stuMatric);

      // 3. Duplicate email -> 409
      const dupEmailRes = await superAdmin.request("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({
          email: stuEmail,
          fullName: "Duplicate Email User",
          password: "TempPassword123!",
          role: "SUPER_ADMIN",
        }),
      });
      expect(dupEmailRes.status).toBe(409);

      // 4. Duplicate matricNumber -> 409
      const dupMatricRes = await superAdmin.request("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({
          email: `other.${SUFFIX.toLowerCase()}@uemp.demo`,
          fullName: "Duplicate Matric Student",
          password: "TempPassword123!",
          role: "STUDENT",
          departmentId: cscDeptId,
          programId: cscProgramId,
          levelId: level100Id,
          matricNumber: stuMatric,
        }),
      });
      expect(dupMatricRes.status).toBe(409);

      // 5. Create valid lecturer
      const lecEmail = `lec.${SUFFIX.toLowerCase()}@uemp.demo`;
      const lecStaffId = `STAFF/CSC/T${SUFFIX}`;
      const createLecRes = await superAdmin.request("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({
          email: lecEmail,
          fullName: `Test Lecturer ${SUFFIX}`,
          password: "TempPassword123!",
          role: "LECTURER",
          departmentId: cscDeptId,
          staffId: lecStaffId,
          title: "Dr.",
          specialization: "Cybersecurity",
        }),
      });
      expect(createLecRes.status).toBe(201);
      const createdLec = (await createLecRes.json()).data;
      createdUserIds.push(createdLec.id);
      assertNoSensitiveUserFields(createdLec);
      expect(createdLec.profile.staffId).toBe(lecStaffId);
      expect(createdLec.profile.title).toBe("Dr.");
    });
  });

  describe("Account Status, Self-Modification & Last-Active-Super-Admin Guards", () => {
    it("suspends user (login -> 403), reactivates user (login -> 200), and enforces self & last-super-admin guards", async () => {
      const targetUserId = createdUserIds[0];
      const targetEmail = `stu.${SUFFIX.toLowerCase()}@uemp.demo`;

      // Suspend user
      const suspendRes = await superAdmin.request(
        `/api/v1/users/${targetUserId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: "SUSPENDED",
            reason: "Testing suspension",
          }),
        }
      );
      expect(suspendRes.status).toBe(200);
      const suspendedUser = (await suspendRes.json()).data;
      assertNoSensitiveUserFields(suspendedUser);
      expect(suspendedUser.status).toBe("SUSPENDED");

      // Suspended user cannot log in -> 403
      const testClient = new ApiTestClient();
      const loginSuspended = await testClient.login(
        targetEmail,
        "TempPassword123!"
      );
      expect(loginSuspended.status).toBe(403);

      // Reactivate user
      const activateRes = await superAdmin.request(
        `/api/v1/users/${targetUserId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: "ACTIVE",
            reason: "Testing reactivation",
          }),
        }
      );
      expect(activateRes.status).toBe(200);

      // Reactivated user can log in -> 200
      const loginActive = await testClient.login(
        targetEmail,
        "TempPassword123!"
      );
      expect(loginActive.status).toBe(200);

      // Super Admin cannot change their own status -> 400
      const selfStatusRes = await superAdmin.request(
        `/api/v1/users/${superAdminUserId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "SUSPENDED" }),
        }
      );
      expect(selfStatusRes.status).toBe(400);

      // Create a second temporary SUPER_ADMIN, suspend it when 2 are active (succeeds),
      // then verify that when only 1 active SUPER_ADMIN remains, suspending/demoting the last active one is blocked
      const sa2Res = await superAdmin.request("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({
          email: `sa2.${SUFFIX.toLowerCase()}@uemp.demo`,
          fullName: `Second Super Admin ${SUFFIX}`,
          password: "TempPassword123!",
          role: "SUPER_ADMIN",
        }),
      });
      expect(sa2Res.status).toBe(201);
      const sa2 = (await sa2Res.json()).data;
      createdUserIds.push(sa2.id);

      // Suspend sa2 so only 1 active SUPER_ADMIN (superadmin@uemp.demo) remains
      const suspendSa2Res = await superAdmin.request(
        `/api/v1/users/${sa2.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "SUSPENDED" }),
        }
      );
      expect(suspendSa2Res.status).toBe(200);

      // Verify last-active-super-admin guard rejects suspending the only remaining ACTIVE SUPER_ADMIN (409)
      await expect(
        updateUserStatus(
          {
            userId: sa2.id,
            email: sa2.email,
            fullName: sa2.fullName,
            role: "SUPER_ADMIN",
            status: "ACTIVE",
            studentId: null,
            lecturerId: null,
            departmentId: null,
            programId: null,
            levelId: null,
            matricNumber: null,
            staffId: null,
            departmentName: null,
            facultyName: null,
            programName: null,
            levelName: null,
          },
          superAdminUserId,
          { status: "SUSPENDED", reason: "Attempt to suspend last active SA" }
        )
      ).rejects.toMatchObject({
        status: 409,
        code: "CONFLICT_LAST_SUPER_ADMIN",
      });

      // Verify password reset endpoint works and never echoes password
      const pwdRes = await superAdmin.request(
        `/api/v1/users/${targetUserId}/password`,
        {
          method: "PATCH",
          body: JSON.stringify({ password: "ResetPassword999!" }),
        }
      );
      expect(pwdRes.status).toBe(200);
      const pwdBody = await pwdRes.json();
      expect(pwdBody.data).not.toHaveProperty("password");
      expect(pwdBody.data).not.toHaveProperty("passwordHash");

      const loginAfterReset = await new ApiTestClient().login(
        targetEmail,
        "ResetPassword999!"
      );
      expect(loginAfterReset.status).toBe(200);
    });
  });

  describe("Role Conversions (Decision D6)", () => {
    it("rejects role changes to or from STUDENT (400), blocks converting a lecturer with assignments (409), and converts an unassigned lecturer to DEPARTMENT_ADMIN", async () => {
      const studentUserId = createdUserIds[0];
      const unassignedLecturerUserId = createdUserIds[1];

      // 1. Converting FROM STUDENT -> 400
      const fromStuRes = await superAdmin.request(
        `/api/v1/users/${studentUserId}/role`,
        {
          method: "PATCH",
          body: JSON.stringify({
            role: "SUPER_ADMIN",
          }),
        }
      );
      expect(fromStuRes.status).toBe(400);

      // 2. Converting TO STUDENT -> 400
      const toStuRes = await superAdmin.request(
        `/api/v1/users/${unassignedLecturerUserId}/role`,
        {
          method: "PATCH",
          body: JSON.stringify({
            role: "STUDENT",
          }),
        }
      );
      expect(toStuRes.status).toBe(400);

      // 3. Converting a lecturer WHO HAS course assignments -> 409
      const assignedLecRes = await superAdmin.request(
        `/api/v1/users/${assignedLecturerUserId}/role`,
        {
          method: "PATCH",
          body: JSON.stringify({
            role: "DEPARTMENT_ADMIN",
            departmentId: cscDeptId,
            staffId: `STAFF/DA/${SUFFIX}`,
          }),
        }
      );
      expect(assignedLecRes.status).toBe(409);

      // 4. Converting an unassigned lecturer to DEPARTMENT_ADMIN -> 200
      const convertRes = await superAdmin.request(
        `/api/v1/users/${unassignedLecturerUserId}/role`,
        {
          method: "PATCH",
          body: JSON.stringify({
            role: "DEPARTMENT_ADMIN",
            departmentId: mthDeptId,
            staffId: `STAFF/MTH/DA${SUFFIX}`,
          }),
        }
      );
      expect(convertRes.status).toBe(200);
      const converted = (await convertRes.json()).data;
      assertNoSensitiveUserFields(converted);
      expect(converted.role).toBe("DEPARTMENT_ADMIN");
      expect(converted.profile.department.code).toBe("MTH");
      expect(converted.profile.staffId).toBe(`STAFF/MTH/DA${SUFFIX}`);
    });
  });
});
