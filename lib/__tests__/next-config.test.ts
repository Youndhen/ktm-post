import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

describe("next.config", () => {
  it("sends the security headers on every path", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((r) => r.source === "/(.*)");
    const headers = Object.fromEntries((all?.headers ?? []).map((h) => [h.key, h.value]));
    expect(headers).toEqual({
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
  });

  it("keeps optimised images for a day, matching the CloudFront image policy", () => {
    expect(nextConfig.images?.minimumCacheTTL).toBe(86400);
  });
});
