"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireStaffSession } from "@/lib/get-session";

export type SponsorActionState = {
  error?: string | null;
  success?: boolean;
} | null;

export async function createSponsor(
  _prevState: SponsorActionState,
  formData: FormData
): Promise<SponsorActionState> {
  await requireStaffSession();

  const title = (formData.get("title") as string)?.trim();
  const bannerImageId = (formData.get("bannerImageId") as string)?.trim();
  const categoryId = (formData.get("categoryId") as string)?.trim() || null;
  const link = (formData.get("link") as string)?.trim() || null;
  const priority = parseInt((formData.get("priority") as string) || "0", 10);
  const active = formData.get("active") === "true";

  if (!title) return { error: "Sponsor title is required" };
  if (!bannerImageId) return { error: "Banner image is required" };

  try {
    await prisma.sponsor.create({
      data: {
        title,
        bannerImageId,
        categoryId: categoryId === "all" ? null : categoryId,
        link,
        priority: isNaN(priority) ? 0 : priority,
        active,
      },
    });
  } catch (err: any) {
    console.error("Create sponsor error:", err);
    return { error: err.message || "Failed to create sponsor ad" };
  }

  revalidatePath("/admin/sponsors");
  revalidatePath("/");
  return { success: true };
}

export async function updateSponsor(
  id: string,
  _prevState: SponsorActionState,
  formData: FormData
): Promise<SponsorActionState> {
  await requireStaffSession();

  const title = (formData.get("title") as string)?.trim();
  const bannerImageId = (formData.get("bannerImageId") as string)?.trim();
  const categoryId = (formData.get("categoryId") as string)?.trim() || null;
  const link = (formData.get("link") as string)?.trim() || null;
  const priority = parseInt((formData.get("priority") as string) || "0", 10);
  const active = formData.get("active") === "true";

  if (!title) return { error: "Title is required" };
  if (!bannerImageId) return { error: "Banner image is required" };

  try {
    await prisma.sponsor.update({
      where: { id },
      data: {
        title,
        bannerImageId,
        categoryId: categoryId === "all" ? null : categoryId,
        link,
        priority: isNaN(priority) ? 0 : priority,
        active,
      },
    });
  } catch (err: any) {
    console.error("Update sponsor error:", err);
    return { error: err.message || "Failed to update sponsor ad" };
  }

  revalidatePath("/admin/sponsors");
  revalidatePath("/");
  return { success: true };
}

export async function toggleSponsorActive(
  id: string,
  currentStatus: boolean
): Promise<SponsorActionState> {
  await requireStaffSession();

  try {
    await prisma.sponsor.update({
      where: { id },
      data: { active: !currentStatus },
    });
  } catch (err: any) {
    console.error("Toggle sponsor error:", err);
    return { error: err.message || "Failed to toggle status" };
  }

  revalidatePath("/admin/sponsors");
  revalidatePath("/");
  return { success: true };
}

export async function deleteSponsor(id: string): Promise<SponsorActionState> {
  await requireStaffSession();

  try {
    await prisma.sponsor.delete({ where: { id } });
  } catch (err: any) {
    console.error("Delete sponsor error:", err);
    return { error: err.message || "Failed to delete sponsor ad" };
  }

  revalidatePath("/admin/sponsors");
  revalidatePath("/");
  return { success: true };
}
