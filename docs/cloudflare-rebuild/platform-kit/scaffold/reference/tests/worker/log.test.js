import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { log, requestLog } from "../../src/server/log.ts";
import worker from "../../src/server/app.ts";

const REQUEST_KEYS = ["ts", "level", "msg", "rid", "method", "path", "status", "ms"];
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** @type {import("vitest").MockInstance<typeof console.log>} */
let logSpy;
/** @type {import("vitest").MockInstance<typeof console.warn>} */
let warnSpy;
/** @type {import("vitest").MockInstance<typeof console.error>} */
let errorSpy;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** @returns {string[]} every line written to any console level */
function allLines() {
  return [...logSpy.mock.calls, ...warnSpy.mock.calls, ...errorSpy.mock.calls].map((call) => {
    expect(call).toHaveLength(1);
    expect(typeof call[0]).toBe("string");
    return String(call[0]);
  });
}

/** @param {Request} request */
async function call(request) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

describe("log()", () => {
  it("writes one JSON line with ts, level, msg and the fields", () => {
    log("info", "hello", { a: 1 });
    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(Object.keys(line)).toEqual(["ts", "level", "msg", "a"]);
    expect(line.ts).toMatch(ISO_UTC);
    expect(line.level).toBe("info");
    expect(line.msg).toBe("hello");
    expect(line.a).toBe(1);
  });

  it("routes warn and error to console.warn and console.error", () => {
    log("warn", "w", {});
    log("error", "e", { err: "boom", stack: "at x" });
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(warnSpy.mock.calls[0][0])).level).toBe("warn");
    const errorLine = JSON.parse(String(errorSpy.mock.calls[0][0]));
    expect(errorLine.level).toBe("error");
    expect(errorLine.err).toBe("boom");
    expect(errorLine.stack).toBe("at x");
  });
});

describe("requestLog()", () => {
  it("writes the request line with exactly the request keys", () => {
    const request = new Request("http://example.com/api/health?x=1", {
      headers: { "cf-ray": "abc123-LHR", "CF-Connecting-IP": "203.0.113.9" },
    });
    requestLog(request, 200, 12.6);
    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(Object.keys(line)).toEqual(REQUEST_KEYS);
    expect(line.msg).toBe("request");
    expect(line.rid).toBe("abc123-LHR");
    expect(line.method).toBe("GET");
    expect(line.path).toBe("/api/health");
    expect(line.status).toBe(200);
    expect(line.ms).toBe(13);
  });

  it("uses a random UUID as rid when cf-ray is absent", () => {
    requestLog(new Request("http://example.com/api/health"), 200, 1);
    const line = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(line.rid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe("one request log line per API request", () => {
  const cases = [
    { name: "GET /api/health", request: () => new Request("http://example.com/api/health"), status: 200 },
    { name: "POST /api/health", request: () => new Request("http://example.com/api/health", { method: "POST" }), status: 405 },
    { name: "GET /api/nothing", request: () => new Request("http://example.com/api/nothing"), status: 404 },
  ];

  for (const c of cases) {
    it(`${c.name} writes exactly one line with the request keys`, async () => {
      const ip = "198.51.100.77";
      const request = c.request();
      request.headers.set("CF-Connecting-IP", ip);
      request.headers.set("cf-ray", "ray-" + c.status);
      const response = await call(request);
      expect(response.status).toBe(c.status);
      const lines = allLines();
      expect(lines).toHaveLength(1);
      const line = JSON.parse(lines[0]);
      expect(Object.keys(line)).toEqual(REQUEST_KEYS);
      expect(line.ts).toMatch(ISO_UTC);
      expect(line.level).toBe("info");
      expect(line.msg).toBe("request");
      expect(line.rid).toBe("ray-" + c.status);
      expect(line.method).toBe(request.method);
      expect(line.path).toBe(new URL(request.url).pathname);
      expect(line.status).toBe(c.status);
      expect(typeof line.ms).toBe("number");
      expect(line.ms).toBeGreaterThanOrEqual(0);
      expect(lines[0]).not.toContain(ip);
      expect(lines[0]).not.toContain("body");
    });
  }

  it("never logs the request body or the client IP", async () => {
    const ip = "192.0.2.44";
    const secret = "name=Ana&rent=144500";
    const response = await call(
      new Request("http://example.com/api/nothing", {
        method: "POST",
        headers: { "CF-Connecting-IP": ip, "Content-Type": "text/plain" },
        body: secret,
      }),
    );
    expect(response.status).toBe(404);
    const joined = allLines().join("\n");
    expect(joined).not.toContain(ip);
    expect(joined).not.toContain("Ana");
    expect(joined).not.toContain("144500");
  });
});
