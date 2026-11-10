import { z } from "zod";

export const studentProfilePatchSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .max(40, "Phone number is too long")
      .nullable()
      .optional()
      .transform((val) => (val === undefined ? undefined : val ? val : null)),
    address: z
      .string()
      .trim()
      .max(300, "Address is too long")
      .nullable()
      .optional()
      .transform((val) => (val === undefined ? undefined : val ? val : null)),
    dateOfBirth: z
      .union([z.coerce.date(), z.literal(""), z.null()])
      .optional()
      .transform((val) =>
        val === undefined ? undefined : val instanceof Date ? val : null
      ),
    gender: z
      .string()
      .trim()
      .max(30, "Gender is too long")
      .nullable()
      .optional()
      .transform((val) => (val === undefined ? undefined : val ? val : null)),
  })
  .strict()
  .refine(
    (data) =>
      data.phone !== undefined ||
      data.address !== undefined ||
      data.dateOfBirth !== undefined ||
      data.gender !== undefined,
    { message: "At least one field must be provided for update" }
  );

export const lecturerProfilePatchSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .max(40, "Phone number is too long")
      .nullable()
      .optional()
      .transform((val) => (val === undefined ? undefined : val ? val : null)),
    specialization: z
      .string()
      .trim()
      .max(120, "Specialization is too long")
      .nullable()
      .optional()
      .transform((val) => (val === undefined ? undefined : val ? val : null)),
  })
  .strict()
  .refine(
    (data) => data.phone !== undefined || data.specialization !== undefined,
    { message: "At least one field must be provided for update" }
  );

export const adminProfilePatchSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .max(40, "Phone number is too long")
      .nullable()
      .optional()
      .transform((val) => (val === undefined ? undefined : val ? val : null)),
  })
  .strict()
  .refine((data) => data.phone !== undefined, {
    message: "At least one field must be provided for update",
  });

export type StudentProfilePatchInput = z.infer<
  typeof studentProfilePatchSchema
>;
export type LecturerProfilePatchInput = z.infer<
  typeof lecturerProfilePatchSchema
>;
export type AdminProfilePatchInput = z.infer<typeof adminProfilePatchSchema>;

