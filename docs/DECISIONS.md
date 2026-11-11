# DECISIONS

D1 Phase order: 1 scaffold+schema+deploy; 2 auth+RBAC+seed; 3 Super Admin structure (faculties, departments, programs, levels, sessions/semesters, grade scale, users) with NO courses; 4 courses+assignments+Dept Admin students/lecturers (shared services used by both admin roles); 5 student registration + admin registration views; 6 lecturer results+grading; 7 approval+audit+student results/CGPA+print+audit viewer+super admin oversight; 8 reports+polish; 9 RBAC tests; 10 docs; 11 verification.
D2 Result states: DRAFT, SUBMITTED, APPROVED, RETURNED. UI label for reject is "Reject (return for correction)". Batch-by-course is the primary action; per-row ids are API-only.
D3 Dept Admin and Super Admin never see DRAFT results.
D4 Grade lookup: highest GradeScale band where minScore <= totalScore. Scores may have decimals. Grade and gradePoint are recomputed on save, submit and approve; APPROVED rows are never recomputed.
D5 AcademicLevel is global; only SUPER_ADMIN creates levels. Dept Admin manages programs in their own department and student levels.
D6 Role changes: never to or from STUDENT; converting to another role requires departmentId and staffId and runs in one transaction; a Super Admin cannot change their own role or status.
D7 Every mutating route checks the Origin header against the app origin. Login: 5 failed attempts lock the account for 15 minutes (failedLoginCount, lockedUntil), audited as USER_LOGIN_FAILED.
D8 A change-password endpoint exists (PATCH /api/v1/auth/password). Admin-created accounts get an admin-set temporary password.
D9 Seed (Phase 2) must include a previous session 2024/2025 with APPROVED results for 200/300-level students so CGPA and history are meaningful, and every workflow must be demonstrable from a clean seed: one student with zero current registrations, one course with registered students and no results, one course with SUBMITTED results awaiting approval, one RETURNED result with feedback.
D10 Result.studentId/courseId/semesterId are always copied from the registration in the service, never accepted from the client.
D11 Audit log is append-only: no update or delete code paths. By application design, no update or delete endpoints exist; a database-level trigger was deliberately omitted.
D12 One lecturer per course per semester: creating a course assignment when another lecturer is already assigned to that course and semester returns 409 Conflict; to change the assigned lecturer, unassign the existing assignment first (which is blocked with 409 if any Result rows exist for that course and semester).
D13 Session cookie: httpOnly, Secure in production, SameSite=Lax, path=/, 8h lifetime, HS256 JWT containing only userId. Reload user on every request to derive role and status.
D14 Reports count APPROVED results only: academic standing and GPA calculations never read draft, submitted or returned results.
D15 CSV export neutralises formula injection: any cell starting with =, +, -, @, \t, \r is prefixed with a single quote.


