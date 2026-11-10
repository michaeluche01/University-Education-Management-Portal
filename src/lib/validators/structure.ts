import { z } from "zod";

// ============================================================================
// Faculties
// ============================================================================
export const createFacultySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Faculty name must be at least 2 characters")
    .max(120, "Faculty name is too long"),
  code: z
    .string()
    .trim()
    .min(2, "Faculty code must be at least 2 characters")
    .max(16, "Faculty code must be at most 16 characters")
    .transform((v) => v.toUpperCase()),
  description: z
    .string()
    .trim()
    .max(500, "Description is too long")
    .optional()
    .nullable(),
});

export const updateFacultySchema = createFacultySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export type CreateFacultyInput = z.infer<typeof createFacultySchema>;
export type UpdateFacultyInput = z.infer<typeof updateFacultySchema>;

// ============================================================================
// Departments
// ============================================================================
export const createDepartmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Department name must be at least 2 characters")
    .max(120, "Department name is too long"),
  code: z
    .string()
    .trim()
    .min(2, "Department code must be at least 2 characters")
    .max(16, "Department code must be at most 16 characters")
    .transform((v) => v.toUpperCase()),
  facultyId: z.string().trim().min(1, "Faculty is required"),
});

export const updateDepartmentSchema = createDepartmentSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

// ============================================================================
// Programs
// ============================================================================
export const createProgramSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Program name must be at least 2 characters")
      .max(120, "Program name is too long"),
    code: z
      .string()
      .trim()
      .min(2, "Program code must be at least 2 characters")
      .max(20, "Program code must be at most 20 characters")
      .transform((v) => v.toUpperCase()),
    durationYears: z.coerce
      .number()
      .int("Duration must be a whole number")
      .min(1, "Duration must be at least 1 year")
      .max(10, "Duration must be at most 10 years")
      .default(4),
    departmentId: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : undefined)),
  })
  .strict();

export const updateProgramSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Program name must be at least 2 characters")
      .max(120, "Program name is too long")
      .optional(),
    code: z
      .string()
      .trim()
      .min(2, "Program code must be at least 2 characters")
      .max(20, "Program code must be at most 20 characters")
      .transform((v) => v.toUpperCase())
      .optional(),
    durationYears: z.coerce
      .number()
      .int("Duration must be a whole number")
      .min(1, "Duration must be at least 1 year")
      .max(10, "Duration must be at most 10 years")
      .optional(),
    departmentId: z
      .string()
      .trim()
      .min(1, "Department cannot be empty")
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export type CreateProgramInput = z.infer<typeof createProgramSchema>;
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;

// ============================================================================
// Academic Levels (D5: global, SUPER_ADMIN only, multiples of 100 from 100..900)
// ============================================================================
export const createLevelSchema = z.object({
  levelNumber: z.coerce
    .number()
    .int("Level number must be an integer")
    .min(100, "Level number must be between 100 and 900")
    .max(900, "Level number must be between 100 and 900")
    .refine((n) => n % 100 === 0, {
      message: "Level number must be a multiple of 100 (e.g. 100, 200, 300)",
    }),
});

export type CreateLevelInput = z.infer<typeof createLevelSchema>;

// ============================================================================
// Academic Sessions & Semesters
// ============================================================================
export function validateSessionName(name: string): {
  valid: boolean;
  message?: string;
} {
  const trimmed = name.trim();
  const match = /^(\d{4})\/(\d{4})$/.exec(trimmed);
  if (!match) {
    return {
      valid: false,
      message: "Session name must match YYYY/YYYY (e.g. 2026/2027)",
    };
  }
  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  if (endYear !== startYear + 1) {
    return {
      valid: false,
      message: "Session end year must equal start year + 1 (e.g. 2026/2027)",
    };
  }
  return { valid: true };
}

export const createSessionSchema = z
  .object({
    name: z
      .string()
      .trim()
      .superRefine((val, ctx) => {
        const res = validateSessionName(val);
        if (!res.valid) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: res.message ?? "Invalid session name",
          });
        }
      }),
    startDate: z.coerce.date({ message: "Valid startDate is required" }),
    endDate: z.coerce.date({ message: "Valid endDate is required" }),
    isCurrent: z.boolean().optional().default(false),
  })
  .refine((data) => data.startDate < data.endDate, {
    message: "startDate must be earlier than endDate",
    path: ["endDate"],
  });

export const updateSessionSchema = z
  .object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    isCurrent: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.startDate !== undefined ||
      data.endDate !== undefined ||
      data.isCurrent !== undefined,
    { message: "At least one field must be provided for update" }
  )
  .refine((data) => data.isCurrent !== false, {
    message:
      "Cannot unset current session directly; switch by making another session current.",
    path: ["isCurrent"],
  });

