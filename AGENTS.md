# AGENTS.md — Rules for every AI agent working in this repo

You are building the UEMP assessment project. The full brief is in `docs/REQUIREMENTS.md`. Read it before any task. If a request conflicts with it, stop and ask.
Also read docs/DECISIONS.md before any task.

## Fixed stack (do not change without asking)
- Next.js (App Router) + TypeScript, single full-stack app, REST route handlers under `/api/v1/*`
- PostgreSQL on Neon (free tier), Prisma ORM with migrations
- Tailwind CSS + shadcn/ui
- Auth: email + password, bcryptjs hashing, signed JWT session (`jose`) in an httpOnly, Secure, SameSite=Lax cookie. No tokens in localStorage.
- Zod for all input validation (shared between UI forms and API handlers)
- Vitest for unit tests (grading, GPA) and a scripted RBAC test run against the API
- Deploy: Vercel Hobby. Keep every request short (serverless time limits); never run seeding or migrations inside a request.

## Security rules (non-negotiable)
1. Authorization is enforced on the server in every route handler and server action through ONE central helper (e.g. `requireRole(...)` plus resource-level policy functions). Hiding buttons or redirecting in middleware is UX only and never counts as security.
2. Never trust role, departmentId, userId or status from the request body. Derive them from the session and the database.
3. Department Admin and Lecturer queries are always scoped by department/assignment in the query itself.
4. Return 401 for unauthenticated and 403 for unauthorized; never leak whether a record exists to someone who should not see it.
5. Suspended or deactivated accounts cannot log in and existing sessions are rejected.
6. Hash passwords, never log secrets, never commit `.env`. Maintain `.env.example`.
7. Unique constraints in the database back every duplicate rule (for example one registration per student, course and semester). Use transactions for multi-step writes.
8. Every result submission, approval, rejection, return, reopening and edit writes an immutable `AuditLog` row (who, role, action, entity, before/after summary, timestamp). Account status changes and admin management actions are audited too.
9. Generic error messages to the user, detailed errors only in server logs.

## Engineering rules
- Plan first. For any task bigger than a small fix, produce a short plan and wait for approval before editing files.
- Small scoped changes. Touch only files the task needs. Never refactor, rename or reformat unrelated code. Never regenerate the whole project.
- Business logic lives in `src/server/services/*`, route handlers stay thin, validation schemas live in `src/lib/validators/*`.
- Grading scale lives in a database table (`GradeScale`) with a seeded default. GPA and CGPA use credit-unit weighting and APPROVED results only.
- Every UI screen needs loading, empty and error states, toast feedback, and must work at 375px width.
- Seed script (`prisma/seed.ts`) must be idempotent and create: 2 faculties, 4 departments, programs, levels, an academic session with two semesters, 1 super admin, 2 department admins (different departments), 4 lecturers, 20+ students, ~12 courses with assignments, some registrations, and results in each status (DRAFT, SUBMITTED, APPROVED, RETURNED). Demo password for all seeded accounts is documented in the README (fictitious data only).
- Out of scope, do not build: payments, accommodation, admissions, biometrics, SMS/email gateways, mobile app, transcript verification, external integrations.

## Definition of done for every phase
1. App builds (`npm run build`) and lints with no errors.
2. The phase's behaviour was exercised (tests or a manual walk-through) and the result reported honestly, including anything not working.
3. `docs/PROGRESS.md` updated: phase name, what was built, files added, known gaps.
4. A git commit with a clear message was made.
5. Nothing outside `docs/REQUIREMENTS.md` scope was added.

## Reporting format
End each task with: what changed, how it was verified, what is NOT done or uncertain. Do not claim something works unless it was run.