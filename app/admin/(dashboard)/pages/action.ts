"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireStaffSession } from "@/lib/get-session";
import { redirect } from "next/navigation";
import { transliterateSlug } from "@/lib/transliterate";

export type PageActionState = {
  error?: string | null;
  success?: boolean;
} | null;

// Static pages are served at both /<slug> and /page/<slug>.
function revalidateStaticPage(slug: string) {
  revalidatePath(`/${slug}`);
  revalidatePath(`/page/${slug}`);
}

export async function createStaticPage(
  _prevState: PageActionState,
  formData: FormData
): Promise<PageActionState> {
  await requireStaffSession();

  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim() || "";
  const rawSlug = (formData.get("slug") as string)?.trim();
  const menuOrder = parseInt((formData.get("menuOrder") as string) || "0", 10);
  const isFooter = formData.get("isFooter") === "true" || formData.get("isFooter") === "on";
  const isNavbar = formData.get("isNavbar") === "true" || formData.get("isNavbar") === "on";

  if (!title) return { error: "Page title is required" };

  let slug = rawSlug ? transliterateSlug(rawSlug) : transliterateSlug(title);
  if (!slug) slug = `page-${Date.now().toString(36)}`;

  const existing = await prisma.staticPage.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now().toString(36)}`;

  try {
    await prisma.staticPage.create({
      data: {
        title,
        slug,
        content,
        menuOrder: isNaN(menuOrder) ? 0 : menuOrder,
        isFooter,
        isNavbar,
      },
    });
  } catch (err: any) {
    console.error("Create page error:", err);
    return { error: err.message || "Failed to create page" };
  }

  revalidatePath("/admin/pages");
  revalidateStaticPage(slug);
  revalidatePath("/", "layout");
  redirect("/admin/pages");
}

export async function updateStaticPage(
  pageId: string,
  _prevState: PageActionState,
  formData: FormData
): Promise<PageActionState> {
  await requireStaffSession();

  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim() || "";
  const rawSlug = (formData.get("slug") as string)?.trim();
  const menuOrder = parseInt((formData.get("menuOrder") as string) || "0", 10);
  const isFooter = formData.get("isFooter") === "true" || formData.get("isFooter") === "on";
  const isNavbar = formData.get("isNavbar") === "true" || formData.get("isNavbar") === "on";

  if (!title) return { error: "Page title is required" };

  const current = await prisma.staticPage.findUnique({ where: { id: pageId } });
  if (!current) return { error: "Page not found" };

  let slug = rawSlug ? transliterateSlug(rawSlug) : current.slug;
  if (slug !== current.slug) {
    const clash = await prisma.staticPage.findUnique({ where: { slug } });
    if (clash && clash.id !== pageId) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }
  }

  try {
    await prisma.staticPage.update({
      where: { id: pageId },
      data: {
        title,
        slug,
        content,
        menuOrder: isNaN(menuOrder) ? 0 : menuOrder,
        isFooter,
        isNavbar,
      },
    });
  } catch (err: any) {
    console.error("Update page error:", err);
    return { error: err.message || "Failed to update page" };
  }

  revalidatePath("/admin/pages");
  revalidateStaticPage(current.slug);
  if (slug !== current.slug) revalidateStaticPage(slug);
  revalidatePath("/", "layout");
  redirect("/admin/pages");
}

export async function deleteStaticPage(pageId: string): Promise<PageActionState> {
  await requireStaffSession();

  const page = await prisma.staticPage.findUnique({ where: { id: pageId } });
  if (!page) return { error: "Page not found" };

  try {
    await prisma.staticPage.delete({ where: { id: pageId } });
  } catch (err: any) {
    console.error("Delete page error:", err);
    return { error: err.message || "Failed to delete page" };
  }

  revalidatePath("/admin/pages");
  revalidateStaticPage(page.slug);
  revalidatePath("/", "layout");
  return { success: true };
}
