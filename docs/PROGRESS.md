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
- `.env` is not present in the workspace yet, so applying the migrations against the live Neon DEV branch (`npm run db:migrate:dev`) and running `npx tsx scripts/smoke-tx.ts` against the live pooled Neon URL require `.env` with `DATABASE_URL` and `DIRECT_URL` to be placed in the project root.
- No remote git origin is configured yet (`git remote -v` is empty), so `git push` requires a remote repository URL.

