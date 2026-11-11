import "dotenv/config";
import { beforeAll, describe, expect, it } from "vitest";
import { ApiTestClient } from "./helpers";

const PORTAL_PAGES = [
  // Student pages
  { path: "/student", allowedRole: "STUDENT" },
  { path: "/student/courses", allowedRole: "STUDENT" },
  { path: "/student/profile", allowedRole: "STUDENT" },
  { path: "/student/results", allowedRole: "STUDENT" },
  { path: "/student/print/registration", allowedRole: "STUDENT" },
  { path: "/student/print/results", allowedRole: "STUDENT" },

  // Lecturer pages
  { path: "/lecturer", allowedRole: "LECTURER" },
  { path: "/lecturer/courses", allowedRole: "LECTURER" },
  { path: "/lecturer/reports", allowedRole: "LECTURER" },

  // Department Admin pages
  { path: "/dept-admin", allowedRole: "DEPARTMENT_ADMIN" },
  { path: "/dept-admin/approvals", allowedRole: "DEPARTMENT_ADMIN" },
  { path: "/dept-admin/programs", allowedRole: "DEPARTMENT_ADMIN" },
  { path: "/dept-admin/courses", allowedRole: "DEPARTMENT_ADMIN" },
  { path: "/dept-admin/students", allowedRole: "DEPARTMENT_ADMIN" },
  { path: "/dept-admin/lecturers", allowedRole: "DEPARTMENT_ADMIN" },
  { path: "/dept-admin/registrations", allowedRole: "DEPARTMENT_ADMIN" },
  { path: "/dept-admin/reports", allowedRole: "DEPARTMENT_ADMIN" },
  { path: "/dept-admin/audit-logs", allowedRole: "DEPARTMENT_ADMIN" },

  // Super Admin pages
  { path: "/super-admin", allowedRole: "SUPER_ADMIN" },
  { path: "/super-admin/approvals", allowedRole: "SUPER_ADMIN" },
  { path: "/super-admin/faculties", allowedRole: "SUPER_ADMIN" },
  { path: "/super-admin/departments", allowedRole: "SUPER_ADMIN" },
  { path: "/super-admin/programs", allowedRole: "SUPER_ADMIN" },
  { path: "/super-admin/courses", allowedRole: "SUPER_ADMIN" },
  { path: "/super-admin/registrations", allowedRole: "SUPER_ADMIN" },
  { path: "/super-admin/sessions", allowedRole: "SUPER_ADMIN" },
  { path: "/super-admin/grade-scale", allowedRole: "SUPER_ADMIN" },
  { path: "/super-admin/users", allowedRole: "SUPER_ADMIN" },
  { path: "/super-admin/reports", allowedRole: "SUPER_ADMIN" },
  { path: "/super-admin/audit-logs", allowedRole: "SUPER_ADMIN" },
];

describe("Portal Page Access & Redirection Suite", { timeout: 90000 }, () => {
  const superAdmin = new ApiTestClient();
  const deptAdmin = new ApiTestClient();
  const lecturer = new ApiTestClient();
  const student = new ApiTestClient();
  const anon = new ApiTestClient();

  beforeAll(async () => {
    const [saRes, daRes, lRes, sRes] = await Promise.all([
      superAdmin.login("superadmin@uemp.demo", "Uemp@Demo2026"),
      deptAdmin.login("deptadmin.csc@uemp.demo", "Uemp@Demo2026"),
      lecturer.login("lecturer1@uemp.demo", "Uemp@Demo2026"),
      student.login("student01@uemp.demo", "Uemp@Demo2026"),
    ]);

    expect(saRes.status).toBe(200);
    expect(daRes.status).toBe(200);
    expect(lRes.status).toBe(200);
    expect(sRes.status).toBe(200);
  }, 90000);

  const roleClients = [
    { role: "SUPER_ADMIN", client: superAdmin, dashboard: "/super-admin" },
    { role: "DEPARTMENT_ADMIN", client: deptAdmin, dashboard: "/dept-admin" },
    { role: "LECTURER", client: lecturer, dashboard: "/lecturer" },
    { role: "STUDENT", client: student, dashboard: "/student" },
  ];

  describe("1. Anonymous Page Access Protection", () => {
    it.each(PORTAL_PAGES)(
      "redirects unauthenticated user to /login on $path",
      async ({ path }) => {
        const res = await anon.request(path, { redirect: "manual" });
        // Next.js middleware / proxy redirect returns 307 or 308 or 302 or 303 to /login
        const isRedirect =
          res.status === 307 ||
          res.status === 308 ||
          res.status === 302 ||
          res.status === 303;

        expect(
          isRedirect,
          `Expected anonymous request to ${path} to redirect, but received ${res.status}`
        ).toBe(true);

        const location = res.headers.get("location") || "";
        expect(location).toContain("/login");
      }
    );
  });

  describe("2. Authenticated Role Isolation & Redirection", () => {
    it.each(
      PORTAL_PAGES.flatMap((p) =>
        roleClients.map((rc) => ({
          page: p,
          clientRole: rc.role,
          client: rc.client,
          clientDashboard: rc.dashboard,
        }))
      )
    )(
      "evaluates $clientRole accessing $page.path (allowed: $page.allowedRole)",
      async ({ page, clientRole, client, clientDashboard }) => {
        const res = await client.request(page.path, { redirect: "manual" });

        if (clientRole === page.allowedRole) {
          // Authorized user receives 200 OK
          expect(
            res.status,
            `Expected ${clientRole} to load ${page.path} with 200, but got ${res.status}`
          ).toBe(200);
        } else {
          // Unauthorized user is redirected to their own dashboard or gets 403 / 404
          const isRedirect =
            res.status === 307 ||
            res.status === 308 ||
            res.status === 302 ||
            res.status === 303;

          if (isRedirect) {
            const location = res.headers.get("location") || "";
            expect(
              location,
              `Expected ${clientRole} to be redirected to ${clientDashboard}, but got ${location}`
            ).toContain(clientDashboard);
          } else {
            expect(
              [403, 404].includes(res.status),
              `Expected ${clientRole} accessing ${page.path} to be redirected or rejected, but got ${res.status}`
            ).toBe(true);
          }
        }
      }
    );
  });
});
