import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/get-session";
import { isStaff } from "@/lib/staff";
import { prisma } from "@/lib/prisma";
import { fetchPosts } from "@/lib/wordpress";
import { transliterateSlug } from "@/lib/transliterate";

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { count = 20, mode = "wordpress" } = await req.json();

    if (mode === "wordpress") {
      // 1. Fetch posts from WordPress GraphQL API
      const wpPosts = await fetchPosts(Number(count) || 20);

      if (!wpPosts || wpPosts.length === 0) {
        return NextResponse.json(
          { error: "No posts retrieved from WordPress CMS." },
          { status: 404 }
        );
      }

      let importedCount = 0;
      let skippedCount = 0;

      for (const post of wpPosts) {
        if (!post.title || !post.content) {
          skippedCount++;
          continue;
        }

        const rawSlug = post.slug || post.title;
        let slug = transliterateSlug(rawSlug);
        if (!slug) slug = `imported-${Date.now().toString(36)}`;

        // Check if already exists by slug
        const existing = await prisma.post.findUnique({ where: { slug } });
        if (existing) {
          skippedCount++;
          continue;
        }

        // Handle Featured Image
        let featuredImageId: string | undefined = undefined;
        if (post.featuredImage?.node?.sourceUrl) {
          const imgUrl = post.featuredImage.node.sourceUrl;
          const altText = post.featuredImage.node.altText || post.title;

          // Check if media already exists
          let media = await prisma.media.findFirst({ where: { url: imgUrl } });
          if (!media) {
            media = await prisma.media.create({
              data: {
                url: imgUrl,
                alt: altText,
                width: post.featuredImage.node.mediaDetails?.width || null,
                height: post.featuredImage.node.mediaDetails?.height || null,
              },
            });
          }
          featuredImageId = media.id;
        }

        // Match or create categories
        const categoryIds: string[] = [];
        if (post.categories?.nodes) {
          for (const catNode of post.categories.nodes) {
            if (!catNode.name) continue;
            const catSlug = catNode.slug || transliterateSlug(catNode.name);

            let cat = await prisma.category.findUnique({
              where: { slug: catSlug },
            });

            if (!cat) {
              cat = await prisma.category.create({
                data: {
                  name: catNode.name,
                  slug: catSlug,
                },
              });
            }
            categoryIds.push(cat.id);
          }
        }

        // Create the Post in Database
        await prisma.post.create({
          data: {
            title: post.title,
            slug,
            content: post.content,
            excerpt: post.excerpt || null,
            status: post.status?.toUpperCase() === "PUBLISH" ? "PUBLISHED" : "PUBLISHED",
            featuredImageId,
            authorId: session.user.id,
            publishedAt: post.date ? new Date(post.date) : new Date(),
            categories:
              categoryIds.length > 0
                ? {
                    create: categoryIds.map((categoryId) => ({ categoryId })),
                  }
                : undefined,
          },
        });

        importedCount++;
      }

      return NextResponse.json({
        success: true,
        imported: importedCount,
        skipped: skippedCount,
        total: wpPosts.length,
      });
    }

    return NextResponse.json({ error: "Unsupported import mode" }, { status: 400 });
  } catch (error: any) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to import posts" },
      { status: 500 }
    );
  }
}
