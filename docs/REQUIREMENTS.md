# UEMP — University Education Management Portal: Assessment Requirements

Source: Lead Web Praxis Media Limited, Technology & Engineering. Transcribed from the assessment document. This file is the source of truth for the build. Anything marked **DECISION** is a candidate decision, not part of the original brief.

- Project: University Education Management Portal (UEMP)
- Assessment type: Practical Software Development Test
- Duration: 72 hours (see Conflicts)
- Submission: working application, source code, technical documentation

## 1. Overview

Build a web-based university management system that supports different user categories, each with clearly defined permissions and responsibilities. It must demonstrate proper role-based access control, academic data management, course registration, result management and administrative oversight. The focus is a functional MVP, not a complete university ERP.

## 2. Roles and permissions (four roles)

### A. STUDENT
Can:
- Log in securely to their student dashboard
- View and update permitted personal profile information
- View their department, faculty, program and matriculation number
- View available courses for their program and academic level
- Register courses for the current semester
- View registered courses and course units
- View academic results and semester grades
- View academic history and cumulative GPA (CGPA)
- Download or print their course registration summary and result statement

Cannot:
- Register other students for courses
- Upload or modify official examination results
- Access lecturer or administrative dashboards
- Modify their academic records or grades

### B. LECTURER
Can:
- Log in to their lecturer dashboard
- View and manage their assigned courses
- View students registered for their assigned courses
- Access class lists
- Enter students' continuous assessment (CA) and examination scores
- Save results as drafts
- Submit completed results for departmental review
- View submission status and feedback
- View basic course and student performance summaries

Cannot:
- Manage courses not assigned to them
- Modify courses or students outside their assigned department or teaching responsibilities
- Edit submitted results without authorized reopening
- Approve their own submitted results

### C. DEPARTMENT ADMIN
Can:
- Access a departmental dashboard
- Register and manage students within their department
- Create and manage lecturer profiles
- Create and manage departmental courses
- Assign lecturers to courses
- Manage academic levels and programs
- View student course registrations
- Review submitted examination results
- Approve or reject submitted results
- Return results to lecturers for correction
- Generate basic departmental reports

Cannot:
- Manage records outside their assigned department
- Access super admin functions
- Alter system-wide settings or manage other departments

### D. SUPER ADMIN
Overall control of the platform. Can:
- View the university-wide dashboard
- Create and manage faculties and departments
- Create and manage academic programs
- Manage student and lecturer accounts
- Create and manage academic sessions and semesters
- Manage courses and course allocations
- Activate, deactivate and suspend user accounts
- Manage user roles and permissions
- View and monitor course registrations
- View and oversee departmental result approvals
- Access university-wide academic reports
- Monitor system activities and administrative actions

## 3. Core platform modules

| Module | Required functionality |
|---|---|
| Authentication | Secure login, logout, and role-based redirection |
| Student Management | Student profiles, matriculation numbers, departments and academic levels |
| Lecturer Management | Lecturer profiles, departmental assignments and course allocations |
| Faculty & Department Management | Create and manage faculties and departments |
| Course Management | Course codes, titles, units, levels and semester allocation |
| Course Registration | Students register available courses for a semester |
| Result Management | CA scores, examination scores, grades and GPA calculations |
| Result Approval | Lecturer submission, departmental review and approval |
| Academic Session Management | Manage academic sessions and semesters |
| Reports | Student lists, course registration reports and academic performance summaries |
| Admin Dashboard | University-wide monitoring and administrative management |

## 4. System workflows (must function correctly)

### Workflow 1: Student course registration
1. Student logs in.
2. System identifies the student's department, program and academic level.
3. Student views available courses for the current semester.
4. Student selects courses and submits registration.
5. System validates course availability and prevents duplicate registration.
6. Registered courses appear on the student's dashboard.
7. Department administrators can view the registrations.

### Workflow 2: Lecturer result submission
1. Lecturer logs in.
2. Lecturer views assigned courses.
3. Lecturer selects a course.
4. System displays the registered students.
5. Lecturer enters CA and examination scores.
6. System calculates total scores and corresponding grades.
7. Lecturer saves results as drafts or submits them for approval.
8. Department administrator reviews the submitted results.
9. Department administrator approves or rejects the submission.
10. Approved results become visible to students.

### Workflow 3: Departmental result approval
1. Department administrator logs in.
2. Administrator views pending result submissions.
3. Administrator selects a course.
4. Administrator reviews submitted results.
5. Administrator approves or rejects the results.
6. If rejected, the lecturer receives feedback and can make corrections.
7. Approved results become available to students.

### Workflow 4: Super Admin management
1. Super Admin logs in.
2. Accesses the university-wide dashboard.
3. Creates faculties and departments.
4. Creates academic sessions and semesters.
5. Manages student and lecturer accounts.
6. Assigns users to their respective departments.
7. Monitors academic activities across the university.

## 5. Technical requirements

Must demonstrate:
- Proper role-based access control (RBAC)
- Secure authentication and session management
- Backend validation of user permissions
- Database relationships between students, lecturers, courses, departments and results
- Data validation and duplicate prevention
- Secure storage and handling of academic records
- Audit trails for result submissions and approvals
- Responsive user interfaces
- Proper error handling and user feedback
- Clean, maintainable, well-structured code

Candidates may choose their technology stack but must explain their architectural and technical decisions.

## 6. Business rules (must be enforced)

