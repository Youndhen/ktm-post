import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { sanitizeContent } from "@/lib/sanitize-content";

export const revalidate = 3600;

export default async function AccessibilityPage() {
  const page = await prisma.staticPage.findFirst({
    where: {
      slug: "accessibility",
    },
  });

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

          <header className="border-b-2 border-nepal-red pb-4 mb-8">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 font-nepali-serif leading-tight">
              {page?.title || "Accessibility Statement (पहुँच योग्यता)"}
            </h1>
          </header>

          {page?.content ? (
            <article
              className="prose max-w-none text-gray-800 leading-relaxed font-mukta text-lg [&>p]:mb-4 [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:mt-8 [&>h2]:mb-4 [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:mt-6 [&>h3]:mb-3 [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-4"
              dangerouslySetInnerHTML={{ __html: sanitizeContent(page.content) }}
            />
          ) : (
            <div className="text-gray-700 leading-relaxed font-mukta text-lg space-y-4">
              <p>
                KTM Post is committed to ensuring digital accessibility for people of all abilities. We are continually improving the user experience for everyone and applying the relevant accessibility standards (WCAG 2.1 guidelines).
              </p>
              <h2 className="text-2xl font-bold text-gray-900 mt-6 mb-2">
                Measures to Support Accessibility
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Clear contrast and legible typography for Devanagari and English scripts.</li>
                <li>Responsive mobile interfaces supporting screen magnifiers and keyboard navigation.</li>
                <li>Alt text attributes for news media and figures.</li>
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}