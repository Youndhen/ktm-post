export const runtime = "nodejs";
export const revalidate = 60;

// No paths are prerendered at build. Without this export a dynamic segment is
// rendered on every request and "revalidate" is ignored (no-store).
export async function generateStaticParams() {
  return [];
}

import ArticleShareBar from "@/app/components/ArticleShareBar";
import NepaliCalendarWidget from "@/app/components/NepaliCalendarWidget";
import UpcomingHolidays from "@/app/components/UpcomingHolidays";
import { sanitizeContent } from "@/lib/sanitize-content";
import ForexRatesWidget from "@/app/components/ForexRatesWidget";
import SidebarAds from "@/app/components/SidebarAds";
import { Suspense } from "react";

import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCleanContent, getPostUrl } from "@/lib/post-format";
import ImageSlider from "@/app/components/ImageSlider";
import NewsImage from "@/app/components/NewsImage";
import YouTubeEmbed from "@/app/components/YouTubeEmbed";
import { transliterateSlug } from "@/lib/transliterate";
import { extractYouTubeFromContent } from "@/lib/youtube";
import * as cheerio from "cheerio";
import NepaliDate from "bikram-sambat-js";

const nepaliMonths = [
  "बैशाख",
  "जेठ",
  "असार",
  "श्रावण",
  "भदौ",
  "आश्विन",
  "कार्तिक",
  "मंसिर",
  "पौष",
  "माघ",
  "फाल्गुण",
  "चैत्र",
];

const toNepaliDigits = (num: number | string) => {
  const nepali = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];
  return num.toString().replace(/\d/g, (d) => nepali[parseInt(d)]);
};

function getFormattedNepaliDate(dateStr: string): string {
  try {
    const dateObj = new Date(dateStr);
    const bsDate = new NepaliDate(dateObj);
    const [bsYear, bsMonth, bsDay] = bsDate.toBS().split("-").map(Number);
    const monthName = nepaliMonths[bsMonth - 1] || "";
    // Get hours and minutes in Nepal Standard Time (UTC+05:45)
    const nepalTime = new Date(dateObj.getTime() + (5 * 60 + 45) * 60 * 1000);
    const hours = toNepaliDigits(
      nepalTime.getUTCHours().toString().padStart(2, "0"),
    );
    const minutes = toNepaliDigits(
      nepalTime.getUTCMinutes().toString().padStart(2, "0"),
    );
    return `${toNepaliDigits(bsYear)} ${monthName} ${toNepaliDigits(bsDay)} गते ${hours}:${minutes}`;
  } catch {
    return dateStr;
  }
}

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

function decodeHtmlEntities(text: string | null): string {
  if (!text) return "";

  const decodedText = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "...");

  return decodedText;
}

function getCleanTitle(title: string | null): string {
  if (!title) return "Untitled Post";
  const decodedTitle = decodeHtmlEntities(title);
  return decodedTitle
    .replace(/\b\d+\/\d+\b/g, "")
    .replace(/\b\d+ of \d+\b/gi, "")
    .replace(/\[[^\]]*\]/g, "")
    .trim();
}

function extractImagesFromContent(content: string | null): string[] {
  if (!content) return [];

  const $ = cheerio.load(content);
  const images: string[] = [];

  $("img").each((_, img) => {
    let src =
      $(img).attr("data-src") ||
      $(img).attr("data-lazy-src") ||
      $(img).attr("src");

    if (!src) return;

    // ignore placeholder base64
    if (src.startsWith("data:image")) {
      src = $(img).attr("data-src") || $(img).attr("data-lazy-src") || "";
    }

    if (!src) return;

    if (src.startsWith("//")) src = `https:${src}`;
    if (src.startsWith("/")) src = `https://cms.ktmpost.com${src}`;

    images.push(src);
  });

  return [...new Set(images)];
}

function normalizeImageUrl(url: string): string {
  try {
    return (
      url
        .split("/")
        .pop() // get filename
        ?.replace(/-\d+x\d+(?=\.)/, "") // remove size suffix
        .split("?")[0] // remove query params
        .replace(/^https?:/, "") || ""
    );
  } catch {
    return "";
  }
}

