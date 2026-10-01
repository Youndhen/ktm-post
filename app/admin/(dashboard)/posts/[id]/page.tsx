import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/get-session";
import { PostForm } from "../PostForm";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireStaffPage();
  const { id } = await params;

  const [post, categories, users] = await Promise.all([
    prisma.post.findUnique({
      where: { id },
      include: {
        categories: { include: { category: true } },
        featuredImage: true,
        author: true,
      },
    }),
    prisma.category.findMany({ orderBy: { menuOrder: "asc" } }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!post) {
    notFound();
  }

  return (
    <>
      <div className="admin-page-header">
        <h1>Edit Article</h1>
        <p className="line-clamp-1">{post.title}</p>
      </div>
      <PostForm
        post={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          content: post.content,
          excerpt: post.excerpt,
          status: post.status,
          videoUrl: post.videoUrl,
          isBreaking: post.isBreaking,
          isFeatured: post.isFeatured,
          isExclusive: post.isExclusive,
          authorId: post.authorId,
          authorName: post.authorName,
          author: post.author,
          categoryIds: post.categories.map((c) => c.categoryId),
          featuredImageId: post.featuredImageId,
          featuredImage: post.featuredImage,
          publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
          createdAt: post.createdAt ? post.createdAt.toISOString() : null,
        }}
        categories={categories}
        users={users}
        currentUserId={session.user.id}
      />
    </>
  );
}
