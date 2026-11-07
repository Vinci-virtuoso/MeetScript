import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../../src/server/app.ts";

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
  "connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

/** @param {Request} request */
async function call(request) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

/** @param {Response} response */
function expectSecurityHeaders(response) {
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("Content-Security-Policy")).toBe(CSP);
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  expect(response.headers.get("Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=()");
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/health", () => {
  it("returns 200 with status ok and the app version", async () => {
    const response = await call(new Request("http://example.com/api/health"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expectSecurityHeaders(response);
    expect(await response.json()).toEqual({ status: "ok", version: "0.2.0" });
  });

  it("reads the version from APP_VERSION", async () => {
    const ctx = createExecutionContext();
    const response = await worker.fetch(
      new Request("http://example.com/api/health"),
      { ...env, APP_VERSION: "9.9.9" },
      ctx,
    );
    await waitOnExecutionContext(ctx);
    expect(await response.json()).toEqual({ status: "ok", version: "9.9.9" });
  });
});

describe("POST /api/health", () => {
  it("returns 405 with Allow GET and the error body", async () => {
    const response = await call(new Request("http://example.com/api/health", { method: "POST" }));
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
    expect(response.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expectSecurityHeaders(response);
    const body = await response.json();
    expect(Object.keys(body).slice(0, 2)).toEqual(["error", "message"]);
    expect(body.error).toBe("method_not_allowed");
    expect(typeof body.message).toBe("string");
    expect(body.message.length).toBeGreaterThan(0);
  });
});

describe("unknown API routes", () => {
  it("GET /api/nothing returns 404 not_found", async () => {
    const response = await call(new Request("http://example.com/api/nothing"));
    expect(response.status).toBe(404);
    expectSecurityHeaders(response);
    const body = await response.json();
    expect(body.error).toBe("not_found");
    expect(typeof body.message).toBe("string");
  });

  it("DELETE /api/ returns 404 not_found", async () => {
    const response = await call(new Request("http://example.com/api/", { method: "DELETE" }));
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("not_found");
  });
});
