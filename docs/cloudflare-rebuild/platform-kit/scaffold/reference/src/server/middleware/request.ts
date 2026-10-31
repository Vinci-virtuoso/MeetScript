// Cross-cutting middleware for every request the Worker answers (pages, /api, /auth):
// a request id on the response, one JSON log line, the security headers, and the per-request
// AsyncLocalStorage context (request id, waitUntil, request.cf) for code without a Hono context.
import type { MiddlewareHandler } from "hono";
import { cfFields, runWithRequest } from "../context.js";
import { errorFields, log, requestId, requestLog } from "../log.js";
import { SECURITY_HEADERS, STRICT_CSP, errorResponse } from "../http.js";

export type RequestVariables = {
  rid: string;
  /** Extends the request past the response (ExecutionContext.waitUntil or Astro's render option). */
  waitUntil: (promise: Promise<unknown>) => void;
};

export const REQUEST_ID_HEADER = "X-Request-Id";

/** Responses from a binding fetch can carry immutable headers; rebuild them before setting ours. */
function mutable(response: Response): Response {
  try {
    response.headers.set("X-Mutable-Probe", "1");
    response.headers.delete("X-Mutable-Probe");
    return response;
  } catch {
    return new Response(response.body, response);
  }
}

export function requestMiddleware(): MiddlewareHandler<{ Bindings: Env; Variables: RequestVariables }> {
  return async (c, next) => {
    const start = performance.now();
    const rid = requestId(c.req.raw);
    c.set("rid", rid);
    c.set("waitUntil", (promise) => {
      try {
        c.executionCtx.waitUntil(promise);
      } catch {
        promise.catch(() => {});
      }
    });
    const context = { rid, waitUntil: (p: Promise<unknown>) => c.get("waitUntil")(p), cf: cfFields(c.req.raw) };
    try {
      await runWithRequest(context, () => next());
    } catch (err) {
      log("error", "unhandled", { rid, ...errorFields(err) });
      c.res = errorResponse("internal", "Something went wrong on the server.", 500);
    }
    const response = mutable(c.res);
    response.headers.set(REQUEST_ID_HEADER, rid);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
    if (!response.headers.has("Content-Security-Policy")) {
      response.headers.set("Content-Security-Policy", STRICT_CSP);
    }
    const path = new URL(c.req.url).pathname;
    if (path.startsWith("/api/") || path.startsWith("/auth/") || path === "/healthz") {
      response.headers.set("Cache-Control", "no-store");
    }
    c.res = response;
    requestLog(c.req.raw, response.status, performance.now() - start, rid);
  };
}
