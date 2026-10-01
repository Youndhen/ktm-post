import { prisma } from "@/lib/prisma";
import MediaLibrary from "./MediaLibrary";
import { requireStaffPage } from "@/lib/get-session";

export const dynamic = "force-dynamic";

export default async function AdminMediaPage() {
  await requireStaffPage();

  const mediaItems = await prisma.media.findMany({
    orderBy: { createdAt: "desc" },
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
        <h1>Media Library</h1>
        <p>Upload, organize, and manage Cloudinary images for articles and sponsor ads</p>
      </div>

      <MediaLibrary initialMedia={mediaItems} />
    </div>
  );
}