export const updateSemesterSchema = z
  .object({
    registrationOpen: z.boolean().optional(),
    isCurrent: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.registrationOpen !== undefined || data.isCurrent !== undefined,
    { message: "At least one field must be provided for update" }
  )
  .refine((data) => data.isCurrent !== false, {
    message:
      "Cannot unset current semester directly; switch by making another semester current.",
    path: ["isCurrent"],
  });

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
export type UpdateSemesterInput = z.infer<typeof updateSemesterSchema>;

// ============================================================================
// Grade Scale (PUT /api/v1/grade-scale)
// ============================================================================
export interface GradeScaleInputRow {
  grade: string;
  minScore: number;
  gradePoint: number;
  remark: string;
}

export interface DerivedGradeScaleRow {
  grade: string;
  minScore: number;
  maxScore: number;
  gradePoint: number;
  remark: string;
}

export function validateAndDeriveGradeScale(
  rows: readonly GradeScaleInputRow[]
):
  | { valid: true; rows: DerivedGradeScaleRow[] }
  | { valid: false; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(rows) || rows.length < 2) {
    return {
      valid: false,
      errors: ["Grade scale must contain at least 2 bands."],
    };
  }

  const normalized = rows.map((r) => ({
    grade: typeof r.grade === "string" ? r.grade.trim().toUpperCase() : "",
    minScore: Number(r.minScore),
    gradePoint: Number(r.gradePoint),
    remark: typeof r.remark === "string" ? r.remark.trim() : "",
  }));

  const seenGrades = new Set<string>();
  const seenMinScores = new Set<number>();

  for (const [idx, row] of normalized.entries()) {
    const label = row.grade || `Row #${idx + 1}`;
    if (!row.grade) {
      errors.push(`Row #${idx + 1}: grade label is required.`);
    } else if (seenGrades.has(row.grade)) {
      errors.push(`Duplicate grade "${row.grade}".`);
    } else {
      seenGrades.add(row.grade);
    }

    if (!row.remark) {
      errors.push(`${label}: remark is required.`);
    }

    if (
      !Number.isInteger(row.minScore) ||
      row.minScore < 0 ||
      row.minScore > 100
    ) {
      errors.push(`${label}: minScore must be an integer between 0 and 100.`);
    } else if (seenMinScores.has(row.minScore)) {
      errors.push(`Duplicate minScore ${row.minScore}.`);
    } else {
      seenMinScores.add(row.minScore);
    }

    if (
      !Number.isFinite(row.gradePoint) ||
      row.gradePoint < 0 ||
      row.gradePoint > 5
    ) {
      errors.push(`${label}: gradePoint must be between 0 and 5.`);
    }
  }

  if (!seenMinScores.has(0)) {
    errors.push("A band with minScore = 0 is required.");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const sortedAsc = [...normalized].sort((a, b) => a.minScore - b.minScore);

  for (let i = 1; i < sortedAsc.length; i++) {
    if (sortedAsc[i].gradePoint < sortedAsc[i - 1].gradePoint) {
      errors.push(
        `Band "${sortedAsc[i].grade}" (minScore ${sortedAsc[i].minScore}) cannot have a lower gradePoint (${sortedAsc[i].gradePoint}) than band "${sortedAsc[i - 1].grade}" (minScore ${sortedAsc[i - 1].minScore}, gradePoint ${sortedAsc[i - 1].gradePoint}).`
      );
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const derivedAsc: DerivedGradeScaleRow[] = sortedAsc.map((band, i) => {
    const isTop = i === sortedAsc.length - 1;
    const maxScore = isTop ? 100 : sortedAsc[i + 1].minScore - 1;
    return {
      grade: band.grade,
      minScore: band.minScore,
      maxScore,
      gradePoint: band.gradePoint,
      remark: band.remark,
    };
  });

  // Return ordered from highest minScore to lowest (A -> F)
  const derivedDesc = [...derivedAsc].sort((a, b) => b.minScore - a.minScore);
  return { valid: true, rows: derivedDesc };
}

export const putGradeScaleSchema = z
  .object({
    rows: z.array(
      z.object({
        grade: z.string(),
        minScore: z.number(),
        gradePoint: z.number(),
        remark: z.string(),
      })
    ),
  })
  .superRefine((val, ctx) => {
    const res = validateAndDeriveGradeScale(val.rows);
    if (!res.valid) {
      for (const err of res.errors) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err,
          path: ["rows"],
        });
      }
    }
  });

