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


