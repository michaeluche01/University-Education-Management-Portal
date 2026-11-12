# UEMP Video Demonstration Script (6–8 Minutes)

A complete, timestamped walkthrough script for recording the assessment video demonstration. This script covers all four user roles, the primary examination workflow, security isolation, and database traceability.

- **Demo Password for All Accounts**: `Uemp@Demo2026`
- **Target Video Duration**: 7 minutes 30 seconds
- **Post-Recording Prerequisite**: Execute `npm run db:reset-demo` after recording to restore the database to its pristine evaluation state.

---

## Demonstration Timeline Overview

| Timestamp | Duration | Section | Demo Account | Focus Entity / Scenario |
|:---:|:---:|---|---|---|
| **0:00 – 0:30** | 30s | 1. Introduction & Architecture | N/A | Landing Page, Stack Overview |
| **0:30 – 1:45** | 75s | 2. Student Course Registration | `student10@uemp.demo` | **S7**: Zero Registrations $\to$ Enrolled |
| **1:45 – 3:00** | 75s | 3. Lecturer Result Entry & Submission | `lecturer1@uemp.demo` | **S2**: `CSC 303` Score Sheet Entry |
| **3:00 – 4:30** | 90s | 4. Dept Admin Review, Return & Approval | `deptadmin.csc@uemp.demo` | **S4** (`CSC 307`) Return & **S1** (`CSC 301`) Approve |
| **4:30 – 5:30** | 60s | 5. Student Results, CGPA & Print Slips | `student01@uemp.demo` | **S5** (`CSC 309`) & **S8** (Historical CGPA) |
| **5:30 – 6:30** | 60s | 6. Super Admin Structure & Global Audit | `superadmin@uemp.demo` | Structure, Users, Global Audit Trail |
| **6:30 – 7:15** | 45s | 7. Security, RBAC & IDOR Verification | Multiple Accounts | URL tampering, IDOR 403, Account Lockout |
| **7:15 – 7:45** | 30s | 8. Codebase, Documentation & Reset | Terminal / IDE | Architecture, ER Diagram, Reset Script |

---

## Detailed Step-by-Step Walkthrough

### 1. Introduction & System Architecture (0:00 – 0:30)
- **Visual**: Start on the UEMP landing page (`/`).
- **Narrator**:
  > *"Welcome to the demonstration of the University Education Management Portal (UEMP). This is a production-grade, full-stack Next.js 16 application backed by PostgreSQL on Neon, Prisma ORM, and Tailwind CSS. The system implements full multi-tenancy and role-based access control across four user roles: Super Admin, Department Admin, Lecturer, and Student. Today, we will demonstrate the core academic workflow: course registration, lecturer score submission, departmental result approval, student CGPA computation, and comprehensive security isolation."*

---

### 2. Student Course Registration Workflow (0:30 – 1:45)
- **Account**: `student10@uemp.demo`
- **Scenario**: **S7** — Student with zero current semester registrations.
- **Steps**:
  1. Click **Sign In**, enter `student10@uemp.demo` / `Uemp@Demo2026`.
  2. The system authenticates and redirects automatically to `/student`.
  3. Point out the dashboard banner: *"0 courses registered for the current First Semester 2026/2027."*
  4. Navigate to **Course Registration** (`/student/courses`).
  5. Demonstrate the course catalog: notice only courses available to **Computer Science**, **B.Sc. Computer Science**, and **300 Level** for the **First Semester** are presented (`CSC 301`, `CSC 303`, `CSC 305`, `CSC 307`, `CSC 309`).
  6. Select `CSC 301` (3 units), `CSC 303` (3 units), and `CSC 305` (3 units). Point out the dynamic credit counter updating from 0 to 9 units.
  7. Click **Submit Registration**.
  8. Notice the success toast and immediate transition into the registered state.
  9. Click **Print Registration Slip** (`/student/print/registration`). Show the clean, printable course slip with matriculation number `UEMP/CSC/2024/010`, registered courses, total credit units, and signature lines.
  10. Log out via the user menu.
- **Narrator**:
  > *"We begin as a 300-level student who has not yet registered. The registration engine enforces three levels of validation: curricular eligibility matching the student's department and level, active semester gating, and maximum credit unit limits. Once registered, the student can immediately generate an official printable registration slip."*

