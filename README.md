# University Education Management Portal (UEMP)

A production-grade, full-stack university academic management platform designed for higher education institutions. UEMP manages academic structures, student course registrations, lecturer score entries, departmental result approvals, student transcripts, and institutional performance reports with strict role-based access control (RBAC), departmental multi-tenancy, and immutable audit logging.

- **Live Application URL**: `https://university-education-management-por-zeta.vercel.app/`
- **Demonstration Video URL[Unlisted link]**: `https://youtu.be/qFZfHfAp60g`
- **Demo Accounts Password**: `Uemp@Demo2026`
- **Default Database**: PostgreSQL on Neon (Free Tier)
  > [!NOTE]
  > **Cold Start Latency**: Neon free-tier compute endpoints automatically suspend after a period of inactivity. The first request after an idle period may take 3–5 seconds while the PostgreSQL instance resumes. Subsequent requests execute with sub-second latency.

---

## 1. Project Overview & Primary Workflow

UEMP implements all four institutional user roles defined in the brief:
1. **Super Admin**: University-wide governance over faculties, departments, degree programs, levels, academic sessions, semesters, grading scales, user lifecycle management, and global audit oversight.
2. **Department Admin**: Scoped governance over departmental programs, course assignments, lecturers, students, registration monitoring, course-by-course result approval/rejection workflows, and departmental performance reports.
3. **Lecturer**: Scoped access to assigned courses for the active academic semester, score sheet entry (CA + Exam), draft persistence, unsaved change warnings, and formal submission for departmental review.
4. **Student**: Self-service course registration with real-time prerequisite/credit-limit validation, printable course registration slips, official semester result view (approved only), cumulative CGPA statements, and printable transcripts.

### Chosen Primary Workflow
Per Section 13 (C2) and Section 6 of the brief, the system implements a complete vertical slice across all roles, with the **Lecturer Result Entry $\to$ Department Admin Approval $\to$ Student Result & CGPA** workflow designated as the primary demonstration:

```
[Lecturer] ──(Enters CA + Exam)──> [Draft Score Sheet]
                                          │
                                   (Submit Sheet)
                                          ▼
                                   [Status: SUBMITTED]
                                          │
                 ┌────────────────────────┴────────────────────────┐
          (Requires Correction)                             (Meets Standard)
                 │                                                 │
                 ▼                                                 ▼
        [Status: RETURNED]                                [Status: APPROVED]
   (Lecturer edits & resubmits)                                    │
                                                   ┌───────────────┴───────────────┐
                                                   ▼                               ▼
                                          [Student Result Portal]        [Audit Trail Locked]
                                          (GPA & CGPA Updated)        (Reopen Requires Reason)
```

1. **Lecturer**: Opens an assigned course sheet, inputs Continuous Assessment (0–30) and Examination (0–70) scores, saves working drafts, and submits the batch for review.
2. **Department Admin**: Reviews submitted scores in the departmental approvals inbox. Can **Return for Correction** with specific feedback (locking the sheet back to `RETURNED`), or **Approve** the batch.
3. **Student**: Instantly views newly approved course grades, semester GPA, and updated cumulative CGPA on their portal and printable result statement.
4. **Audit Trail**: Every score edit, draft save, submission, rejection, approval, and administrative reopening generates an immutable, timestamped `AuditLog` entry.

---

## 2. Technology Stack & Rationale

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | **Next.js 16 (App Router)** | Full-stack TypeScript architecture unifying REST API route handlers (`/api/v1/*`) and React Server Components (RSC) with zero context-switching and minimal network hops. |
| **Language** | **TypeScript 5 (Strict)** | End-to-end type safety spanning Prisma models, Zod validation schemas, API responses, and UI component state. |
| **Database** | **PostgreSQL (Neon Serverless)** | Strict relational constraints, composite foreign keys, unique indexes, and ACID transactions critical for financial and academic record integrity. |
| **ORM** | **Prisma ORM 7** | Type-safe schema definition, automated schema migrations (`prisma/schema.prisma`), and connection pooling via `@prisma/adapter-pg`. |
| **Authentication** | **JOSE (HS256 JWT)** | Stateless, cryptographic session tokens stored in secure, `httpOnly`, `SameSite=Lax` cookies. User credentials and account status are re-verified against PostgreSQL on every request. |
| **Validation** | **Zod 4 (Strict Schemas)** | Shared client and server validation schemas rejecting unknown parameters (`.strict()`) to block parameter smuggling and privilege escalation. |
| **Styling & UI** | **Tailwind CSS + shadcn/ui** | Accessible, responsive component primitives styled down to 375px mobile screens with clean loading skeletons, toasts, and print-specific CSS stylesheets (`@media print`). |
| **Testing** | **Vitest 5** | High-performance in-memory and integration test runner executing static route security checks, grading logic, and full RBAC matrix tests. |