1. A student can only register courses available to their department, program, academic level and semester.
2. Students cannot register for the same course twice within the same semester.
3. Lecturers can only enter results for courses assigned to them.
4. Results must be submitted before departmental approval.
5. Only authorized departmental administrators can approve results for their department.
6. Students can only view approved results.
7. Super Admin has university-wide administrative access.
8. Every important result submission, approval, rejection or modification must be traceable.

GPA: use a documented grading scale and a standard credit-unit-weighted calculation. The grading scale must be configurable or clearly documented.

## 7. Deliverables

1. A functional web-based university management portal
2. Working dashboards for all four user roles
3. Source code
4. Database schema or ER diagram
5. README containing installation and setup instructions
6. Test login credentials for each user role
7. Brief technical documentation explaining system architecture, database structure and permission logic
8. A short demonstration of the completed application

The application should include sample data so the evaluation team can test the different workflows without manually creating every record.

## 8. Acceptance criteria

- All four user roles can log in and access their respective dashboards
- Each role has the correct permissions and restrictions
- Students can register courses
- Lecturers can view assigned courses and submit examination results
- Department administrators can review and approve results
- Students can view approved results
- Super Admin can manage faculties, departments, users, sessions and semesters
- Unauthorized users cannot access restricted pages or backend endpoints
- Academic records are properly linked and stored in the database
- The system can demonstrate the complete course registration and result approval workflows

## 9. Out of scope

Online fee payment gateways; accommodation booking/allocation; admission application and screening; biometric attendance; SMS and email gateway integrations; mobile applications; full transcript verification and document certification; live integration with external university systems.

## 10. Evaluation weights

| Area | Weight |
|---|---|
| System architecture and database design | 15% |
| Role-based access control and security | 20% |
| Student and course management | 15% |
| Course registration workflow | 10% |
| Result entry and approval workflow | 15% |
| Super Admin functionality | 10% |
| UI/UX and responsiveness | 5% |
| Code quality and documentation | 5% |
| Testing and problem-solving | 5% |
| TOTAL | 100% |

## 11. Submission instructions

Deadline: **12 November 2026, 11:55 PM Abuja/Lagos (WAT, GMT+1)**.

Submit:
- Live application URL (deployed and accessible)
- Test credentials: login URL, username/email and password for the selected user role(s)
- GitHub repository link with the complete source code
- Technical documentation (Google Docs, Notion, PDF or README link): system architecture, database structure, technology stack, security implementation, setup instructions
- Database design: schema or ER diagram
- Demonstration: short video walkthrough or availability for a live demo

The candidate must be able to explain the architecture, database relationships, security implementation and major technical decisions.

## 12. Candidate clarifications (from the separate clarification page)

1. Positions: Technology & Engineering Manager (5–8 years) and Mid-Level Full-Stack Software Engineer (3–5 years). Both full-time, hybrid, based in Abuja. Not fully remote. Candidates outside Abuja may apply but must be willing and able to relocate or make arrangements for on-site requirements.
2. Compensation is discussed at interview and selection stages.
3. Purpose and scope: recruitment and technical evaluation only. Candidates build a functional MVP for only ONE of the available workflows: Student, Lecturer, or Administrator. Not a complete production system. Must show frontend and backend functionality, database integration, authentication and role-based access control. Limited to the stated requirements and "must be completed within 24 hours of commencement".
4. Code ownership: reviewed solely for recruitment; not a commitment to deploy. Submit independently developed work and be able to explain it. Commercial use would require a separate agreement.
5. Submission access: provide dedicated demonstration credentials using fictitious data only. Do not submit personal, private, production or unrelated-system credentials. GitHub repo may be public or private; if private, grant the evaluation team access. Documentation may be a README or an accessible Google Docs/Notion/PDF link.
6. Before starting the 72-hour assessment the candidate confirms: the position applied for; acceptance of the Abuja hybrid arrangement; the ONE selected workflow; understanding of scope and submission requirements. The 72-hour countdown begins once the candidate has received the assessment and confirmed the selected workflow.

## 13. Conflicts in the brief (to be clarified with the company in writing)

- C1 Timing: header and clarification 6 say 72 hours; section 9 says "48-Hour Scope"; clarification 3 says 24 hours. Plan for the strictest sensible reading but build against 72 hours and the 12 Nov 23:55 deadline unless told otherwise.
- C2 Scope: main brief demands all four roles and dashboards (deliverable 2, acceptance criteria); clarification 3 says ONE workflow only. **DECISION:** build a lean vertical slice for all four roles so either reading is satisfied, and declare the Lecturer result-submission workflow (which touches Dept Admin approval and Student result viewing) as the primary selected workflow.
- C3 "Administrator" in the clarification is ambiguous (Department Admin vs Super Admin).

## 14. Candidate decisions (not in the brief)

- D1 Grading scale (5.0, configurable table, seeded with Nigerian university standard): A 70–100 = 5, B 60–69 = 4, C 50–59 = 3, D 45–49 = 2, E 40–44 = 1, F 0–39 = 0. Total = CA (max 30) + Exam (max 70). Semester GPA = sum(grade point × course units) / sum(course units); CGPA = same across all approved results.
- D2 Result status machine: DRAFT → SUBMITTED → APPROVED, or SUBMITTED → RETURNED (rejected with feedback) → editable by lecturer → SUBMITTED again. APPROVED results are locked; reopening is an explicit, audited action by the Department Admin (or Super Admin).
- D3 One role per user account. Role is stored server-side and never accepted from the client.
- D4 CGPA and student-visible results use APPROVED results only.
