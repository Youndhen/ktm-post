import { prisma } from "@/lib/prisma";
import MenuManager from "./MenuManager";
import { requireStaffPage } from "@/lib/get-session";

export const dynamic = "force-dynamic";

export default async function AdminMenuPage() {
  await requireStaffPage();

  const [menuItems, categories] = await Promise.all([
    prisma.menuItem.findMany({
      orderBy: { order: "asc" },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            nepaliName: true,
            slug: true,
          },
        },
      },
    }),
    prisma.category.findMany({
      orderBy: { menuOrder: "asc" },
      select: {
        id: true,
        name: true,
        nepaliName: true,
        slug: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="admin-page-header">
        <h1>Navigation Menu (हेडर मेनु)</h1>
        <p>
          Configure and reorder the links in the header navbar. Link directly to categories, static pages, or custom URLs.
        </p>
      </div>

      <MenuManager menuItems={menuItems} categories={categories} />
    </div>
  );
}
