"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireStaffSession } from "@/lib/get-session";

export type CategoryActionState = {
  error?: string | null;
  success?: boolean;
} | null;

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

export async function createCategory(
  _prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  await requireStaffSession();

  const name = (formData.get("name") as string)?.trim();
  const nepaliName = (formData.get("nepaliName") as string)?.trim() || null;
  const menuOrder = parseInt((formData.get("menuOrder") as string) || "0", 10);
  const isNavVisible = formData.get("isNavVisible") !== "false";
  let slug = (formData.get("slug") as string)?.trim() || slugify(name);

  if (!name) return { error: "Category name is required" };
  if (!slug) return { error: "Slug is required" };

  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) {
    return { error: "A category with this slug already exists" };
  }

  try {
    await prisma.category.create({
      data: {
        name,
        nepaliName,
        slug,
        menuOrder: isNaN(menuOrder) ? 0 : menuOrder,
      },
    });
  } catch (err: any) {
    console.error("Create category error:", err);
    return { error: err.message || "Failed to create category" };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateCategory(
  id: string,
  _prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  await requireStaffSession();

  const name = (formData.get("name") as string)?.trim();
  const nepaliName = (formData.get("nepaliName") as string)?.trim() || null;
  const menuOrder = parseInt((formData.get("menuOrder") as string) || "0", 10);
  const slug = (formData.get("slug") as string)?.trim();

  if (!name || !slug) return { error: "Name and slug are required" };

  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing && existing.id !== id) {
    return { error: "Slug is already used by another category" };
  }

  try {
    await prisma.category.update({
      where: { id },
      data: {
        name,
        nepaliName,
        slug,
        menuOrder: isNaN(menuOrder) ? 0 : menuOrder,
      },
    });
  } catch (err: any) {
    console.error("Update category error:", err);
    return { error: err.message || "Failed to update category" };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteCategory(id: string): Promise<CategoryActionState> {
  await requireStaffSession();

  try {
    await prisma.category.delete({ where: { id } });
  } catch (err: any) {
    console.error("Delete category error:", err);
    return { error: err.message || "Failed to delete category" };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
  return { success: true };
}
