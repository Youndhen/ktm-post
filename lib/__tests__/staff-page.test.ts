import { beforeEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  redirect: vi.fn((to: string) => {
    // next/navigation's redirect never returns; it throws.
    throw new Error(`REDIRECT:${to}`);
  }),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { requireStaffPage } from "@/lib/get-session";

describe("requireStaffPage", () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
  });

  it("sends a visitor without a session to the admin login", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(requireStaffPage()).rejects.toThrow("REDIRECT:/admin/login");
  });

  it("sends a signed-in non-staff user to the home page", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "u", role: "user" } });
    await expect(requireStaffPage()).rejects.toThrow("REDIRECT:/");
  });

  it("sends a suspended editor to the home page even with a live session", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "u", role: "editor", banned: true } });
    await expect(requireStaffPage()).rejects.toThrow("REDIRECT:/");
  });

  it("returns the session for an editor", async () => {
    const session = { user: { id: "u", role: "editor" } };
    mocks.getSession.mockResolvedValue(session);
    await expect(requireStaffPage()).resolves.toBe(session);
  });
});

// Next skips a layout when the client claims to already have it, so the
// dashboard layout's check does not protect the pages below it. Every page
// has to check for itself.
describe("admin dashboard pages", () => {
  const dir = path.resolve(__dirname, "../../app/admin/(dashboard)");
  const pages = (readdirSync(dir, { recursive: true }) as string[])
    .filter((f) => path.basename(f) === "page.tsx")
    .sort();

  it("finds the dashboard pages", () => {
    expect(pages.length).toBeGreaterThanOrEqual(14);
  });

  it.each(pages)("%s checks for a staff session itself", (page) => {
    const source = readFileSync(path.join(dir, page), "utf8");
    expect(source).toMatch(/await requireStaffPage\(\)/);
  });
});
