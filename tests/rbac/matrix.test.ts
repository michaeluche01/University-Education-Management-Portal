import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../src/generated/prisma/client";
import { ApiTestClient } from "./helpers";
import {
  type RouteFixtures,
  ROUTE_MANIFEST,
  type RouteManifestEntry,
} from "./route-manifest";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const FORBIDDEN_KEYS = new Set([
  "passwordHash",
  "failedLoginCount",
  "lockedUntil",
  "SESSION_SECRET",
]);

function scanForbiddenKeys(obj: unknown, currentPath = ""): void {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => scanForbiddenKeys(item, `${currentPath}[${idx}]`));
    return;
  }
  for (const [key, value] of Object.entries(obj)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new Error(
        `Security leakage: forbidden key "${key}" found at ${currentPath}.${key}`
      );
    }
    scanForbiddenKeys(value, `${currentPath}.${key}`);
  }
}

describe("Comprehensive API RBAC Matrix & Origin Security Suite", { timeout: 120000 }, () => {
  const superAdmin = new ApiTestClient();
  const cscAdmin = new ApiTestClient();
  const lecturer = new ApiTestClient();
  const student = new ApiTestClient();
  const anon = new ApiTestClient();

  let fixtures: RouteFixtures;

  beforeAll(async () => {
    // 1. Authenticate test clients sequentially
    const saRes = await superAdmin.login("superadmin@uemp.demo", "Uemp@Demo2026");
    const daRes = await cscAdmin.login("deptadmin.csc@uemp.demo", "Uemp@Demo2026");
    const lRes = await lecturer.login("lecturer1@uemp.demo", "Uemp@Demo2026");
    const sRes = await student.login("student01@uemp.demo", "Uemp@Demo2026");

    expect(saRes.status).toBe(200);
    expect(daRes.status).toBe(200);
    expect(lRes.status).toBe(200);
    expect(sRes.status).toBe(200);

    // 2. Fetch real entity fixture IDs from DB
    const [
      faculty,
      dept,
      prog,
      lvl,
      sess,
      sem,
      user,
      course,
      studentProf,
      lecturerProf,
    ] = await Promise.all([
      prisma.faculty.findFirstOrThrow(),
      prisma.department.findFirstOrThrow({ where: { code: "CSC" } }),
      prisma.program.findFirstOrThrow({ where: { code: "BSC-CSC" } }),
      prisma.academicLevel.findFirstOrThrow({ where: { levelNumber: 100 } }),
      prisma.academicSession.findFirstOrThrow({ where: { isCurrent: true } }),
      prisma.semester.findFirstOrThrow({ where: { isCurrent: true } }),
      prisma.user.findFirstOrThrow({ where: { email: "lecturer2@uemp.demo" } }),
      prisma.course.findFirstOrThrow({ where: { code: "CSC 201" } }),
      prisma.student.findFirstOrThrow({ where: { matricNumber: "UEMP/2024/CSC/001" } }),
      prisma.lecturer.findFirstOrThrow({ where: { staffId: "STAFF/CSC/001" } }),
    ]);

    const [assignment, registration, result] = await Promise.all([
      prisma.courseAssignment.findFirstOrThrow(),
      prisma.courseRegistration.findFirstOrThrow(),
      prisma.result.findFirstOrThrow(),
    ]);

    fixtures = {
      facultyId: faculty.id,
      departmentId: dept.id,
      programId: prog.id,
      levelId: lvl.id,
      sessionId: sess.id,
      semesterId: sem.id,
      userId: user.id,
      courseId: course.id,
      assignmentId: assignment.id,
      studentId: studentProf.id,
      lecturerId: lecturerProf.id,
      registrationId: registration.id,
      resultId: result.id,
    };
  }, 90000);

  const roleClients = [
    { role: "SUPER_ADMIN" as const, client: () => superAdmin },
    { role: "DEPARTMENT_ADMIN" as const, client: () => cscAdmin },
    { role: "LECTURER" as const, client: () => lecturer },
    { role: "STUDENT" as const, client: () => student },
  ];

  describe("1. Anonymous Access Matrix", () => {
    it.each(ROUTE_MANIFEST)(
      "evaluates anonymous access for $method $pathPattern",
      async (entry: RouteManifestEntry) => {
        const req = entry.buildRequest(fixtures);
        const res = await anon.request(req.path, req.init);

        if (entry.isPublic) {
          expect(res.status).not.toBe(401);
        } else {
          expect(res.status).toBe(401);
        }

        const json = await res.json().catch(() => null);
        if (json) scanForbiddenKeys(json);
      }
    );
  });

  describe("2. Authenticated Role Permission Matrix", () => {
    it.each(
      ROUTE_MANIFEST.flatMap((entry) =>
        roleClients.map((rc) => ({
          entry,
          role: rc.role,
          client: rc.client,
        }))
      )
    )(
      "evaluates $role on $entry.method $entry.pathPattern",
      async ({ entry, role, client }) => {
        if (entry.isPublic) return;

        const req = entry.buildRequest(fixtures);
        const res = await client().request(req.path, req.init);
        const isAllowed = entry.allowedRoles.includes(role);

        if (isAllowed) {
          expect(
            res.status,
            `Expected ${role} to be allowed on ${entry.method} ${req.path}, but received ${res.status}`
          ).not.toBe(401);

          expect(
            res.status,
            `Expected ${role} to be allowed on ${entry.method} ${req.path}, but received 403`
          ).not.toBe(403);
        } else {
          expect(
            res.status,
            `Expected ${role} to be rejected on ${entry.method} ${req.path}, but received ${res.status}`
          ).toBe(403);
        }

        const json = await res.json().catch(() => null);
        if (json) scanForbiddenKeys(json);
      }
    );
  });

  describe("3. Mutating Route Foreign Origin Rejection", () => {
    const mutatingEntries = ROUTE_MANIFEST.filter((e) => e.isMutating);

    it.each(mutatingEntries)(
      "rejects foreign Origin with 403 on $method $pathPattern",
      async (entry: RouteManifestEntry) => {
        const req = entry.buildRequest(fixtures);
        // Call with foreign Origin
        const res = await superAdmin.request(req.path, {
          ...req.init,
          customOrigin: "http://malicious.evil-hacker.com",
        });

        expect(
          res.status,
          `Expected foreign Origin to be blocked with 403 on ${entry.method} ${req.path}, but got ${res.status}`
        ).toBe(403);
      }
    );
  });
});
