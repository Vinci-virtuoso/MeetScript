// /api/splits (policy + free limit), /api/billing (pending checkout, webhook settles, idempotency),
// /api/client-errors, /api/openapi.json.
import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeLinkCode } from "../../public/js/link.js";
import { findOrCreateUser, setUserPlan } from "../../src/db/index.js";
import { signBachsPayload } from "../../src/payments/bachs.js";
import { signAccessToken } from "loginbase";
import worker from "../../src/server/app.js";

const ORIGIN = "http://127.0.0.1:8787";
const SECRET = "whsec_test_secret";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

async function call(path: string, init: RequestInit = {}, bindings: Record<string, unknown> = {}): Promise<Response> {
  const ctx = createExecutionContext();
  const headers = new Headers(init.headers);
  if (init.method && init.method !== "GET" && !headers.has("Origin")) headers.set("Origin", ORIGIN);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await worker.fetch(new Request(`${ORIGIN}${path}`, { ...init, headers }), { ...env, ...bindings } as never, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

let n = 0;
async function user(email?: string) {
  n += 1;
  const { user } = await findOrCreateUser(env.DB, email ?? `user${n}@example.com`);
  const token = await signAccessToken(env.JWT_SECRET!, user.id, "sid", 900);
  const auth = { Authorization: `Bearer ${token}` };
  return { user, auth };
}

const G1 = {
  currency: "USD",
  rent: 144500,
  utilities: 11000,
  commonPct: 30,
  bathPct: 15,
  incomeMode: false,
  rooms: [
    { name: "Big", size: 14, bath: false },
    { name: "Small", size: 9, bath: false },
  ],
  persons: [
    { name: "Ana", room: 1, income: null },
    { name: "Ben", room: 0, income: null },
    { name: "Cal", room: 0, income: null },
  ],
};
const CODE = encodeLinkCode(G1, "AAAAAAAAAAA");

const json = async <T>(r: Response) => (await r.json()) as T;

describe("/api/splits", () => {
  it("saves, lists, reads, renames and deletes within the owner scope", async () => {
    const a = await user();
    const b = await user();
    const created = await call("/api/splits", { method: "POST", headers: a.auth, body: JSON.stringify({ name: "  Flat on Oak St ", code: CODE }) });
    expect(created.status).toBe(201);
    const split = await json<{ id: string; name: string; currency: string; rent: number; persons: number }>(created);
    expect(split).toMatchObject({ name: "Flat on Oak St", currency: "USD", rent: 144500, persons: 3 });

    const list = await json<{ splits: { id: string }[]; count: number; freeLimit: number; canCreate: boolean }>(await call("/api/splits", { headers: a.auth }));
    expect(list.count).toBe(1);
    expect(list.freeLimit).toBe(3);
    expect(list.canCreate).toBe(true);
    expect(list.splits[0]!.id).toBe(split.id);
    expect((await json<{ count: number }>(await call("/api/splits", { headers: b.auth }))).count).toBe(0);

    expect((await call(`/api/splits/${split.id}`, { headers: b.auth })).status).toBe(404);
    expect((await call(`/api/splits/${split.id}`, { method: "PATCH", headers: b.auth, body: JSON.stringify({ name: "x" }) })).status).toBe(404);
    expect((await call(`/api/splits/${split.id}`, { method: "DELETE", headers: b.auth })).status).toBe(404);

    const renamed = await call(`/api/splits/${split.id}`, { method: "PATCH", headers: a.auth, body: JSON.stringify({ name: "Oak St" }) });
    expect(renamed.status).toBe(200);
    expect((await json<{ name: string }>(renamed)).name).toBe("Oak St");
    expect((await call(`/api/splits/${split.id}`, { method: "DELETE", headers: a.auth })).status).toBe(204);
    expect((await call(`/api/splits/${split.id}`, { headers: a.auth })).status).toBe(404);
  });

  it("validates the body and the link code", async () => {
    const a = await user();
    const bad = await call("/api/splits", { method: "POST", headers: a.auth, body: JSON.stringify({ name: "", code: CODE }) });
    expect(bad.status).toBe(400);
    expect(await json<{ error: string; issues: { path: string }[] }>(bad)).toMatchObject({ error: "validation_error", issues: [{ path: "name" }] });
    const broken = await call("/api/splits", { method: "POST", headers: a.auth, body: JSON.stringify({ name: "x", code: "v1.e30" }) });
    expect(broken.status).toBe(400);
    expect((await json<{ error: string }>(broken)).error).toBe("invalid_code");
    const notJson = await call("/api/splits", { method: "POST", headers: a.auth, body: "{" });
    expect(notJson.status).toBe(400);
    expect((await call("/api/splits", { method: "POST", body: JSON.stringify({ name: "x", code: CODE }) })).status).toBe(401);
  });

  it("stops a free account at 3 saved splits with plan_required, Pro continues", async () => {
    const a = await user();
    for (let i = 0; i < 3; i += 1) {
      expect((await call("/api/splits", { method: "POST", headers: a.auth, body: JSON.stringify({ name: `s${i}`, code: CODE }) })).status).toBe(201);
    }
    const fourth = await call("/api/splits", { method: "POST", headers: a.auth, body: JSON.stringify({ name: "s3", code: CODE }) });
    expect(fourth.status).toBe(403);
    expect(await json<Record<string, unknown>>(fourth)).toMatchObject({ error: "plan_required", plan: "pro", freeLimit: 3, count: 3 });
    expect((await json<{ canCreate: boolean }>(await call("/api/splits", { headers: a.auth }))).canCreate).toBe(false);
    expect((await call("/api/splits/export", { headers: a.auth })).status).toBe(403);

    await setUserPlan(env.DB, a.user.id, "pro", Date.now() + 86400000);
    expect((await call("/api/splits", { method: "POST", headers: a.auth, body: JSON.stringify({ name: "s3", code: CODE }) })).status).toBe(201);
    const exported = await call("/api/splits/export", { headers: a.auth });
    expect(exported.status).toBe(200);
    expect((await json<{ splits: unknown[] }>(exported)).splits).toHaveLength(4);
  });
});

describe("/api/billing and the Bachs webhook", () => {
  const checkoutResponse = (id: string) =>
    new Response(JSON.stringify({ checkout_id: id, checkout_url: `https://checkout.bachs.io/c/${id}`, status: "open" }), { status: 201 });

  const event = (type: string, data: Record<string, unknown>, id = `evt_${crypto.randomUUID()}`) =>
    JSON.stringify({ id, type, created_at: new Date().toISOString(), organization_id: "acct_x", data });

  async function webhook(body: string, secrets: string[] = [SECRET]) {
    const headers = await signBachsPayload(body, secrets);
    headers.set("Content-Type", "application/json");
    return call("/api/webhooks/bachs", { method: "POST", headers, body });
  }

  it("starts a checkout (pending row) and the paid webhook settles it once", async () => {
    const a = await user();
    const fetchMock = vi.fn(async () => checkoutResponse("chk_1"));
    vi.stubGlobal("fetch", fetchMock);
    const started = await call("/api/billing/checkout", { method: "POST", headers: a.auth, body: JSON.stringify({ plan: "pro" }) });
    vi.unstubAllGlobals();
    expect(started.status).toBe(200);
    expect(await json<unknown>(started)).toEqual({ checkoutId: "chk_1", url: "https://checkout.bachs.io/c/chk_1" });
    const sent = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(sent.pricing).toEqual({ currency: "USD", amount: "5.00" });
    expect(sent.metadata.user_id).toBe(a.user.id);
    // Locally BACHS_RETURN_ORIGIN (a public origin) stands in for the loopback APP_ORIGIN.
    expect(sent.success_url).toBe("https://rent-split-kit-preview.tropos.workers.dev/billing/pending");

    const pending = await json<{ status: string; plan: string }>(await call("/api/billing/checkout/chk_1", { headers: a.auth }));
    expect(pending).toMatchObject({ status: "pending", plan: "free" });
    const other = await user();
    expect((await call("/api/billing/checkout/chk_1", { headers: other.auth })).status).toBe(404);

    const paid = event("checkout.completed", { checkout_id: "chk_1", payment_status: "paid", amount: "5.00", currency: "USD", charge: { id: "ch_1" }, customer: { customer_id: "cust_1" } }, "evt_paid");
    const first = await webhook(paid);
    expect(first.status).toBe(200);
    expect(await json<unknown>(first)).toEqual({ received: true, outcome: "settled" });
    const again = await webhook(paid);
    expect(await json<unknown>(again)).toEqual({ received: true, outcome: "duplicate" });

    const state = await json<{ plan: string; proUntil: number; subscription: { status: string; cancelAtPeriodEnd: boolean } }>(await call("/api/billing/plan", { headers: a.auth }));
    expect(state.plan).toBe("pro");
    expect(state.proUntil).toBeGreaterThan(Date.now() + 29 * 86400000);
    expect(state.subscription.status).toBe("active");
    const me = await json<{ user: { plan: string } }>(await call("/api/me", { headers: a.auth }));
    expect(me.user.plan).toBe("pro");

    const row = await env.DB.prepare("SELECT outcome FROM bachs_events WHERE id = ?").bind("evt_paid").first<{ outcome: string }>();
    expect(row?.outcome).toBe("settled");

    const canceled = await call("/api/billing/cancel", { method: "POST", headers: a.auth, body: JSON.stringify({ cancelAtPeriodEnd: true }) });
    expect(canceled.status).toBe(200);
    expect((await json<{ subscription: { cancelAtPeriodEnd: boolean } }>(canceled)).subscription.cancelAtPeriodEnd).toBe(true);
  });

  it("refuses an amount or currency that does not cover the plan, and an unknown checkout", async () => {
    const a = await user();
    vi.stubGlobal("fetch", vi.fn(async () => checkoutResponse("chk_2")));
    await call("/api/billing/checkout", { method: "POST", headers: a.auth, body: JSON.stringify({ plan: "pro" }) });
    vi.unstubAllGlobals();
    const short = await webhook(event("checkout.completed", { checkout_id: "chk_2", payment_status: "paid", amount: "4.99", currency: "USD" }));
    expect(await json<unknown>(short)).toEqual({ received: true, outcome: "amount_mismatch" });
    const ngn = await webhook(event("checkout.completed", { checkout_id: "chk_2", payment_status: "paid", amount: "5.00", currency: "NGN" }));
    expect(await json<unknown>(ngn)).toEqual({ received: true, outcome: "amount_mismatch" });
    const unknown = await webhook(event("checkout.completed", { checkout_id: "chk_nope", payment_status: "paid", amount: "5.00", currency: "USD" }));
    expect(await json<unknown>(unknown)).toEqual({ received: true, outcome: "unknown_checkout" });
    expect((await json<{ plan: string }>(await call("/api/billing/plan", { headers: a.auth }))).plan).toBe("free");
    const expired = await webhook(event("checkout.expired", { checkout_id: "chk_2" }));
    expect(await json<unknown>(expired)).toEqual({ received: true, outcome: "expired" });
  });

  it("rejects a forged or stale signature with 400 and records nothing", async () => {
    const body = event("checkout.completed", { checkout_id: "chk_x" }, "evt_forged");
    const forged = await call("/api/webhooks/bachs", { method: "POST", headers: { "x-bachs-signature-v2": "t=1,v1=00", "Content-Type": "application/json" }, body });
    expect(forged.status).toBe(400);
    expect((await json<{ error: string }>(forged)).error).toBe("invalid_signature");
    const wrong = await webhook(body, ["whsec_other"]);
    expect(wrong.status).toBe(400);
    const row = await env.DB.prepare("SELECT id FROM bachs_events WHERE id = ?").bind("evt_forged").first();
    expect(row).toBeNull();
    // A foreign Origin does not block the webhook (it is signed, not cookie-authenticated).
    const headers = await signBachsPayload(body, [SECRET]);
    headers.set("Origin", "https://bachs.io");
    expect((await call("/api/webhooks/bachs", { method: "POST", headers, body })).status).toBe(200);
  });

  it("checkout answers 502 checkout_failed when Bachs is down and 503 without keys", async () => {
    const a = await user();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    const down = await call("/api/billing/checkout", { method: "POST", headers: a.auth, body: JSON.stringify({ plan: "pro" }) });
    vi.unstubAllGlobals();
    expect(down.status).toBe(502);
    expect((await json<{ error: string }>(down)).error).toBe("checkout_failed");
    const nokeys = await call("/api/billing/checkout", { method: "POST", headers: a.auth, body: JSON.stringify({ plan: "pro" }) }, { BACHS_API_KEY: "" });
    expect(nokeys.status).toBe(503);
  });
});

describe("system routes", () => {
  it("accepts a client error report and logs one warn line without the stack beyond 2000 chars", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await call("/api/client-errors", { method: "POST", body: JSON.stringify({ message: "boom", stack: "x".repeat(3000), url: `${ORIGIN}/splits?x=1`, component: "SplitsList" }) });
    expect(r.status).toBe(204);
    const line = JSON.parse(String(warn.mock.calls.find((c) => String(c[0]).includes("client_error"))![0]));
    expect(line).toMatchObject({ msg: "client_error", message: "boom", url: "/splits", component: "SplitsList" });
    expect(line.stack).toHaveLength(2000);
    expect((await call("/api/client-errors", { method: "POST", body: JSON.stringify({ message: "" }) })).status).toBe(400);
  });

  it("serves the OpenAPI document built from the zod schemas", async () => {
    const r = await call("/api/openapi.json");
    expect(r.status).toBe(200);
    const doc = await json<{ openapi: string; paths: Record<string, Record<string, { requestBody?: unknown; security?: unknown }>>; components: { schemas: { Error: unknown } } }>(r);
    expect(doc.openapi).toBe("3.0.3");
    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining(["/api/splits", "/api/splits/{id}", "/api/billing/checkout", "/api/webhooks/bachs", "/auth/web/code/verify"]));
    expect(doc.paths["/api/splits"]!.post!.requestBody).toBeDefined();
    expect(doc.paths["/api/splits"]!.post!.security).toEqual([{ bearerAuth: [] }]);
    expect(doc.components.schemas.Error).toBeDefined();
  });
});
