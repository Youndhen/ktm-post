import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const read = (p: string) => JSON.parse(readFileSync(path.join(root, p), "utf8"));

const CACHING_DISABLED = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"; // managed CachingDisabled
const CACHING_OPTIMIZED = "658327ea-f89d-4fab-a63d-7e88639e58f6"; // managed CachingOptimized
const ALL_VIEWER = "216adef6-5c7f-47e4-b989-5492eafa07d3"; // managed AllViewer origin request policy

describe("CloudFront pages cache policy", () => {
  const policy = read("infra/cloudfront/cache-policy-pages.json").CachePolicyConfig;
  it("obeys origin Cache-Control (min 0, default 0)", () => {
    expect(policy.MinTTL).toBe(0);
    expect(policy.DefaultTTL).toBe(0);
    expect(policy.MaxTTL).toBe(31536000);
  });
  it("keys on every header Next.js varies RSC responses by, and ignores cookies", () => {
    const p = policy.ParametersInCacheKeyAndForwardedToOrigin;
    expect(p.HeadersConfig.Headers.Items).toEqual([
      "RSC",
      "Next-Router-Prefetch",
      "Next-Router-State-Tree",
      "Next-Router-Segment-Prefetch",
      "Next-Url",
    ]);
    expect(p.HeadersConfig.Headers.Quantity).toBe(p.HeadersConfig.Headers.Items.length);
    expect(p.CookiesConfig.CookieBehavior).toBe("none");
    expect(p.QueryStringsConfig.QueryStringBehavior).toBe("all");
  });
});

describe("CloudFront images cache policy", () => {
  const policy = read("infra/cloudfront/cache-policy-images.json").CachePolicyConfig;
  it("caches for at least a minute and a day by default", () => {
    expect(policy.MinTTL).toBe(60);
    expect(policy.DefaultTTL).toBe(86400);
  });
  it("keys on Accept for format negotiation and all query strings", () => {
    const p = policy.ParametersInCacheKeyAndForwardedToOrigin;
    expect(p.HeadersConfig.Headers.Items).toEqual(["Accept"]);
    expect(p.QueryStringsConfig.QueryStringBehavior).toBe("all");
  });
});

describe("CloudFront distribution template", () => {
  const raw = readFileSync(path.join(root, "infra/cloudfront/distribution.json"), "utf8");
  const dist = JSON.parse(raw);
  type Behaviour = { PathPattern?: string; CachePolicyId: string; OriginRequestPolicyId?: string };
  const behaviours = dist.CacheBehaviors.Items as Behaviour[];

  it("never caches admin or api paths", () => {
    for (const p of ["/admin", "/admin/*", "/api/*"]) {
      const b = behaviours.find((x) => x.PathPattern === p);
      expect(b?.CachePolicyId, p).toBe(CACHING_DISABLED);
    }
  });
  it("uses CachingOptimized for hashed static chunks", () => {
    const b = behaviours.find((x) => x.PathPattern === "/_next/static/*");
    expect(b?.CachePolicyId).toBe(CACHING_OPTIMIZED);
  });
  it("forwards the viewer Host on every behaviour so the ALB certificate validates", () => {
    for (const b of [dist.DefaultCacheBehavior as Behaviour, ...behaviours]) {
      expect(b.OriginRequestPolicyId, b.PathPattern ?? "default").toBe(ALL_VIEWER);
    }
  });
  it("declares as many behaviours as it lists", () => {
    expect(dist.CacheBehaviors.Quantity).toBe(behaviours.length);
  });
  it("includes Asia in the price class and sends a verify header to the origin", () => {
    expect(dist.PriceClass).toBe("PriceClass_200");
    expect(dist.Origins.Items[0].CustomHeaders.Items[0].HeaderName).toBe("X-Origin-Verify");
    expect(dist.Origins.Items[0].CustomOriginConfig.OriginProtocolPolicy).toBe("https-only");
  });
  it("only has the placeholders the setup script substitutes", () => {
    const placeholders = Array.from(raw.matchAll(/\$\{([A-Z_]+)\}/g)).map((m) => m[1]);
    expect(new Set(placeholders)).toEqual(
      new Set(["CALLER_REFERENCE", "SITE_DOMAIN", "ALB_DNS", "ORIGIN_VERIFY", "PAGES_CACHE_POLICY_ID", "IMAGES_CACHE_POLICY_ID", "ACM_CERT_ARN"]),
    );
  });
});
