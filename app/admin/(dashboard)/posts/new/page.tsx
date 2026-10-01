import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/get-session";
import { PostForm } from "../PostForm";

export default async function NewPostPage() {
  const session = await requireStaffPage();
  const [categories, users] = await Promise.all([
    prisma.category.findMany({
      orderBy: { menuOrder: "asc" },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <div className="admin-page-header">
        <h1>Create New Article</h1>
        <p>Write and publish a new news article</p>
      </div>
      <PostForm
        categories={categories}
        users={users}
        currentUserId={session.user.id}
      />
    </>
  );
}
