import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import PostsTable from "./PostsTable";
import { requireStaffPage } from "@/lib/get-session";

export default async function AdminPostsPage() {
  await requireStaffPage();

  let posts: any[] = [];
  try {
    posts = await prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { name: true } },
        categories: { include: { category: true } },
      },
    });
  } catch (err) {
    console.error("Error fetching posts:", err);
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="admin-page-header" style={{ marginBottom: 0 }}>
          <h1>Articles</h1>
          <p>Create, publish, and manage news posts</p>
        </div>
        <Link
          href="/admin/posts/new"
          className="inline-flex items-center gap-2 bg-nepal-red hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Article
        </Link>
      </div>

      <PostsTable initialPosts={posts} />
    </>
  );
}
