// The Hono server: every /api, /auth and /healthz route. src/fetch.ts mounts this in front of the
// Astro pages; tests call `app.fetch(request, env, ctx)` directly (no Astro needed under vitest).
import { Hono, type MiddlewareHandler } from "hono";
import { login } from "./auth/login.js";
import { authRateLimit } from "./auth/rate-limit.js";
import { authWebRoutes } from "./auth/web.js";
import { ApiError, errorResponse } from "./http.js";
import { errorFields, log } from "./log.js";
import { corsAllowlist } from "./middleware/cors.js";
import { originCheck } from "./middleware/origin.js";
import { requestMiddleware, type RequestVariables } from "./middleware/request.js";
import { devRoutes } from "./routes/dev.js";
import { eventRoutes } from "./routes/events.js";
import { healthRoutes } from "./routes/health.js";
import { meRoutes } from "./routes/me.js";
import { splitRoutes } from "./routes/splits.js";
import { systemRoutes } from "./routes/system.js";
import { billingRoutes, webhookRoutes } from "./routes/billing.js";

export type AppEnv = { Bindings: Env; Variables: RequestVariables };

export interface CreateAppOptions {
  /**
   * Bindings to use when Hono's fetch is called without an env. Astro calls the fetch entry as
   * `fetch(request)` (no env, no ExecutionContext), so src/fetch.ts passes the `cloudflare:workers`
   * env here. Tests and a plain Worker entry pass env to `app.fetch` and never need it.
   */
  fallbackEnv?: () => Env;
  /** Middleware run right after the request middleware (src/fetch.ts uses it to expose waitUntil). */
  prepare?: MiddlewareHandler<AppEnv>;
}

/** Routes a browser never calls with a cookie: the signed webhook and the anonymous events beacon. */
const ORIGIN_EXEMPT = (path: string) => path === "/api/events" || path.startsWith("/api/webhooks/");

export function createApp(options: CreateAppOptions = {}): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use(async (c, next) => {
    if (!c.env && options.fallbackEnv) c.env = options.fallbackEnv();
    await next();
  });
  app.use(requestMiddleware());
  if (options.prepare) app.use(options.prepare);

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return errorResponse(err.code, err.message, err.status, err.fields, err.headers);
    }
    log("error", "route_error", { rid: c.get("rid"), path: new URL(c.req.url).pathname, ...errorFields(err) });
    return errorResponse("internal", "Something went wrong on the server.", 500);
  });

  // Security baseline on the JSON surface: CORS allowlist, origin check, edge rate limit on codes.
  app.use("/api/*", corsAllowlist());
  app.use("/auth/*", corsAllowlist());
  app.use("/api/*", originCheck({ exempt: ORIGIN_EXEMPT }));
  app.use("/auth/web/*", originCheck({ requireOrigin: true }));
  app.use("/auth/*", originCheck());
  app.use("/auth/code/*", authRateLimit());
  app.use("/auth/web/code/*", authRateLimit());
  app.use("/auth/account/delete/*", authRateLimit());

  app.route("/", healthRoutes);
  app.route("/", eventRoutes);
  app.route("/", meRoutes);
  app.route("/", splitRoutes as unknown as Hono<AppEnv>);
  app.route("/", billingRoutes as unknown as Hono<AppEnv>);
  app.route("/", webhookRoutes);
  app.route("/", systemRoutes);
  app.route("/", devRoutes);
  app.route("/", authWebRoutes);
  app.route("/", login.app as unknown as Hono<AppEnv>);

  app.all("/api/*", () => {
    throw new ApiError(404, "not_found", "There is no API route at this path.");
  });
  app.all("/auth/*", () => {
    throw new ApiError(404, "not_found", "There is no auth route at this path.");
  });
  return app;
}

const app = createApp();
export default { fetch: app.fetch };
