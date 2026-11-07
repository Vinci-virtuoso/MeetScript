// splits repository. Every query filters by owner_id: a split never leaves its owner's scope here,
// and the policy layer (src/policy/can.ts) decides the action on top of that.
import { newId, nowMs } from "./ids.js";

export interface SplitRow {
  id: string;
  owner_id: string;
  name: string;
  code: string;
  currency: string;
  rent: number;
  persons: number;
  created_at: number;
  updated_at: number;
}

export interface Split {
  id: string;
  ownerId: string;
  name: string;
  code: string;
  currency: string;
  rent: number;
  persons: number;
  createdAt: number;
  updatedAt: number;
}

export interface NewSplit {
  ownerId: string;
  name: string;
  code: string;
  currency: string;
  rent: number;
  persons: number;
}

export function toSplit(row: SplitRow): Split {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    code: row.code,
    currency: row.currency,
    rent: row.rent,
    persons: row.persons,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSplits(db: D1Database, ownerId: string, limit = 100): Promise<Split[]> {
  const { results } = await db
    .prepare("SELECT * FROM splits WHERE owner_id = ? ORDER BY updated_at DESC, id DESC LIMIT ?")
    .bind(ownerId, limit)
    .all<SplitRow>();
  return results.map(toSplit);
}

export async function countSplits(db: D1Database, ownerId: string): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM splits WHERE owner_id = ?")
    .bind(ownerId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function findSplit(db: D1Database, ownerId: string, id: string): Promise<Split | null> {
  const row = await db
    .prepare("SELECT * FROM splits WHERE id = ? AND owner_id = ?")
    .bind(id, ownerId)
    .first<SplitRow>();
  return row ? toSplit(row) : null;
}

export async function createSplit(db: D1Database, input: NewSplit): Promise<Split> {
  const now = nowMs();
  const split: Split = { id: newId(), ...input, createdAt: now, updatedAt: now };
  await db
    .prepare(
      "INSERT INTO splits (id, owner_id, name, code, currency, rent, persons, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(split.id, split.ownerId, split.name, split.code, split.currency, split.rent, split.persons, now, now)
    .run();
  return split;
}

export async function updateSplit(
  db: D1Database,
  ownerId: string,
  id: string,
  patch: Partial<Pick<NewSplit, "name" | "code" | "currency" | "rent" | "persons">>,
): Promise<Split | null> {
  const current = await findSplit(db, ownerId, id);
  if (!current) return null;
  const next: Split = { ...current, ...patch, updatedAt: nowMs() };
  await db
    .prepare(
      "UPDATE splits SET name = ?, code = ?, currency = ?, rent = ?, persons = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
    )
    .bind(next.name, next.code, next.currency, next.rent, next.persons, next.updatedAt, id, ownerId)
    .run();
  return next;
}

export async function deleteSplit(db: D1Database, ownerId: string, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM splits WHERE id = ? AND owner_id = ?").bind(id, ownerId).run();
  return (result.meta.changes ?? 0) > 0;
}