function removeThumbnailFromContent(
  content: string | null,
  thumbnail?: string,
): string {
  if (!content || !thumbnail) return content || "";

  const $ = cheerio.load(content);
  const thumbName = normalizeImageUrl(thumbnail);

  $("img").each((_, img) => {
    const src =
      $(img).attr("data-src") ||
      $(img).attr("data-lazy-src") ||
      $(img).attr("src");
    if (!src) return;
    const imgName = normalizeImageUrl(src);

    if (imgName && imgName === thumbName) {
      $(img).remove();
    }
  });

  return $.html();
}

function removeYouTubeFromContent(content: string | null): string {
  if (!content) return "";
  const $ = cheerio.load(content);
  $("iframe").each((_, iframe) => {
    const src = $(iframe).attr("src") || "";
    if (src.includes("youtube.com") || src.includes("youtu.be")) {
      $(iframe).remove();
    }
  });
  return $.html();
}

// ─── Prisma helpers ───────────────────────────────────────────────

async function fetchPostFromDB(idParam: string, categorySlug?: string) {
  const decoded = decodeURIComponent(idParam).trim();
  const includeQuery = {
    featuredImage: true,
    author: { select: { name: true, image: true } },
    categories: { include: { category: true } },
  };

  // 1. Try exact slug match first
  let post = await prisma.post.findUnique({
    where: { slug: decoded },
    include: includeQuery,
  });

  // 2. Fallback: transliterate the full slug and try again
  if (!post) {
    const transliterated = transliterateSlug(decoded);
    if (transliterated !== decoded) {
      post = await prisma.post.findUnique({
        where: { slug: transliterated },
        include: includeQuery,
      });
    }
  }

  // 3. Fallback: Lookup by post ID (cuid)
  if (!post) {
    try {
      post = await prisma.post.findUnique({
        where: { id: decoded },
        include: includeQuery,
      });
    } catch {
      // Ignore invalid id format errors
    }
  }

  // 4. Fallback: If it starts with a legacy numeric prefix like "12345-actual-slug"
  if (!post) {
    const match = decoded.match(/^(\d+)-(.+)$/);
    if (match) {
      const strippedSlug = match[2];
      post = await prisma.post.findUnique({
        where: { slug: strippedSlug },
        include: includeQuery,
      });

      if (!post) {
        const transliteratedStripped = transliterateSlug(strippedSlug);
        if (transliteratedStripped !== strippedSlug) {
          post = await prisma.post.findUnique({
            where: { slug: transliteratedStripped },
            include: includeQuery,
          });
        }
      }
    }
  }

  return post;
}

async function fetchRelatedFromDB(postId: string, categoryIds: string[], limit: number = 4) {
  if (categoryIds.length === 0) {
    // Fallback: latest posts
    return prisma.post.findMany({
      where: { status: "PUBLISHED", id: { not: postId } },
      orderBy: { publishedAt: "desc" },
      take: limit,
      include: {
        featuredImage: true,
        author: { select: { name: true } },
        categories: { include: { category: true } },
      },
    });
  }

  return prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      id: { not: postId },
      categories: { some: { categoryId: { in: categoryIds } } },
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    include: {
      featuredImage: true,
      author: { select: { name: true } },
      categories: { include: { category: true } },
    },
  });
}

import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; category?: string }>;
}): Promise<Metadata> {
  const { id, category } = await params;
  const post = await fetchPostFromDB(id, category);

  if (!post) {
    return {
      title: "समाचार भेटिएन - KTM Post",
      description: "समाचार पृष्ठ उपलब्ध छैन।",
    };
  }

  const cleanTitle = getCleanTitle(post.title);
  const rawContent = post.content || "";
  const cleanDescription = getCleanContent(rawContent, 160);

  const contentImages = extractImagesFromContent(rawContent);
  const featuredImageUrl = post.featuredImage?.url || undefined;
  const heroImage =
    featuredImageUrl ||
    (contentImages.length > 0 ? contentImages[0] : undefined);

  const images = heroImage ? [{ url: heroImage }] : [];

  return {
    title: `${cleanTitle} - KTM Post`,
    description: cleanDescription,
    openGraph: {
      title: cleanTitle,
      description: cleanDescription,
      type: "article",
      siteName: "KTM Post",
      images: images,
    },
    twitter: {
      card: "summary_large_image",
      title: cleanTitle,
      description: cleanDescription,
      images: images.map((i) => i.url),
    },
  };
}