---

### 3. Lecturer Score Entry & Submission (1:45 – 3:00)
- **Account**: `lecturer1@uemp.demo`
- **Scenario**: **S2** — Assigned course `CSC 303` with 9 registered students and no results entered yet.
- **Steps**:
  1. Log in as `lecturer1@uemp.demo`.
  2. The system loads `/lecturer`, displaying assigned courses for the semester (`CSC 301`, `CSC 303`, `CSC 201`, `CSC 401`).
  3. Click on **CSC 303 (Operating Systems)**.
  4. Show the score sheet with 9 registered students. Notice all score fields are currently blank.
  5. Enter Continuous Assessment (CA) and Exam scores for the first two students:
     - Student 1: CA = `24`, Exam = `52` (Total = `76`, Grade = `A`, Points = `5.0`).
     - Student 2: CA = `19`, Exam = `45` (Total = `64`, Grade = `B`, Points = `4.0`).
  6. Point out that total score, letter grade, and grade points are computed automatically in real time.
  7. Point out the yellow visual indicator: *"Unsaved Changes"*.
  8. Attempt to click a navigation link — show the browser prompt warning that uncommitted changes will be lost.
  9. Click **Save Draft**. Show the confirmation toast and notice the badge changes to `DRAFT`.
  10. Click **Submit for Review**. Confirm the submission modal.
  11. The status updates to `SUBMITTED`, and the inputs lock into read-only mode to prevent alteration during administrative review.
  12. Log out.
- **Narrator**:
  > *"Next, we log in as the assigned lecturer. The lecturer can only access courses allocated to them for the current semester. In the score sheet, entering CA and Exam scores immediately computes total marks and letter grades according to the university's 5.0 grading scale. Unsaved score changes trigger active navigation guards. Once submitted, the batch locks to prevent further edits while awaiting departmental review."*

---

### 4. Department Admin Review, Return & Approval (3:00 – 4:30)
- **Account**: `deptadmin.csc@uemp.demo`
- **Scenarios**:
  - **S4**: `CSC 307` — Reviewing returned results with feedback.
  - **S1**: `CSC 301` — Approving submitted results.
- **Steps**:
  1. Log in as `deptadmin.csc@uemp.demo`.
  2. Navigate to **Approvals** (`/dept-admin/approvals`).
  3. Show the submitted course batches awaiting review: `CSC 301` and `CSC 303`.
  4. First, open **CSC 307 (Computer Networks)** from the courses menu. Show that its current status is `RETURNED` with the admin remark: *"Please verify CA score computation for network lab assessment and resubmit."* This demonstrates the return-for-correction workflow.
  5. Return to **Approvals** and open the batch for **CSC 301 (Database Systems)** (Scenario S1).
  6. Inspect the roster of 9 submitted student scores.
  7. Click **Approve Batch**.
  8. Confirm the approval dialog. Show the success toast: the batch status transitions to `APPROVED`.
  9. Point out the **Reopen Results** button: show that once approved, modifying or reopening a sheet requires an explicit administrative reason that is permanently recorded in the audit trail.
  10. Log out.
- **Narrator**:
  > *"Now logged in as the Computer Science Department Administrator, we access the approvals queue. Administrators can either Return for Correction with specific remarks—which sends the sheet back to the lecturer for adjustments—or Approve the batch. Approval transitions all result rows atomically via a database transaction and immediately unlocks them for student viewing."*

---

### 5. Student Approved Results & CGPA Transcript (4:30 – 5:30)
- **Account**: `student01@uemp.demo`
- **Scenarios**: **S5** (`CSC 309` approved results) and **S8** (2025/2026 multi-semester historical CGPA).
- **Steps**:
  1. Log in as `student01@uemp.demo`.
  2. Navigate to **My Results** (`/student/results`).
  3. Show the approved results accordion for the current semester:
     - Notice newly approved results for `CSC 301` and `CSC 309` are visible.
     - Unapproved draft or submitted courses (`CSC 303`, `CSC 305`) are **not** visible, confirming business rule compliance.
  4. Scroll down to the **2025/2026 Academic Session** (Scenario S8) showing First and Second semester results.
  5. Highlight the summary cards:
     - **Current Semester GPA**: e.g. `4.50`.
     - **Cumulative CGPA**: e.g. `4.28`.
     - **Total Registered & Earned Credit Units**.
  6. Click **Print Official Statement** (`/student/print/results`).
  7. Show the formal institutional result statement with session breakdowns, grading key, and signature footers.
  8. Log out.
