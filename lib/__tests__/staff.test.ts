import { describe, expect, it } from "vitest";
import { isStaff } from "@/lib/staff";

describe("isStaff", () => {
  it("accepts admin and editor", () => {
    expect(isStaff("admin")).toBe(true);
    expect(isStaff("editor")).toBe(true);
  });
  it("rejects user, empty, null and undefined", () => {
    expect(isStaff("user")).toBe(false);
    expect(isStaff("")).toBe(false);
    expect(isStaff(null)).toBe(false);
    expect(isStaff(undefined)).toBe(false);
  });
  it("is case sensitive, matching how roles are stored", () => {
    expect(isStaff("Admin")).toBe(false);
  });
});
