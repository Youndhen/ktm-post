import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { update: vi.fn() },
    session: { deleteMany: vi.fn() },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("better-auth/crypto", () => ({ hashPassword: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/get-session", () => ({
  getServerSession: vi.fn(async () => ({ user: { id: "admin1", role: "admin" } })),
}));

import { toggleUserBan } from "@/app/admin/(dashboard)/users/action";

beforeEach(() => {
  mocks.prisma.user.update.mockReset().mockResolvedValue({});
  mocks.prisma.session.deleteMany.mockReset().mockResolvedValue({ count: 1 });
});

describe("toggleUserBan", () => {
  it("ends every session of a user when suspending them", async () => {
    const result = await toggleUserBan("u2", false);
    expect(result).toEqual({ success: true });
    expect(mocks.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u2" }, data: expect.objectContaining({ banned: true }) }),
    );
    expect(mocks.prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "u2" } });
  });

  it("does not touch sessions when lifting a suspension", async () => {
    await toggleUserBan("u2", true);
    expect(mocks.prisma.session.deleteMany).not.toHaveBeenCalled();
  });
});
