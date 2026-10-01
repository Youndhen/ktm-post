import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const revalidate = 3600;

export default async function AboutUsPage() {
  const page = await prisma.staticPage.findFirst({
    where: {
      slug: "about-us",
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
              {page?.title || "About Us / हाम्रो बारेमा"}
            </h1>
          </header>

          {page?.content ? (
            <article
              className="prose max-w-none text-gray-800 leading-relaxed font-mukta text-lg [&>p]:mb-4 [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:mt-8 [&>h2]:mb-4 [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:mt-6 [&>h3]:mb-3 [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-4"
              dangerouslySetInnerHTML={{ __html: page.content }}
            />
          ) : (
            <div className="text-gray-700 leading-relaxed font-mukta text-lg space-y-4">
              <p>
                <strong>KTM Post (काठमाडौं पोस्ट)</strong> नेपालको एक अग्रणी डिजिटल समाचार माध्यम हो। हामी निष्पक्ष, तथ्यपरक र गहन पत्रकारिताका माध्यमबाट पाठकहरूलाई सत्य र विश्‍वसनीय सूचना सम्प्रेषण गर्न प्रतिबद्ध छौं।
              </p>
              <p>
                डिजिटल मिडियाको यस युगमा हामी राजनीति, समाज, अर्थतन्त्र, खेलकुद, विचार तथा विश्वव्यापी घटनाक्रमहरूलाई निष्पक्ष दृष्टिकोणबाट प्रस्तुत गर्दछौं।
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mt-8">
                <h3 className="text-base font-bold text-gray-900 mb-2 font-poppins">
                  Contact & Information
                </h3>
                <p className="text-sm text-gray-600">
                  डिजी भिजन प्रा. लि., सूचना विभाग द.नं. ५३१६-२०८२/०८३
                </p>
                <p className="text-sm text-gray-600">
                  Sukedhara, Kathmandu, Nepal | info@ktmpost.com | 9851320822
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}