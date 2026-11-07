// /api/client-errors (the browser error boundary) and /api/openapi.json.
import { Hono } from "hono";
import { ClientErrorSchema } from "../../schemas/client-error.js";
import { ApiError, emptyResponse, jsonResponse } from "../http.js";
import { errorFields, log } from "../log.js";
import { buildOpenApi } from "../openapi.js";
import { parseBody } from "../validate.js";
import type { RequestVariables } from "../middleware/request.js";

export const systemRoutes = new Hono<{ Bindings: Env; Variables: RequestVariables }>();

systemRoutes.post("/api/client-errors", async (c) => {
  const key = c.req.header("CF-Connecting-IP") || "unknown";
  try {
    const { success } = await c.env.RATE_LIMITER.limit({ key });
    if (!success) {
      throw new ApiError(429, "rate_limited", "Too many reports from this client; try again in a minute.", { retryAfterSeconds: 60 }, { "Retry-After": "60" });
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    log("warn", "rate_limiter", { rid: c.get("rid"), ...errorFields(err) });
  }
  const report = await parseBody(c.req.raw, ClientErrorSchema);
  log("warn", "client_error", {
    rid: c.get("rid"),
    message: report.message,
    stack: (report.stack ?? "").slice(0, 2000),
    url: report.url ? new URL(report.url, "http://x").pathname : "",
    component: report.component ?? "",
  });
  return emptyResponse(204);
});

systemRoutes.get("/api/openapi.json", (c) => {
  const doc = buildOpenApi(c.env.APP_VERSION, c.env.APP_ORIGIN || new URL(c.req.url).origin);
  return jsonResponse(doc, 200, { "Cache-Control": "public, max-age=300" });
});
