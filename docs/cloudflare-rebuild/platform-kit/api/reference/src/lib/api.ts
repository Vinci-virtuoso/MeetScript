// Typed calls to /api/*. Every response is parsed with the shared zod schema at the boundary.
import { PlanStateSchema, CheckoutStartedSchema, CheckoutStatusSchema, type PlanState } from "../schemas/billing.js";
import { SplitListSchema, SplitSchema, type SplitDto, type SplitList } from "../schemas/split.js";
import { apiFetch } from "./auth-client.js";

export async function listSplits(): Promise<SplitList> {
  return SplitListSchema.parse(await (await apiFetch("/api/splits")).json());
}

export async function createSplit(name: string, code: string): Promise<SplitDto> {
  return SplitSchema.parse(await (await apiFetch("/api/splits", { method: "POST", body: JSON.stringify({ name, code }) })).json());
}

export async function renameSplit(id: string, name: string): Promise<SplitDto> {
  return SplitSchema.parse(await (await apiFetch(`/api/splits/${id}`, { method: "PATCH", body: JSON.stringify({ name }) })).json());
}

export async function deleteSplit(id: string): Promise<void> {
  await apiFetch(`/api/splits/${id}`, { method: "DELETE" });
}

export async function getPlan(): Promise<PlanState> {
  return PlanStateSchema.parse(await (await apiFetch("/api/billing/plan")).json());
}

export async function startCheckout(): Promise<{ checkoutId: string; url: string }> {
  return CheckoutStartedSchema.parse(await (await apiFetch("/api/billing/checkout", { method: "POST", body: JSON.stringify({ plan: "pro" }) })).json());
}

export async function checkoutStatus(checkoutId: string) {
  return CheckoutStatusSchema.parse(await (await apiFetch(`/api/billing/checkout/${encodeURIComponent(checkoutId)}`)).json());
}

export async function cancelPlan(): Promise<PlanState> {
  return PlanStateSchema.parse(await (await apiFetch("/api/billing/cancel", { method: "POST", body: JSON.stringify({ cancelAtPeriodEnd: true }) })).json());
}