---

## 3. Prerequisites

- **Node.js**: `v20.0.0` or higher (verified on Node `v26.1.0` and npm `12.2.2`).
- **PostgreSQL**: A running PostgreSQL instance (local or hosted on Neon/Supabase/Railway).
- **Git**: Installed and configured on your terminal.

---

## 4. Local Setup Step-by-Step

### A. Windows (PowerShell)

```powershell
# 1. Clone the repository
git clone https://github.com/michaeluche01/University-Education-Management-Portal.git
cd University-Education-Management-Portal

# 2. Install dependencies
npm install

# 3. Configure environment variables
Copy-Item .env.example .env
# Open .env and insert your PostgreSQL connection strings and SESSION_SECRET

# 4. Run database migrations
npx prisma migrate deploy

# 5. Seed database with initial demo fixtures
npm run db:seed

# 6. Start development server
npm run dev
```

### B. macOS & Linux (Bash / Zsh)

```bash
# 1. Clone the repository
git clone https://github.com/michaeluche01/University-Education-Management-Portal.git
cd University-Education-Management-Portal

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Open .env and insert your PostgreSQL connection strings and SESSION_SECRET

# 4. Run database migrations
npx prisma migrate deploy

# 5. Seed database with initial demo fixtures
npm run db:seed

# 6. Start development server
npm run dev
```

The application will be live at `http://localhost:3000`.

---

## 5. Environment Variables Reference

| Variable | Required | Description | Example |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | Connection-pooled PostgreSQL URL for runtime queries. | `postgresql://user:pass@ep-pooler.region.neon.tech/neondb?sslmode=require` |
| `DIRECT_URL` | **Yes** | Direct (non-pooled) PostgreSQL URL for Prisma migrations. | `postgresql://user:pass@ep.region.neon.tech/neondb?sslmode=require` |
| `SESSION_SECRET` | **Yes** | 32+ character random secret used to sign HS256 session JWTs. | `c687e8b9a1d54e3f892a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7` |
| `RESET_CONFIRM` | Optional | Guard required to run `npm run db:reset-demo`. | `wipe-all-data` |
| `CONFIRM_PROD` | Optional | Guard required to run production migration/seed scripts. | `yes` |
| `EXPECTED_DB_HOST` | Optional | Substring verification guard for production reset scripts. | `neon.tech` |

---

## 6. Test Credentials & Demo Accounts

All seeded demo accounts share the password: **`Uemp@Demo2026`**

| Role | Email | Scope | What to Try First |
|---|---|---|---|
| **SUPER_ADMIN** | `superadmin@uemp.demo` | University-wide | Browse faculties, departments, degree programs, user accounts, and global audit log history. |
| **DEPARTMENT_ADMIN** | `deptadmin.csc@uemp.demo` | Computer Science (CSC) | Go to **Approvals** to review submitted grades for `CSC 301`. Approve results or return them with feedback. |
| **DEPARTMENT_ADMIN** | `deptadmin.mth@uemp.demo` | Mathematics (MTH) | Verify departmental isolation: cannot view or approve CSC courses; only manages MTH courses (`MTH 201`). |
| **LECTURER** | `lecturer1@uemp.demo` | CSC Lecturer | Open `CSC 303` (blank sheet) to enter scores, or view submitted `CSC 301` scores. Try editing with unsaved warning. |
| **LECTURER** | `lecturer2@uemp.demo` | CSC Lecturer | Open `CSC 307` (returned with feedback) to inspect admin feedback, adjust scores, and resubmit. |
| **STUDENT** | `student01@uemp.demo` | CSC 300L (Registered) | View approved results for `CSC 309` and historical results, check CGPA calculation, and print result slip. |
| **STUDENT** | `student10@uemp.demo` | CSC 300L (0 Registrations) | Complete course registration from scratch: select eligible 300L courses, register, and print course slip. |

---

## 7. Seeded Scenarios to Try (S1–S8)

The test seed establishes 8 concrete evaluation scenarios ready for immediate review:

