import { z } from "zod";

/** What the error boundary posts to /api/client-errors. No user data; the message is truncated. */
export const ClientErrorSchema = z.object({
  message: z.string().trim().min(1).max(500),
  stack: z.string().max(4000).optional(),
  url: z.string().max(500).optional(),
  component: z.string().max(100).optional(),
});
export type ClientError = z.infer<typeof ClientErrorSchema>;
