// The repo layer against the real D1 schema (migrations applied in tests/setup.ts).
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  countSplits,
  createPendingSubscription,
  createSplit,
  deleteSplit,
  deleteUserCascade,
  ensureCustomer,
  findCurrentSubscription,
  findOrCreateUser,
  findSplit,
  findSubscriptionByCheckout,
  findUserByEmail,
  hasActivePro,
  listSplits,
  markBachsEvent,
  recordAuthEvent,
  recordBachsEvent,
  setUserPlan,
  updateSplit,
  updateSubscription,
} from "../../src/db/index.js";

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

describe("users", () => {
  it("creates once per normalized email and reports created", async () => {
    const a = await findOrCreateUser(env.DB, "  Ana@Example.COM ");
    expect(a.created).toBe(true);
    expect(a.user.id).toMatch(ULID);
    expect(a.user.email).toBe("ana@example.com");
    expect(a.user.plan).toBe("free");
    const b = await findOrCreateUser(env.DB, "ana@example.com", { githubId: "42" });
    expect(b.created).toBe(false);
    expect(b.user.id).toBe(a.user.id);
    expect(b.user.githubId).toBe("42");
    expect((await findUserByEmail(env.DB, "ANA@example.com"))?.githubId).toBe("42");
  });

  it("caches the plan and knows when Pro is active", async () => {
    const { user } = await findOrCreateUser(env.DB, "pro@example.com");
    await setUserPlan(env.DB, user.id, "pro", Date.now() + 1000);
    const fresh = await findUserByEmail(env.DB, "pro@example.com");
    expect(fresh && hasActivePro(fresh)).toBe(true);
    expect(fresh && hasActivePro(fresh, Date.now() + 5000)).toBe(false);
    expect(hasActivePro({ plan: "free", proUntil: Date.now() + 5000 })).toBe(false);
  });
});

describe("splits", () => {
  const input = (ownerId: string, name: string) => ({
    ownerId,
    name,
    code: "v1.e30",
    currency: "USD",
    rent: 144500,
    persons: 3,
  });

  it("stays inside the owner scope for list, find, update and delete", async () => {
    const { user: ana } = await findOrCreateUser(env.DB, "ana@example.com");
    const { user: ben } = await findOrCreateUser(env.DB, "ben@example.com");
    const s1 = await createSplit(env.DB, input(ana.id, "Flat"));
    await createSplit(env.DB, input(ana.id, "House"));
    await createSplit(env.DB, input(ben.id, "Bens"));
    expect(s1.id).toMatch(ULID);
    expect((await listSplits(env.DB, ana.id)).map((s) => s.name).sort()).toEqual(["Flat", "House"]);
    expect(await countSplits(env.DB, ana.id)).toBe(2);
    expect(await countSplits(env.DB, ben.id)).toBe(1);
    expect(await findSplit(env.DB, ben.id, s1.id)).toBeNull();
    expect(await updateSplit(env.DB, ben.id, s1.id, { name: "Stolen" })).toBeNull();
    const updated = await updateSplit(env.DB, ana.id, s1.id, { name: "Flat 2" });
    expect(updated?.name).toBe("Flat 2");
    expect(updated && updated.updatedAt >= s1.updatedAt).toBe(true);
    expect(await deleteSplit(env.DB, ben.id, s1.id)).toBe(false);
    expect(await deleteSplit(env.DB, ana.id, s1.id)).toBe(true);
    expect(await countSplits(env.DB, ana.id)).toBe(1);
  });

  it("lists newest first", async () => {
    const { user } = await findOrCreateUser(env.DB, "order@example.com");
    await createSplit(env.DB, input(user.id, "first"));
    await new Promise((r) => setTimeout(r, 2));
    await createSplit(env.DB, input(user.id, "second"));
    expect((await listSplits(env.DB, user.id)).map((s) => s.name)).toEqual(["second", "first"]);
  });
});

describe("customers, subscriptions and the webhook ledger", () => {
  it("creates one customer per owner", async () => {
    const { user } = await findOrCreateUser(env.DB, "cust@example.com");
    const a = await ensureCustomer(env.DB, user.id, user.email);
    const b = await ensureCustomer(env.DB, user.id, user.email);
    expect(a.id).toBe(b.id);
    expect(a.bachs_customer_id).toBeNull();
  });

  it("settles a pending subscription into the current one", async () => {
    const { user } = await findOrCreateUser(env.DB, "sub@example.com");
    const pending = await createPendingSubscription(env.DB, {
      ownerId: user.id,
      plan: "pro",
      bachsCheckoutId: "chk_1",
      amount: 500,
      currency: "USD",
    });
    expect(pending.status).toBe("pending");
    expect(await findCurrentSubscription(env.DB, user.id)).toBeNull();
    const end = Date.now() + 30 * 86400000;
    await updateSubscription(env.DB, pending.id, {
      status: "active",
      bachsChargeId: "ch_1",
      currentPeriodStart: Date.now(),
      currentPeriodEnd: end,
    });
    const current = await findCurrentSubscription(env.DB, user.id);
    expect(current?.id).toBe(pending.id);
    expect(current?.bachs_charge_id).toBe("ch_1");
    expect(current?.current_period_end).toBe(end);
    expect((await findSubscriptionByCheckout(env.DB, "chk_1"))?.id).toBe(pending.id);
  });

  it("rejects a duplicate checkout id", async () => {
    const { user } = await findOrCreateUser(env.DB, "dup@example.com");
    const make = () =>
      createPendingSubscription(env.DB, { ownerId: user.id, plan: "pro", bachsCheckoutId: "chk_dup", amount: 1, currency: "USD" });
    await make();
    await expect(make()).rejects.toThrow();
  });

  it("records a Bachs event once", async () => {
    expect(await recordBachsEvent(env.DB, "evt_1", "checkout.completed", "{}")).toBe(true);
    expect(await recordBachsEvent(env.DB, "evt_1", "checkout.completed", "{}")).toBe(false);
    await markBachsEvent(env.DB, "evt_1", "settled");
  });

  it("records an auth event with meta", async () => {
    await recordAuthEvent(env.DB, { event: "code_sent", locale: { resolved: "en" } }, { country: "GB" });
    const row = await env.DB.prepare("SELECT event, country, meta FROM auth_events").first<{ event: string; country: string; meta: string }>();
    expect(row?.event).toBe("code_sent");
    expect(row?.country).toBe("GB");
    expect(JSON.parse(row?.meta ?? "{}")).toEqual({ locale: { resolved: "en" } });
  });

  it("deletes a user with every owned row", async () => {
    const { user } = await findOrCreateUser(env.DB, "gone@example.com");
    await createSplit(env.DB, { ownerId: user.id, name: "x", code: "v1.e30", currency: "USD", rent: 1, persons: 1 });
    await ensureCustomer(env.DB, user.id, user.email);
    await deleteUserCascade(env.DB, user.id);
    expect(await findUserByEmail(env.DB, "gone@example.com")).toBeNull();
    expect(await countSplits(env.DB, user.id)).toBe(0);
  });
});
