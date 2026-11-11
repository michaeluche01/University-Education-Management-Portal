import type { Role } from "../../src/generated/prisma/enums";

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface RouteFixtures {
  facultyId: string;
  departmentId: string;
  programId: string;
  levelId: string;
  sessionId: string;
  semesterId: string;
  userId: string;
  courseId: string;
  assignmentId: string;
  studentId: string;
  lecturerId: string;
  registrationId: string;
  resultId: string;
}

export interface RouteManifestEntry {
  file: string;
  method: HttpMethod;
  pathPattern: string;
  allowedRoles: Role[];
  isPublic?: boolean;
  isMutating?: boolean;
  buildRequest: (fixtures: RouteFixtures) => {
    path: string;
    init?: RequestInit;
  };
}

export const ROUTE_MANIFEST: RouteManifestEntry[] = [
  // Health check
  {
    file: "src/app/api/health/route.ts",
    method: "GET",
    pathPattern: "/api/health",
    allowedRoles: [],
    isPublic: true,
    isMutating: false,
    buildRequest: () => ({ path: "/api/health" }),
  },

  // Auth: clear-session
  {
    file: "src/app/api/v1/auth/clear-session/route.ts",
    method: "GET",
    pathPattern: "/api/v1/auth/clear-session",
    allowedRoles: [],
    isPublic: true,
    isMutating: false,
    buildRequest: () => ({ path: "/api/v1/auth/clear-session" }),
  },

  // Auth: login
  {
    file: "src/app/api/v1/auth/login/route.ts",
    method: "POST",
    pathPattern: "/api/v1/auth/login",
    allowedRoles: [],
    isPublic: true,
    isMutating: true,
    buildRequest: () => ({
      path: "/api/v1/auth/login",
      init: {
        method: "POST",
        body: JSON.stringify({ email: "invalid-email-format", password: "" }),
      },
    }),
  },

  // Auth: logout
  {
    file: "src/app/api/v1/auth/logout/route.ts",
    method: "POST",
    pathPattern: "/api/v1/auth/logout",
    allowedRoles: [],
    isPublic: true,
    isMutating: true,
    buildRequest: () => ({
      path: "/api/v1/auth/logout",
      init: { method: "POST", body: JSON.stringify({}) },
    }),
  },

  // Auth: me
  {
    file: "src/app/api/v1/auth/me/route.ts",
    method: "GET",
    pathPattern: "/api/v1/auth/me",
    allowedRoles: ["STUDENT", "LECTURER", "DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: false,
    buildRequest: () => ({ path: "/api/v1/auth/me" }),
  },

  // Auth: password
  {
    file: "src/app/api/v1/auth/password/route.ts",
    method: "PATCH",
    pathPattern: "/api/v1/auth/password",
    allowedRoles: ["STUDENT", "LECTURER", "DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: () => ({
      path: "/api/v1/auth/password",
      init: {
        method: "PATCH",
        body: JSON.stringify({ currentPassword: "", newPassword: "short" }),
      },
    }),
  },

  // Profile (GET)
  {
    file: "src/app/api/v1/profile/route.ts",
    method: "GET",
    pathPattern: "/api/v1/profile",
    allowedRoles: ["STUDENT", "LECTURER", "DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: false,
    buildRequest: () => ({ path: "/api/v1/profile" }),
  },

  // Profile (PATCH)
  {
    file: "src/app/api/v1/profile/route.ts",
    method: "PATCH",
    pathPattern: "/api/v1/profile",
    allowedRoles: ["STUDENT", "LECTURER", "DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: () => ({
      path: "/api/v1/profile",
      init: {
        method: "PATCH",
        // Smuggle forbidden field to trigger 400
        body: JSON.stringify({ matricNumber: "HACKED" }),
      },
    }),
  },

  // Faculties (GET)
  {
    file: "src/app/api/v1/faculties/route.ts",
    method: "GET",
    pathPattern: "/api/v1/faculties",
    allowedRoles: ["STUDENT", "LECTURER", "DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: false,
    buildRequest: () => ({ path: "/api/v1/faculties" }),
  },

  // Faculties (POST)
  {
    file: "src/app/api/v1/faculties/route.ts",
    method: "POST",
    pathPattern: "/api/v1/faculties",
    allowedRoles: ["SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: () => ({
      path: "/api/v1/faculties",
      init: {
        method: "POST",
        body: JSON.stringify({ name: "", code: "" }),
      },
    }),
  },

  // Faculties [id] (PATCH)
  {
    file: "src/app/api/v1/faculties/[id]/route.ts",
    method: "PATCH",
    pathPattern: "/api/v1/faculties/[id]",
    allowedRoles: ["SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: (f) => ({
      path: `/api/v1/faculties/${f.facultyId}`,
      init: {
        method: "PATCH",
        body: JSON.stringify({ name: "" }),
      },
    }),
  },

  // Departments (GET)
  {
    file: "src/app/api/v1/departments/route.ts",
    method: "GET",
    pathPattern: "/api/v1/departments",
    allowedRoles: ["STUDENT", "LECTURER", "DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: false,
    buildRequest: () => ({ path: "/api/v1/departments" }),
  },

  // Departments (POST)
  {
    file: "src/app/api/v1/departments/route.ts",
    method: "POST",
    pathPattern: "/api/v1/departments",
    allowedRoles: ["SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: () => ({
      path: "/api/v1/departments",
      init: {
        method: "POST",
        body: JSON.stringify({ name: "", code: "", facultyId: "invalid" }),
      },
    }),
  },

  // Departments [id] (PATCH)
  {
    file: "src/app/api/v1/departments/[id]/route.ts",
    method: "PATCH",
    pathPattern: "/api/v1/departments/[id]",
    allowedRoles: ["SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: (f) => ({
      path: `/api/v1/departments/${f.departmentId}`,
      init: {
        method: "PATCH",
        body: JSON.stringify({ name: "" }),
      },
    }),
  },

  // Programs (GET)
  {
    file: "src/app/api/v1/programs/route.ts",
    method: "GET",
    pathPattern: "/api/v1/programs",
    allowedRoles: ["STUDENT", "LECTURER", "DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: false,
    buildRequest: () => ({ path: "/api/v1/programs" }),
  },

  // Programs (POST)
  {
    file: "src/app/api/v1/programs/route.ts",
    method: "POST",
    pathPattern: "/api/v1/programs",
    allowedRoles: ["DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: () => ({
      path: "/api/v1/programs",
      init: {
        method: "POST",
        body: JSON.stringify({ name: "", code: "", durationYears: 0 }),
      },
    }),
  },

  // Programs [id] (PATCH)
  {
    file: "src/app/api/v1/programs/[id]/route.ts",
    method: "PATCH",
    pathPattern: "/api/v1/programs/[id]",
    allowedRoles: ["DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: (f) => ({
      path: `/api/v1/programs/${f.programId}`,
      init: {
        method: "PATCH",
        body: JSON.stringify({ durationYears: 0 }),
      },
    }),
  },

  // Levels (GET)
  {
    file: "src/app/api/v1/levels/route.ts",
    method: "GET",
    pathPattern: "/api/v1/levels",
    allowedRoles: ["STUDENT", "LECTURER", "DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: false,
    buildRequest: () => ({ path: "/api/v1/levels" }),
  },

  // Levels (POST)
  {
    file: "src/app/api/v1/levels/route.ts",
    method: "POST",
    pathPattern: "/api/v1/levels",
    allowedRoles: ["SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: () => ({
      path: "/api/v1/levels",
      init: {
        method: "POST",
        body: JSON.stringify({ levelNumber: 150, name: "" }),
      },
    }),
  },

  // Sessions (GET)
  {
    file: "src/app/api/v1/sessions/route.ts",
    method: "GET",
    pathPattern: "/api/v1/sessions",
    allowedRoles: ["STUDENT", "LECTURER", "DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: false,
    buildRequest: () => ({ path: "/api/v1/sessions" }),
  },

  // Sessions (POST)
  {
    file: "src/app/api/v1/sessions/route.ts",
    method: "POST",
    pathPattern: "/api/v1/sessions",
    allowedRoles: ["SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: () => ({
      path: "/api/v1/sessions",
      init: {
        method: "POST",
        body: JSON.stringify({ name: "invalid", startDate: "bad" }),
      },
    }),
  },

  // Sessions [id] (PATCH)
  {
    file: "src/app/api/v1/sessions/[id]/route.ts",
    method: "PATCH",
    pathPattern: "/api/v1/sessions/[id]",
    allowedRoles: ["SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: (f) => ({
      path: `/api/v1/sessions/${f.sessionId}`,
      init: {
        method: "PATCH",
        body: JSON.stringify({ isCurrent: "not-a-bool" }),
      },
    }),
  },

  // Semesters [id] (PATCH)
  {
    file: "src/app/api/v1/semesters/[id]/route.ts",
    method: "PATCH",
    pathPattern: "/api/v1/semesters/[id]",
    allowedRoles: ["SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: (f) => ({
      path: `/api/v1/semesters/${f.semesterId}`,
      init: {
        method: "PATCH",
        body: JSON.stringify({ registrationOpen: "not-a-bool" }),
      },
    }),
  },

  // Grade Scale (GET)
  {
    file: "src/app/api/v1/grade-scale/route.ts",
    method: "GET",
    pathPattern: "/api/v1/grade-scale",
    allowedRoles: ["STUDENT", "LECTURER", "DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: false,
    buildRequest: () => ({ path: "/api/v1/grade-scale" }),
  },

  // Grade Scale (PUT)
  {
    file: "src/app/api/v1/grade-scale/route.ts",
    method: "PUT",
    pathPattern: "/api/v1/grade-scale",
    allowedRoles: ["SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: () => ({
      path: "/api/v1/grade-scale",
      init: {
        method: "PUT",
        body: JSON.stringify({ bands: [] }),
      },
    }),
  },

  // Users (GET)
  {
    file: "src/app/api/v1/users/route.ts",
    method: "GET",
    pathPattern: "/api/v1/users",
    allowedRoles: ["SUPER_ADMIN"],
    isPublic: false,
    isMutating: false,
    buildRequest: () => ({ path: "/api/v1/users?page=1&pageSize=10" }),
  },

  // Users (POST)
  {
    file: "src/app/api/v1/users/route.ts",
    method: "POST",
    pathPattern: "/api/v1/users",
    allowedRoles: ["SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: () => ({
      path: "/api/v1/users",
      init: {
        method: "POST",
        body: JSON.stringify({ email: "invalid" }),
      },
    }),
  },

  // Users [id] (PATCH)
  {
    file: "src/app/api/v1/users/[id]/route.ts",
    method: "PATCH",
    pathPattern: "/api/v1/users/[id]",
    allowedRoles: ["SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: (f) => ({
      path: `/api/v1/users/${f.userId}`,
      init: {
        method: "PATCH",
        body: JSON.stringify({ email: "invalid-email" }),
      },
    }),
  },

  // Users [id] status (PATCH)
  {
    file: "src/app/api/v1/users/[id]/status/route.ts",
    method: "PATCH",
    pathPattern: "/api/v1/users/[id]/status",
    allowedRoles: ["SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: (f) => ({
      path: `/api/v1/users/${f.userId}/status`,
      init: {
        method: "PATCH",
        body: JSON.stringify({ status: "INVALID_STATUS" }),
      },
    }),
  },

  // Users [id] role (PATCH)
  {
    file: "src/app/api/v1/users/[id]/role/route.ts",
    method: "PATCH",
    pathPattern: "/api/v1/users/[id]/role",
    allowedRoles: ["SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: (f) => ({
      path: `/api/v1/users/${f.userId}/role`,
      init: {
        method: "PATCH",
        body: JSON.stringify({ role: "INVALID_ROLE" }),
      },
    }),
  },

  // Users [id] password (PATCH)
  {
    file: "src/app/api/v1/users/[id]/password/route.ts",
    method: "PATCH",
    pathPattern: "/api/v1/users/[id]/password",
    allowedRoles: ["SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: (f) => ({
      path: `/api/v1/users/${f.userId}/password`,
      init: {
        method: "PATCH",
        body: JSON.stringify({ password: "short" }),
      },
    }),
  },

  // Courses (GET)
  {
    file: "src/app/api/v1/courses/route.ts",
    method: "GET",
    pathPattern: "/api/v1/courses",
    allowedRoles: ["LECTURER", "DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: false,
    buildRequest: () => ({ path: "/api/v1/courses" }),
  },

  // Courses (POST)
  {
    file: "src/app/api/v1/courses/route.ts",
    method: "POST",
    pathPattern: "/api/v1/courses",
    allowedRoles: ["DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: () => ({
      path: "/api/v1/courses",
      init: {
        method: "POST",
        body: JSON.stringify({ code: "", title: "", creditUnits: 0 }),
      },
    }),
  },

  // Courses [id] (PATCH)
  {
    file: "src/app/api/v1/courses/[id]/route.ts",
    method: "PATCH",
    pathPattern: "/api/v1/courses/[id]",
    allowedRoles: ["DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: (f) => ({
      path: `/api/v1/courses/${f.courseId}`,
      init: {
        method: "PATCH",
        body: JSON.stringify({ creditUnits: -1 }),
      },
    }),
  },

  // Course Assignments (GET)
  {
    file: "src/app/api/v1/course-assignments/route.ts",
    method: "GET",
    pathPattern: "/api/v1/course-assignments",
    allowedRoles: ["LECTURER", "DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: false,
    buildRequest: () => ({ path: "/api/v1/course-assignments" }),
  },

  // Course Assignments (POST)
  {
    file: "src/app/api/v1/course-assignments/route.ts",
    method: "POST",
    pathPattern: "/api/v1/course-assignments",
    allowedRoles: ["DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: () => ({
      path: "/api/v1/course-assignments",
      init: {
        method: "POST",
        body: JSON.stringify({ courseId: "", lecturerId: "", semesterId: "" }),
      },
    }),
  },

  // Course Assignments [id] (DELETE)
  {
    file: "src/app/api/v1/course-assignments/[id]/route.ts",
    method: "DELETE",
    pathPattern: "/api/v1/course-assignments/[id]",
    allowedRoles: ["DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: () => ({
      path: "/api/v1/course-assignments/non-existent-id-404",
      init: { method: "DELETE" },
    }),
  },

  // Students (GET)
  {
    file: "src/app/api/v1/students/route.ts",
    method: "GET",
    pathPattern: "/api/v1/students",
    allowedRoles: ["DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: false,
    buildRequest: () => ({ path: "/api/v1/students" }),
  },

  // Students (POST)
  {
    file: "src/app/api/v1/students/route.ts",
    method: "POST",
    pathPattern: "/api/v1/students",
    allowedRoles: ["DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: () => ({
      path: "/api/v1/students",
      init: {
        method: "POST",
        body: JSON.stringify({ email: "invalid" }),
      },
    }),
  },

  // Students [id] (GET)
  {
    file: "src/app/api/v1/students/[id]/route.ts",
    method: "GET",
    pathPattern: "/api/v1/students/[id]",
    allowedRoles: ["DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: false,
    buildRequest: (f) => ({ path: `/api/v1/students/${f.studentId}` }),
  },

  // Students [id] (PATCH)
  {
    file: "src/app/api/v1/students/[id]/route.ts",
    method: "PATCH",
    pathPattern: "/api/v1/students/[id]",
    allowedRoles: ["DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: (f) => ({
      path: `/api/v1/students/${f.studentId}`,
      init: {
        method: "PATCH",
        body: JSON.stringify({ email: "invalid-email" }),
      },
    }),
  },

  // Lecturers (GET)
  {
    file: "src/app/api/v1/lecturers/route.ts",
    method: "GET",
    pathPattern: "/api/v1/lecturers",
    allowedRoles: ["DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: false,
    buildRequest: () => ({ path: "/api/v1/lecturers" }),
  },

  // Lecturers (POST)
  {
    file: "src/app/api/v1/lecturers/route.ts",
    method: "POST",
    pathPattern: "/api/v1/lecturers",
    allowedRoles: ["DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: () => ({
      path: "/api/v1/lecturers",
      init: {
        method: "POST",
        body: JSON.stringify({ email: "invalid" }),
      },
    }),
  },

  // Lecturers [id] (GET)
  {
    file: "src/app/api/v1/lecturers/[id]/route.ts",
    method: "GET",
    pathPattern: "/api/v1/lecturers/[id]",
    allowedRoles: ["DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: false,
    buildRequest: (f) => ({ path: `/api/v1/lecturers/${f.lecturerId}` }),
  },

  // Lecturers [id] (PATCH)
  {
    file: "src/app/api/v1/lecturers/[id]/route.ts",
    method: "PATCH",
    pathPattern: "/api/v1/lecturers/[id]",
    allowedRoles: ["DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: (f) => ({
      path: `/api/v1/lecturers/${f.lecturerId}`,
      init: {
        method: "PATCH",
        body: JSON.stringify({ email: "invalid-email" }),
      },
    }),
  },

  // Course Registrations (GET)
  {
    file: "src/app/api/v1/registrations/route.ts",
    method: "GET",
    pathPattern: "/api/v1/registrations",
    allowedRoles: ["STUDENT", "LECTURER", "DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: false,
    buildRequest: () => ({ path: "/api/v1/registrations" }),
  },

  // Course Registrations (POST)
  {
    file: "src/app/api/v1/registrations/route.ts",
    method: "POST",
    pathPattern: "/api/v1/registrations",
    allowedRoles: ["STUDENT"],
    isPublic: false,
    isMutating: true,
    buildRequest: () => ({
      path: "/api/v1/registrations",
      init: {
        method: "POST",
        body: JSON.stringify({ courseIds: [] }),
      },
    }),
  },

  // Available courses for registration (GET)
  {
    file: "src/app/api/v1/registrations/available/route.ts",
    method: "GET",
    pathPattern: "/api/v1/registrations/available",
    allowedRoles: ["STUDENT"],
    isPublic: false,
    isMutating: false,
    buildRequest: () => ({ path: "/api/v1/registrations/available" }),
  },

  // Registration drop (DELETE)
  {
    file: "src/app/api/v1/registrations/[id]/route.ts",
    method: "DELETE",
    pathPattern: "/api/v1/registrations/[id]",
    allowedRoles: ["STUDENT"],
    isPublic: false,
    isMutating: true,
    buildRequest: () => ({
      path: "/api/v1/registrations/non-existent-id-404",
      init: { method: "DELETE" },
    }),
  },

  // Student Results & CGPA (GET)
  {
    file: "src/app/api/v1/results/route.ts",
    method: "GET",
    pathPattern: "/api/v1/results",
    allowedRoles: ["STUDENT"],
    isPublic: false,
    isMutating: false,
    buildRequest: () => ({ path: "/api/v1/results" }),
  },

  // Results score sheet (GET)
  {
    file: "src/app/api/v1/results/sheet/route.ts",
    method: "GET",
    pathPattern: "/api/v1/results/sheet",
    allowedRoles: ["LECTURER", "DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: false,
    buildRequest: (f) => ({
      path: `/api/v1/results/sheet?courseId=${f.courseId}&semesterId=${f.semesterId}`,
    }),
  },

  // Results draft save (POST)
  {
    file: "src/app/api/v1/results/draft/route.ts",
    method: "POST",
    pathPattern: "/api/v1/results/draft",
    allowedRoles: ["LECTURER"],
    isPublic: false,
    isMutating: true,
    buildRequest: (f) => ({
      path: "/api/v1/results/draft",
      init: {
        method: "POST",
        body: JSON.stringify({
          courseId: f.courseId,
          semesterId: f.semesterId,
          entries: [{ registrationId: "invalid", caScore: 999, examScore: 999 }],
        }),
      },
    }),
  },

  // Results submit (POST)
  {
    file: "src/app/api/v1/results/submit/route.ts",
    method: "POST",
    pathPattern: "/api/v1/results/submit",
    allowedRoles: ["LECTURER"],
    isPublic: false,
    isMutating: true,
    buildRequest: () => ({
      path: "/api/v1/results/submit",
      init: {
        method: "POST",
        body: JSON.stringify({ courseId: "", semesterId: "" }),
      },
    }),
  },

  // Results submissions list (GET)
  {
    file: "src/app/api/v1/results/submissions/route.ts",
    method: "GET",
    pathPattern: "/api/v1/results/submissions",
    allowedRoles: ["DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: false,
    buildRequest: () => ({ path: "/api/v1/results/submissions" }),
  },

  // Results approve (POST)
  {
    file: "src/app/api/v1/results/approve/route.ts",
    method: "POST",
    pathPattern: "/api/v1/results/approve",
    allowedRoles: ["DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: () => ({
      path: "/api/v1/results/approve",
      init: {
        method: "POST",
        body: JSON.stringify({ resultIds: [] }),
      },
    }),
  },

  // Results return (POST)
  {
    file: "src/app/api/v1/results/return/route.ts",
    method: "POST",
    pathPattern: "/api/v1/results/return",
    allowedRoles: ["DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: () => ({
      path: "/api/v1/results/return",
      init: {
        method: "POST",
        body: JSON.stringify({ resultIds: [], feedback: "no" }),
      },
    }),
  },

  // Results reopen (POST)
  {
    file: "src/app/api/v1/results/reopen/route.ts",
    method: "POST",
    pathPattern: "/api/v1/results/reopen",
    allowedRoles: ["DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: true,
    buildRequest: () => ({
      path: "/api/v1/results/reopen",
      init: {
        method: "POST",
        body: JSON.stringify({ resultIds: [], reason: "no" }),
      },
    }),
  },

  // Result history (GET)
  {
    file: "src/app/api/v1/results/[id]/history/route.ts",
    method: "GET",
    pathPattern: "/api/v1/results/[id]/history",
    allowedRoles: ["LECTURER", "DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: false,
    buildRequest: (f) => ({ path: `/api/v1/results/${f.resultId}/history` }),
  },

  // Audit logs (GET)
  {
    file: "src/app/api/v1/audit-logs/route.ts",
    method: "GET",
    pathPattern: "/api/v1/audit-logs",
    allowedRoles: ["DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: false,
    buildRequest: () => ({ path: "/api/v1/audit-logs?page=1&pageSize=10" }),
  },

  // Reports: Students (GET)
  {
    file: "src/app/api/v1/reports/students/route.ts",
    method: "GET",
    pathPattern: "/api/v1/reports/students",
    allowedRoles: ["DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: false,
    buildRequest: () => ({ path: "/api/v1/reports/students" }),
  },

  // Reports: Registrations (GET)
  {
    file: "src/app/api/v1/reports/registrations/route.ts",
    method: "GET",
    pathPattern: "/api/v1/reports/registrations",
    allowedRoles: ["LECTURER", "DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: false,
    buildRequest: () => ({ path: "/api/v1/reports/registrations" }),
  },

  // Reports: Performance (GET)
  {
    file: "src/app/api/v1/reports/performance/route.ts",
    method: "GET",
    pathPattern: "/api/v1/reports/performance",
    allowedRoles: ["LECTURER", "DEPARTMENT_ADMIN", "SUPER_ADMIN"],
    isPublic: false,
    isMutating: false,
    buildRequest: () => ({ path: "/api/v1/reports/performance" }),
  },
];
