// Copied from minshop src/features/email/mailysend.test.ts.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMailysendEmail, normalizeMailysendUrl } from "./mailysend.js";

const msg = { to: "ana@example.com", subject: "Hi", html: "<p>hi</p>", text: "hi" };
const from = { email: "login@rent-split.local", name: "rent-split" };

afterEach(() => vi.unstubAllGlobals());

describe("normalizeMailysendUrl", () => {
  it("accepts https origins and strips trailing slash and /v1", () => {
    expect(normalizeMailysendUrl("https://mail.example.workers.dev/")).toBe("https://mail.example.workers.dev");
    expect(normalizeMailysendUrl(" https://m.example.com/v1/ ")).toBe("https://m.example.com");
    expect(normalizeMailysendUrl("https://m.example.com/mailysend")).toBe("https://m.example.com/mailysend");
  });
  it("rejects non-TLS, credentials, query strings and junk", () => {
    expect(normalizeMailysendUrl("http://m.example.com")).toBeNull();
    expect(normalizeMailysendUrl("https://u:p@m.example.com")).toBeNull();
    expect(normalizeMailysendUrl("https://m.example.com/?x=1")).toBeNull();
    expect(normalizeMailysendUrl("not a url")).toBeNull();
    expect(normalizeMailysendUrl("")).toBeNull();
    expect(normalizeMailysendUrl(null)).toBeNull();
  });
});

describe("createMailysendEmail", () => {
  it("posts the Resend-compatible payload via global fetch without a binding", async () => {
    const fetchMock = vi.fn(async () => new Response('{"id":"em_1"}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await createMailysendEmail("ms_key", from, { baseUrl: "https://m.example.com" }).send({
      ...msg,
      idempotencyKey: "receipt/1",
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://m.example.com/v1/emails");
    const h = init.headers as Record<string, string>;
    expect(h.authorization).toBe("Bearer ms_key");
    expect(h["idempotency-key"]).toBe("receipt/1");
    expect(JSON.parse(init.body as string)).toEqual({
      from: "rent-split <login@rent-split.local>",
      to: ["ana@example.com"],
      subject: "Hi",
      html: "<p>hi</p>",
      text: "hi",
    });
  });

  it("prefers the service binding when present", async () => {
    const globalFetch = vi.fn();
    vi.stubGlobal("fetch", globalFetch);
    const binding = { fetch: vi.fn(async (_r: Request | string) => new Response("{}", { status: 200 })) };
    await createMailysendEmail("ms_key", { email: "a@b.co", name: "" }, { baseUrl: "https://m.example.com", binding }).send(msg);
    expect(globalFetch).not.toHaveBeenCalled();
    const req = binding.fetch.mock.calls[0]![0] as Request;
    expect(req.url).toBe("https://m.example.com/v1/emails");
    expect(req.method).toBe("POST");
    expect(req.headers.get("authorization")).toBe("Bearer ms_key");
    expect(req.headers.get("idempotency-key")).toBeNull();
    expect(((await req.json()) as { from: string }).from).toBe("a@b.co");
  });

  it("throws with status and detail on a non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"name":"validation_error"}', { status: 422 })));
    await expect(createMailysendEmail("k", from, { baseUrl: "https://m.example.com" }).send(msg)).rejects.toThrow(
      /Mailysend send failed \(422\).*validation_error/,
    );
  });
});
