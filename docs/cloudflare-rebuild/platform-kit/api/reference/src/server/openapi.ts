// OpenAPI 3.0 JSON generated from the zod schemas each route declares. zod 4 ships its own JSON
// Schema export, so no extra dependency; the registry below is the one list of API routes.
import { z } from "zod";
import {
  CancelSchema,
  CheckoutStartSchema,
  CheckoutStartedSchema,
  CheckoutStatusSchema,
  ClientErrorSchema,
  CodeSendSchema,
  CodeVerifySchema,
  PlanStateSchema,
  PublicUserSchema,
  SplitCreateSchema,
  SplitListSchema,
  SplitSchema,
  SplitUpdateSchema,
  WebTokenSchema,
} from "../schemas/index.js";

export const ErrorSchema = z
  .object({ error: z.string().describe("snake_case error code"), message: z.string().describe("one plain sentence") })
  .catchall(z.unknown())
  .describe("The one error envelope (loginbase's shape plus a message).");

export interface RouteDoc {
  method: "get" | "post" | "patch" | "delete";
  path: string;
  summary: string;
  tag: string;
  auth?: "bearer" | "cookie" | "signature";
  request?: z.ZodType;
  responses: Record<number, z.ZodType | "empty">;
}

const HealthSchema = z.object({ status: z.string(), version: z.string(), checks: z.object({ db: z.string() }).optional() });
const CooldownSchema = z.object({ cooldownSeconds: z.number() });
const MeSchema = z.object({ user: PublicUserSchema });
const ReceivedSchema = z.object({ received: z.boolean(), outcome: z.string() });

export const ROUTES: RouteDoc[] = [
  { method: "get", path: "/healthz", summary: "Liveness with a D1 check", tag: "system", responses: { 200: HealthSchema, 503: HealthSchema } },
  { method: "get", path: "/api/health", summary: "Liveness (v1 contract)", tag: "system", responses: { 200: HealthSchema } },
  { method: "post", path: "/api/events", summary: "Anonymous product event (contract C2)", tag: "system", responses: { 204: "empty", 400: ErrorSchema, 413: ErrorSchema, 415: ErrorSchema, 429: ErrorSchema } },
  { method: "post", path: "/api/client-errors", summary: "Browser error boundary report", tag: "system", request: ClientErrorSchema, responses: { 204: "empty", 400: ErrorSchema, 429: ErrorSchema } },
  { method: "post", path: "/auth/web/code/send", summary: "Send a sign-in code", tag: "auth", request: CodeSendSchema, responses: { 200: CooldownSchema, 400: ErrorSchema, 429: ErrorSchema } },
  { method: "post", path: "/auth/web/code/verify", summary: "Verify the code; sets the session cookie", tag: "auth", request: CodeVerifySchema, responses: { 200: WebTokenSchema, 400: ErrorSchema, 429: ErrorSchema } },
  { method: "post", path: "/auth/web/refresh", summary: "New access token from the session cookie (204 when signed out)", tag: "auth", auth: "cookie", responses: { 200: WebTokenSchema, 204: "empty", 401: ErrorSchema } },
  { method: "post", path: "/auth/web/logout", summary: "Revoke the session and clear the cookie", tag: "auth", auth: "cookie", responses: { 204: "empty" } },
  { method: "get", path: "/api/me", summary: "The signed-in user", tag: "account", auth: "bearer", responses: { 200: MeSchema, 401: ErrorSchema } },
  { method: "get", path: "/api/splits", summary: "List saved splits", tag: "splits", auth: "bearer", responses: { 200: SplitListSchema, 401: ErrorSchema } },
  { method: "post", path: "/api/splits", summary: "Save a split", tag: "splits", auth: "bearer", request: SplitCreateSchema, responses: { 201: SplitSchema, 400: ErrorSchema, 401: ErrorSchema, 403: ErrorSchema } },
  { method: "get", path: "/api/splits/export", summary: "Export every saved split (Pro)", tag: "splits", auth: "bearer", responses: { 200: z.object({ splits: z.array(SplitSchema) }), 401: ErrorSchema, 403: ErrorSchema } },
  { method: "get", path: "/api/splits/{id}", summary: "One saved split", tag: "splits", auth: "bearer", responses: { 200: SplitSchema, 401: ErrorSchema, 404: ErrorSchema } },
  { method: "patch", path: "/api/splits/{id}", summary: "Rename or replace a saved split", tag: "splits", auth: "bearer", request: SplitUpdateSchema, responses: { 200: SplitSchema, 400: ErrorSchema, 401: ErrorSchema, 404: ErrorSchema } },
  { method: "delete", path: "/api/splits/{id}", summary: "Delete a saved split", tag: "splits", auth: "bearer", responses: { 204: "empty", 401: ErrorSchema, 404: ErrorSchema } },
  { method: "get", path: "/api/billing/plan", summary: "Plan, current subscription and price", tag: "billing", auth: "bearer", responses: { 200: PlanStateSchema, 401: ErrorSchema } },
  { method: "post", path: "/api/billing/checkout", summary: "Start a Bachs checkout for Pro", tag: "billing", auth: "bearer", request: CheckoutStartSchema, responses: { 200: CheckoutStartedSchema, 401: ErrorSchema, 502: ErrorSchema } },
  { method: "get", path: "/api/billing/checkout/{checkoutId}", summary: "Status of one checkout", tag: "billing", auth: "bearer", responses: { 200: CheckoutStatusSchema, 401: ErrorSchema, 404: ErrorSchema } },
  { method: "post", path: "/api/billing/cancel", summary: "Stop Pro at the end of the period", tag: "billing", auth: "bearer", request: CancelSchema, responses: { 200: PlanStateSchema, 401: ErrorSchema, 404: ErrorSchema } },
  { method: "post", path: "/api/webhooks/bachs", summary: "Bachs webhook (X-Bachs-Signature-V2)", tag: "billing", auth: "signature", responses: { 200: ReceivedSchema, 400: ErrorSchema } },
];