| ID | Course / Entity | Account to Use | Scenario Description & Expected Behavior |
|---|---|---|---|
| **S1** | `CSC 301` | `deptadmin.csc@uemp.demo` | **Submitted Results Ready for Approval**: 9 students registered with submitted results. Admin can approve or return with feedback. |
| **S2** | `CSC 303` | `lecturer1@uemp.demo` | **Blank Score Sheet Entry**: 9 students registered with no results. Lecturer enters CA/exam scores and saves draft or submits. |
| **S3** | `CSC 305` | `lecturer2@uemp.demo` | **Draft Results In-Progress**: 8 students with draft scores. Lecturer reviews, updates values, and submits for departmental review. |
| **S4** | `CSC 307` | `lecturer2@uemp.demo` | **Returned Results with Feedback**: Returned by admin for score check. Lecturer views feedback banner, adjusts scores, and resubmits. |
| **S5** | `CSC 309` | `student01@uemp.demo` | **Approved Results & CGPA**: Approved grades visible to student. Admin can reopen approved sheet with a mandatory reason. |
| **S6** | `MTH 201` | `deptadmin.mth@uemp.demo` | **Cross-Department Security (IDOR)**: `deptadmin.mth` can approve MTH 201; `deptadmin.csc` attempting access receives HTTP 403. |
| **S7** | `student10@uemp.demo` | `student10@uemp.demo` | **Zero-Registration Student**: Student has 0 registrations in current semester. Demonstrates clean registration picker and validation. |
| **S8** | Previous Session | `student01@uemp.demo` | **Multi-Semester CGPA History**: 2025/2026 approved results demonstrate weighted CGPA computation across multiple academic sessions. |

---

## 8. Grading Scale & Academic Standing Calculation

### Grading Scale (Nigerian 5.0 Standard)

Configured via the database table `GradeScale` with seeded defaults:

| Grade | Min Score | Max Score | Grade Point | Remark |
|:---:|:---:|:---:|:---:|:---:|
| **A** | 70 | 100 | **5.0** | Excellent |
| **B** | 60 | 69 | **4.0** | Very Good |
| **C** | 50 | 59 | **3.0** | Good |
| **D** | 45 | 49 | **2.0** | Fair |
| **E** | 40 | 44 | **1.0** | Pass |
| **F** | 0 | 39 | **0.0** | Fail |

- **Total Score**: $\text{Total} = \text{CA Score (0–30)} + \text{Exam Score (0–70)}$
- **Semester GPA**:
  $$\text{GPA} = \frac{\sum_{i \in \text{Approved}} (\text{Credit Units}_i \times \text{Grade Point}_i)}{\sum_{i \in \text{Approved}} \text{Credit Units}_i}$$
- **Cumulative Grade Point Average (CGPA)**:
  $$\text{CGPA} = \frac{\sum_{k \in \text{All Approved}} (\text{Credit Units}_k \times \text{Grade Point}_k)}{\sum_{k \in \text{All Approved}} \text{Credit Units}_k}$$

> [!NOTE]
> **Precision & Incomplete Batches**:
> 1. Results count towards GPA/CGPA **only after reaching `APPROVED` status**. Draft, submitted, and returned results are excluded.
> 2. Calculations use integer-hundredths arithmetic to eliminate IEEE-754 floating-point inaccuracies.

---

## 9. Scripts Reference

All commands defined in `package.json`:

| Script | Purpose | Execution Notes |
|---|---|---|
| `npm run dev` | Starts Next.js development server. | Runs on `http://localhost:3000`. |
| `npm run build` | Compiles production Next.js build. | Performs type checking and page static analysis. |
| `npm run start` | Starts production server. | Requires a previous `npm run build`. |
| `npm run lint` | Runs ESLint analysis. | Validates Next.js and TypeScript conventions. |
| `npm run test:unit` | Executes isolated unit tests. | Tests validators, CSV safety, and GPA logic (no DB required). |
| `npm run test:matrix` | Runs RBAC permissions matrix. | Evaluates 345 route, method, role, and origin combinations. |
| `npm run test:rbac` | Runs all RBAC integration suites. | Tests page routing, IDOR protection, and audit logs. |
| `npm run test:all` | Executes complete test suite. | Runs `test:unit` followed by all RBAC tests. |
| `npm run db:migrate:dev` | Applies Prisma migrations in dev. | Uses `DIRECT_URL` against dev database. |
| `npm run db:seed` | Seeds database with demo records. | Idempotent script creating all 8 test scenarios. |
| `npm run db:reset-demo` | Resets development demo state. | Requires `RESET_CONFIRM=wipe-all-data`. |
| `npm run db:reset-demo:prod` | Resets production demo state. | Guarded with `CONFIRM_PROD=yes` and host verification. |

> [!WARNING]
> **Test Environment Safety**: Integration test suites (`test:rbac`, `test:matrix`, `test:all`) must **ONLY** be executed against the development database. Built-in safety guards in `tests/rbac/helpers.ts` automatically abort execution if run against non-local hosts without `ALLOW_REMOTE_TESTS=yes`.

---

## 10. Deployment Notes (Vercel & Neon)

