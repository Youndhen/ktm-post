import { NextResponse } from "next/server";
import { searchPosts } from "@/lib/wordpress";
import { getCleanContent, getCleanTitle, getPostUrl, mapWpPost } from "@/lib/post-format";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";

  if (!q.trim()) {
    return NextResponse.json([]);
  }

  try {
    const rawPosts = await searchPosts(q, 8);
    const posts = rawPosts.map(mapWpPost);

    const formatted = posts.map((post) => ({
      id: post.id,
      title: getCleanTitle(post.title),
      excerpt: getCleanContent(post.excerpt || post.content, 90),
      url: getPostUrl(post),
      image: post.featuredImage || (post.images && post.images[0]) || null,
      date: post.date,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("API Search error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
