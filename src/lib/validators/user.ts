import { z } from "zod";

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  role: z
    .enum(["STUDENT", "LECTURER", "DEPARTMENT_ADMIN", "SUPER_ADMIN"])
    .optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]).optional(),
  departmentId: z.string().trim().min(1).optional(),
  search: z.string().trim().optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const createUserSchema = z
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
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? val : null)),
    password: z
      .string()
      .min(8, "Temporary password must be at least 8 characters")
      .max(128, "Password is too long"),
    role: z.enum(["STUDENT", "LECTURER", "DEPARTMENT_ADMIN", "SUPER_ADMIN"]),
    departmentId: z
      .string()
      .trim()
      .optional()
      .transform((val) => (val ? val : undefined)),
    matricNumber: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .transform((val) => (val ? val : undefined)),
    programId: z
      .string()
      .trim()
      .optional()
      .transform((val) => (val ? val : undefined)),
    levelId: z
      .string()
      .trim()
      .optional()
      .transform((val) => (val ? val : undefined)),
    staffId: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .transform((val) => (val ? val : undefined)),
    title: z
      .string()
      .trim()
      .max(60)
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? val : null)),
    specialization: z
      .string()
      .trim()
      .max(120)
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? val : null)),
  })
  .superRefine((data, ctx) => {
    if (data.role === "STUDENT") {
      if (!data.matricNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Matriculation number is required for students",
          path: ["matricNumber"],
        });
      }
      if (!data.departmentId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Department is required for students",
          path: ["departmentId"],
        });
      }
      if (!data.programId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Program is required for students",
          path: ["programId"],
        });
      }
      if (!data.levelId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Academic level is required for students",
          path: ["levelId"],
        });
      }
    } else if (data.role === "LECTURER" || data.role === "DEPARTMENT_ADMIN") {
      if (!data.staffId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Staff ID is required for lecturers and department admins",
          path: ["staffId"],
        });
      }
      if (!data.departmentId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Department is required for lecturers and department admins",
          path: ["departmentId"],
        });
      }
    }
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    phone: z
      .string()
      .trim()
      .max(40)
      .nullable()
      .optional()
      .transform((val) => (val === undefined ? undefined : val ? val : null)),
    departmentId: z.string().trim().min(1).optional(),
    programId: z.string().trim().min(1).optional(),
    levelId: z.string().trim().min(1).optional(),
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
  .refine(
    (data) =>
      data.fullName !== undefined ||
      data.phone !== undefined ||
      data.departmentId !== undefined ||
      data.programId !== undefined ||
      data.levelId !== undefined ||
      data.title !== undefined ||
      data.specialization !== undefined,
    { message: "At least one field must be provided for update" }
  );

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const updateUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .transform((val) => (val ? val : null)),
});

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

export const updateUserRoleSchema = z
  .object({
    role: z.enum(["STUDENT", "LECTURER", "DEPARTMENT_ADMIN", "SUPER_ADMIN"]),
    departmentId: z
      .string()
      .trim()
      .optional()
      .transform((val) => (val ? val : undefined)),
    staffId: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .transform((val) => (val ? val : undefined)),
    title: z
      .string()
      .trim()
      .max(60)
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? val : null)),
    specialization: z
      .string()
      .trim()
      .max(120)
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? val : null)),
  })
  .superRefine((data, ctx) => {
    if (data.role === "STUDENT") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Role cannot be changed to or from STUDENT.",
        path: ["role"],
      });
      return;
    }
    if (data.role === "LECTURER" || data.role === "DEPARTMENT_ADMIN") {
      if (!data.departmentId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "departmentId is required when converting to LECTURER or DEPARTMENT_ADMIN",
          path: ["departmentId"],
        });
      }
      if (!data.staffId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "staffId is required when converting to LECTURER or DEPARTMENT_ADMIN",
          path: ["staffId"],
        });
      }
    }
  });

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export const resetUserPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Temporary password must be at least 8 characters")
    .max(128, "Password is too long"),
});

export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;

