import { prisma } from "@/lib/prisma";

interface SidebarAdsProps {
  category?: string;
  maxAds?: number;
  startIndex?: number;
}

export default async function SidebarAds({
  category,
  maxAds = 3,
  startIndex = 0,
}: SidebarAdsProps) {
  let sponsors: any[] = [];

  try {
    sponsors = await prisma.sponsor.findMany({
      where: {
        active: true,
        ...(category
          ? {
              category: {
                slug: category.toLowerCase(),
              },
            }
          : {}),
      },
      orderBy: { priority: "desc" },
      skip: startIndex,
      take: maxAds,
      include: {
        bannerImage: true,
      },
    });
  } catch (error) {
    console.error("Error fetching sponsors from DB:", error);
  }

  const DEFAULT_SIDEBAR_FALLBACKS = [
    {
      id: "fallback-ad-0",
      title: "TVC Advertisement",
      adTitle: "विज्ञापन स्थान",
      adImage: "/banner/TVC MT RAJESH HAMAL 5 SEC.mp4",
      link: "#",
    },
    {
      id: "fallback-ad-1",
      title: "MT Logo",
      adTitle: "विज्ञापन स्थान",
      adImage: "/banner/MT LOGO FLIP.mp4",
      link: "#",
    },
  ];

  // Fallback cards if no ads are currently in the database
  const displayAds =
    sponsors.length > 0
      ? sponsors.map((s) => ({
          id: s.id,
          title: s.title,
          adTitle: s.title,
          adImage: s.bannerImage?.url || null,
          link: s.link || "#",
        }))
      : DEFAULT_SIDEBAR_FALLBACKS.slice(
          startIndex,
          startIndex + Math.min(maxAds, DEFAULT_SIDEBAR_FALLBACKS.length)
        );

  return (
    <div className="flex flex-col gap-3">
      {displayAds.map((ad) => {
        const isVideo =
          ad.adImage &&
          (ad.adImage.endsWith(".mp4") ||
            ad.adImage.endsWith(".webm") ||
            ad.adImage.includes(".mp4"));

        return (
          <div
            key={ad.id}
            className="block w-full overflow-hidden border border-gray-200 bg-white shadow-2xs"
            title={ad.adTitle || ad.title}
          >
            {/* "Ad" label */}
            <div className="px-2 py-1 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <span className="text-[10px] font-poppins font-semibold text-gray-400 uppercase tracking-widest">
                विज्ञापन
              </span>
              <span className="text-[10px] font-poppins text-gray-300">Ad</span>
            </div>

            {/* Ad Media (Video or Image) */}
            {ad.adImage ? (
              <a
                href={ad.link}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full overflow-hidden block bg-black"
              >
                {isVideo ? (
                  <video
                    src={ad.adImage}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-auto object-cover block"
                  />
                ) : (
                  <img
                    src={ad.adImage}
                    alt={ad.adTitle || ad.title || "Advertisement"}
                    className="w-full h-auto object-cover"
                    loading="lazy"
                  />
                )}
              </a>
            ) : (
              // Placeholder when no media is set
              <div className="w-full h-28 bg-gradient-to-br from-gray-100 to-gray-50 flex flex-col items-center justify-center gap-1">
                <span className="text-gray-300 text-2xl">📢</span>
                <p className="text-gray-400 text-xs font-poppins">
                  {ad.adTitle || "Advertisement"}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
