import { fetchAdsBanner } from "@/lib/wordpress";

interface BannerAdSlotProps {
  /** Index of the ad to display from active CMS ads array (default: 0) */
  index?: number;
  /** Optional fallback image static path if no CMS ad exists at this index */
  fallbackImage?: string;
  /** Optional fallback link if using static fallback image */
  fallbackLink?: string;
  /** Custom container class */
  className?: string;
}

export default async function BannerAdSlot({
  index = 0,
  fallbackImage,
  fallbackLink = "#",
  className = "w-full max-w-4xl h-auto object-contain",
}: BannerAdSlotProps) {
  const ads = await fetchAdsBanner();
  const activeAds = ads.filter((ad) => ad.active !== false);

  const ad = activeAds[index];

  if (!ad && !fallbackImage) {
    return null;
  }

  const imageUrl = ad?.adImage || fallbackImage;
  const link = ad?.link || fallbackLink;
  const title = ad?.adTitle || ad?.title || "Advertisement";

  if (!imageUrl) return null;

  const isVideo =
    imageUrl.endsWith(".mp4") ||
    imageUrl.endsWith(".webm") ||
    imageUrl.includes("mp4");

  return (
    <div className="w-full flex justify-center py-4 md:py-6">
      <div className="block w-full max-w-5xl px-mobile-safe" title={title}>
        {isVideo ? (
          <video
            src={imageUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-auto rounded-xs object-cover border border-gray-200 shadow-xs"
          />
        ) : (
          <img src={imageUrl} alt={title} className={className} loading="lazy" />
        )}
      </div>
    </div>
  );
}
