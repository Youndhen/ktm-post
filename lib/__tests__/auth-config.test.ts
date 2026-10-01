import { afterEach, describe, expect, it, vi } from "vitest";

async function loadAuth(nodeEnv: string) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret");
  const { auth } = await import("@/lib/auth");
  return auth;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("auth config", () => {
  it("closes public sign-up", async () => {
    const auth = await loadAuth("production");
    expect(auth.options.emailAndPassword?.disableSignUp).toBe(true);
  });

  it("trusts only the site origins in production", async () => {
    const auth = await loadAuth("production");
    const origins = auth.options.trustedOrigins as string[];
    expect(origins).toContain("https://www.ktmpost.com");
    expect(origins).toContain("https://ktmpost.com");
    expect(origins.filter((o) => /localhost|127\.0\.0\.1/.test(o))).toEqual([]);
  });

  it("also trusts localhost outside production", async () => {
    const auth = await loadAuth("development");
    expect(auth.options.trustedOrigins).toContain("http://localhost:3000");
  });
});
