"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireStaffSession } from "@/lib/get-session";

export type MenuActionState = {
  error?: string | null;
  success?: boolean;
} | null;

export async function createMenuItem(
  _prevState: MenuActionState,
  formData: FormData
): Promise<MenuActionState> {
  await requireStaffSession();

  const label = (formData.get("label") as string)?.trim();
  const nepaliLabel = (formData.get("nepaliLabel") as string)?.trim() || null;
  let url = (formData.get("url") as string)?.trim();
  const order = parseInt((formData.get("order") as string) || "0", 10);
  const categoryId = (formData.get("categoryId") as string)?.trim() || null;
  const openInNewTab = formData.get("openInNewTab") === "on";

  if (!label) return { error: "Menu item label is required" };
  if (!url) return { error: "Target URL is required" };

  // Ensure leading slash for internal links
  if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("/")) {
    url = `/${url}`;
  }

  try {
    await prisma.menuItem.create({
      data: {
        label,
        nepaliLabel,
        url,
        order: isNaN(order) ? 0 : order,
        openInNewTab,
        categoryId: categoryId || undefined,
        isActive: true,
      },
    });
  } catch (err: any) {
    console.error("Create menu item error:", err);
    return { error: err.message || "Failed to create menu item" };
  }

  revalidatePath("/admin/menu");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateMenuItem(
  id: string,
  _prevState: MenuActionState,
  formData: FormData
): Promise<MenuActionState> {
  await requireStaffSession();

  const label = (formData.get("label") as string)?.trim();
  const nepaliLabel = (formData.get("nepaliLabel") as string)?.trim() || null;
  let url = (formData.get("url") as string)?.trim();
  const order = parseInt((formData.get("order") as string) || "0", 10);
  const categoryId = (formData.get("categoryId") as string)?.trim() || null;
  const isActive = formData.get("isActive") === "on" || formData.get("isActive") === "true";
  const openInNewTab = formData.get("openInNewTab") === "on";

  if (!label || !url) return { error: "Label and URL are required" };

  if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("/")) {
    url = `/${url}`;
  }

  try {
    await prisma.menuItem.update({
      where: { id },
      data: {
        label,
        nepaliLabel,
        url,
        order: isNaN(order) ? 0 : order,
        isActive,
        openInNewTab,
        category: categoryId ? { connect: { id: categoryId } } : { disconnect: true },
      },
    });
  } catch (err: any) {
    console.error("Update menu item error:", err);
    return { error: err.message || "Failed to update menu item" };
  }

  revalidatePath("/admin/menu");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteMenuItem(id: string): Promise<MenuActionState> {
  await requireStaffSession();

  try {
    await prisma.menuItem.delete({ where: { id } });
  } catch (err: any) {
    console.error("Delete menu item error:", err);
    return { error: err.message || "Failed to delete menu item" };
  }

  revalidatePath("/admin/menu");
  revalidatePath("/", "layout");
  return { success: true };
}
