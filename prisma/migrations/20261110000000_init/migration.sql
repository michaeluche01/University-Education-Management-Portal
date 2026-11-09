-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'LECTURER', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "SemesterName" AS ENUM ('FIRST', 'SECOND');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'RETURNED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_LOGIN', 'USER_LOGIN_FAILED', 'USER_CREATED', 'USER_UPDATED', 'USER_STATUS_CHANGED', 'USER_ROLE_CHANGED', 'USER_PASSWORD_CHANGED', 'ENTITY_CREATED', 'ENTITY_UPDATED', 'ENTITY_DELETED', 'SESSION_CURRENT_CHANGED', 'COURSE_ASSIGNED', 'COURSE_UNASSIGNED', 'REGISTRATION_CREATED', 'REGISTRATION_DELETED', 'RESULT_DRAFT_SAVED', 'RESULT_SUBMITTED', 'RESULT_APPROVED', 'RESULT_RETURNED', 'RESULT_REOPENED', 'GRADE_SCALE_UPDATED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faculty" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentAdmin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "durationYears" INTEGER NOT NULL DEFAULT 4,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicLevel" (
    "id" TEXT NOT NULL,
    "levelNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicSession" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Semester" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" "SemesterName" NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Semester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matricNumber" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "gender" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lecturer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "title" TEXT,
    "specialization" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lecturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "creditUnits" INTEGER NOT NULL,
    "description" TEXT,
    "departmentId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "semesterName" "SemesterName" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseAssignment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lecturerId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseRegistration" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "caScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "examScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grade" TEXT NOT NULL,
    "gradePoint" DOUBLE PRECISION NOT NULL,
    "status" "ResultStatus" NOT NULL DEFAULT 'DRAFT',
    "feedback" TEXT,
    "enteredById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reopenedById" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeScale" (
    "id" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "minScore" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "gradePoint" DOUBLE PRECISION NOT NULL,
    "remark" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeScale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" "Role" NOT NULL,
    "departmentId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeSummary" JSONB,
    "afterSummary" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_name_key" ON "Faculty"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_code_key" ON "Faculty"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE INDEX "Department_facultyId_idx" ON "Department"("facultyId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_facultyId_name_key" ON "Department"("facultyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentAdmin_userId_key" ON "DepartmentAdmin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentAdmin_staffId_key" ON "DepartmentAdmin"("staffId");

-- CreateIndex
CREATE INDEX "DepartmentAdmin_departmentId_idx" ON "DepartmentAdmin"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Program_code_key" ON "Program"("code");

-- CreateIndex
CREATE INDEX "Program_departmentId_idx" ON "Program"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Program_departmentId_name_key" ON "Program"("departmentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicLevel_levelNumber_key" ON "AcademicLevel"("levelNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicLevel_name_key" ON "AcademicLevel"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicSession_name_key" ON "AcademicSession"("name");

-- CreateIndex
CREATE INDEX "Semester_isCurrent_idx" ON "Semester"("isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "Semester_sessionId_name_key" ON "Semester"("sessionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_matricNumber_key" ON "Student"("matricNumber");

-- CreateIndex
CREATE INDEX "Student_departmentId_programId_levelId_idx" ON "Student"("departmentId", "programId", "levelId");

-- CreateIndex
CREATE UNIQUE INDEX "Lecturer_userId_key" ON "Lecturer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Lecturer_staffId_key" ON "Lecturer"("staffId");

-- CreateIndex
CREATE INDEX "Lecturer_departmentId_idx" ON "Lecturer"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");

-- CreateIndex
CREATE INDEX "Course_departmentId_programId_levelId_semesterName_idx" ON "Course"("departmentId", "programId", "levelId", "semesterName");

-- CreateIndex
CREATE INDEX "CourseAssignment_lecturerId_semesterId_idx" ON "CourseAssignment"("lecturerId", "semesterId");

-- CreateIndex
CREATE INDEX "CourseAssignment_courseId_semesterId_idx" ON "CourseAssignment"("courseId", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseAssignment_courseId_lecturerId_semesterId_key" ON "CourseAssignment"("courseId", "lecturerId", "semesterId");

-- CreateIndex
CREATE INDEX "CourseRegistration_courseId_semesterId_idx" ON "CourseRegistration"("courseId", "semesterId");

-- CreateIndex
CREATE INDEX "CourseRegistration_studentId_semesterId_idx" ON "CourseRegistration"("studentId", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRegistration_studentId_courseId_semesterId_key" ON "CourseRegistration"("studentId", "courseId", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "Result_registrationId_key" ON "Result"("registrationId");

-- CreateIndex
CREATE INDEX "Result_courseId_semesterId_status_idx" ON "Result"("courseId", "semesterId", "status");

-- CreateIndex
CREATE INDEX "Result_studentId_status_idx" ON "Result"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Result_studentId_courseId_semesterId_key" ON "Result"("studentId", "courseId", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeScale_grade_key" ON "GradeScale"("grade");

-- CreateIndex
CREATE UNIQUE INDEX "GradeScale_minScore_maxScore_key" ON "GradeScale"("minScore", "maxScore");

-- CreateIndex
CREATE INDEX "AuditLog_departmentId_idx" ON "AuditLog"("departmentId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentAdmin" ADD CONSTRAINT "DepartmentAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentAdmin" ADD CONSTRAINT "DepartmentAdmin_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Semester" ADD CONSTRAINT "Semester_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "AcademicLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lecturer" ADD CONSTRAINT "Lecturer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lecturer" ADD CONSTRAINT "Lecturer_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "AcademicLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAssignment" ADD CONSTRAINT "CourseAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAssignment" ADD CONSTRAINT "CourseAssignment_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "Lecturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAssignment" ADD CONSTRAINT "CourseAssignment_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRegistration" ADD CONSTRAINT "CourseRegistration_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRegistration" ADD CONSTRAINT "CourseRegistration_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRegistration" ADD CONSTRAINT "CourseRegistration_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "CourseRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