1. **Vercel Hobby Deployment**:
   - Framework Preset: `Next.js`
   - Build Command: `npm run build`
   - Install Command: `npm install` (triggers `"postinstall": "prisma generate"`)
2. **Database Configuration**:
   - Set `DATABASE_URL` in Vercel to the Neon **pooled** connection string (`-pooler` hostname) to avoid exhausting serverless connection limits.
   - Set `DIRECT_URL` to the **direct** connection string for CLI migrations.
3. **Database Migrations on Vercel**:
   - **Never run migrations or database seeding inside request handlers or build steps**.
   - Execute migrations and seeding via your local CLI using `npx prisma migrate deploy` and `npm run db:seed`.

---

## 11. Project Directory Structure

```
uni-manage/
├── docs/
│   ├── ACCEPTANCE.md         # Evidence mapping for acceptance criteria & business rules
│   ├── ARCHITECTURE.md       # Technical architecture, lifecycles, and RBAC matrix
│   ├── DECISIONS.md          # Architectural decision records (D1–D15)
│   ├── DEMO_SCRIPT.md        # 6-8 minute video demonstration walkthrough
│   ├── ER_DIAGRAM.md         # Mermaid ER diagram & database dictionary (16 models)
│   ├── PROGRESS.md           # Implementation log across all 11 phases
│   └── REQUIREMENTS.md       # Project brief and evaluation specifications
├── prisma/
│   ├── migrations/           # Version-controlled SQL migration files
│   ├── schema.prisma         # Comprehensive 16-model PostgreSQL schema
│   └── seed.ts               # Idempotent demo database seeder
├── scripts/
│   ├── reset-demo.ts         # Guarded database reset & reseed script
│   └── smoke-tx.ts           # Neon transaction adapter smoke test
├── src/
│   ├── app/
│   │   ├── (auth)/           # Login and session management pages
│   │   ├── (portal)/         # Authenticated role-based dashboards & tools
│   │   │   ├── dept-admin/   # Department Admin views (approvals, courses, reports)
│   │   │   ├── lecturer/     # Lecturer views (assigned courses, score sheets)
│   │   │   ├── student/      # Student views (course registration, print slips)
│   │   │   └── super-admin/  # Super Admin views (structure, users, audit)
│   │   ├── api/v1/           # 46 thin REST API route handlers
│   │   ├── error.tsx         # Global and portal-level error boundaries
│   │   ├── layout.tsx        # Root HTML layout with providers
│   │   └── not-found.tsx     # 404 handler
│   ├── components/           # Reusable UI components & data managers
│   ├── lib/                  # Utilities, CSV export, and Zod validator schemas
│   └── server/               # Server-only logic
│       ├── auth/             # JWT (jose) and RBAC session utilities
│       ├── db/               # Prisma client singleton with Neon adapter
│       └── services/         # Scoped domain services & transaction helpers
└── tests/
    ├── rbac/                 # Integration test suites (matrix, IDOR, pages, audit)
    └── unit/                 # Pure unit tests (grading, CSV, schema validators)
```

---

## 12. Technical Documentation Links

- [System Architecture & RBAC Design](docs/ARCHITECTURE.md)
- [Entity-Relationship Diagram & Data Dictionary](docs/ER_DIAGRAM.md)
- [Project Requirements & Assessment Brief](docs/REQUIREMENTS.md)
- [Architectural Decision Records (ADR)](docs/DECISIONS.md)
- [Acceptance Criteria Evidence Mapping](docs/ACCEPTANCE.md)
- [Demo Walkthrough Script](docs/DEMO_SCRIPT.md)

---

## 13. Known Limitations

In the interest of engineering transparency, the following technical limitations are noted:

1. **Single Lecturer Assignment per Course per Semester (Decision D12)**:
   A course can be assigned to exactly one lecturer in a given academic semester. Multi-lecturer co-teaching is not modeled in the current schema.
2. **Third-Party Gateways Omitted**:
   Per Section 9 of the brief, email/SMS notifications, fee payment gateways, biometric verification, and student housing are strictly out of scope.
3. **Serverless Database Cold Starts**:
   On Neon free-tier compute endpoints, idle instances suspend after 5 minutes. Initial connections incur a 3–5s startup latency.
4. **Application-Enforced Audit Logging**:
   `AuditLog` entries are recorded via explicit Prisma transactions in service functions (`writeAudit`) rather than PostgreSQL database triggers. This preserves serverless portability but requires all database mutations to pass through application services.
5. **Client CSRF Protection**:
   Mutating API endpoints (`POST`, `PATCH`, `PUT`, `DELETE`) require a valid matching `Origin` header (`assertSameOrigin`). Requests from native HTTP clients or scripts must include the origin header or be executed from within the application domain.
