import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PageForm } from "../PageForm";
import { requireStaffPage } from "@/lib/get-session";

export const dynamic = "force-dynamic";

export default async function EditStaticPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaffPage();

  const { id } = await params;
  const page = await prisma.staticPage.findUnique({
    where: { id },
  });

  if (!page) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="admin-page-header">
        <h1>Edit Static Page (पृष्ठ सम्पादन)</h1>
        <p className="line-clamp-1">{page.title}</p>
      </div>

      <PageForm page={page} />
    </div>
  );
}
