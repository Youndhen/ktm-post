import { prisma } from "@/lib/prisma";
import SponsorManager from "./SponsorManager";
import { requireStaffPage } from "@/lib/get-session";

export const dynamic = "force-dynamic";

export default async function AdminSponsorsPage() {
  await requireStaffPage();

  const [sponsors, categories] = await Promise.all([
    prisma.sponsor.findMany({
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      include: {
        category: true,
        bannerImage: true,
      },
    }),
    prisma.category.findMany({ orderBy: { menuOrder: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="admin-page-header">
        <h1>Sponsors & Advertisements</h1>
        <p>Manage header, sidebar, and category-targeted sponsor banners</p>
      </div>

      <SponsorManager sponsors={sponsors} categories={categories} />
    </div>
  );
}
