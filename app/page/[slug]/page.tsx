import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { sanitizeContent } from "@/lib/sanitize-content";

export const revalidate = 3600;

// No paths are prerendered at build. Without this export a dynamic segment is
// rendered on every request and "revalidate" is ignored (no-store).
export async function generateStaticParams() {
  return [];
}

export default async function StaticPageView({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug).toLowerCase().trim();

  const page = await prisma.staticPage.findFirst({
    where: {
      slug: {
        equals: decodedSlug,
        mode: "insensitive",
      },
    },
  });

  if (!page) {
    notFound();
  }

  return (
    <div className="w-full min-h-screen bg-white">
      <main className="w-full" style={{ paddingTop: "var(--header-height)" }}>
        <div className="w-full max-w-4xl mx-auto px-mobile-safe pt-8 pb-20">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-nepal-red uppercase tracking-wider mb-6 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            गृहपृष्ठ (Home)
          </Link>

          {/* Title Header */}
          <header className="border-b-2 border-nepal-red pb-4 mb-8">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 font-nepali-serif leading-tight">
              {page.title}
            </h1>
            <p className="text-xs text-gray-400 mt-2 font-poppins">
              Last updated: {new Date(page.updatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </header>

          {/* Page Body Content */}
          <article
            className="prose max-w-none text-gray-800 leading-relaxed font-mukta text-lg [&>p]:mb-4 [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:mt-8 [&>h2]:mb-4 [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:mt-6 [&>h3]:mb-3 [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-4 [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:mb-4 [&>blockquote]:border-l-4 [&>blockquote]:border-nepal-red [&>blockquote]:pl-4 [&>blockquote]:italic [&>img]:rounded-xl [&>img]:my-6"
            dangerouslySetInnerHTML={{ __html: sanitizeContent(page.content) }}
          />
        </div>
      </main>
    </div>
  );
}
