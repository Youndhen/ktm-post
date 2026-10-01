import { prisma } from "@/lib/prisma";
import CategoryManager from "./CategoryManager";
import { requireStaffPage } from "@/lib/get-session";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  await requireStaffPage();

  const categories = await prisma.category.findMany({
    orderBy: { menuOrder: "asc" },
    include: {
      _count: {
        select: {
          posts: true,
          sponsors: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="admin-page-header">
        <h1>Categories (विधाहरू)</h1>
        <p>Manage article categories, Nepali labels, and navigation menu ordering</p>
      </div>

      <CategoryManager categories={categories} />
    </div>
  );
}
