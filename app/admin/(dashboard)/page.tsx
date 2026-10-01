import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { requireStaffPage } from "@/lib/get-session";
import {
  FileText,
  CheckCircle,
  Clock,
  Plus,
  ArrowRight,
} from "lucide-react";

export default async function AdminDashboard() {
  await requireStaffPage();

  const [totalPosts, publishedPosts, draftPosts, recentPosts] =
    await Promise.all([
      prisma.post.count(),
      prisma.post.count({ where: { status: "PUBLISHED" } }),
      prisma.post.count({ where: { status: "DRAFT" } }),
      prisma.post.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { author: { select: { name: true } } },
      }),
    ]);

  return (
    <>
      <div className="admin-page-header">
        <h1>Dashboard</h1>
        <p>Overview of your news portal content</p>
      </div>

      {/* Stats */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-card__icon admin-stat-card__icon--blue">
            <FileText className="w-5 h-5" />
          </div>
          <p className="admin-stat-card__label">Total Articles</p>
          <p className="admin-stat-card__value">{totalPosts}</p>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card__icon admin-stat-card__icon--green">
            <CheckCircle className="w-5 h-5" />
          </div>
          <p className="admin-stat-card__label">Published</p>
          <p className="admin-stat-card__value">{publishedPosts}</p>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card__icon admin-stat-card__icon--amber">
            <Clock className="w-5 h-5" />
          </div>
          <p className="admin-stat-card__label">Drafts</p>
          <p className="admin-stat-card__value">{draftPosts}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "32px" }}>
        <Link
          href="/admin/posts/new"
          className="inline-flex items-center gap-2 bg-nepal-red hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Article
        </Link>
        <Link
          href="/admin/posts"
          className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-medium px-5 py-2.5 rounded-xl text-sm transition-all"
        >
          View All Articles
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Recent Posts */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            Recent Articles
          </h2>
        </div>
        {recentPosts.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            No articles yet. Create your first one!
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentPosts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/admin/posts/${post.id}`}
                  className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50/60 transition-colors"
                >
                  <div>
                    <p className="font-semibold text-gray-900 text-sm line-clamp-1">
                      {post.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {post.author?.name} ·{" "}
                      {new Date(post.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      post.status === "PUBLISHED"
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-yellow-50 text-yellow-700 border border-yellow-200"
                    }`}
                  >
                    {post.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
