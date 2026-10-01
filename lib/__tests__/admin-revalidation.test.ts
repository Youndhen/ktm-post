import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  prisma: {
    post: { findUnique: vi.fn(), delete: vi.fn() },
    menuItem: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    category: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/get-session", () => ({
  requireStaffSession: vi.fn(async () => ({ user: { id: "u1", role: "admin" } })),
}));

import { deletePost } from "@/app/admin/(dashboard)/posts/action";
import {
  createMenuItem,
  deleteMenuItem,
  updateMenuItem,
} from "@/app/admin/(dashboard)/menu/action";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/app/admin/(dashboard)/categories/action";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

beforeEach(() => {
  mocks.revalidatePath.mockClear();
  mocks.prisma.category.findUnique.mockResolvedValue(null);
});

describe("deletePost", () => {
  it("revalidates every URL the article and its lists are served at", async () => {
    mocks.prisma.post.findUnique.mockResolvedValue({
      id: "p1",
      slug: "budget-speech",
      categories: [{ category: { slug: "politics" } }, { category: { slug: "business" } }],
    });
    await deletePost("p1");
    const paths = mocks.revalidatePath.mock.calls.map((c) => c[0]);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/",
        "/news",
        "/news/budget-speech",
        "/politics",
        "/politics/budget-speech",
        "/economy",
        "/economy/budget-speech",
      ]),
    );
  });
});

// The header (menu) is part of the root layout, so it is baked into every
// cached page, not only the home page.
describe("menu and category edits", () => {
  const cases: Array<[string, () => Promise<unknown>]> = [
    ["createMenuItem", () => createMenuItem(null, form({ label: "Sports", url: "/sports" }))],
    ["updateMenuItem", () => updateMenuItem("m1", null, form({ label: "Sports", url: "/sports" }))],
    ["deleteMenuItem", () => deleteMenuItem("m1")],
    ["createCategory", () => createCategory(null, form({ name: "Sports", slug: "sports" }))],
    ["updateCategory", () => updateCategory("c1", null, form({ name: "Sports", slug: "sports" }))],
    ["deleteCategory", () => deleteCategory("c1")],
  ];

  it.each(cases)("%s revalidates the whole layout", async (_name, run) => {
    await expect(run()).resolves.toEqual({ success: true });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});
