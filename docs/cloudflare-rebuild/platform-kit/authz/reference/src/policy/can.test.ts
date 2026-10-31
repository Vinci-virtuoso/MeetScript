import { describe, expect, it } from "vitest";
import { FREE_SPLIT_LIMIT, can } from "./can.js";

const free = { id: "u1", plan: "free" as const, proUntil: null };
const pro = { id: "u1", plan: "pro" as const, proUntil: Date.now() + 86400000 };
const lapsed = { id: "u1", plan: "pro" as const, proUntil: Date.now() - 1 };

describe("can()", () => {
  it("split.read: only the owner", () => {
    expect(can(free, "split.read", { ownerId: "u1" })).toBe(true);
    expect(can(free, "split.read", { ownerId: "u2" })).toBe(false);
    expect(can(null, "split.read", { ownerId: "u1" })).toBe(false);
  });

  it("split.write: the owner; a new split past the free limit needs Pro", () => {
    expect(can(free, "split.write", { ownerId: "u1" })).toBe(true);
    expect(can(free, "split.write", { ownerId: "u2" })).toBe(false);
    expect(can(free, "split.write", { ownerId: "u1", existingCount: FREE_SPLIT_LIMIT - 1 })).toBe(true);
    expect(can(free, "split.write", { ownerId: "u1", existingCount: FREE_SPLIT_LIMIT })).toBe(false);
    expect(can(pro, "split.write", { ownerId: "u1", existingCount: 50 })).toBe(true);
    expect(can(lapsed, "split.write", { ownerId: "u1", existingCount: FREE_SPLIT_LIMIT })).toBe(false);
  });

  it("split.delete: only the owner", () => {
    expect(can(pro, "split.delete", { ownerId: "u1" })).toBe(true);
    expect(can(pro, "split.delete", { ownerId: "u2" })).toBe(false);
  });

  it("pro.use: an unexpired Pro plan", () => {
    expect(can(pro, "pro.use")).toBe(true);
    expect(can(free, "pro.use")).toBe(false);
    expect(can(lapsed, "pro.use")).toBe(false);
    expect(can(undefined, "pro.use")).toBe(false);
  });
});
