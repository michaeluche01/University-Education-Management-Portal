# UEMP Build Progress

## Phase 1: Scaffold + Schema + Skeleton Deploy

### What Was Built
- **Housekeeping & Project Layout**:
  - Moved `REQUIREMENTS.md` to `docs/REQUIREMENTS.md` (single copy).
  - Created `docs/DECISIONS.md` with Decisions D1–D11 verbatim and referenced it in `AGENTS.md`.
  - Moved `app/` to `src/app/` and updated `tsconfig.json` path alias `"@/*": ["./src/*"]`.
- **Dependencies & UI Primitives**:
  - Installed `prisma@7.10.1`, `@prisma/client@7.10.1`, `@prisma/adapter-pg@7.10.1`, `@prisma/adapter-neon@7.10.1`, `@neondatabase/serverless`, `pg`, `ws`, `bcryptjs`, `jose`, `zod`, `lucide-react`, `sonner`, `vitest`, `dotenv-cli`, and `tsx`.
  - Initialized `shadcn/ui` with `button`, `card`, `input`, `label`, `table`, `dialog`, and `sonner`.
- **Database Schema & Migrations (`Prisma 7.10.1`)**:
  - Created `prisma.config.ts` and `prisma/schema.prisma` with generator output `../src/generated/prisma`, all 16 domain models, 5 enums (including expanded `AuditAction`), `User` lockout fields (`failedLoginCount`, `lockedUntil`), and `AuditLog.departmentId` with index.
  - Created initial SQL migration `prisma/migrations/20261110000000_init/migration.sql` and partial unique index migration `prisma/migrations/20261110000001_partial_unique_current_session_semester/migration.sql` enforcing at most one `AcademicSession` and one `Semester` with `isCurrent = true`.
  - Created `src/server/db/prisma.ts` using Prisma 7 `PrismaPg` driver adapter.
  - Created `.env.example` and configured `.gitignore` to ignore `.env*` except `!.env.example`.
  - Added npm scripts `postinstall`, `db:migrate:dev`, `db:migrate:prod` (guarded by `CONFIRM_PROD=yes`), `db:seed`, and `db:seed:prod` (guarded by `CONFIRM_PROD=yes`).
- **Health Endpoint, Landing Page & Transaction Smoke Script**:
  - Created `GET /api/health` (`src/app/api/health/route.ts`) running `SELECT 1` and returning `{ ok: true }`.
  - Updated `src/app/page.tsx` and `src/app/layout.tsx` with the UEMP landing card.
  - Created `scripts/smoke-tx.ts` to test interactive `prisma.$transaction` creation and rollback against the pooled `DATABASE_URL`.

