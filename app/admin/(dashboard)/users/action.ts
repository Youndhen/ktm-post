"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/get-session";
import { hashPassword } from "better-auth/crypto";

export type UserActionState = {
  error?: string | null;
  success?: boolean;
} | null;

async function requireAdmin() {
  const session = await getServerSession();
  if (!session) throw new Error("Unauthorized");
  if (session.user.role !== "admin") {
    throw new Error("Forbidden: Only administrators can manage users.");
  }
  return session;
}

export async function createUser(
  _prevState: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  await requireAdmin();

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = (formData.get("password") as string)?.trim();
  const role = (formData.get("role") as string) || "editor";

  if (!name || !email || !password) {
    return { error: "Name, email, and password are required" };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { error: "A user with this email address already exists" };
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        emailVerified: true,
        role: role === "admin" ? "admin" : "editor",
      },
    });

    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hashedPassword,
      },
    });

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err: any) {
    console.error("Create user error:", err);
    return { error: err.message || "Failed to create user account" };
  }
}

export async function resetUserPassword(
  userId: string,
  newPassword: string
): Promise<UserActionState> {
  await requireAdmin();

  if (!newPassword || newPassword.trim().length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { error: "User not found" };
    }

    const hashedPassword = await hashPassword(newPassword.trim());

    // Check if an existing credential account exists for this user
    const existingAccount = await prisma.account.findFirst({
      where: {
        userId: user.id,
        providerId: "credential",
      },
    });

    if (existingAccount) {
      await prisma.account.update({
        where: { id: existingAccount.id },
        data: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.account.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: hashedPassword,
        },
      });
    }

    // Invalidate old sessions for security
    await prisma.session.deleteMany({
      where: { userId: user.id },
    });

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err: any) {
    console.error("Reset password error:", err);
    return { error: err.message || "Failed to reset password" };
  }
}

export async function updateUserRole(
  userId: string,
  newRole: string
): Promise<UserActionState> {
  const session = await requireAdmin();

  if (session.user.id === userId && newRole !== "admin") {
    return { error: "You cannot demote your own administrator account" };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { role: newRole === "admin" ? "admin" : "editor" },
    });

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err: any) {
    console.error("Update role error:", err);
    return { error: err.message || "Failed to update user role" };
  }
}

export async function toggleUserBan(
  userId: string,
  currentBanned: boolean
): Promise<UserActionState> {
  const session = await requireAdmin();

  if (session.user.id === userId) {
    return { error: "You cannot suspend or ban your own account" };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        banned: !currentBanned,
        banReason: !currentBanned ? "Suspended by administrator" : null,
      },
    });

    // better-auth only checks the ban at sign-in. End the user's existing
    // sessions so a suspension takes effect now, not when they next log in.
    if (!currentBanned) {
      await prisma.session.deleteMany({ where: { userId } });
    }

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err: any) {
    console.error("Toggle user ban error:", err);
    return { error: err.message || "Failed to update user status" };
  }
}

export async function deleteUser(userId: string): Promise<UserActionState> {
  const session = await requireAdmin();

  if (session.user.id === userId) {
    return { error: "You cannot delete your own administrator account" };
  }

  try {
    // Delete user (cascades or clears sessions)
    await prisma.user.delete({ where: { id: userId } });
    revalidatePath("/admin/users");
    return { success: true };
  } catch (err: any) {
    console.error("Delete user error:", err);
    return { error: err.message || "Failed to delete user account" };
  }
}
