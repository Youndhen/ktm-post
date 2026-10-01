import { describe, expect, it } from "vitest";
import { checkSetupToken } from "@/lib/setup-token";

describe("checkSetupToken", () => {
  it("is disabled when no token is configured", () => {
    expect(checkSetupToken(undefined, "anything")).toBe("disabled");
    expect(checkSetupToken("", "anything")).toBe("disabled");
    expect(checkSetupToken("   ", "anything")).toBe("disabled");
  });
  it("is invalid when the header is missing or wrong", () => {
    expect(checkSetupToken("secret", null)).toBe("invalid");
    expect(checkSetupToken("secret", "")).toBe("invalid");
    expect(checkSetupToken("secret", "secre")).toBe("invalid");
    expect(checkSetupToken("secret", "secret!")).toBe("invalid");
  });
  it("is ok on an exact match", () => {
    expect(checkSetupToken("secret", "secret")).toBe("ok");
  });
});
