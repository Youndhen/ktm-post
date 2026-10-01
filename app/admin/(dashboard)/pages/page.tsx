import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus, Edit2, FileText, Globe, ExternalLink } from "lucide-react";
import DeletePageButton from "./DeletePageButton";
import { requireStaffPage } from "@/lib/get-session";

export const dynamic = "force-dynamic";

export default async function AdminPagesListPage() {
  await requireStaffPage();

  const pages = await prisma.staticPage.findMany({
    orderBy: [{ menuOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="admin-page-header mb-0">
          <h1>Footer Pages (फुटर पृष्ठहरू)</h1>
          <p>
            Create and manage static pages like About Us, Privacy Policy, Terms of Service, Contact, etc.
          </p>
        </div>
        <Link
          href="/admin/pages/new"
          className="admin-btn-primary flex items-center gap-2 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Create New Page
        </Link>
      </div>

      {pages.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 text-nepal-red flex items-center justify-center mx-auto mb-3">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            No Footer Pages Found
          </h3>
          <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
            You haven't created any custom static pages yet. Create your first page to show in the footer or menu.
          </p>
          <Link
            href="/admin/pages/new"
            className="admin-btn-primary inline-flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Create Page
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 text-xs font-semibold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3.5">Title & URL</th>
                  <th className="px-6 py-3.5">Placements</th>
                  <th className="px-6 py-3.5">Order</th>
                  <th className="px-6 py-3.5">Last Updated</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pages.map((page) => (
                  <tr key={page.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 font-nepali-serif text-base">
                        {page.title}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono mt-0.5">
                        <span>/{page.slug}</span>
                        <Link
                          href={`/page/${page.slug}`}
                          target="_blank"
                          className="hover:text-nepal-red inline-flex items-center"
                          title="Open page in new tab"
                        >
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </Link>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {page.isFooter && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 uppercase tracking-wide border border-blue-200">
                            Footer
                          </span>
                        )}
                        {page.isNavbar && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 uppercase tracking-wide border border-emerald-200">
                            Header
                          </span>
                        )}
                        {!page.isFooter && !page.isNavbar && (
                          <span className="text-xs text-gray-400">Direct link only</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-700 font-medium">
                      {page.menuOrder}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {new Date(page.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/pages/${page.id}`}
                          className="p-1.5 text-gray-500 hover:text-nepal-red hover:bg-red-50 rounded-md transition-colors"
                          title="Edit page"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Link>
                        <DeletePageButton pageId={page.id} pageTitle={page.title} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
