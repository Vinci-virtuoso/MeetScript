// /api/splits: saved splits. zod at the boundary, can() at the route, owner_id in the repo.
import { Hono } from "hono";
import { decodeLinkCode } from "../../../public/js/link.js";
import {
  countSplits,
  createSplit,
  deleteSplit,
  findSplit,
  listSplits,
  updateSplit,
  type Split,
} from "../../db/index.js";
import { FREE_SPLIT_LIMIT, can } from "../../policy/can.js";
import { SplitCreateSchema, SplitUpdateSchema, type SplitDto } from "../../schemas/split.js";
import { requirePlan, requireUser, type AuthVariables } from "../auth/require-user.js";
import { ApiError, emptyResponse, jsonResponse } from "../http.js";
import { parseBody } from "../validate.js";

export const splitRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

export function toDto(split: Split): SplitDto {
  return {
    id: split.id,
    name: split.name,
    code: split.code,
    currency: split.currency,
    rent: split.rent,
    persons: split.persons,
    createdAt: split.createdAt,
    updatedAt: split.updatedAt,
  };
}

/** The denormalized list fields come from the decoded, validated link code. */
export function summarize(code: string): { currency: string; rent: number; persons: number } {
  const decoded = decodeLinkCode(code);
  if (!decoded.ok) throw new ApiError(400, "invalid_code", "This link code is broken or cut short.");
  return { currency: decoded.input.currency, rent: decoded.input.rent, persons: decoded.input.persons.length };
}

splitRoutes.use("/api/splits", requireUser());
splitRoutes.use("/api/splits/*", requireUser());

splitRoutes.get("/api/splits", async (c) => {
  const user = c.get("user");
  const [splits, count] = await Promise.all([listSplits(c.env.DB, user.id), countSplits(c.env.DB, user.id)]);
  return jsonResponse({
    splits: splits.map(toDto),
    count,
    freeLimit: FREE_SPLIT_LIMIT,
    canCreate: can(user, "split.write", { ownerId: user.id, existingCount: count }),
  });
});

splitRoutes.post("/api/splits", async (c) => {
  const user = c.get("user");
  const body = await parseBody(c.req.raw, SplitCreateSchema);
  const summary = summarize(body.code);
  const existingCount = await countSplits(c.env.DB, user.id);
  if (!can(user, "split.write", { ownerId: user.id, existingCount })) {
    throw new ApiError(403, "plan_required", `Free accounts keep ${FREE_SPLIT_LIMIT} saved splits. Pro keeps more.`, {
      plan: "pro",
      freeLimit: FREE_SPLIT_LIMIT,
      count: existingCount,
    });
  }
  const split = await createSplit(c.env.DB, { ownerId: user.id, name: body.name, code: body.code, ...summary });
  return jsonResponse(toDto(split), 201);
});

splitRoutes.get("/api/splits/export", requirePlan("pro"), async (c) => {
  const user = c.get("user");
  const splits = await listSplits(c.env.DB, user.id, 1000);
  return jsonResponse({ splits: splits.map(toDto) });
});

splitRoutes.get("/api/splits/:id", async (c) => {
  const user = c.get("user");
  const split = await findSplit(c.env.DB, user.id, c.req.param("id"));
  if (!split || !can(user, "split.read", { ownerId: split.ownerId })) {
    throw new ApiError(404, "not_found", "There is no saved split with this id.");
  }
  return jsonResponse(toDto(split));
});

splitRoutes.patch("/api/splits/:id", async (c) => {
  const user = c.get("user");
  const body = await parseBody(c.req.raw, SplitUpdateSchema);
  const current = await findSplit(c.env.DB, user.id, c.req.param("id"));
  if (!current || !can(user, "split.write", { ownerId: current.ownerId })) {
    throw new ApiError(404, "not_found", "There is no saved split with this id.");
  }
  const patch = { ...(body.name !== undefined ? { name: body.name } : {}), ...(body.code !== undefined ? { code: body.code, ...summarize(body.code) } : {}) };
  const updated = await updateSplit(c.env.DB, user.id, current.id, patch);
  if (!updated) throw new ApiError(404, "not_found", "There is no saved split with this id.");
  return jsonResponse(toDto(updated));
});

splitRoutes.delete("/api/splits/:id", async (c) => {
  const user = c.get("user");
  const current = await findSplit(c.env.DB, user.id, c.req.param("id"));
  if (!current || !can(user, "split.delete", { ownerId: current.ownerId })) {
    throw new ApiError(404, "not_found", "There is no saved split with this id.");
  }
  await deleteSplit(c.env.DB, user.id, current.id);
  return emptyResponse(204);
});
