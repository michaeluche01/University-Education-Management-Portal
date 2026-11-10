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
- Phase 3b (Users Management) is implemented in the next commit.




