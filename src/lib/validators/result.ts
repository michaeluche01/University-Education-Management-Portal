import { z } from "zod";

const scoreDecimalsRefine = (val: number) =>
  Math.abs(val * 100 - Math.round(val * 100)) <= 1e-6;

export const resultSheetQuerySchema = z
  .object({
    courseId: z.string().trim().min(1, "courseId is required"),
    semesterId: z.string().trim().min(1, "semesterId is required"),
  })
  .strict();

export type ResultSheetQuery = z.infer<typeof resultSheetQuerySchema>;

export const resultDraftEntrySchema = z
  .object({
    registrationId: z.string().trim().min(1, "registrationId is required"),
    caScore: z
      .number({ message: "caScore must be a number" })
      .finite("caScore must be a finite number")
      .min(0, "caScore must be between 0 and 30")
      .max(30, "caScore must be between 0 and 30")
      .refine(scoreDecimalsRefine, {
        message: "caScore cannot have more than 2 decimal places",
      }),
    examScore: z
      .number({ message: "examScore must be a number" })
      .finite("examScore must be a finite number")
      .min(0, "examScore must be between 0 and 70")
      .max(70, "examScore must be between 0 and 70")
      .refine(scoreDecimalsRefine, {
        message: "examScore cannot have more than 2 decimal places",
      }),
  })
  .strict();

export const saveDraftResultsSchema = z
  .object({
    courseId: z.string().trim().min(1, "courseId is required"),
    semesterId: z.string().trim().min(1, "semesterId is required"),
    entries: z
      .array(resultDraftEntrySchema)
      .min(1, "At least one entry is required")
      .max(500, "Cannot save more than 500 entries at once"),
  })
  .strict();

export type SaveDraftResultsInput = z.infer<typeof saveDraftResultsSchema>;

export const submitResultsSchema = z
  .object({
    courseId: z.string().trim().min(1, "courseId is required"),
    semesterId: z.string().trim().min(1, "semesterId is required"),
  })
  .strict();

export type SubmitResultsInput = z.infer<typeof submitResultsSchema>;

export const submissionsQuerySchema = z
  .object({
    semesterId: z.string().trim().min(1).optional(),
  })
  .strict();

export type SubmissionsQuery = z.infer<typeof submissionsQuerySchema>;

export const approveResultsSchema = z
  .object({
    courseId: z.string().trim().min(1, "courseId is required"),
    semesterId: z.string().trim().min(1, "semesterId is required"),
    resultIds: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(500)
      .optional(),
  })
  .strict();

export type ApproveResultsInput = z.infer<typeof approveResultsSchema>;

export const returnResultsSchema = z
  .object({
    courseId: z.string().trim().min(1, "courseId is required"),
    semesterId: z.string().trim().min(1, "semesterId is required"),
    feedback: z
      .string()
      .trim()
      .min(3, "Feedback must be between 3 and 500 characters")
      .max(500, "Feedback must be between 3 and 500 characters"),
    resultIds: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(500)
      .optional(),
  })
  .strict();

export type ReturnResultsInput = z.infer<typeof returnResultsSchema>;

export const reopenResultsSchema = z
  .object({
    courseId: z.string().trim().min(1, "courseId is required"),
    semesterId: z.string().trim().min(1, "semesterId is required"),
    reason: z
      .string()
      .trim()
      .min(3, "Reason must be between 3 and 500 characters")
      .max(500, "Reason must be between 3 and 500 characters"),
    resultIds: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(500)
      .optional(),
  })
  .strict();

export type ReopenResultsInput = z.infer<typeof reopenResultsSchema>;
