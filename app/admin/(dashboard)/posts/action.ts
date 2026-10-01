"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireStaffSession } from "@/lib/get-session";
import { postPublicPaths } from "@/lib/post-format";
import { redirect } from "next/navigation";

import { transliterateSlug } from "@/lib/transliterate";

export type ActionState = {
  error?: string | null;
  success?: boolean;
} | null;

function parsePublishDate(input: string | null): Date | null {
  if (!input) return null;
  const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (isoMatch) {
    const [_, y, m, d, h, min, s = "00"] = isoMatch;
    // Interpret local datetime-local as Nepal Standard Time (UTC+05:45)
    return new Date(`${y}-${m}-${d}T${h}:${min}:${s}+05:45`);
  }
  const parsed = new Date(input);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export async function createPost(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireStaffSession();

  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();
  const excerpt = (formData.get("excerpt") as string) || null;
  const videoUrl = (formData.get("videoUrl") as string)?.trim() || null;
  const featuredImageId = (formData.get("featuredImageId") as string) || null;
  const categoryIds = formData.getAll("categoryIds") as string[];
  const status = (formData.get("status") as "DRAFT" | "PUBLISHED") || "DRAFT";
  const authorId = (formData.get("authorId") as string)?.trim() || null;
  const authorName = (formData.get("authorName") as string)?.trim() || null;
  const dateMode = (formData.get("dateMode") as string) || "auto";
  const publishedAtInput = (formData.get("publishedAt") as string)?.trim() || null;

  if (!title) return { error: "Title is required" };
  if (!content) return { error: "Content is required" };

  const rawSlug = (formData.get("slug") as string)?.trim();
  let slug = rawSlug ? transliterateSlug(rawSlug) : transliterateSlug(title);
  if (!slug) slug = `article-${Date.now().toString(36)}`;

  // Ensure slug uniqueness — append timestamp if taken
  const existing = await prisma.post.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now().toString(36)}`;  const isBreaking = formData.get("isBreaking") === "true" || formData.get("isBreaking") === "on";
  const isFeatured = formData.get("isFeatured") === "true" || formData.get("isFeatured") === "on";
  const isExclusive = formData.get("isExclusive") === "true" || formData.get("isExclusive") === "on";

  const selectedCategories = categoryIds.length > 0
    ? await prisma.category.findMany({ where: { id: { in: categoryIds } } })
    : [];

  // Filter out meta-categories if their corresponding badge is unchecked
  const finalCategoryIds = selectedCategories
    .filter(c => {
      if (!isBreaking && (c.slug === "breaking-news" || c.nepaliName?.includes("ताजा"))) return false;
      if (!isFeatured && c.slug === "featured-news") return false;
      if (!isExclusive && c.slug === "exclusive") return false;
      return true;
    })
    .map(c => c.id);

  // If badges are checked, ensure their respective system categories are included
  if (isExclusive) {
    const exclusiveCategory = await prisma.category.findUnique({ where: { slug: "exclusive" } });
    if (exclusiveCategory && !finalCategoryIds.includes(exclusiveCategory.id)) {
      finalCategoryIds.push(exclusiveCategory.id);
    }
  }

  const resolvedPublishedAt =
    status === "PUBLISHED"
      ? (dateMode === "manual" && publishedAtInput ? parsePublishDate(publishedAtInput) || new Date() : new Date())
      : null;

  let postId: string;
  try {
    const post = await prisma.post.create({
      data: {
        title,
        slug,
        content,
        excerpt,
        videoUrl,
        status,
        isBreaking,
        isFeatured,
        isExclusive,
        authorName: authorName || undefined,
        featuredImage: featuredImageId ? { connect: { id: featuredImageId } } : undefined,
        author: authorId ? { connect: { id: authorId } } : undefined,
        publishedAt: resolvedPublishedAt,
        categories:
          finalCategoryIds.length > 0
            ? {
                create: finalCategoryIds.map((categoryId) => ({ categoryId })),
              }
            : undefined,
      },
    });
    postId = post.id;
  } catch (err: any) {
    console.error("Create post error:", err);
    return { error: err.message || "Failed to create post" };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/posts");
  revalidatePath("/");
  revalidatePath("/news");
  revalidatePath("/search");
  revalidatePath("/exclusive");
  for (const path of postPublicPaths(slug, selectedCategories.map((c) => c.slug))) {
    revalidatePath(path);
  }
  redirect(`/admin/posts/${postId}`);
}

export async function updatePost(
  postId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireStaffSession();

  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();
  const excerpt = (formData.get("excerpt") as string) || null;
  const videoUrl = (formData.get("videoUrl") as string)?.trim() || null;
  const featuredImageId = (formData.get("featuredImageId") as string) || null;
  const categoryIds = formData.getAll("categoryIds") as string[];
  const status = (formData.get("status") as "DRAFT" | "PUBLISHED") || "DRAFT";
  const authorId = (formData.get("authorId") as string)?.trim() || null;
  const authorName = (formData.get("authorName") as string)?.trim() || null;
  const dateMode = (formData.get("dateMode") as string) || "manual";
  const publishedAtInput = (formData.get("publishedAt") as string)?.trim() || null;
  const rawSlug = (formData.get("slug") as string)?.trim();

  if (!title || !content) {
    return { error: "Title and content are required" };
  }

  let slug = rawSlug ? transliterateSlug(rawSlug) : transliterateSlug(title);
  if (!slug) slug = `article-${Date.now().toString(36)}`;

  const current = await prisma.post.findUnique({
    where: { id: postId },
    include: { categories: { include: { category: true } } },
  });
  if (!current) return { error: "Post not found" };

  // If slug changed, verify no clash
  if (slug !== current.slug) {
    const clash = await prisma.post.findUnique({ where: { slug } });
    if (clash && clash.id !== postId) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }
  }

  const isBreaking = formData.get("isBreaking") === "true" || formData.get("isBreaking") === "on";
  const isFeatured = formData.get("isFeatured") === "true" || formData.get("isFeatured") === "on";
  const isExclusive = formData.get("isExclusive") === "true" || formData.get("isExclusive") === "on";

  const selectedCategories = categoryIds.length > 0
    ? await prisma.category.findMany({ where: { id: { in: categoryIds } } })
    : [];

  // Filter out meta-categories if their corresponding badge is unchecked
  const finalCategoryIds = selectedCategories
    .filter(c => {
      if (!isBreaking && (c.slug === "breaking-news" || c.nepaliName?.includes("ताजा"))) return false;
      if (!isFeatured && c.slug === "featured-news") return false;
      if (!isExclusive && c.slug === "exclusive") return false;
      return true;
    })
    .map((c) => c.id);

  // If badges are checked, ensure their respective system categories are included
  if (isExclusive) {
    const exclusiveCategory = await prisma.category.findUnique({ where: { slug: "exclusive" } });
    if (exclusiveCategory && !finalCategoryIds.includes(exclusiveCategory.id)) {
      finalCategoryIds.push(exclusiveCategory.id);
    }
  }

  // Resolve Published Date
  let resolvedPublishedAt: Date | null = current.publishedAt;
  if (status === "PUBLISHED") {
    if (dateMode === "auto") {
      resolvedPublishedAt = new Date();
    } else if (dateMode === "manual" && publishedAtInput) {
      resolvedPublishedAt = parsePublishDate(publishedAtInput) || current.publishedAt || new Date();
    } else {
      resolvedPublishedAt = current.publishedAt ?? new Date();
    }
  }

  try {
    await prisma.post.update({
      where: { id: postId },
      data: {
        title,
        slug,
        content,
        excerpt,
        videoUrl,
        status,
        isBreaking,
        isFeatured,
        isExclusive,
        authorName: authorName || null,
        author: authorId ? { connect: { id: authorId } } : { disconnect: true },
        featuredImage: featuredImageId ? { connect: { id: featuredImageId } } : { disconnect: true },
        publishedAt: resolvedPublishedAt,
        categories: {
          deleteMany: {}, // Clear existing joins
          create: finalCategoryIds.map((categoryId) => ({ categoryId })),
        },
      },
    });
  } catch (err: any) {
    console.error("Update post error:", err);
    return { error: err.message || "Failed to update post" };
  }

  // Comprehensive Cache Revalidation
  revalidatePath("/admin");
  revalidatePath("/admin/posts");
  revalidatePath(`/admin/posts/${postId}`);
  revalidatePath("/");
  revalidatePath("/news");
  revalidatePath("/search");
  revalidatePath("/exclusive");

  const allRelevantCategorySlugs = [
    ...selectedCategories,
    ...current.categories.map((c) => c.category),
  ]
    .map((cat) => cat?.slug)
    .filter((s): s is string => Boolean(s));
  for (const path of [
    ...postPublicPaths(current.slug, allRelevantCategorySlugs),
    ...postPublicPaths(slug, allRelevantCategorySlugs),
  ]) {
    revalidatePath(path);
  }

  redirect(`/admin/posts/${postId}`);
}

export async function deletePost(postId: string): Promise<ActionState> {
  const session = await requireStaffSession();

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { categories: { include: { category: true } } },
  });
  if (!post) return { error: "Post not found" };

  try {
    await prisma.post.delete({ where: { id: postId } });
  } catch (err: any) {
    console.error("Delete post error:", err);
    return { error: err.message || "Failed to delete post" };
  }

  // The article and the lists it appeared in are ISR-cached; without this a
  // deleted post would keep being served until the cache expires.
  revalidatePath("/admin");
  revalidatePath("/admin/posts");
  revalidatePath("/");
  revalidatePath("/news");
  revalidatePath("/exclusive");
  for (const path of postPublicPaths(
    post.slug,
    post.categories.map((pc) => pc.category.slug),
  )) {
    revalidatePath(path);
  }
  redirect("/admin/posts");
}