function jsonSchema(schema: z.ZodType, io: "input" | "output"): Record<string, unknown> {
  return z.toJSONSchema(schema, { target: "openapi-3.0", io, unrepresentable: "any" }) as Record<string, unknown>;
}

export function buildOpenApi(version: string, serverUrl: string): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of ROUTES) {
    const operation: Record<string, unknown> = {
      summary: route.summary,
      tags: [route.tag],
      operationId: `${route.method}_${route.path.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "")}`,
      responses: Object.fromEntries(
        Object.entries(route.responses).map(([status, schema]) => [
          status,
          schema === "empty"
            ? { description: "No content" }
            : { description: Number(status) < 400 ? "OK" : "Error", content: { "application/json": { schema: jsonSchema(schema, "output") } } },
        ]),
      ),
    };
    const params = [...route.path.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: "path", required: true, schema: { type: "string" } }));
    if (params.length) operation.parameters = params;
    if (route.request) operation.requestBody = { required: true, content: { "application/json": { schema: jsonSchema(route.request, "input") } } };
    if (route.auth === "bearer") operation.security = [{ bearerAuth: [] }];
    if (route.auth === "cookie") operation.security = [{ sessionCookie: [] }];
    if (route.auth === "signature") operation.security = [{ bachsSignature: [] }];
    paths[route.path] ??= {};
    paths[route.path]![route.method] = operation;
  }
  return {
    openapi: "3.0.3",
    info: {
      title: "rent-split API",
      version,
      description: "Every error answers { error: <code>, message, ...fields }. Every response carries X-Request-Id.",
    },
    servers: [{ url: serverUrl }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        sessionCookie: { type: "apiKey", in: "cookie", name: "rs_session" },
        bachsSignature: { type: "apiKey", in: "header", name: "X-Bachs-Signature-V2" },
      },
      schemas: { Error: jsonSchema(ErrorSchema, "output") },
    },
    paths,
  };
}