- **Narrator**:
  > *"Back in the student portal, students can only see results that have achieved Approved status. The system aggregates all historical semesters to calculate semester GPAs and cumulative CGPA using credit-unit-weighted integer arithmetic, ensuring 100% rounding accuracy on official printable statements."*

---

### 6. Super Admin University Governance & Global Audit (5:30 – 6:30)
- **Account**: `superadmin@uemp.demo`
- **Steps**:
  1. Log in as `superadmin@uemp.demo`.
  2. The university-wide dashboard displays global statistics: 2 faculties, 4 departments, 4 programs, 31 users, and total course registrations.
  3. Visit **Structure** (`/super-admin/departments`, `/super-admin/programs`): show faculties, departments, and programs across Science and Engineering.
  4. Visit **User Management** (`/super-admin/users`):
     - Filter by Role (`LECTURER`, `STUDENT`, `DEPARTMENT_ADMIN`).
     - Open the **Create User** modal: show role-aware dynamic fields (matriculation number for students, staff ID and department selection for staff).
  5. Visit **Audit Logs** (`/super-admin/audit-logs`):
     - Filter by Action (`RESULT_APPROVED`, `REGISTRATION_CREATED`, `USER_STATUS_CHANGED`).
     - Expand an audit row: show the `beforeSummary` and `afterSummary` JSON snapshots capturing exactly what changed, who performed it, and the precise timestamp.
  6. Log out.
- **Narrator**:
  > *"Super Admins possess institution-wide oversight. They manage organizational hierarchies, degree curricula, user accounts, and can inspect the immutable audit log capturing every administrative mutation, result submission, and approval event across the university."*

---

### 7. Security, RBAC & Cross-Department IDOR Isolation (6:30 – 7:15)
- **Demonstration**:
  1. **Privilege Escalation Block**:
     - Log in as `student01@uemp.demo`.
     - In the browser address bar, manually type `http://localhost:3000/super-admin` and press Enter.
     - Show that the server-side layout guard catches the unauthorized request and redirects the student cleanly back to `/student` with an access alert.
  2. **Cross-Department IDOR Isolation**:
     - Log in as Mathematics Department Admin (`deptadmin.mth@uemp.demo`).
     - Open `/dept-admin/approvals`.
     - Show that only Mathematics courses (`MTH 201`) appear in the inbox.
     - Attempting to inspect or approve Computer Science courses is blocked with HTTP 403 Forbidden.
  3. **Suspended Account Enforcement**:
     - Show that if an administrator suspends an account, active sessions are invalidated immediately on their next request.
- **Narrator**:
  > *"Security is enforced on the server. If an authenticated student attempts to browse to /super-admin, server layout guards reject the request. Department administrators are strictly scoped: Mathematics administrators cannot view or approve Computer Science submissions. Furthermore, account suspensions take effect in real time because user status is re-verified against the database on every single request."*

---

### 8. Codebase, Documentation & Clean Reset (7:15 – 7:45)
- **Visual**: Show VS Code / Terminal.
- **Steps**:
  1. Show `prisma/schema.prisma` highlighting relational foreign keys and unique constraints.
  2. Show `tests/rbac/matrix.test.ts` with 345 passing API security matrix tests.
  3. In the terminal, execute:
     ```bash
     $env:RESET_CONFIRM="wipe-all-data"; npm run db:reset-demo
     ```
  4. Show the clean table truncate and reseeding output restoring the demo database to pristine evaluation status.
- **Narrator**:
  > *"The entire solution is thoroughly verified by 649 automated tests, including an exhaustive 345-test RBAC matrix. After this recording, running npm run db:reset-demo safely wipes all test data and reseeds pristine demo records, ensuring the evaluation team can test every scenario from a clean state. Thank you."*

