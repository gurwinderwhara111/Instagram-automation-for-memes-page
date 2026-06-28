import { z } from "zod";
import { deriveVideoPath } from "@/lib/utils";

const uuidSchema = z.string().uuid("Choose an Instagram account.");

const httpsUrlSchema = z
  .string()
  .trim()
  .url("Use a valid public HTTPS video URL.")
  .refine((value) => value.startsWith("https://"), "Video URL must start with https://");

const scheduledAtSchema = z.string().trim().transform((value, ctx) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    ctx.addIssue({
      code: "custom",
      message: "Choose a valid schedule date and time."
    });
    return z.NEVER;
  }
  return date.toISOString();
});

const reelBaseSchema = z.object({
  accountId: uuidSchema,
  title: z.string().trim().min(2, "Title is required.").max(120),
  videoPath: z.string().trim().optional().nullable(),
  videoUrl: httpsUrlSchema,
  caption: z.string().trim().min(1, "Caption is required.").max(2200),
  scheduledAt: scheduledAtSchema
});

export const createReelSchema = reelBaseSchema.transform((value) => ({
  ...value,
  videoPath: value.videoPath || deriveVideoPath(value.videoUrl)
}));

export const batchReelItemSchema = z.object({
  title: z.string().trim().min(2, "Title is required.").max(120),
  videoPath: z.string().trim().min(1, "Video path is required."),
  videoUrl: httpsUrlSchema,
  caption: z.string().trim().min(1, "Caption is required.").max(2200),
  scheduledAt: scheduledAtSchema,
  accountIds: z.array(uuidSchema).min(1, "Choose at least one Instagram account.")
});

export const createBatchReelsSchema = z.object({
  items: z.array(batchReelItemSchema).min(1, "Select at least one video to schedule.")
});

export const updateReelSchema = reelBaseSchema.partial().transform((value) => ({
    ...value,
    videoPath:
      value.videoPath !== undefined
        ? value.videoPath || (value.videoUrl ? deriveVideoPath(value.videoUrl) : null)
        : value.videoUrl
          ? deriveVideoPath(value.videoUrl)
          : undefined
  }));

export const createAccountSchema = z.object({
  label: z.string().trim().min(2, "Account label is required.").max(80),
  igUserId: z.string().trim().min(3, "Instagram user ID is required.").max(80),
  accessToken: z.string().trim().min(20, "Access token looks too short."),
  tokenExpiresAt: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value, ctx) => {
      if (!value) {
        return null;
      }
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        ctx.addIssue({
          code: "custom",
          message: "Token expiry must be a valid date."
        });
        return z.NEVER;
      }
      return date.toISOString();
    })
});

export const updateAccountSchema = z.object({
  label: z.string().trim().min(2, "Account label is required.").max(80).optional(),
  igUserId: z.string().trim().min(3, "Instagram user ID is required.").max(80).optional(),
  accessToken: z
    .string()
    .trim()
    .transform((value) => value || undefined)
    .pipe(z.string().min(20, "Access token looks too short.").optional())
    .optional(),
  tokenExpiresAt: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value, ctx) => {
      if (!value) {
        return null;
      }
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        ctx.addIssue({
          code: "custom",
          message: "Token expiry must be a valid date."
        });
        return z.NEVER;
      }
      return date.toISOString();
    }),
  status: z.enum(["active", "disabled"]).optional()
});

export type CreateReelPayload = z.infer<typeof createReelSchema>;
export type CreateBatchReelsPayload = z.infer<typeof createBatchReelsSchema>;
export type UpdateReelPayload = z.infer<typeof updateReelSchema>;
export type CreateAccountPayload = z.infer<typeof createAccountSchema>;
export type UpdateAccountPayload = z.infer<typeof updateAccountSchema>;
