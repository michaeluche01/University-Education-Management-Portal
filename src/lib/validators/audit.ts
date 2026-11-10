import { z } from "zod";
import { AuditAction } from "@/generated/prisma/client";

export const listAuditLogsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
    action: z.nativeEnum(AuditAction).optional(),
    entityType: z.string().trim().max(50).optional(),
    actorId: z.string().trim().optional(),
    entityId: z.string().trim().optional(),
    departmentId: z.string().trim().optional(),
    fromDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    toDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  })
  .strict();

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
