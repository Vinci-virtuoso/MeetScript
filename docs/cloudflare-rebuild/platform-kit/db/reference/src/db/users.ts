// users repository. The only module that writes SQL for the users table.
import { newId, nowMs } from "./ids.js";

export type Plan = "free" | "pro";

export interface UserRow {
  id: string;
  email: string;
  plan: Plan;
  pro_until: number | null;
  github_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface User {
  id: string;
  email: string;
  plan: Plan;
  proUntil: number | null;
  githubId: string | null;
  createdAt: number;
  updatedAt: number;
}

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    plan: row.plan,
    proUntil: row.pro_until,
    githubId: row.github_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserById(db: D1Database, id: string): Promise<User | null> {
  const row = await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
  return row ? toUser(row) : null;
}

export async function findUserByEmail(db: D1Database, email: string): Promise<User | null> {
  const row = await db.prepare("SELECT * FROM users WHERE email = ?").bind(normalizeEmail(email)).first<UserRow>();
  return row ? toUser(row) : null;
}

/** Find by email or create. Returns the user and whether this call created it. */
export async function findOrCreateUser(
  db: D1Database,
  email: string,
  extra: { githubId?: string } = {},
): Promise<{ user: User; created: boolean }> {
  const normalized = normalizeEmail(email);
  const existing = await findUserByEmail(db, normalized);
  if (existing) {
    if (extra.githubId && existing.githubId !== extra.githubId) {
      const now = nowMs();
      await db
        .prepare("UPDATE users SET github_id = ?, updated_at = ? WHERE id = ?")
        .bind(extra.githubId, now, existing.id)
        .run();
      return { user: { ...existing, githubId: extra.githubId, updatedAt: now }, created: false };
    }
    return { user: existing, created: false };
  }
  const now = nowMs();
  const user: User = {
    id: newId(),
    email: normalized,
    plan: "free",
    proUntil: null,
    githubId: extra.githubId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db
    .prepare(
      "INSERT INTO users (id, email, plan, pro_until, github_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(user.id, user.email, user.plan, user.proUntil, user.githubId, user.createdAt, user.updatedAt)
    .run();
  return { user, created: true };
}

/** Cache the plan on the user row (called by the payments code after a webhook settles). */
export async function setUserPlan(db: D1Database, id: string, plan: Plan, proUntil: number | null): Promise<void> {
  await db
    .prepare("UPDATE users SET plan = ?, pro_until = ?, updated_at = ? WHERE id = ?")
    .bind(plan, proUntil, nowMs(), id)
    .run();
}

/** Delete the user and every row that references it (account deletion). */
export async function deleteUserCascade(db: D1Database, id: string): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM splits WHERE owner_id = ?").bind(id),
    db.prepare("DELETE FROM subscriptions WHERE owner_id = ?").bind(id),
    db.prepare("DELETE FROM customers WHERE owner_id = ?").bind(id),
    db.prepare("DELETE FROM users WHERE id = ?").bind(id),
  ]);
}

/** Pro is active while pro_until is in the future. */
export function hasActivePro(user: Pick<User, "plan" | "proUntil">, now: number = nowMs()): boolean {
  return user.plan === "pro" && user.proUntil !== null && user.proUntil > now;
}
