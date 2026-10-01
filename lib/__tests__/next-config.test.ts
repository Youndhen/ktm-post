import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";
import { config as middlewareConfig } from "@/middleware";

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

  it("caps how long a stale ISR page may be served after it expires", () => {
    expect(nextConfig.expireTime).toBe(3600);
  });
});

describe("middleware matcher", () => {
  const matches = (p: string) =>
    middlewareConfig.matcher.some((m) => new RegExp(`^${m}$`).test(p));

  it("skips API routes, so uploads are not truncated at the 10 MB proxy body limit", () => {
    expect(matches("/api/upload")).toBe(false);
    expect(matches("/api/auth/sign-in/email")).toBe(false);
  });
  it("still runs on pages", () => {
    expect(matches("/about-us")).toBe(true);
    expect(matches("/admin/posts")).toBe(true);
  });
});
