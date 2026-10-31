// GET /api/health keeps the v1 contract body. GET /healthz adds a D1 round trip for the deploy check.
import { Hono } from "hono";
import { ApiError, jsonResponse } from "../http.js";
import { errorFields, log } from "../log.js";

export const healthRoutes = new Hono<{ Bindings: Env }>();

healthRoutes.on(["POST", "PUT", "PATCH", "DELETE"], "/api/health", () => {
  throw new ApiError(405, "method_not_allowed", "Use GET for this route.", {}, { Allow: "GET" });
});

healthRoutes.get("/api/health", (c) => jsonResponse({ status: "ok", version: c.env.APP_VERSION }));

healthRoutes.get("/healthz", async (c) => {
  let db: "ok" | "error" = "ok";
  try {
    await c.env.DB.prepare("SELECT 1").first();
  } catch (err) {
    db = "error";
    log("error", "healthz_db", { rid: c.req.header("cf-ray") ?? "", ...errorFields(err) });
  }
  const status = db === "ok" ? "ok" : "degraded";
  return jsonResponse({ status, version: c.env.APP_VERSION, checks: { db } }, db === "ok" ? 200 : 503);
});
