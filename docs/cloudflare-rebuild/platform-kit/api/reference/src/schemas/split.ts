// Saved splits: shared by the splits page island and /api/splits. A saved split is a name plus the
// v1 link code (contract C1); the server decodes the code with the same module the page uses.
import { z } from "zod";

export const SPLIT_NAME_MAX = 60;

export const SplitNameSchema = z.string().trim().min(1, "Enter a name.").max(SPLIT_NAME_MAX);
export const LinkCodeSchema = z.string().regex(/^v1\.[A-Za-z0-9_-]{1,6000}$/, "Not a rent-split link code.");

export const SplitCreateSchema = z.object({
  name: SplitNameSchema,
  code: LinkCodeSchema,
});
export type SplitCreate = z.infer<typeof SplitCreateSchema>;

export const SplitUpdateSchema = z
  .object({ name: SplitNameSchema.optional(), code: LinkCodeSchema.optional() })
  .refine((v) => v.name !== undefined || v.code !== undefined, "Send a name or a code.");
export type SplitUpdate = z.infer<typeof SplitUpdateSchema>;

export const SplitSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  currency: z.string(),
  rent: z.number().int(),
  persons: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type SplitDto = z.infer<typeof SplitSchema>;

export const SplitListSchema = z.object({
  splits: z.array(SplitSchema),
  count: z.number().int(),
  freeLimit: z.number().int(),
  canCreate: z.boolean(),
});
export type SplitList = z.infer<typeof SplitListSchema>;
