// Per-request context reachable from code that has no Hono context in hand (loginbase hooks).
// AsyncLocalStorage works on Workers with the nodejs_compat flag and under the vitest plugin.
import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  rid: string;
  waitUntil: (promise: Promise<unknown>) => void;
  cf: { country?: string; asn?: number; colo?: string; timezone?: string };
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequest<T>(context: RequestContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(context, fn);
}

export function currentRequest(): RequestContext | undefined {
  return storage.getStore();
}

/** Extend the request past the response, or at least swallow a rejection when no context exists. */
export function deferred(promise: Promise<unknown>): void {
  const ctx = currentRequest();
  if (ctx) ctx.waitUntil(promise);
  else promise.catch(() => {});
}

export function cfFields(request: Request): RequestContext["cf"] {
  const cf = (request as Request & { cf?: Record<string, unknown> }).cf ?? {};
  const pick = (key: string) => (typeof cf[key] === "string" ? (cf[key] as string) : undefined);
  const asn = typeof cf.asn === "number" ? (cf.asn as number) : undefined;
  return { country: pick("country"), asn, colo: pick("colo"), timezone: pick("timezone") };
}
