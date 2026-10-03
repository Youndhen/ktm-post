import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, Megaphone, CheckCircle } from "lucide-react";
import { sanitizeContent } from "@/lib/sanitize-content";

export const revalidate = 3600;

export default async function AdvertisePage() {
  const [page, settingsRecords] = await Promise.all([
    prisma.staticPage.findFirst({ where: { slug: "advertise" } }),
    prisma.siteSetting.findMany(),
  ]);

  const settings: Record<string, string> = {};
  for (const record of settingsRecords) {
    settings[record.key] = record.value;
  }

  const contactEmail = settings.contact_email || "info@ktmpost.com";
  const contactPhone = settings.contact_phone || "9851320822";

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
              {page?.title || "Advertise with Us (विज्ञापन)"}
            </h1>
          </header>

          {page?.content ? (
            <article
              className="prose max-w-none text-gray-800 leading-relaxed font-mukta text-lg [&>p]:mb-4 [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:mt-8 [&>h2]:mb-4 [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:mt-6 [&>h3]:mb-3 [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-4"
              dangerouslySetInnerHTML={{ __html: sanitizeContent(page.content) }}
            />
          ) : (
            <div className="text-gray-700 leading-relaxed font-mukta text-lg space-y-6">
              <p>
                Reach hundreds of thousands of engaged readers and decision-makers across Nepal and the diaspora through high-impact digital advertising on KTM Post.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-8">
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                  <Megaphone className="w-6 h-6 text-nepal-red mb-2" />
                  <h3 className="font-bold text-gray-900 font-poppins text-base mb-1">
                    Display Banners
                  </h3>
                  <p className="text-xs text-gray-600">
                    Leaderboard, sidebar, header, and in-article premium responsive banners.
                  </p>
                </div>

                <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                  <CheckCircle className="w-6 h-6 text-nepal-red mb-2" />
                  <h3 className="font-bold text-gray-900 font-poppins text-base mb-1">
                    Sponsored Content
                  </h3>
                  <p className="text-xs text-gray-600">
                    Custom native editorial, product highlights, and corporate press releases.
                  </p>
                </div>

                <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                  <Megaphone className="w-6 h-6 text-nepal-red mb-2" />
                  <h3 className="font-bold text-gray-900 font-poppins text-base mb-1">
                    Multimedia & Video
                  </h3>
                  <p className="text-xs text-gray-600">
                    High engagement video pre-rolls, custom podcasts, and social media reach.
                  </p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
                <h3 className="text-xl font-bold text-nepal-red font-nepali-serif mb-2">
                  विज्ञापनका लागि सिधा सम्पर्क गर्नुहोस्
                </h3>
                <p className="text-sm text-gray-700 mb-4">
                  इमेल: <a href={`mailto:${contactEmail}`} className="font-bold underline">{contactEmail}</a> | फोन: <a href={`tel:${contactPhone}`} className="font-bold underline">{contactPhone}</a>
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}