import { z } from "zod";

export const studentReportQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    departmentId: z.string().trim().min(1).optional(),
    programId: z.string().trim().min(1).optional(),
    levelId: z.string().trim().min(1).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]).optional(),
    search: z.string().trim().min(1).max(50).optional(),
  })
  .strict();

export type StudentReportQuery = z.infer<typeof studentReportQuerySchema>;

export const registrationReportQuerySchema = z
  .object({
    semesterId: z.string().trim().min(1).optional(),
    courseId: z.string().trim().min(1).optional(),
    departmentId: z.string().trim().min(1).optional(),
    programId: z.string().trim().min(1).optional(),
    levelId: z.string().trim().min(1).optional(),
  })
  .strict();

export type RegistrationReportQuery = z.infer<typeof registrationReportQuerySchema>;

export const performanceReportQuerySchema = z
  .object({
    semesterId: z.string().trim().min(1).optional(),
    departmentId: z.string().trim().min(1).optional(),
    courseId: z.string().trim().min(1).optional(),
    programId: z.string().trim().min(1).optional(),
    levelId: z.string().trim().min(1).optional(),
  })
  .strict();

export type PerformanceReportQuery = z.infer<typeof performanceReportQuerySchema>;
