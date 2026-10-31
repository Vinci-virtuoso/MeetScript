// Shared by the sign-in island and the /auth/web routes.
import { z } from "zod";

export const EmailSchema = z.string().trim().toLowerCase().email().max(254);

export const CodeSendSchema = z.object({
  email: EmailSchema,
  locale: z.string().trim().max(64).optional(),
});

export const CodeVerifySchema = z.object({
  email: EmailSchema,
  code: z.string().trim().regex(/^\d{6}$/, "6 digits"),
});

export type CodeSend = z.infer<typeof CodeSendSchema>;
export type CodeVerify = z.infer<typeof CodeVerifySchema>;

export const PublicUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  plan: z.enum(["free", "pro"]),
  proUntil: z.number().nullable(),
});
export type PublicUser = z.infer<typeof PublicUserSchema>;

export const WebTokenSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
  isNewUser: z.boolean().optional(),
  user: PublicUserSchema.nullable().optional(),
});
