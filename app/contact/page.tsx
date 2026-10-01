import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, MapPin, Building2, Globe } from "lucide-react";

export const revalidate = 3600;

export default async function ContactPage() {
  const [page, settingsRecords] = await Promise.all([
    prisma.staticPage.findFirst({ where: { slug: "contact" } }),
    prisma.siteSetting.findMany(),
  ]);

  const settings: Record<string, string> = {};
  for (const record of settingsRecords) {
    settings[record.key] = record.value;
  }

  const companyLegal =
    settings.company_name_legal ||
    "डिजी भिजन प्रा. लि., सूचना विभाग द.नं. ५३१६-२०८२/०८३";
  const officeAddress = settings.office_address || "Sukedhara, Kathmandu, Nepal";
  const contactEmail = settings.contact_email || "info@ktmpost.com";
  const contactPhone = settings.contact_phone || "9851320822";
  const editorInChief = settings.editor_in_chief || "";

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
              {page?.title || "Contact Us (सम्पर्क)"}
            </h1>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 space-y-4">
              <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2 border-b pb-3">
                <Building2 className="w-5 h-5 text-nepal-red" />
                Office Details (कार्यालय)
              </h2>
              <div className="space-y-3 text-sm text-gray-700">
                <p className="font-semibold text-gray-900 font-nepali-serif text-base">
                  {companyLegal}
                </p>
                <div className="flex items-start gap-2.5 text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <span>{officeAddress}</span>
                </div>
                {editorInChief && (
                  <div className="flex items-center gap-2.5 text-gray-600">
                    <span className="font-semibold">Editor:</span>
                    <span>{editorInChief}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 space-y-4">
              <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2 border-b pb-3">
                <Mail className="w-5 h-5 text-nepal-red" />
                Direct Communication
              </h2>
              <div className="space-y-3 text-sm text-gray-700">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                  <a
                    href={`mailto:${contactEmail}`}
                    className="hover:text-nepal-red underline transition-colors font-mono"
                  >
                    {contactEmail}
                  </a>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                  <a
                    href={`tel:${contactPhone}`}
                    className="hover:text-nepal-red underline transition-colors font-mono"
                  >
                    {contactPhone}
                  </a>
                </div>
                <div className="flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="font-mono text-gray-600">www.ktmpost.com</span>
                </div>
              </div>
            </div>
          </div>

          {page?.content && (
            <article
              className="prose max-w-none text-gray-800 leading-relaxed font-mukta text-lg [&>p]:mb-4 [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:mt-8 [&>h2]:mb-4"
              dangerouslySetInnerHTML={{ __html: page.content }}
            />
          )}
        </div>
      </main>
    </div>
  );
}