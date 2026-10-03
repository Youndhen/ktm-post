import { describe, expect, it } from "vitest";
import { publishedOnly } from "@/lib/post-visibility";

describe("publishedOnly", () => {
  it("passes a published post through unchanged", () => {
    const post = { id: "p1", status: "PUBLISHED", title: "t" };
    expect(publishedOnly(post)).toBe(post);
  });

  it("hides a draft as if it did not exist", () => {
    expect(publishedOnly({ id: "p2", status: "DRAFT" })).toBeNull();
  });

  it("returns null for null", () => {
    expect(publishedOnly(null)).toBeNull();
  });
});
