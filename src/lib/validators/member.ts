import { z } from "zod";

export const listStudentsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    departmentId: z.string().trim().min(1).optional(),
    programId: z.string().trim().min(1).optional(),
    levelId: z.string().trim().min(1).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]).optional(),
    search: z.string().trim().optional(),
  })
  .strict();

export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;

export const createStudentSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Valid email address is required"),
    fullName: z
      .string()
      .trim()
      .min(2, "Full name is required")
      .max(120, "Full name is too long"),
    phone: z
      .string()
      .trim()
      .max(40, "Phone number is too long")
      .nullable()
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? val : null)),
    password: z
      .string()
      .min(8, "Temporary password must be at least 8 characters")
      .max(128, "Password is too long"),
    matricNumber: z
      .string()
      .trim()
      .min(3, "Matriculation number is required")
      .max(40, "Matriculation number is too long")
      .transform((v) => v.toUpperCase()),
    departmentId: z
      .string()
      .trim()
      .optional()
      .transform((val) => (val ? val : undefined)),
    programId: z.string().trim().min(1, "Program is required"),
    levelId: z.string().trim().min(1, "Academic level is required"),
    gender: z
      .string()
      .trim()
      .max(30)
      .nullable()
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? val : null)),
    dateOfBirth: z
      .union([z.coerce.date(), z.literal(""), z.null()])
      .optional()
      .transform((val) => (val instanceof Date ? val : null)),
    address: z
      .string()
      .trim()
      .max(300)
      .nullable()
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? val : null)),
  })
  .strict();

export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    phone: z
      .string()
      .trim()
      .max(40)
      .nullable()
      .optional()
      .transform((val) => (val === undefined ? undefined : val ? val : null)),
    gender: z
      .string()
      .trim()
      .max(30)
      .nullable()
      .optional()
      .transform((val) => (val === undefined ? undefined : val ? val : null)),
    dateOfBirth: z
      .union([z.coerce.date(), z.literal(""), z.null()])
      .optional()
      .transform((val) =>
        val === undefined ? undefined : val instanceof Date ? val : null
      ),
    address: z
      .string()
      .trim()
      .max(300)
      .nullable()
      .optional()
      .transform((val) => (val === undefined ? undefined : val ? val : null)),
    levelId: z.string().trim().min(1).optional(),
    programId: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.fullName !== undefined ||
      data.phone !== undefined ||
      data.gender !== undefined ||
      data.dateOfBirth !== undefined ||
      data.address !== undefined ||
      data.levelId !== undefined ||
      data.programId !== undefined,
    { message: "At least one field must be provided for update" }
  );

export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

export const listLecturersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    departmentId: z.string().trim().min(1).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]).optional(),
    search: z.string().trim().optional(),
  })
  .strict();

export type ListLecturersQuery = z.infer<typeof listLecturersQuerySchema>;

export const createLecturerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Valid email address is required"),
    fullName: z
      .string()
      .trim()
      .min(2, "Full name is required")
      .max(120, "Full name is too long"),
    phone: z
      .string()
      .trim()
      .max(40, "Phone number is too long")
      .nullable()
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? val : null)),
    password: z
      .string()
      .min(8, "Temporary password must be at least 8 characters")
      .max(128, "Password is too long"),
    staffId: z
      .string()
      .trim()
      .min(2, "Staff ID is required")
      .max(40, "Staff ID is too long")
      .transform((v) => v.toUpperCase()),
    departmentId: z
      .string()
      .trim()
      .optional()
      .transform((val) => (val ? val : undefined)),
    title: z
      .string()
      .trim()
      .max(60)
      .nullable()
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? val : null)),
    specialization: z
      .string()
      .trim()
      .max(120)
      .nullable()
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? val : null)),
  })
  .strict();

export type CreateLecturerInput = z.infer<typeof createLecturerSchema>;

export const updateLecturerSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    phone: z
      .string()
      .trim()
      .max(40)
      .nullable()
      .optional()
      .transform((val) => (val === undefined ? undefined : val ? val : null)),
    title: z
      .string()
      .trim()
      .max(60)
      .nullable()
      .optional()
      .transform((val) => (val === undefined ? undefined : val ? val : null)),
    specialization: z
      .string()
      .trim()
      .max(120)
      .nullable()
      .optional()
      .transform((val) => (val === undefined ? undefined : val ? val : null)),
  })
  .strict()
  .refine(
    (data) =>
      data.fullName !== undefined ||
      data.phone !== undefined ||
      data.title !== undefined ||
      data.specialization !== undefined,
    { message: "At least one field must be provided for update" }
  );

export type UpdateLecturerInput = z.infer<typeof updateLecturerSchema>;

