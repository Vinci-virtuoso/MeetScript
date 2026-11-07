// zod at the boundary. A failed parse answers 400 validation_error with the field paths.
import type { z } from "zod";
import { ApiError } from "./http.js";

export async function parseBody<T>(request: Request, schema: z.ZodType<T>, code = "validation_error"): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError(400, code, "Send a JSON body.", { issues: [] });
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ApiError(400, code, "The request body is not valid.", {
      issues: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
  }
  return result.data;
}
