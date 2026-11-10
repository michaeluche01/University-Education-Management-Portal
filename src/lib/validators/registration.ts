import { z } from "zod";

export interface EligibilityStudentContext {
  departmentId: string;
  programId: string;
  levelId: string;
}

export interface EligibilityCourseContext {
  id: string;
  code: string;
  isActive: boolean;
  departmentId: string;
  programId: string;
  levelId: string;
  semesterName: "FIRST" | "SECOND";
}

export interface EligibilitySemesterContext {
  id: string;
  name: "FIRST" | "SECOND";
  registrationOpen: boolean;
}

export type EligibilityFailureCode =
  | "NO_CURRENT_SEMESTER"
  | "REGISTRATION_CLOSED"
  | "COURSE_INACTIVE"
  | "DEPARTMENT_MISMATCH"
  | "PROGRAM_MISMATCH"
  | "LEVEL_MISMATCH"
  | "SEMESTER_MISMATCH"
  | "ALREADY_REGISTERED";

export interface CourseEligibilityResult {
  eligible: boolean;
  code?: EligibilityFailureCode;
  reason?: string;
}

/**
 * Pure function that evaluates whether a student can register for a course in the current semester.
 */
export function evaluateCourseEligibility(
  student: EligibilityStudentContext,
  course: EligibilityCourseContext,
  currentSemester: EligibilitySemesterContext | null,
  isAlreadyRegistered: boolean
): CourseEligibilityResult {
  if (!currentSemester) {
    return {
      eligible: false,
      code: "NO_CURRENT_SEMESTER",
      reason: "There is no active semester open for course registration.",
    };
  }

  if (!currentSemester.registrationOpen) {
    return {
      eligible: false,
      code: "REGISTRATION_CLOSED",
      reason: "Course registration is currently closed for this semester.",
    };
  }

  if (!course.isActive) {
    return {
      eligible: false,
      code: "COURSE_INACTIVE",
      reason: `Course ${course.code} is inactive.`,
    };
  }

  if (course.departmentId !== student.departmentId) {
    return {
      eligible: false,
      code: "DEPARTMENT_MISMATCH",
      reason: `Course ${course.code} belongs to a different department.`,
    };
  }

  if (course.programId !== student.programId) {
    return {
      eligible: false,
      code: "PROGRAM_MISMATCH",
      reason: `Course ${course.code} belongs to a different degree program.`,
    };
  }

  if (course.levelId !== student.levelId) {
    return {
      eligible: false,
      code: "LEVEL_MISMATCH",
      reason: `Course ${course.code} does not match your academic level.`,
    };
  }

  if (course.semesterName !== currentSemester.name) {
    return {
      eligible: false,
      code: "SEMESTER_MISMATCH",
      reason: `Course ${course.code} is a ${course.semesterName} semester course, not ${currentSemester.name}.`,
    };
  }

  if (isAlreadyRegistered) {
    return {
      eligible: false,
      code: "ALREADY_REGISTERED",
      reason: `You are already registered for ${course.code} this semester.`,
    };
  }

  return { eligible: true };
}

export const createRegistrationBatchSchema = z
  .object({
    courseIds: z
      .array(z.string().trim().min(1, "Course ID cannot be empty"))
      .min(1, "Select at least one course to register")
      .max(20, "Cannot register more than 20 courses at once")
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "Duplicate courseIds in request",
      }),
  })
  .strict();

export type CreateRegistrationBatchInput = z.infer<
  typeof createRegistrationBatchSchema
>;

export const listRegistrationsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    semesterId: z.string().trim().min(1).optional(),
    courseId: z.string().trim().min(1).optional(),
    programId: z.string().trim().min(1).optional(),
    levelId: z.string().trim().min(1).optional(),
    departmentId: z.string().trim().min(1).optional(),
    search: z.string().trim().optional(),
  })
  .strict();

export type ListRegistrationsQuery = z.infer<
  typeof listRegistrationsQuerySchema
>;

