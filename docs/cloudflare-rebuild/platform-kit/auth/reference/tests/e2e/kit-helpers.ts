// Shared helpers for the milestone 2 screens: sign in through the dev mail transport, save splits,
// drive a Pro purchase through the sandbox (or a stub) and the signed webhook.
import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 900 },
] as const;

export function devVars(): Record<string, string> {
  const path = new URL("../../.dev.vars", import.meta.url).pathname;
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
}

/** One fake client IP per test, sent on the auth calls so loginbase's per-IP limits do not pile up. */
export function devIp(): string {
  const n = () => Math.floor(Math.random() * 200) + 1;
  return `10.${n()}.${n()}.${n()}`;
}

export async function useDevIp(page: Page, ip = devIp()): Promise<string> {
  await page.route("**/auth/web/**", (route) => route.continue({ headers: { ...route.request().headers(), "X-Dev-Client-IP": ip } }));
  return ip;
}

export function uniqueEmail(tag: string): string {
  return `${tag}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}@example.com`;
}

/** The last 6 digit code the dev transport sent to `email` (GET /api/dev/mail, local only). */
export async function lastCode(request: APIRequestContext, email: string): Promise<string> {
  for (let i = 0; i < 20; i += 1) {
    const r = await request.get(`/api/dev/mail?to=${encodeURIComponent(email)}`);
    const { messages } = (await r.json()) as { messages: { text: string }[] };
    const m = messages[0] && /\b(\d{6})\b/.exec(messages[0].text);
    if (m) return m[1]!;
    await new Promise((res) => setTimeout(res, 100));
  }
  throw new Error(`no code mailed to ${email}`);
}

/** Sign in through the real screens. Leaves the page on `next`. */
export async function signIn(page: Page, email: string, next = "/splits"): Promise<void> {
  await useDevIp(page);
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await expect(page.getByTestId("sign-in-email")).toHaveAttribute("data-ready", "true");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByTestId("sign-in-code")).toBeVisible();
  const code = await lastCode(page.request, email);
  await page.getByLabel("Code").fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === new URL(next, "http://x").pathname);
}

/** A Bearer token for API calls from the test, taken from the page's own session. */
export async function accessToken(page: Page): Promise<string> {
  const r = await page.request.post("/auth/web/refresh", { headers: { Origin: new URL(page.url()).origin } });
  expect(r.ok()).toBeTruthy();
  return ((await r.json()) as { accessToken: string }).accessToken;
}

export function linkCode(persons = 3): string {
  // Every room needs a person (validateInput), so one person means one room.
  const rooms = persons >= 2 ? [["Big", 1400, 0], ["Small", 900, 0]] : [["Studio", 1800, 1]];
  const pp = Array.from({ length: persons }, (_, i) => [`Person ${i + 1}`, persons >= 2 ? i % 2 : 0, 0]);
  const payload = { c: "USD", r: 144500, u: 11000, cp: 30, bx: 15, im: 0, rm: rooms, pp, s: "AAAAAAAAAAA" };
  return "v1." + Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export async function saveSplit(page: Page, token: string, name: string, persons = 3): Promise<void> {
  const r = await page.request.post("/api/splits", {
    headers: { Authorization: `Bearer ${token}`, Origin: new URL(page.url()).origin, "Content-Type": "application/json" },
    data: { name, code: linkCode(persons) },
  });
  expect(r.status(), await r.text()).toBe(201);
}

/** Post a signed Bachs event to the local webhook. */
export async function bachsWebhook(page: Page, type: string, data: Record<string, unknown>): Promise<string> {
  const secret = devVars().BACHS_WEBHOOK_SECRET;
  if (!secret) throw new Error("BACHS_WEBHOOK_SECRET missing from .dev.vars");
  const body = JSON.stringify({ id: `evt_e2e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`, type, created_at: new Date().toISOString(), organization_id: "acct_e2e", data });
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  const r = await page.request.post("/api/webhooks/bachs", { headers: { "Content-Type": "application/json", "X-Bachs-Signature-V2": `t=${t},v1=${sig}` }, data: body });
  expect(r.status(), await r.text()).toBe(200);
  return ((await r.json()) as { outcome: string }).outcome;
}

/** True when .dev.vars holds a real sandbox key (not the placeholder). */
export function hasRealBachsKey(): boolean {
  const key = devVars().BACHS_API_KEY ?? "";
  return key.length > 20 && !key.includes("placeholder");
}

/** Start a Pro checkout for the signed-in page and return its checkout id and url. */
export async function startCheckout(page: Page, token: string): Promise<{ checkoutId: string; url: string }> {
  const r = await page.request.post("/api/billing/checkout", {
    headers: { Authorization: `Bearer ${token}`, Origin: new URL(page.url()).origin, "Content-Type": "application/json" },
    data: { plan: "pro" },
  });
  expect(r.status(), await r.text()).toBe(200);
  return (await r.json()) as { checkoutId: string; url: string };
}

/** Make the signed-in user Pro: a real sandbox checkout (when the key exists), then a signed paid webhook. */
export async function makePro(page: Page, token: string): Promise<string> {
  const { checkoutId } = await startCheckout(page, token);
  const outcome = await bachsWebhook(page, "checkout.completed", {
    checkout_id: checkoutId,
    status: "completed",
    mode: "payment",
    payment_status: "paid",
    amount: "5.00",
    currency: "USD",
    charge: { id: `ch_e2e_${Date.now().toString(36)}` },
    customer: { customer_id: `cust_e2e_${Date.now().toString(36)}`, email: "e2e@example.com" },
    metadata: { plan: "pro" },
  });
  expect(outcome).toBe("settled");
  return checkoutId;
}

export async function shot(page: Page, name: string, viewport: string): Promise<void> {
  await page.screenshot({ path: `evidence/kit/${name}-${viewport}.png`, fullPage: true, animations: "disabled" });
}

export async function axe(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations, JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), null, 2)).toEqual([]);
}
