import { describe, expect, it } from "vitest";
import { isCategoryAlias } from "@/lib/wordpress";

describe("isCategoryAlias", () => {
  it("recognises built-in category slugs regardless of case and padding", () => {
    expect(isCategoryAlias("exclusive")).toBe(true);
    expect(isCategoryAlias(" Politics ")).toBe(true);
    expect(isCategoryAlias("विशेष")).toBe(true);
  });
  it("rejects paths that are not categories", () => {
    expect(isCategoryAlias("login")).toBe(false);
    expect(isCategoryAlias("wp-login.php")).toBe(false);
    expect(isCategoryAlias("constructor")).toBe(false);
  });
});