### Files Added / Modified
- `AGENTS.md`
- `docs/REQUIREMENTS.md`
- `docs/DECISIONS.md`
- `docs/PROGRESS.md`
- `.env.example`
- `.gitignore`
- `package.json`
- `tsconfig.json`
- `components.json`
- `prisma.config.ts`
- `prisma/schema.prisma`
- `prisma/migrations/migration_lock.toml`
- `prisma/migrations/20261110000000_init/migration.sql`
- `prisma/migrations/20261110000001_partial_unique_current_session_semester/migration.sql`
- `src/server/db/prisma.ts`
- `src/app/api/health/route.ts`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/globals.css`
- `src/components/ui/{button,card,dialog,input,label,sonner,table}.tsx`
- `src/lib/utils.ts`
- `scripts/smoke-tx.ts`

### Known Gaps / Pending Environment Setup
- Verified live Neon DEV branch migration (`npm run db:migrate:dev`) and interactive transaction smoke test (`npx tsx scripts/smoke-tx.ts` -> `{"ok":true,"createdInsideTx":true,"rolledBackCleanly":true}`).

---

## Phase 2: Auth + RBAC Core + Shared UI Shell + Seed

### What Was Built
- **Auth & RBAC Core (`src/server/auth/*`, `src/lib/*`, `src/server/services/*`)**:
  - `src/server/auth/jwt.ts`: `jose` HS256 JWT signing/verification with `SESSION_SECRET` (validated >= 32 chars at startup), 8-hour expiry, `{ sub: userId }` payload, and `uemp_session` cookie (`httpOnly`, `Secure` in production, `SameSite=Lax`, `path="/"`).
  - `src/server/auth/rbac.ts`: `getSession()`, `requireAuth()`, and `requireRole(roles)` reloading the user and role profile (`studentId`, `lecturerId`, `departmentId`, `programId`, `levelId`) from PostgreSQL on every call and rejecting missing or non-`ACTIVE` accounts with `401`.
  - `src/server/auth/policies.ts`: `assertDepartmentScope` and `assertLecturerCourseAssignment` throwing `403` for out-of-scope access.
  - `src/lib/errors.ts`: `AppError` (`400`/`401`/`403`/`404`/`409`/`423`) and `okResponse` / `handleApiError` mappers (automatically clearing `uemp_session` cookie on `401` in route handlers).
  - `src/lib/origin.ts`: `assertSameOrigin(request)` enforcing same-origin `Origin` header on mutating routes.
  - `src/server/services/audit.service.ts`: append-only `writeAudit(tx, ...)` transactional helper.
  - `src/server/services/grading.service.ts`: pure `lookupGrade(totalScore, scaleRows)` function (D4) with Vitest boundary tests in `tests/unit/grading.test.ts` (`0, 39.5, 40, 44.9, 45, 69.5, 70, 100`).
- **Auth Endpoints & Validators (`src/lib/validators/auth.ts`, `src/app/api/v1/auth/*`)**:
  - `POST /api/v1/auth/login`: checks `lockedUntil` first (`423`), runs timing-safe dummy bcrypt comparison for unknown email, increments `failedLoginCount` and locks for 15 minutes at 5 attempts (`USER_LOGIN_FAILED`), verifies `ACTIVE` status after password match (`403` for `SUSPENDED`/`DEACTIVATED`), resets lockout counters, writes `USER_LOGIN`, sets `uemp_session` cookie, and returns role + dashboard path.
  - `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, `PATCH /api/v1/auth/password` (`USER_PASSWORD_CHANGED`), and `GET /api/v1/auth/clear-session`.
- **UI & Proxy (`src/proxy.ts`, `/login`, `(portal)` Shell & Role Dashboards)**:
  - `src/proxy.ts`: Next.js 16 Proxy convention verifying JWT signature for UX redirects.
  - Server-side `requireRole([...])` enforced in `src/app/(portal)/{student,lecturer,dept-admin,super-admin}/layout.tsx`.
  - Responsive portal shell (`src/components/layout/PortalShell.tsx` & `src/app/(portal)/layout.tsx`) with desktop sidebar, mobile drawer (`375px`), role badge, and logout button, plus placeholder dashboards for all 4 roles.
  - `/login` page with loading/error states and demo credential quick-fill buttons for all 4 roles; `/` redirects signed-in users to their dashboard.
  - Shared UI components under `src/components/shared/{EmptyState,ErrorState,LoadingSkeleton,PageHeader}.tsx`.
- **Idempotent Seed (`prisma/seed.ts`) & Verification (`tests/rbac/*`)**:
  - Implemented `prisma/seed.ts` with production host guard (`PROD_DB_HOST` / `CONFIRM_PROD`), 5.0 `GradeScale`, levels `100`–`400`, 2 faculties (`FSC`, `FENG`), 4 departments (`CSC`, `MTH`, `EEE`, `CVE`), 4 programs, 2 sessions (`2025/2026` previous, `2026/2027` current), 31 users (`1` Super Admin, `2` Dept Admins, `4` Lecturers, `24` Students), 18 courses, 14 assignments, 105 registrations, 88 results, and 235 audit logs covering Scenarios S1–S8.
  - Added `tests/rbac/helpers.ts` and `tests/rbac/auth.test.ts` plus `npm run test:unit` and `npm run test:rbac`.

### Files Added / Modified
- `package.json`
- `docs/PROGRESS.md`
- `prisma/seed.ts`
- `src/proxy.ts`
- `src/lib/errors.ts`
- `src/lib/origin.ts`
- `src/lib/validators/auth.ts`
- `src/server/auth/jwt.ts`
- `src/server/auth/rbac.ts`
- `src/server/auth/policies.ts`
- `src/server/services/audit.service.ts`
- `src/server/services/grading.service.ts`
- `src/server/services/auth.service.ts`
- `src/app/api/v1/auth/login/route.ts`
- `src/app/api/v1/auth/logout/route.ts`
- `src/app/api/v1/auth/me/route.ts`
- `src/app/api/v1/auth/password/route.ts`
- `src/app/api/v1/auth/clear-session/route.ts`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/app/(portal)/layout.tsx`
- `src/app/(portal)/student/{layout,page}.tsx`
- `src/app/(portal)/lecturer/{layout,page}.tsx`
- `src/app/(portal)/dept-admin/{layout,page}.tsx`
- `src/app/(portal)/super-admin/{layout,page}.tsx`
- `src/components/layout/PortalShell.tsx`
- `src/components/shared/{EmptyState,ErrorState,LoadingSkeleton,PageHeader}.tsx`
- `tests/unit/grading.test.ts`
- `tests/rbac/helpers.ts`
- `tests/rbac/auth.test.ts`

### Known Gaps
- None for Phase 2. Phase 3+ screens and endpoints are scheduled for subsequent phases per Decision D1.
- **Regression Fix (`fix: login/logout stuck loading state`)**: With Next.js 16 `cacheComponents: true`, client pages remain mounted inside hidden `<Activity>` boundaries across client-side navigations. Previously, `LoginPage` only called `setSubmitting(false)` on error and used `router.push(dashboardPath)` on success, while `PortalShell.handleLogout` used `router.push("/login")`, restoring the cached `LoginPage` instance with `submitting === true` and stale `email`/`password` state. Fixed by wrapping `LoginPage.handleSubmit` in `try/catch/finally` (always resetting `submitting` and clearing `password`, plus clearing `email` and calling `router.replace(dashboardPath)` on success) and changing `PortalShell.handleLogout` to use `window.location.assign("/login")` inside `try/catch/finally`.

---

## Phase 3a: Super Admin Structure Management

### What Was Built
- **Prisma Error Mapping (`src/lib/errors.ts`)**:
  - Updated `handleApiError` to map Prisma `P2002` to `409 CONFLICT_DUPLICATE ("A record with this value already exists.")`, `P2003` / `P2014` to `409 CONFLICT_IN_USE ("Record is in use by other records.")`, and `P2025` to `404 NOT_FOUND`.
- **Structure Validators & Pure Functions (`src/lib/validators/structure.ts`, `tests/unit/structure-validators.test.ts`)**:
  - Added Zod schemas for faculties, departments, programs (`B.Sc.`/`B.Eng.`/`B.Tech.`/`B.A.`), global academic levels (`100`–`900`, multiples of `100`), academic sessions (`validateSessionName` enforcing `YYYY/YYYY+1` and `startDate < endDate`), semesters (`isCurrent !== false`), and grade scale replacement (`validateAndDeriveGradeScale` enforcing >= 2 bands, `minScore: 0` band, unique grades/minScores, monotonic `gradePoint`, and derived `maxScore`).
- **Session-Scoped Services (`src/server/services/*`)**:
  - `faculty.service.ts`, `department.service.ts`, `program.service.ts` (enforcing `assertDepartmentScope` for Phase 4 reuse), `level.service.ts`, `session.service.ts` (auto-creating `FIRST` and `SECOND` semesters on session creation and clearing old `isCurrent` rows inside transactions), `grade-scale.service.ts` (writing `GRADE_SCALE_UPDATED` audit log), and `admin-dashboard.service.ts` (8 real DB stat counts).
- **REST Endpoints (`/api/v1/*`)**:
  - `GET/POST /api/v1/faculties` & `PATCH /api/v1/faculties/[id]`
  - `GET/POST /api/v1/departments` & `PATCH /api/v1/departments/[id]`
  - `GET/POST /api/v1/programs` & `PATCH /api/v1/programs/[id]`
  - `GET/POST /api/v1/levels`
  - `GET/POST /api/v1/sessions` & `PATCH /api/v1/sessions/[id]`
  - `PATCH /api/v1/semesters/[id]`
  - `GET/PUT /api/v1/grade-scale`
- **Super Admin UI & Navigation (`src/app/(portal)/super-admin/*`, `src/components/layout/PortalShell.tsx`)**:
  - Updated `/super-admin` dashboard with 8 live DB stat cards.
  - Built `/super-admin/faculties`, `/super-admin/departments`, `/super-admin/programs` (with global Academic Levels section), `/super-admin/sessions` (with nested semesters, "Make current", and registration toggle confirmation dialog), and `/super-admin/grade-scale` (with live validation and Reset to default 5.0 scale).
- **RBAC Integration Suite (`tests/rbac/structure.test.ts`)**:
  - 28 integration tests covering 401/403 on all mutations, foreign `Origin` rejection, `DEPARTMENT_ADMIN` read scoping, `SUPER_ADMIN` CRUD + `409` duplicate handling, single `isCurrent` session/semester invariant, and grade scale validation/derivation.

### Files Added / Modified
- `docs/PROGRESS.md`
- `src/lib/errors.ts`
- `src/lib/validators/structure.ts`
- `src/server/services/faculty.service.ts`
- `src/server/services/department.service.ts`
- `src/server/services/program.service.ts`
- `src/server/services/level.service.ts`
- `src/server/services/session.service.ts`
- `src/server/services/grade-scale.service.ts`
- `src/server/services/admin-dashboard.service.ts`
- `src/app/api/v1/faculties/route.ts`
- `src/app/api/v1/faculties/[id]/route.ts`
- `src/app/api/v1/departments/route.ts`
- `src/app/api/v1/departments/[id]/route.ts`
- `src/app/api/v1/programs/route.ts`
- `src/app/api/v1/programs/[id]/route.ts`
- `src/app/api/v1/levels/route.ts`
- `src/app/api/v1/sessions/route.ts`
- `src/app/api/v1/sessions/[id]/route.ts`
- `src/app/api/v1/semesters/[id]/route.ts`
- `src/app/api/v1/grade-scale/route.ts`
- `src/components/layout/PortalShell.tsx`
- `src/app/(portal)/super-admin/page.tsx`
- `src/app/(portal)/super-admin/faculties/page.tsx`
- `src/app/(portal)/super-admin/departments/page.tsx`
- `src/app/(portal)/super-admin/programs/page.tsx`
- `src/app/(portal)/super-admin/sessions/page.tsx`
- `src/app/(portal)/super-admin/grade-scale/page.tsx`
- `tests/unit/structure-validators.test.ts`
- `tests/rbac/structure.test.ts`

### Known Gaps
- None for Phase 3a.

---

## Phase 3b: Super Admin Users Management

### What Was Built
- **User Validators (`src/lib/validators/user.ts`)**:
  - `listUsersQuerySchema` (`page`, `pageSize` max 50, `role`, `status`, `departmentId`, `search`).
  - `createUserSchema` (lowercased `email`, `fullName`, `phone`, temporary `password` min 8 chars, `role`, and role-conditional profile fields with uppercased `matricNumber`/`staffId`).
  - `updateUserSchema`, `updateUserStatusSchema`, `updateUserRoleSchema` (enforcing Decision D6: never to/from `STUDENT`, requiring `departmentId` and `staffId` for `LECTURER` and `DEPARTMENT_ADMIN`), and `resetUserPasswordSchema`.
- **Scoped Profile & User Services (`src/server/services/{student,lecturer,user}.service.ts`)**:
  - `SAFE_USER_SELECT` & `serializeUser` ensuring `passwordHash`, `failedLoginCount`, and `lockedUntil` are never selected or returned in API responses.
  - `student.service.ts` (`validateStudentDepartmentProgramLevel`, `assertCanMoveStudentDepartmentOrProgram`, `listStudentsScoped`) and `lecturer.service.ts` (`assertCanMoveLecturerDepartment`, `assertCanConvertFromLecturer`, `listLecturersScoped`) reusable by `DEPARTMENT_ADMIN` in Phase 4.
  - `user.service.ts`: `listUsers`, `createUser` (`USER_CREATED`), `updateUser` (`USER_UPDATED`), `updateUserStatus` (`USER_STATUS_CHANGED`, self-guard + last-active-`SUPER_ADMIN` guard + lockout reset on `ACTIVE`), `updateUserRole` (`USER_ROLE_CHANGED`, Decision D6 enforcement), and `adminResetUserPassword` (`USER_PASSWORD_CHANGED`).
- **REST Endpoints (`/api/v1/users*`)**:
  - `GET/POST /api/v1/users`
  - `PATCH /api/v1/users/[id]`
  - `PATCH /api/v1/users/[id]/status`
  - `PATCH /api/v1/users/[id]/role`
  - `PATCH /api/v1/users/[id]/password`
- **Super Admin Users UI (`/super-admin/users`)**:
  - Added `"Users"` link to `PortalShell.tsx` under `SUPER_ADMIN`.
  - Built `/super-admin/users` with search, role/status/department filters, pagination, dynamic role-aware Create User dialog (filtering programs by selected department), Edit User dialog, Change Status dialog (with audit reason), Change Role dialog (for non-student rows), and Reset Password dialog.
- **RBAC Integration Suite (`tests/rbac/users.test.ts`, `vitest.config.mts`)**:
  - 16 integration tests covering `401`/`403` on all `/api/v1/users*` endpoints, paginated list without sensitive fields, creating student & lecturer, duplicate email/matric (`409`), program/department mismatch (`400`), suspend (`login -> 403`) & reactivate (`login -> 200`), self-status & last-active-super-admin guards, password reset, and Decision D6 role conversion rules.

### Files Added / Modified
- `docs/PROGRESS.md`
- `vitest.config.mts`
- `src/server/db/prisma.ts`
- `src/lib/validators/user.ts`
- `src/server/services/student.service.ts`
- `src/server/services/lecturer.service.ts`
- `src/server/services/user.service.ts`
- `src/app/api/v1/users/route.ts`
- `src/app/api/v1/users/[id]/route.ts`
- `src/app/api/v1/users/[id]/status/route.ts`
- `src/app/api/v1/users/[id]/role/route.ts`
- `src/app/api/v1/users/[id]/password/route.ts`
- `src/components/layout/PortalShell.tsx`
- `src/app/(portal)/super-admin/users/page.tsx`
- `tests/rbac/users.test.ts`

### Known Gaps
- None for Phase 3. Courses, course assignments, and Department Admin student/lecturer management are scheduled for Phase 4 per Decision D1.

---

## Phase 4a: Courses and Course Assignments

### What Was Built
- **Decision D12 (`docs/DECISIONS.md`)**:
  - Documented the one-lecturer-per-course-per-semester rule (`409` if an assignment already exists; unassign first, which is blocked with `409` if any `Result` rows exist for that course and semester).
- **Strict Course & Assignment Validators (`src/lib/validators/course.ts`, `tests/unit/course-validators.test.ts`)**:
  - Added pure function `normalizeCourseCode` (`"csc  301"` -> `"CSC 301"`) and `.strict()` Zod schemas `listCoursesQuerySchema`, `createCourseSchema`, `updateCourseSchema`, `listCourseAssignmentsQuerySchema`, and `createCourseAssignmentSchema`.
- **Course & Assignment Services (`src/server/services/{course,course-assignment}.service.ts`)**:
  - `course.service.ts`: scoped `listCourses` (`SUPER_ADMIN` all, `DEPARTMENT_ADMIN` own department, `LECTURER` assigned courses only, `STUDENT` `403`), `createCourse`, and `updateCourse` with structural immutability guards (`409` if changing `departmentId`, `programId`, `levelId`, or `semesterName` when assignments/registrations/results exist, or `creditUnits` when results exist).
  - `course-assignment.service.ts`: scoped `listCourseAssignments`, `createCourseAssignment` (`COURSE_ASSIGNED`, enforcing department match, semester match, current session, active course & lecturer, and Decision D12 single lecturer per course/semester), and `deleteCourseAssignment` (`COURSE_UNASSIGNED`, blocking with `409` if results exist).
- **REST Endpoints (`/api/v1/courses*`, `/api/v1/course-assignments*`)**:
  - `GET/POST /api/v1/courses` & `PATCH /api/v1/courses/[id]`
  - `GET/POST /api/v1/course-assignments` & `DELETE /api/v1/course-assignments/[id]`
- **Shared CoursesManager UI (`src/components/admin/CoursesManager.tsx`)**:
  - Mounted at `/super-admin/courses` and `/dept-admin/courses`, and added `"Courses"` to `PortalShell.tsx` under both `SUPER_ADMIN` and `DEPARTMENT_ADMIN`.

### Files Added / Modified
- `docs/DECISIONS.md`
- `docs/PROGRESS.md`
- `src/lib/validators/course.ts`
- `src/server/services/course.service.ts`
- `src/server/services/course-assignment.service.ts`
- `src/app/api/v1/courses/route.ts`
- `src/app/api/v1/courses/[id]/route.ts`
- `src/app/api/v1/course-assignments/route.ts`
- `src/app/api/v1/course-assignments/[id]/route.ts`
- `src/components/admin/CoursesManager.tsx`
- `src/app/(portal)/super-admin/courses/page.tsx`
- `src/app/(portal)/dept-admin/courses/page.tsx`
- `src/components/layout/PortalShell.tsx`
- `tests/unit/course-validators.test.ts`

### Known Gaps
- None for Phase 4a.

---

## Phase 4b: Department Admin Module & Scope Isolation

### What Was Built
- **Department Admin Program Mutations (`src/lib/validators/structure.ts`, `src/server/services/program.service.ts`, `src/app/api/v1/programs*`)**:
  - Made `createProgramSchema` and `updateProgramSchema` `.strict()` with optional `departmentId` on create so `DEPARTMENT_ADMIN` is forced to their own department (`403` if another department is supplied).
  - Opened `POST /api/v1/programs` and `PATCH /api/v1/programs/[id]` to `DEPARTMENT_ADMIN` within their own department.
- **Strict Student & Lecturer Validators & Services (`src/lib/validators/member.ts`, `src/server/services/{student,lecturer}.service.ts`)**:
  - `.strict()` Zod schemas for listing, creating (`User` + profile in one transaction with `USER_CREATED` audit), and updating (`USER_UPDATED` audit) students and lecturers by profile ID (`Student.id` / `Lecturer.id`), rejecting unknown/forbidden fields (`role`, `email`, `status`, `password`, `matricNumber`, `staffId`, `departmentId`) with `400`.
  - Enforced `assertDepartmentScope` (`403` for out-of-scope `GET`/`PATCH`), program-belongs-to-department validation (`400`), and immutability of `programId` when registrations or results exist (`409`).
- **REST Endpoints (`/api/v1/students*`, `/api/v1/lecturers*`)**:
  - `GET/POST /api/v1/students` & `GET/PATCH /api/v1/students/[id]`
  - `GET/POST /api/v1/lecturers` & `GET/PATCH /api/v1/lecturers/[id]`
- **Department Admin Dashboard & Shared Manager UIs**:
  - `getDeptAdminDashboardStats` in `src/server/services/admin-dashboard.service.ts` and 7 stat cards in `/dept-admin` (`src/app/(portal)/dept-admin/page.tsx`).
  - Shared `ProgramsManager` (`src/components/admin/ProgramsManager.tsx`) mounted at `/super-admin/programs` and `/dept-admin/programs`.
  - Shared `StudentsManager` (`src/components/admin/StudentsManager.tsx`) mounted at `/dept-admin/students`.
  - Shared `LecturersManager` (`src/components/admin/LecturersManager.tsx`) mounted at `/dept-admin/lecturers`.
  - Added `"Programs"`, `"Students"`, and `"Lecturers"` to `DEPARTMENT_ADMIN` navigation in `src/components/layout/PortalShell.tsx`.
- **Department Scope RBAC Suite (`tests/rbac/dept-scope.test.ts`)**:
  - 30 integration tests covering `401`/`403`/foreign `Origin` (`403`), course creation/normalisation/duplicate (`409`)/structural immutability (`409`), lecturer assigned courses view, D12 single-lecturer per course/semester (`409`), cross-department lecturer assignment (`403`), semester mismatch (`400`), result-in-use unassign block (`409`), and CSC vs MTH isolation on programs, students, and lecturers.

### Files Added / Modified
- `docs/PROGRESS.md`
- `src/lib/validators/structure.ts`
- `src/lib/validators/member.ts`
- `src/server/services/program.service.ts`
- `src/server/services/student.service.ts`
- `src/server/services/lecturer.service.ts`
- `src/server/services/admin-dashboard.service.ts`
- `src/app/api/v1/programs/route.ts`
- `src/app/api/v1/programs/[id]/route.ts`
- `src/app/api/v1/students/route.ts`
- `src/app/api/v1/students/[id]/route.ts`
- `src/app/api/v1/lecturers/route.ts`
- `src/app/api/v1/lecturers/[id]/route.ts`
- `src/components/admin/ProgramsManager.tsx`
- `src/components/admin/StudentsManager.tsx`
- `src/components/admin/LecturersManager.tsx`
- `src/app/(portal)/super-admin/programs/page.tsx`
- `src/app/(portal)/dept-admin/page.tsx`
- `src/app/(portal)/dept-admin/programs/page.tsx`
- `src/app/(portal)/dept-admin/students/page.tsx`
- `src/app/(portal)/dept-admin/lecturers/page.tsx`
- `src/components/layout/PortalShell.tsx`
- `tests/rbac/dept-scope.test.ts`

### Known Gaps
- None for Phase 4.

---

## Phase 5: Student Course Registration, Profile, Print Slip & Admin Registration Views

### What Was Built
- **Registration Eligibility & Strict Validators (`src/lib/validators/registration.ts`, `src/lib/validators/profile.ts`, `tests/unit/registration-eligibility.test.ts`)**:
  - Pure function `evaluateCourseEligibility(student, course, currentSemester, isAlreadyRegistered)` shared between service and unit tests.
  - `.strict()` Zod schemas `createRegistrationBatchSchema` (1–20 unique `courseIds`) and `listRegistrationsQuerySchema`.
  - Role-specific `.strict()` profile patch schemas (`studentProfilePatchSchema`, `lecturerProfilePatchSchema`, `adminProfilePatchSchema`) rejecting unknown/forbidden fields (`role`, `matricNumber`, `departmentId`, `levelId`, `email`, etc.) with `400`.
- **Registration & Profile Services (`src/server/services/{registration,profile}.service.ts`)**:
  - `getAvailableCoursesForStudent`: returns eligible active courses for the student's `departmentId`, `programId`, `levelId`, and `currentSemester.name`, marking `alreadyRegistered`, `hasResult`, and `assignedLecturerName`, plus structured `state` (`"open"`, `"registrationClosed"`, or `"noCurrentSemester"`).
  - `registerStudentCourses`: atomic batch registration inside one `prisma.$transaction`, rejecting the entire batch with `400` if any course fails eligibility (`409` for duplicate or race condition via `@@unique([studentId, courseId, semesterId])`), and writing `REGISTRATION_CREATED` `AuditLog` per row.
  - `dropStudentRegistration`: allows dropping own registration only when `semester.isCurrent && semester.registrationOpen && !result` (`403` for another student's row, `409` when closed or result exists), writing `REGISTRATION_DELETED` `AuditLog`.
  - `listRegistrations`: role-aware (`STUDENT` own rows with `canDrop` and `totalCreditUnits`, `LECTURER` class list for assigned `(courseId, semesterId)` with `assertLecturerCourseAssignment` and no scores, `DEPARTMENT_ADMIN` own department, `SUPER_ADMIN` university-wide).
  - `getOwnProfile` and `updateOwnProfile` with `USER_UPDATED` audit logging.
- **REST Endpoints (`/api/v1/registrations*`, `/api/v1/profile`)**:
  - `GET /api/v1/registrations/available`
  - `GET/POST /api/v1/registrations`
  - `DELETE /api/v1/registrations/[id]`
  - `GET/PATCH /api/v1/profile`
- **Student & Admin Registration UIs**:
  - `/student` dashboard (`src/app/(portal)/student/page.tsx`)
  - `/student/profile` (`src/app/(portal)/student/profile/page.tsx`)
  - `/student/courses` (`src/app/(portal)/student/courses/page.tsx`)
  - `/student/print/registration` (`src/app/(portal)/student/print/registration/page.tsx`)
  - Shared `RegistrationsView` (`src/components/admin/RegistrationsView.tsx`) mounted at `/dept-admin/registrations` and `/super-admin/registrations`.
  - Updated `PortalShell.tsx` navigation for `STUDENT`, `DEPARTMENT_ADMIN`, and `SUPER_ADMIN`.
- **Registration RBAC Integration Suite (`tests/rbac/registration.test.ts`)**:
  - Integration tests using `student10@uemp.demo` (Scenario S7) covering eligible registration & multi-role visibility (`student10`, `CSC` admin, `SUPER_ADMIN`, hidden from `MTH` admin), level/dept/program mismatches (`400`), duplicate (`409`), atomic batch rollback (`400`), `Promise.all` concurrent race (`[201, 409]`), closed registration window (`409`), drop rules (`200` own without result, `409` with result, `403` another student's), lecturer class list (`200` assigned, `403` unassigned), and profile field smuggling (`400`).

### Files Added / Modified
- `docs/PROGRESS.md`
- `src/lib/validators/registration.ts`
- `src/lib/validators/profile.ts`
- `src/server/services/registration.service.ts`
- `src/server/services/profile.service.ts`
- `src/app/api/v1/registrations/available/route.ts`
- `src/app/api/v1/registrations/route.ts`
- `src/app/api/v1/registrations/[id]/route.ts`
- `src/app/api/v1/profile/route.ts`
- `src/app/(portal)/student/page.tsx`
- `src/app/(portal)/student/profile/page.tsx`
- `src/app/(portal)/student/courses/page.tsx`
- `src/app/(portal)/student/print/registration/page.tsx`
- `src/components/admin/RegistrationsView.tsx`
- `src/app/(portal)/dept-admin/registrations/page.tsx`
- `src/app/(portal)/super-admin/registrations/page.tsx`
- `src/components/layout/PortalShell.tsx`
- `tests/unit/registration-eligibility.test.ts`
- `tests/rbac/registration.test.ts`

### Known Gaps
- None for Phase 5.

---

## Phase 6: Grading & Lecturer Results

### What Was Built
- **Pure Score Arithmetic & GPA / CGPA Calculations (`src/server/services/grading.service.ts`, `tests/unit/grading.test.ts`)**:
  - Pure integer arithmetic score processing (`0 <= CA <= 30`, `0 <= Exam <= 70`, at most 2 decimal places, integer hundredths arithmetic, `roundHalfUp2Decimals`), preventing JavaScript floating-point errors (e.g., `0.1 + 0.2 = 0.30`).
  - Pure `calculateWeightedGpa`, `calculateSemesterGpa`, and `calculateCgpa` functions using credit-unit weighting (`sum(gp * units) / sum(units)` rounded half-up to 2 decimals, returning `null` when credit units are zero).
  - 20 unit tests in `tests/unit/grading.test.ts` testing all grade scale boundaries (`39.99`, `40`, `44.99`, `45`, `69.99`, `70`), `x.xx5` midpoint rounding, `F` grades pulling down GPA, and empty/zero-unit edge cases.
- **Strict Zod Validators (`src/lib/validators/result.ts`)**:
  - Strict `.strict()` schemas rejecting client-smuggled fields (`totalScore`, `grade`, `gradePoint`, `status`, `studentId`, `enteredById`, etc.) with `400`.
  - `saveDraftResultsSchema` validating array of 1–500 score entries.
  - `submitResultsSchema` validating `courseId` and `semesterId`.
  - `resultSheetQuerySchema` validating sheet queries.
- **Lecturer Result Services (`src/server/services/result.service.ts`, `src/server/services/lecturer-dashboard.service.ts`)**:
  - `getResultSheet`: scoped via `assertLecturerCourseAssignment`; strictly enforces Decision D3 (draft scores are never revealed to `DEPARTMENT_ADMIN` or `SUPER_ADMIN`).
  - `saveDraftResults`: atomic transactional update/upsert writing `RESULT_DRAFT_SAVED` audit log per row with before/after score breakdown and department ID. Validates that every registration belongs to the course in the current semester (rejects alien registrations with `400` without persisting partial updates).
  - `submitResults`: atomic transition to `SUBMITTED`. Verifies every registered student has an entered score row; returns `409` with list of missing students if any student is missing. Writes `RESULT_SUBMITTED` audit log per row.
  - Post-submit immutability: editing submitted or approved rows via draft endpoint is rejected with `409`.
- **REST Route Handlers (`src/app/api/v1/results/*`)**:
  - `GET /api/v1/results/sheet`: sheet fetching with summary counts.
  - `POST /api/v1/results/draft`: draft score submission with `assertSameOrigin`.
  - `POST /api/v1/results/submit`: batch final submission with `assertSameOrigin`.
- **Lecturer UI & Navigation (`src/app/(portal)/lecturer/*`, `src/components/lecturer/*`)**:
  - `/lecturer`: Lecturer dashboard with active semester summary cards, assigned courses table, and prominent warning alert for returned results requiring attention.
  - `/lecturer/courses`: Assigned courses list with progress indicators.
  - `/lecturer/courses/[assignmentId]`: Interactive spreadsheet-style scoresheet (`LecturerScoreSheet.tsx`) featuring real-time total/grade computation, summary cards (enrolled, entered, average score, pass/fail counts), draft saving, confirm dialog for submission, and read-only locked mode for submitted/approved sheets.
  - Navigation in `src/components/layout/PortalShell.tsx` updated with "My Courses".
- **RBAC Integration Suite (`tests/rbac/results-lecturer.test.ts`)**:
  - 10 automated integration tests covering 401 unauthenticated requests, 403 role restrictions for Student/Admins and foreign origin, strict schema smuggling rejection, score boundary rejection, atomic rollback on alien registration ID, lecturer assignment scoping, draft saving accuracy, 409 missing student rejection, and post-submit immutability.

### Files Added / Modified
- `docs/DECISIONS.md`
- `docs/PROGRESS.md`
- `src/server/services/grading.service.ts`
- `src/lib/validators/result.ts`
- `src/server/services/result.service.ts`
- `src/server/services/lecturer-dashboard.service.ts`
- `src/app/api/v1/results/sheet/route.ts`
- `src/app/api/v1/results/draft/route.ts`
- `src/app/api/v1/results/submit/route.ts`
- `src/app/(portal)/lecturer/page.tsx`
- `src/app/(portal)/lecturer/courses/page.tsx`
- `src/app/(portal)/lecturer/courses/[assignmentId]/page.tsx`
- `src/components/lecturer/LecturerScoreSheet.tsx`
- `src/components/shared/StatusBadge.tsx`
- `src/components/layout/PortalShell.tsx`
- `tests/unit/grading.test.ts`
- `tests/rbac/results-lecturer.test.ts`

### Known Gaps
- None for Phase 6.

---

## Phase 7a: Approval Workflow & Audit Trail

### What Was Built
- **Departmental Result Approval Services (`src/server/services/result-approval.service.ts`)**:
  - `listSubmissions`: queries courses with student registrations, filtering by department for `DEPARTMENT_ADMIN` and university-wide for `SUPER_ADMIN`.
  - `approveResults`: conditional `updateMany` (`where: { id: { in: targetIds }, status: "SUBMITTED" }`) validating that count matches expected count (rolls back with `409` on concurrent modification). Checks that reviewer is not the lecturer who entered the scores (`res.enteredById !== session.userId`; throws `403` to prevent self-approval). Recalculates grade and gradePoint against current `GradeScale` table. Writes `RESULT_APPROVED` `AuditLog` row per approved result with before/after summaries and department ID.
  - `returnResults`: validates reviewer feedback (3–500 chars). Conditional `updateMany` transitioning results from `SUBMITTED` to `RETURNED`, setting `feedback` column. Writes `RESULT_RETURNED` `AuditLog` row per result with feedback and department ID.
  - `reopenResults`: validates reopening justification (3–500 chars). Conditional `updateMany` transitioning results from `APPROVED` to `RETURNED`, setting `reopenedById`, `reopenedAt`, and `reopenReason`. Writes `RESULT_REOPENED` `AuditLog` row per result with reason and department ID.
  - `getResultHistory`: retrieves full chronological audit trail for a result row, scoped to authorized admins and assigned lecturers. Enforces Decision D3: admins never see `RESULT_DRAFT_SAVED` audit logs.
- **REST Route Handlers (`src/app/api/v1/results/*`)**:
  - `GET /api/v1/results/submissions`: submissions listing with semester selector.
  - `POST /api/v1/results/approve`: batch result approval with `assertSameOrigin`.
  - `POST /api/v1/results/return`: return results for correction with `assertSameOrigin`.
  - `POST /api/v1/results/reopen`: audited result reopening with `assertSameOrigin`.
  - `GET /api/v1/results/[id]/history`: result lifecycle audit trail viewer.
- **Approvals UI & Navigation (`src/components/admin/ApprovalsView.tsx`, `/dept-admin/approvals`, `/super-admin/approvals`)**:
  - Shared `ApprovalsView` component mounted under `/dept-admin/approvals` (scoped to admin's department) and `/super-admin/approvals` (all departments).
  - Features: semester dropdown, submissions table with counts (registered, submitted, approved, returned) and status chips, drill-down into full course score sheet, approve-all confirmation dialog, return-for-correction dialog with feedback input, reopen dialog with mandatory reason input, and per-row audit history modal showing chronological events, actors, and reasons.
  - Dashboard cards for "Results Awaiting Approval" in `/dept-admin` and `/super-admin` linked to the approvals page.
  - Navigation updated in `src/components/layout/PortalShell.tsx` for `DEPARTMENT_ADMIN` and `SUPER_ADMIN`.
- **RBAC Integration Suite (`tests/rbac/results-approval.test.ts`)**:
  - 16 automated integration tests covering 401 unauthenticated requests, 403 for Student and Lecturer, 403 on foreign Origin, D3 hidden drafts in admin submissions and sheets, department scoping (MTH admin cannot touch CSC course; CSC admin cannot touch MTH course), return validation (<3 chars -> 400), lecturer modification and resubmission, concurrent `Promise.all` race safety (conditional count match check), repeat approval rejection (409), reopening validation (<3 chars -> 400), Super Admin university-wide approval, and `/history` scoping and chronological order.

### Files Added / Modified
- `docs/PROGRESS.md`
- `src/server/services/result-approval.service.ts`
- `src/app/api/v1/results/submissions/route.ts`
- `src/app/api/v1/results/approve/route.ts`
- `src/app/api/v1/results/return/route.ts`
- `src/app/api/v1/results/reopen/route.ts`
- `src/app/api/v1/results/[id]/history/route.ts`
- `src/components/admin/ApprovalsView.tsx`
- `src/app/(portal)/dept-admin/approvals/page.tsx`
- `src/app/(portal)/super-admin/approvals/page.tsx`
- `src/app/(portal)/dept-admin/page.tsx`
- `src/app/(portal)/super-admin/page.tsx`
- `src/components/layout/PortalShell.tsx`
- `tests/rbac/results-approval.test.ts`

### Known Gaps
- None for Phase 7a.

---

## Phase 7b: Student Results, CGPA Statements, Audit Viewer & Administrative Oversight

### What Was Built
- **Student Academic History & CGPA Calculations (`src/server/services/student-results.service.ts`)**:
  - `getStudentAcademicHistory`: strictly restricted to authenticated students (`session.role === "STUDENT"`).
  - Fetches ONLY `APPROVED` results for the student (all drafts, submitted, or returned results are excluded per Decision D3).
  - Groups results chronologically by session start date and semester.
  - Computes credit-unit weighted semester GPA (`sum(gp * units) / sum(units)` rounded half-up to 2 decimals) and running progressive CGPA up to each semester.
  - Computes overall career totals (total registered units, total earned units where `gradePoint > 0`, cumulative CGPA, and standing).
- **Audit Log Viewer & Oversight Service (`src/server/services/audit-view.service.ts`)**:
  - `listAuditLogs`: role-scoped audit log viewer.
  - `DEPARTMENT_ADMIN` is strictly scoped to `departmentId = session.departmentId` AND `entityType = "Result"`; draft logs (`RESULT_DRAFT_SAVED`) are filtered out (Decision D3). Attempting to query an alien department throws `403`.
  - `SUPER_ADMIN` has university-wide oversight across all entity types (`Result`, `User`, `Course`, `CourseRegistration`, `Faculty`, `Department`, `Program`, `AcademicSession`, `GradeScale`, etc.) with multi-field filtering and date ranges.
  - Secret sanitization: ensures no `passwordHash`, `lockedUntil`, or `failedLoginCount` are ever selected or serialized.
- **REST Route Handlers (`src/app/api/v1/results`, `src/app/api/v1/audit-logs`)**:
  - `GET /api/v1/results`: student approved examination results and CGPA summary.
  - `GET /api/v1/audit-logs`: paginated administrative audit logs with filtering.
- **Client Primitives & Student / Admin UIs**:
  - `src/components/shared/PrintButton.tsx`: client-side print button triggering `window.print()`.
  - `/student/results` (`src/app/(portal)/student/results/page.tsx`): interactive student results page with career CGPA card, academic standing badge, total units registered/earned, and semester breakdowns with course grades and GPA badges.
  - `/student/print/results` (`src/app/(portal)/student/print/results/page.tsx`): print-optimized result statement with institution header, student bio-data, chronological semester course tables with GPAs/CGPAs, career summary, 5.0 grade scale legend, and prominent watermark ("STUDENT COPY — NOT AN OFFICIAL TRANSCRIPT").
  - `/student` dashboard updated with CGPA stat card and direct links to academic results.
  - Shared `AuditLogsView` component (`src/components/admin/AuditLogsView.tsx`) mounted at `/dept-admin/audit-logs` and `/super-admin/audit-logs`. Features action and entity filters, date range inputs, paginated table, and JSON payload inspection dialog for before/after state diffs.
  - Navigation in `src/components/layout/PortalShell.tsx` updated with "Academic Results" for Student, and "Audit Logs" for Department Admin and Super Admin.
- **RBAC Integration Suite (`tests/rbac/audit.test.ts`)**:
  - 9 automated integration tests covering 401 unauthenticated requests, 403 for Student/Lecturer on `/api/v1/audit-logs`, Dept Admin scoping to CSC and `entityType: "Result"` with drafts hidden, 403 on cross-department queries, Super Admin university-wide oversight across multiple entity types, zero secrets/passwordHash leakage guarantee, student results route guards, and approved-only results verification with accurate GPA/CGPA.

### Files Added / Modified
- `docs/PROGRESS.md`
- `src/lib/validators/audit.ts`
- `src/server/services/audit-view.service.ts`
- `src/server/services/student-results.service.ts`
- `src/app/api/v1/audit-logs/route.ts`
- `src/app/api/v1/results/route.ts`
- `src/components/shared/PrintButton.tsx`
- `src/components/admin/AuditLogsView.tsx`
- `src/app/(portal)/student/page.tsx`
- `src/app/(portal)/student/results/page.tsx`
- `src/app/(portal)/student/print/results/page.tsx`
- `src/app/(portal)/dept-admin/audit-logs/page.tsx`
- `src/app/(portal)/super-admin/audit-logs/page.tsx`
- `src/components/layout/PortalShell.tsx`
- `tests/rbac/audit.test.ts`

### Known Gaps
- None for Phases 6 and 7.

---

## Phase 8a: Departmental & University Reports + CSV Export

### What Was Built
- **CSV Sanitization & Export Utility (`src/lib/csv.ts`, `tests/unit/csv.test.ts`)**:
  - Implemented `sanitizeCsvCell` defending against spreadsheet formula injection (CSV injection): checks leading trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`) and prepends a single quote (`'`), while adhering to RFC 4180 quote-escaping rules for commas, quotes, and line breaks.
  - Implemented `generateCsvString` and client-side `downloadCsv` generating a UTF-8 BOM blob and triggering browser download.
  - Added unit test suite in `tests/unit/csv.test.ts` covering formula trigger neutralization and formatting edge cases.
- **Reporting Services & Database Aggregations (`src/server/services/report.service.ts`)**:
  - `getStudentReport`: paginated student roster, strictly scoped to own department for `DEPARTMENT_ADMIN` and university-wide for `SUPER_ADMIN`. Blocks `STUDENT` and `LECTURER` with 403. Supports multi-field filtering (`programId`, `levelId`, `status`, `search`).
  - `getRegistrationReport`: aggregates course enrolments per course and totals by academic level using database `groupBy`. Scopes `LECTURER` strictly to their assigned courses, `DEPARTMENT_ADMIN` to department courses, and `SUPER_ADMIN` university-wide.
  - `getPerformanceReport`: enforces the brief's non-negotiable rule that **only APPROVED results** are included in academic performance summaries (unsubmitted drafts, pending submissions, and returned results are excluded). Calculates course metrics (results count, average score, high/low, pass rate) and grade distribution (`A`–`F`) represented with pure CSS bar charts, plus program-level credit-weighted GPAs.
- **REST Endpoints (`src/app/api/v1/reports/*`)**:
  - `GET /api/v1/reports/students`
  - `GET /api/v1/reports/registrations`
  - `GET /api/v1/reports/performance`
- **UI & Portal Navigation (`src/components/reports/ReportsView.tsx`, `src/app/(portal)/*`)**:
  - Built unified, accessible `ReportsView` with tabs for Student List, Course Registrations, and Academic Performance.
  - Integrated print stylesheet (`@media print`) rendering a clean formal institution header, active filter values, and generated-by credentials.
  - Export CSV buttons for students, course registrations, course performance, and program performance.
  - Mounted at `/dept-admin/reports`, `/super-admin/reports`, and `/lecturer/reports`.
  - Added sidebar navigation entries in `PortalShell.tsx`.
- **RBAC Integration Suite (`tests/rbac/reports.test.ts`)**:
  - 15 automated integration tests verifying 401 unauthenticated access, 403 for students, 403 for lecturers on student rosters, cross-department protection, assigned course scoping, and accurate performance aggregation.

### Files Added / Modified
- `docs/PROGRESS.md`
- `src/lib/csv.ts`
- `src/lib/validators/reports.ts`
- `src/server/services/report.service.ts`
- `src/app/api/v1/reports/students/route.ts`
- `src/app/api/v1/reports/registrations/route.ts`
- `src/app/api/v1/reports/performance/route.ts`
- `src/components/reports/ReportsView.tsx`
- `src/app/(portal)/dept-admin/reports/page.tsx`
- `src/app/(portal)/super-admin/reports/page.tsx`
- `src/app/(portal)/lecturer/reports/page.tsx`
- `src/app/(portal)/lecturer/courses/page.tsx`
- `src/components/layout/PortalShell.tsx`
- `tests/unit/csv.test.ts`
- `tests/rbac/reports.test.ts`

### Known Gaps
- Phase 8b cleanup & polish (score sheet auto-save removal, error/not-found boundaries, security headers, mobile polish) is next.