export default async function NewsSlugPage({
  params,
}: {
  params: Promise<{ id: string; category?: string }>;
}) {
  const { id, category } = await params;

  const post = await fetchPostFromDB(id, category);

  // A real 404 (app/not-found.tsx), so missing articles are not served and
  // cached as if they were pages.
  if (!post) notFound();

  // Get category slugs for related posts
  const categorySlugs = post.categories.map((pc) => pc.category.slug);
  const categoryIds = post.categories.map((pc) => pc.categoryId);

  const metaCategorySlugs = ["featured-news", "latest-news"];
  const nonMetaCategorySlugs = categorySlugs.filter(
    (slug) => !metaCategorySlugs.includes(slug),
  );

  // Fetch related posts from DB
  const relatedDbPosts = await fetchRelatedFromDB(post.id, categoryIds, 4);

  const contentImages = extractImagesFromContent(post.content);
  const featuredImageUrl = post.featuredImage?.url || undefined;

  // Main hero image
  const heroImage =
    featuredImageUrl ||
    (contentImages.length > 0 ? contentImages[0] : undefined);

  // Video URL (from dedicated post.videoUrl field or extracted from content)
  const videoUrl = post.videoUrl || extractYouTubeFromContent(post.content);

  // Clean content (remove hero image and youtube iframe from body text if embedded)
  const contentWithoutThumb = removeThumbnailFromContent(post.content, heroImage);
  // Sanitised at render as well as at save, so articles stored before the
  // sanitiser existed (and imported ones) cannot carry script either.
  const cleanedContent = sanitizeContent(
    videoUrl ? removeYouTubeFromContent(contentWithoutThumb) : contentWithoutThumb,
  );

  const dateStr = (post.publishedAt || post.createdAt).toISOString();
  const formattedDate = getFormattedNepaliDate(dateStr);

  // Author display
  const authorDisplay = post.authorName
    ? post.authorName
    : post.author?.name && post.author.name.toLowerCase() !== "news"
    ? post.author.name
    : "KTM Post";

  const postUrl = `https://www.ktmpost.com/news/${post.slug}`;

  return (
    <div
      className={`${inter.className} min-h-screen text-nepal-black w-full bg-white`}
    >
      <main
        className="w-full flex items-center justify-center pt-3 lg:pt-4"
        style={{ paddingTop: "var(--header-height)" }}
      >
        <article className="w-full max-w-[1500px] mx-auto px-mobile-safe flex flex-col gap-6">
          {/* Main content + Advertisement side by side */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(320px,380px)] gap-8 items-start">
            {/* Main Content */}
            <div className="flex flex-col gap-6">
              <header className="flex flex-col gap-2 justify-center items-center text-center">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold leading-snug text-nepal-black font-nepali-serif">
                  {getCleanTitle(post.title)}
                </h1>

                <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 text-gray-600 text-sm md:text-base font-poppins">
                  <time dateTime={dateStr} className="font-medium">
                    {formattedDate}
                  </time>
                 
                 
                </div>
              </header>

              <div className="bg-white p-3 sm:p-4 md:p-6">
                {!videoUrl && heroImage && (
                  <div className="w-full mb-5 md:mb-8">
                    <div className="w-full relative overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                      <NewsImage
                        post={{
                          id: post.id,
                          title: post.title,
                          featuredImage: heroImage,
                          content: post.content,
                          images: contentImages,
                        }}
                        images={[heroImage]}
                        className="w-full h-auto object-contain block mx-auto"
                        fallbackGradient="bg-gradient-to-br from-gray-200 to-gray-300"
                      />
                    </div>
                  </div>
                )}

                <div
                  className="prose prose-lg md:prose-xl max-w-none text-gray-800 font-poppins
                    prose-p:text-base prose-p:sm:text-lg prose-p:md:text-xl prose-p:leading-[1.9]
                    prose-headings:font-nepali-serif prose-headings:text-nepal-black
                    prose-li:text-base prose-li:sm:text-lg prose-li:md:text-xl
                    prose-img:rounded-lg prose-img:mx-auto"
                  dangerouslySetInnerHTML={{
                    __html: cleanedContent || "<p>No content available.</p>",
                  }}
                  style={{
                    lineHeight: "1.9",
                    fontSize: "clamp(1.05rem, 2.5vw, 1.25rem)",
                  }}
                />

                {/* Dedicated YouTube Video Player at bottom of content */}
                {videoUrl && (
                  <YouTubeEmbed
                    url={videoUrl}
                    title={getCleanTitle(post.title)}
                  />
                )}

                {/* Social Share & Published Date Bar */}
                <ArticleShareBar
                  title={getCleanTitle(post.title)}
                  publishedDate={formattedDate}
                  authorName={authorDisplay}
                  url={postUrl}
                />

                {/* Related News - directly below content */}
                {relatedDbPosts.length > 0 && (
                  <div className="border-t border-gray-200 pt-8 mt-8 space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl md:text-2xl font-bold text-nepal-black font-nepali-serif">
                        सम्बन्धित समाचार
                      </h2>
                    </div>

                    {/* Cards grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-6">
                      {relatedDbPosts.map((item) => {
                        const itemContentImages = extractImagesFromContent(
                          item.content,
                        );
                        const itemFeaturedUrl = item.featuredImage?.url;

                        const images =
                          itemContentImages.length > 0
                            ? itemContentImages
                            : itemFeaturedUrl
                              ? [itemFeaturedUrl]
                              : [];

                        const primaryCat = item.categories[0]?.category;

                        return (
                          <a
                            key={item.id}
                            href={getPostUrl({
                              slug: item.slug,
                              databaseId: undefined,
                              categorySlug: primaryCat?.slug,
                            })}
                            className="
                              group cursor-pointer bg-white
                              border border-gray-200
                              transition-colors duration-200
                              flex flex-col
                              gap-4
                              p-5
                            "
                          >
                            {/* IMAGE SLIDER */}
                            <div className="relative w-full aspect-video bg-gray-100 overflow-hidden">
                              <ImageSlider
                                images={images}
                                title={item.title ?? "News image"}
                              />
                            </div>

                            {/* CONTENT */}
                            <div className="flex-1 flex flex-col gap-2 mt-2">
                              <h3
                                className="font-nepali-serif font-bold text-lg md:text-xl text-gray-900 leading-snug line-clamp-2 mb-2
                                group-hover:text-nepal-red transition-colors duration-200"
                              >
                                {getCleanTitle(item.title)}
                              </h3>

                              <p className="text-gray-600 font-poppins text-sm md:text-base leading-relaxed line-clamp-4 flex-1">
                                {getCleanContent(item.content, 150)}
                              </p>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar: Ads + Calendar + Holidays + Forex */}
            <aside className="flex flex-col md:grid md:grid-cols-2 xl:flex xl:flex-col gap-6 w-full mt-8 xl:mt-0">
              {/* ── CMS Banner Ads ── */}
              <div className="w-full md:col-span-2 xl:col-span-1">
                <Suspense fallback={null}>
                  <SidebarAds category={nonMetaCategorySlugs[0]} maxAds={2} />
                </Suspense>
              </div>

              {/* Nepali Calendar */}
              <div className="w-full">
                <NepaliCalendarWidget compact />
              </div>

              {/* Upcoming Holidays */}
              <div className="w-full">
                <UpcomingHolidays maxItems={4} />
              </div>

              {/* Forex Rates */}
              <div className="w-full md:col-span-2 xl:col-span-1">
                <Suspense
                  fallback={
                    <div className="border border-gray-200 h-40 flex items-center justify-center text-gray-400 text-xs font-poppins">
                      विनिमय दर लोड हुँदैछ...
                    </div>
                  }
                >
                  <ForexRatesWidget />
                </Suspense>
              </div>

              {/* ── Additional Ads ── */}
              <div className="w-full md:col-span-2 xl:col-span-1">
                <Suspense fallback={null}>
                  <SidebarAds
                    category={nonMetaCategorySlugs[0]}
                    maxAds={1}
                    startIndex={2}
                  />
                </Suspense>
              </div>
            </aside>
          </div>
        </article>
      </main>

      {/* Spacer */}
      <div className="h-16 md:h-20 lg:h-24 bg-transparent"></div>
    </div>
  );
}
