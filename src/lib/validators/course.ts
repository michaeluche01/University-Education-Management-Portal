import { z } from "zod";

/**
 * Normalizes a course code: trims leading/trailing whitespace, collapses
 * internal whitespace to a single space, and uppercases ("csc  301" -> "CSC 301").
 */
export function normalizeCourseCode(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

export const listCoursesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
    departmentId: z.string().trim().min(1).optional(),
    programId: z.string().trim().min(1).optional(),
    levelId: z.string().trim().min(1).optional(),
    semesterName: z.enum(["FIRST", "SECOND"]).optional(),
    isActive: z
      .enum(["true", "false"])
      .transform((val) => val === "true")
      .optional(),
    search: z.string().trim().optional(),
  })
  .strict();

export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>;

export const createCourseSchema = z
  .object({
    code: z
      .string()
      .transform(normalizeCourseCode)
      .pipe(
        z
          .string()
          .min(3, "Course code must be at least 3 characters")
          .max(24, "Course code must be at most 24 characters")
      ),
    title: z
      .string()
      .trim()
      .min(3, "Course title must be at least 3 characters")
      .max(160, "Course title is too long"),
    creditUnits: z.coerce
      .number()
      .int("Credit units must be an integer")
      .min(1, "Credit units must be between 1 and 6")
      .max(6, "Credit units must be between 1 and 6"),
    description: z
      .string()
      .trim()
      .max(500, "Description is too long")
      .nullable()
      .optional()
      .transform((val) => (val ? val : null)),
    departmentId: z
      .string()
      .trim()
      .min(1)
      .optional(),
    programId: z.string().trim().min(1, "Program is required"),
    levelId: z.string().trim().min(1, "Academic level is required"),
    semesterName: z.enum(["FIRST", "SECOND"]),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export type CreateCourseInput = z.infer<typeof createCourseSchema>;

export const updateCourseSchema = z
  .object({
    code: z
      .string()
      .transform(normalizeCourseCode)
      .pipe(
        z
          .string()
          .min(3, "Course code must be at least 3 characters")
          .max(24, "Course code must be at most 24 characters")
      )
      .optional(),
    title: z
      .string()
      .trim()
      .min(3, "Course title must be at least 3 characters")
      .max(160, "Course title is too long")
      .optional(),
    creditUnits: z.coerce
      .number()
      .int("Credit units must be an integer")
      .min(1, "Credit units must be between 1 and 6")
      .max(6, "Credit units must be between 1 and 6")
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, "Description is too long")
      .nullable()
      .optional()
      .transform((val) => (val === undefined ? undefined : val ? val : null)),
    departmentId: z.string().trim().min(1).optional(),
    programId: z.string().trim().min(1).optional(),
    levelId: z.string().trim().min(1).optional(),
    semesterName: z.enum(["FIRST", "SECOND"]).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.code !== undefined ||
      data.title !== undefined ||
      data.creditUnits !== undefined ||
      data.description !== undefined ||
      data.departmentId !== undefined ||
      data.programId !== undefined ||
      data.levelId !== undefined ||
      data.semesterName !== undefined ||
      data.isActive !== undefined,
    { message: "At least one field must be provided for update" }
  );

export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;

export const listCourseAssignmentsQuerySchema = z
  .object({
    semesterId: z.string().trim().min(1).optional(),
    courseId: z.string().trim().min(1).optional(),
    lecturerId: z.string().trim().min(1).optional(),
  })
  .strict();

export type ListCourseAssignmentsQuery = z.infer<
  typeof listCourseAssignmentsQuerySchema
>;

export const createCourseAssignmentSchema = z
  .object({
    courseId: z.string().trim().min(1, "courseId is required"),
    lecturerId: z.string().trim().min(1, "lecturerId is required"),
    semesterId: z.string().trim().min(1, "semesterId is required"),
  })
  .strict();

export type CreateCourseAssignmentInput = z.infer<
  typeof createCourseAssignmentSchema
>;

