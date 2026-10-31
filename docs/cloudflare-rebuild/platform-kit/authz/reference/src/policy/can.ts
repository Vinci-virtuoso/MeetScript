// Authorization: can(user, action, resource). Called at the route boundary; the repo layer filters
// by owner_id underneath so a wrong answer here still cannot reach another owner's rows.
import { hasActivePro, type User } from "../db/users.js";

export type Action = "split.read" | "split.write" | "split.delete" | "pro.use";

/** Free accounts keep up to this many saved splits; more needs Pro. */
export const FREE_SPLIT_LIMIT = 3;

export interface SplitResource {
  ownerId: string;
  /** For a new split: how many the owner already has. Absent when editing an existing split. */
  existingCount?: number;
}

type Actor = Pick<User, "id" | "plan" | "proUntil"> | null | undefined;

export function can(user: Actor, action: "pro.use"): boolean;
export function can(user: Actor, action: "split.read" | "split.write" | "split.delete", resource: SplitResource): boolean;
export function can(user: Actor, action: Action, resource?: SplitResource): boolean {
  if (!user) return false;
  switch (action) {
    case "pro.use":
      return hasActivePro(user);
    case "split.read":
    case "split.delete":
      return Boolean(resource) && resource!.ownerId === user.id;
    case "split.write": {
      if (!resource || resource.ownerId !== user.id) return false;
      if (resource.existingCount === undefined) return true;
      return resource.existingCount < FREE_SPLIT_LIMIT || hasActivePro(user);
    }
    default:
      return false;
  }
}
