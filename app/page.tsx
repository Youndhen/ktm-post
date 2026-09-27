export const runtime = "nodejs";
export const revalidate = 60;
import * as cheerio from "cheerio";
import NepaliCalendarWidget from "./components/NepaliCalendarWidget";
import UpcomingHolidays from "./components/UpcomingHolidays";
import ForexRatesWidget from "./components/ForexRatesWidget";
import { Suspense } from "react";

import { Inter } from "next/font/google";
import "./globals.css";
import NewsImage from "./components/NewsImage";

import {
    fetchPosts,
    fetchHomePagePosts,
    fetchPostsByCategory,
    type Post as WordPressPost,
} from "@/lib/wordpress";
import BreakingNews from "./components/BreakingNews";
import TopStories from "./components/TopStories";
import SidebarAds from "./components/SidebarAds";
import BannerAdSlot from "./components/BannerAdSlot";
import Card from "./components/Card";
import Link from "next/link";
import Image from "next/image";
import React from "react";

const inter = Inter({
    subsets: ["latin"],
    weight: ["300", "400", "500", "600", "700"],
});

interface Post {
    id: string;
    uri: string | null;
    title: string | null;
    slug: string;
    status: string;
    link: string;
    date: string;
    content: string | null;
    featuredImage?: string | null;
    excerpt?: string | null;
    images?: string[];
    author?: {
        node?: {
            name?: string;
        };
    } | null;
}

export async function getPosts(page: number = 1): Promise<Post[]> {
    try {
        const baseUrl =
            process.env.NODE_ENV === "production"
                ? "https://www.nepalvoices.com"
                : "http://localhost:300x0";

        const apiUrl = `${baseUrl}/api/posts?page=${page}`;
        const res = await fetch(apiUrl, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            next: { revalidate: 60 },
        });

        if (!res.ok) return [];
        const posts = await res.json();
        if (!Array.isArray(posts)) return [];

        return posts;
    } catch (error) {
        console.error("Error fetching posts:", error);
        return [];
    }
}

export function decodeHtmlEntities(text: string | null): string {
    if (!text) return "No preview available.";

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

export function getCleanContent(
    content: string | null,
    maxLength: number = 200,
): string {
    if (!content) return "No preview available.";

    const decodedContent = decodeHtmlEntities(content);
    const cleanText = decodedContent
        .replace(/<[^>]*>/g, "")
        .replace(/\[[^\]]*\]/g, "")
        .replace(/\s+/g, " ")
        .replace(/\b\d+\/\d+\b/g, "")
        .replace(/\b\d+ of \d+\b/gi, "")
        .replace(/https?:\/\/[^\s]+/g, "")
        .replace(/\([^)]*\)/g, "")
        .replace(/\[[^\]]*\]/g, "")
        .replace(
            /\b(?:Photo|Image|Source|Credit|Getty|Reuters|AFP|AP|PTI)\b.*/gi,
            "",
        )
        .replace(/\s+\./g, ".")
        .replace(/\s+,/g, ",")
        .trim();

    if (cleanText.length > maxLength) {
        const truncated = cleanText.substring(0, maxLength);
        const lastPeriod = truncated.lastIndexOf(".");
        const lastQuestion = truncated.lastIndexOf("?");
        const lastExclamation = truncated.lastIndexOf("!");
        const breakPoint = Math.max(lastPeriod, lastQuestion, lastExclamation);

        if (breakPoint > maxLength * 0.5)
            return truncated.substring(0, breakPoint + 1) + "..";
        const lastSpace = truncated.lastIndexOf(" ");
        if (lastSpace > maxLength * 0.7)
            return truncated.substring(0, lastSpace) + "...";
        return truncated + "...";
    }

    return cleanText;
}

export function getCleanTitle(title: string | null): string {
    if (!title) return "Untitled Post";
    const decodedTitle = decodeHtmlEntities(title);
    return decodedTitle
        .replace(/\b\d+\/\d+\b/g, "")
        .replace(/\b\d+ of \d+\b/gi, "")
        .replace(/\[[^\]]*\]/g, "")
        .trim();
}

// export function extractImagesFromContent(content: string | null): string[] {
//   if (!content) return [];
//   const imageUrls: string[] = [];
//   const imgRegex = /<img[^>]+src="([^">]+)"/g;
//   let match;
//   while ((match = imgRegex.exec(content)) !== null)
//     if (match[1] && match[1].startsWith("http")) imageUrls.push(match[1]);
//   return imageUrls;
// }

export function extractImagesFromContent(content: string | null): string[] {
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
interface Post {
    id: string;
    databaseId?: number;
    uri: string | null;
    title: string | null;
    slug: string;
    status: string;
    link: string;
    date: string;
    content: string | null;
    featuredImage?: string | null;
    excerpt?: string | null;
    images?: string[];
    categorySlug?: string;
    categoryName?: string;
    author?: {
        node?: {
            name?: string;
        };
    } | null;
}

export function mapWpPost(post: WordPressPost): Post {
    const primaryCat = post.categories?.nodes?.[0];
    const catSlug = primaryCat?.slug;
    const categorySlug =
        catSlug === "business"
            ? "economy"
            : catSlug === "science-technology"
                ? "technology"
                : catSlug;

    return {
        id: post.id,
        databaseId: post.databaseId,
        uri: post.uri,
        title: post.title,
        slug: post.slug,
        status: post.status,
        link: post.link,
        date: post.date,
        content: post.content,
        excerpt: post.excerpt,
        featuredImage: post.featuredImage?.node?.sourceUrl || null,
        images: extractImagesFromContent(post.content),
        categorySlug: categorySlug || undefined,
        categoryName: primaryCat?.name || "विशेष",
        author: post.author,
    };
}

import { transliterateSlug } from "@/lib/transliterate";

export function getPostUrl(post: {
    slug: string;
    categorySlug?: string;
    databaseId?: number;
}): string {
    const cleanSlug = transliterateSlug(post.slug);
    const idPrefix = post.databaseId ? `${post.databaseId}-` : "";
    if (
        post.categorySlug &&
        post.categorySlug !== "latest-news" &&
        post.categorySlug !== "featured-news" &&
        post.categorySlug !== "breaking-news" &&
        post.categorySlug !== "exclusive"
    ) {
        return `/${post.categorySlug}/${idPrefix}${cleanSlug}`;
    }
    return `/news/${idPrefix}${cleanSlug}`;
}

export default async function HomePage() {
    // let initialPosts: Post[] = [];

    // try {
    //   initialPosts = await getPosts(1);
    //   initialPosts = initialPosts.map((post) => ({
    //     ...post,
    //     images: extractImagesFromContent(post.content),
    //   }));
    // } catch (error) {
    //   console.error("Error in HomePage:", error);
    // }

    // if (initialPosts.length === 0) {
    //   return (
    //     <div
    //       className={`${inter.className} min-h-screen text-nepal-black w-full gradient-white-to-orange`}
    //     >
    //       <div className="pt-32 md:pt-48 lg:pt-64"></div>
    //       <div className="flex items-center justify-center min-h-[60vh] w-full px-mobile-safe">
    //         <div className="text-center">
    //           <h1 className="text-3xl md:text-4xl font-bold mb-4">
    //             <span className="text-nepal-black">Nepal</span>
    //             <span className="text-nepal-orange"> Voices</span>
    //           </h1>
    //           <p className="text-gray-600">
    //             Unable to load news content. Please check the console for errors.
    //           </p>
    //         </div>
    //       </div>
    //       <div className="h-24 bg-transparent"></div>
    //       <Footer />
    //     </div>
    //   );
    // }
    // const { featured, trending, latest } = await fetchHomePagePosts();

    // const featuredPost = initialPosts[0];
    // const secondaryPosts = initialPosts.slice(1, 4);
    // const trendingPosts = initialPosts.slice(4, 10);
    // const latestPosts = initialPosts.slice(10);
    const {
        featured,
        trending,
        latest,
        breaking,
        economy,
        politics,
        sports,
        international,
        opinion,
        multimedia,
        legal,
        health,
        exclusive,
        technology,
        arts,
        society,
    } = await fetchHomePagePosts();
    const Posts = await fetchPosts(10);
    const posts = Posts.map(mapWpPost);

  const rawExclusivePosts = await fetchPostsByCategory("exclusive", 6);
  const exclusivePosts =
    rawExclusivePosts && rawExclusivePosts.length > 0
      ? rawExclusivePosts.map(mapWpPost)
      : exclusive && exclusive.length > 0
        ? exclusive.map(mapWpPost)
        : [];

    // Top Stories (isFeatured / मुख्य समाचार) — shown after exclusive, before breaking
    const rawTopStoriesPosts = await fetchPostsByCategory("featured-news", 7);
    const topStoriesPosts = [
        ...(featured && featured.length > 0 ? featured.map(mapWpPost) : []),
        ...(rawTopStoriesPosts && rawTopStoriesPosts.length > 0 ? rawTopStoriesPosts.map(mapWpPost) : []),
    ].filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i).slice(0, 4);

    // Featured hero = first economy post; secondary sidebar = next 3 economy posts
    // (Falls back gracefully to latest posts if economy category has 0 posts in WordPress)
    const economyPool =
        economy && economy.length > 0
            ? economy.map(mapWpPost)
            : [];

    const featuredPost = economyPool[0] || (posts && posts.length > 0 ? posts[0] : null);
    const secondaryPosts = economyPool.slice(1, 4);

  const rawNewsPosts = await fetchPostsByCategory("news", 7);
  const newsPosts = rawNewsPosts.map(mapWpPost);
  const politicsPosts = politics && politics.length > 0 ? politics.map(mapWpPost) : [];
  const sportsPosts = sports && sports.length > 0 ? sports.map(mapWpPost) : [];
  const multimediaPosts =
    multimedia && multimedia.length > 0 ? multimedia.map(mapWpPost) : [];
  const opinionPosts =
    opinion && opinion.length > 0 ? opinion.map(mapWpPost) : [];
  const internationalPosts =
    international && international.length > 0
      ? international.map(mapWpPost)
      : [];
  const healthCategoryPosts = await fetchPostsByCategory(
    "health-and-lifestyle",
    5,
  );
  const healthPostsList =
    healthCategoryPosts && healthCategoryPosts.length > 0
      ? healthCategoryPosts.map(mapWpPost)
      : health && health.length > 0
        ? health.map(mapWpPost)
        : [];
  const rawTechPosts = await fetchPostsByCategory("technology", 6);
  const techPosts =
    rawTechPosts && rawTechPosts.length > 0
      ? rawTechPosts.map(mapWpPost)
      : technology && technology.length > 0
        ? technology.map(mapWpPost)
        : [];
  const artsCategoryPosts = await fetchPostsByCategory("arts", 6);
  const artsPosts =
    artsCategoryPosts && artsCategoryPosts.length > 0
      ? artsCategoryPosts.map(mapWpPost)
      : arts && arts.length > 0
        ? arts.map(mapWpPost)
        : [];
  const rawSocietyPosts = await fetchPostsByCategory("society", 6);
  const societyPosts =
    rawSocietyPosts && rawSocietyPosts.length > 0
      ? rawSocietyPosts.map(mapWpPost)
      : society && society.length > 0
        ? society.map(mapWpPost)
        : [];
  const rawLegalPosts = await fetchPostsByCategory("legal", 6);
  const legalPosts =
    rawLegalPosts && rawLegalPosts.length > 0
      ? rawLegalPosts.map(mapWpPost)
      : legal && legal.length > 0
        ? legal.map(mapWpPost).slice(0, 6)
        : [];
  return (
    <div
      className={`${inter.className} min-h-screen text-nepal-black overflow-x-hidden w-full gradient-white-to-orange`}
    > 
    
      {exclusivePosts.length > 0 && (
        <section className="w-full pt-4 md:pt-6 mb-8">
          <div className="w-full max-w-[1920px] mx-auto px-mobile-safe">
            {/* ── SINGLE POST: full-width hero with overlay ── */}
            {(() => {
              const post = exclusivePosts[0];
              const contentImages = extractImagesFromContent(post.content);
              const featuredImageUrl = post.featuredImage;
              const thumbnailImage =
                featuredImageUrl ?? contentImages[0] ?? undefined;
              const excerpt = getCleanContent(
                post.excerpt || post.content,
                350,
              );

              return (
                <Link href={getPostUrl(post)} className="block group">
                  <div className="relative w-full h-[calc(100svh-7rem)] sm:h-[400px] md:h-[480px] lg:h-[560px] xl:h-[620px] 2xl:h-[680px] overflow-hidden rounded-xs bg-gray-950 shadow-md">
                    {thumbnailImage && (
                      <img
                        src={thumbnailImage}
                        alt={getCleanTitle(post.title)}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
                      />
                    )}
                    {/* Dark bottom gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none" />

                    {/* Bottom overlay content */}
                    <div className="absolute bottom-20 inset-x-0 p-4 sm:p-6 md:p-8 lg:p-10 z-10 flex flex-col items-start max-w-5xl">
                      <h2
                        className="font-black text-white font-nepali-serif leading-tight tracking-tight drop-shadow-md mb-2 md:mb-3"
                        style={{
                          fontSize: "clamp(1.5625rem, 5vw, 3.75rem)",
                        }}
                      >
                        {getCleanTitle(post.title)}
                      </h2>

                      {excerpt && (
                        <p className="text-[0.8625rem] sm:text-[1.00625rem] md:text-[1.15rem] lg:text-[1.29375rem] font-nepali text-white/90 leading-relaxed line-clamp-4 text-shadow-sm">
                          {excerpt}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })()}
          </div>
        </section>
      )}

            {/* ── TOP STORIES / मुख्य समाचार ── */}
            {topStoriesPosts.length > 0 && (
                <div className="pt-2 md:pt-4 w-full max-w-[1920px] mx-auto px-mobile-safe space-y-4">
                    {topStoriesPosts.slice(0, 3).map((item, index) => {
                        const contentImages = extractImagesFromContent(item.content);
                        const featuredImageUrl = item.featuredImage;
                        const thumbnailImage =
                            featuredImageUrl ?? contentImages[0] ?? undefined;
                        const excerpt = getCleanContent(item.excerpt || item.content, 180);

                        return (
                            <React.Fragment key={item.slug}>
                                <TopStories
                                    slug={item.slug}
                                    title={getCleanTitle(item.title)}
                                    image={thumbnailImage}
                                    excerpt={excerpt}
                                    link={getPostUrl(item)}
                                />
                            </React.Fragment>
                        );
                    })}
                </div>
            )}

            {/* ── BREAKING NEWS ── */}
            {/* {breaking.length > 0 && (
                <div className="pt-2 md:pt-4 w-full max-w-[1920px] mx-auto px-mobile-safe space-y-4">
                    {breaking.slice(0, 2).map((item, index) => {
                        const contentImages = extractImagesFromContent(item.content);
                        const featuredImageUrl = item.featuredImage?.node?.sourceUrl || (typeof item.featuredImage === "string" ? item.featuredImage : undefined);
                        const thumbnailImage =
                            featuredImageUrl ?? contentImages[0] ?? undefined;
                        const excerpt = getCleanContent(item.excerpt || item.content, 180);

                        return (
                            <React.Fragment key={item.slug}>
                                {index < 3 && (
                                    <Suspense fallback={null}>
                                        <BannerAdSlot
                                            index={index}
                                            fallbackImage={
                                                index === 0
                                                    ? "/banner/bizmandu.gif"
                                                    : "/banner/banner-3.png"
                                            }
                                        />
                                    </Suspense>
                                )}
                                <BreakingNews
                                    slug={item.slug}
                                    title={getCleanTitle(item.title)}
                                    image={thumbnailImage}
                                    excerpt={excerpt}
                                    link={getPostUrl(item)}
                                />
                            </React.Fragment>
                        );
                    })}
                </div>
            )} */}

            <main className="w-full">
                <div className="h-10 md:h-14 lg:h-16 bg-transparent"> </div>
                {/*Banner Section*/}

                {/* Breaking News - 100% Width Red Marquee */}

                {/* News Section */}
                <div className="h-6 md:h-8 bg-transparent"> </div>
                {newsPosts.length > 0 && (
                    <section className="w-full">
                        <div className="w-full max-w-[1920px] mx-auto px-mobile-safe">
                            <div className="flex items-center mb-5 border-b border-gray-200 pb-3">
                                <h2 className="text-2xl md:text-3xl font-bold text-nepal-black font-nepali-serif">
                                    समाचार{" "}
                                    <span className="text-gray-400 font-poppins text-sm font-normal">
                                        / News
                                    </span>
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-7 md:gap-9 pb-6 md:pb-8">
                                {/* LEFT: Big featured post */}
                                {newsPosts[0] &&
                                    (() => {
                                        const post = newsPosts[0];
                                        const contentImages = extractImagesFromContent(
                                            post.content,
                                        );
                                        const featuredImageUrl = post.featuredImage;
                                        const thumbnailImage =
                                            featuredImageUrl ?? contentImages[0] ?? undefined;

                                        return (
                                            <Link
                                                href={getPostUrl(post)}
                                                className="flex flex-col h-full group"
                                            >
                                                {thumbnailImage && (
                                                    <div className="w-full h-[220px] sm:h-[300px] md:h-[380px] lg:h-[420px] xl:h-[480px] overflow-hidden rounded-sm bg-gray-100">
                                                        <img
                                                            src={thumbnailImage}
                                                            alt={getCleanTitle(post.title)}
                                                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                                                        />
                                                    </div>
                                                )}
                                                <h3 className="mt-3 text-lg md:text-2xl font-bold text-nepal-black group-hover:text-nepal-red transition-colors font-nepali-serif">
                                                    {getCleanTitle(post.title)}
                                                </h3>
                                                <p className="mt-2 text-sm md:text-base text-gray-600 line-clamp-3 leading-relaxed">
                                                    {getCleanContent(post.content, 150)}
                                                </p>
                                            </Link>
                                        );
                                    })()}

                                {/* RIGHT: 6 smaller posts */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
                                    {newsPosts.slice(1, 7).map((post) => {
                                        const contentImages = extractImagesFromContent(
                                            post.content,
                                        );
                                        const featuredImageUrl = post.featuredImage;
                                        const thumbnailImage =
                                            featuredImageUrl ?? contentImages[0] ?? undefined;

                                        return (
                                            <Link
                                                href={getPostUrl(post)}
                                                key={post.id}
                                                className="flex flex-col group"
                                            >
                                                {thumbnailImage && (
                                                    <div className="w-full aspect-video sm:h-[140px] md:h-[150px] overflow-hidden rounded-sm bg-gray-100">
                                                        <img
                                                            src={thumbnailImage}
                                                            alt={getCleanTitle(post.title)}
                                                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                                                        />
                                                    </div>
                                                )}
                                                <h3 className="mt-2.5 text-sm md:text-base font-bold text-nepal-black group-hover:text-nepal-red transition-colors line-clamp-2 font-nepali-serif leading-snug">
                                                    {getCleanTitle(post.title)}
                                                </h3>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </section>
                )}
                {featuredPost ? (
                    <div>
                        {/* Featured + Latest */}
                        {featuredPost && (
                            <section className="w-full">
                                <div className="w-full max-w-[1920px] mx-auto px-mobile-safe">
                                    <div className="flex items-center mb-6 md:mb-8 border-b-4 border-nepal-orange pb-3 md:pb-4">
                                        <h2 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-nepal-black font-nepali-serif">
                                            अर्थतन्त्र{" "}
                                            <span className="text-gray-500 font-poppins text-lg font-normal">
                                                / Economy
                                            </span>
                                        </h2>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 w-full items-stretch">
                                        {/* LEFT: Full-bleed Hero Card with overlay, category badge, and red hover effect */}
                                        <div className="lg:col-span-7 xl:col-span-8 group cursor-pointer w-full flex flex-col">
                                            <a
                                                href={getPostUrl(featuredPost)}
                                                className="relative overflow-hidden bg-gray-950 rounded-xs transition-colors duration-300 w-full h-full min-h-[380px] sm:min-h-[440px] md:min-h-[480px] lg:min-h-[520px] xl:min-h-[550px] shadow-sm flex flex-col justify-end"
                                            >
                                                {(() => {
                                                    const contentImages = extractImagesFromContent(
                                                        featuredPost.content,
                                                    );
                                                    const featuredImageUrl = featuredPost.featuredImage;
                                                    const thumbnailImage =
                                                        featuredImageUrl ?? contentImages[0] ?? undefined;
                                                    return (
                                                        <>
                                                            {thumbnailImage && (
                                                                <img
                                                                    src={thumbnailImage}
                                                                    alt={getCleanTitle(featuredPost.title)}
                                                                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out"
                                                                />
                                                            )}
                                                            {/* Gradient Overlay for high contrast readability */}
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-transparent pointer-events-none" />

                                                            {/* Content pinned to bottom */}
                                                            <div className="relative z-10 p-5 sm:p-7 md:p-8 lg:p-9 flex flex-col items-start">
                                                                <span className="bg-nepal-red text-white px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-xs shadow-sm mb-3 inline-block">
                                                                    अर्थ
                                                                </span>
                                                                <h2 className="font-nepali-serif text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-white mb-3 leading-tight group-hover:text-red-400 transition-colors duration-200 drop-shadow-md">
                                                                    {getCleanTitle(featuredPost.title)}
                                                                </h2>
                                                                <p className="text-gray-200 font-poppins text-xs sm:text-sm md:text-base leading-relaxed line-clamp-3 text-shadow-sm">
                                                                    {getCleanContent(featuredPost.content, 220)}
                                                                </p>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </a>
                                        </div>

                                        {/* RIGHT: Secondary Economy Posts - Evenly distributed to match the bottom edge */}
                                        <div className="lg:col-span-5 xl:col-span-4 flex flex-col justify-between gap-3.5 sm:gap-4 w-full h-full">
                                            {secondaryPosts.map((post) => {
                                                const contentImages = extractImagesFromContent(
                                                    post.content,
                                                );
                                                const featuredImageUrl = post.featuredImage;
                                                const thumbnailImage =
                                                    featuredImageUrl ?? contentImages[0] ?? undefined;

                                                return (
                                                    <a
                                                        key={post.id}
                                                        href={getPostUrl(post)}
                                                        className="group cursor-pointer bg-white border border-gray-200 p-3.5 sm:p-4 transition-all duration-200 hover:shadow-md hover:border-gray-300 flex gap-3.5 sm:gap-4 items-center flex-1 rounded-xs"
                                                    >
                                                        {thumbnailImage && (
                                                            <div className="shrink-0 w-28 sm:w-36 md:w-44 aspect-video bg-gray-100 overflow-hidden rounded-xs">
                                                                <img
                                                                    src={thumbnailImage}
                                                                    alt={getCleanTitle(post.title)}
                                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                                />
                                                            </div>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="font-nepali-serif font-bold text-base sm:text-lg text-gray-900 leading-snug group-hover:text-nepal-red transition-colors duration-200 line-clamp-3">
                                                                {getCleanTitle(post.title)}
                                                            </h3>
                                                        </div>
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}
                    </div>
                ) : (
                    <section className="pt-20 md:pt-0 w-full">
                        <div className="w-full max-w-[1920px] mx-auto px-mobile-safe">
                            <div className="flex items-center mb-6 md:mb-8 border-b-1 border-gray-200 pb-3 md:pb-4">
                                <h2 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-nepal-black font-nepali-serif">
                                    राजनीति{" "}
                                    <span className="text-gray-500 font-poppins text-lg font-normal">
                                        / Politics
                                    </span>
                                </h2>
                            </div>
                            {/* Section title */}
                            <div className="flex items-center mb-6 md:mb-8 border-b-4 border-nepal-orange pb-3 md:pb-4">
                                <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-nepal-black">
                                    News
                                </h2>
                            </div>

                            <div className="h-4 md:h-6" />

                            {/* FLEX GRID: professional cards */}
                            <div className="flex flex-col md:flex-wrap md:flex-row 2xl:grid grid-cols-5 justify-start gap-6 md:gap-8 lg:gap-10">
                                {posts.length > 0 ? (
                                    posts.map((post) => {
                                        const contentImages = extractImagesFromContent(
                                            post.content,
                                        );
                                        const featuredImageUrl = post.featuredImage;
                                        const thumbnailImage =
                                            featuredImageUrl ?? contentImages[0] ?? undefined;

                                        return (
                                            <Card
                                                link={getPostUrl(post)}
                                                key={post.id}
                                                images={thumbnailImage ? [thumbnailImage] : []}
                                                title={getCleanTitle(post.title)}
                                                content={getCleanContent(post.content, 150)}
                                            />
                                        );
                                    })
                                ) : (
                                    <div className="text-2xl md:text-3xl text-center text-gray-600 flex items-center justify-center h-[50vh]">
                                        No Content Available For Now
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {/* Politics Section */}
                <div className="h-10 md:h-14 lg:h-16 bg-transparent"> </div>
                {politicsPosts.length > 0 && (
                    <section className="w-full">
                        <div className="w-full max-w-[1920px] mx-auto px-mobile-safe">
                            <div className="flex items-left mb-6 md:mb-8 border-b-2 border-gray-200 pb-3 md:pb-4">
                                <h2 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-nepal-black font-nepali-serif">
                                    राजनीति{" "}
                                    <span className="text-gray-500 font-poppins text-lg font-normal">
                                        / Politics
                                    </span>
                                </h2>
                            </div>

                            <div className="h-2 md:h-2 bg-transparent"> </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-9 md:gap-11 lg:gap-13 w-full">
                                {politicsPosts.map((post) => {
                                    const contentImages = extractImagesFromContent(post.content);
                                    const featuredImageUrl = post.featuredImage;
                                    const thumbnailImage =
                                        featuredImageUrl ?? contentImages[0] ?? undefined;
                                    return (
                                        <a
                                            key={post.id}
                                            href={getPostUrl(post)}
                                            className="group cursor-pointer bg-white border border-gray-200 p-6 md:p-7 transition-colors duration-150 w-full block shadow-xs hover:shadow-md"
                                        >
                                            <div className="flex gap-5 md:gap-6 w-full items-start">
                                                <div className="flex-1 min-w-0 space-y-3 pr-2">
                                                    <h3 className="font-nepali-serif font-bold text-lg md:text-xl text-gray-900 leading-snug transition-colors duration-150 line-clamp-2 mb-2 group-hover:text-nepal-red">
                                                        {getCleanTitle(post.title)}
                                                    </h3>
                                                    <p className="text-gray-600 font-poppins text-[calc(var(--text-base)*1.1)] text-left line-clamp-3 w-full leading-relaxed mt-1">
                                                        {getCleanContent(post.content, 120)}
                                                    </p>
                                                </div>

                                                <div className="shrink-0 w-20 h-20 md:w-24 md:h-24 lg:w-26 lg:h-26 bg-gray-100 overflow-hidden rounded-sm">
                                                    <NewsImage
                                                        post={post}
                                                        images={thumbnailImage ? [thumbnailImage] : []}
                                                        className="w-full h-full object-cover"
                                                        fallbackGradient="bg-gradient-to-br from-gray-200 to-gray-300"
                                                    />
                                                </div>
                                            </div>
                                        </a>
                                    );
                                })}
                            </div>
                        </div>
                    </section>
                )}

                {/* Three-column Category Sections: Sports, Health & Lifestyle, Multimedia */}
                <div className="h-10 md:h-14 lg:h-16 bg-transparent"> </div>
                <section className="w-full">
                    <div className="w-full max-w-[1920px] mx-auto px-mobile-safe">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 md:gap-12 lg:gap-14">
                            {/* Sports Column */}
                            <div className="flex flex-col">
                                <div className="flex items-center mb-5 border-b-4 border-nepal-orange pb-3">
                                    <h2 className="text-2xl md:text-3xl font-bold text-nepal-black font-nepali-serif">
                                        खेलकुद{" "}
                                        <span className="text-gray-500 font-poppins text-sm font-normal">
                                            / Sports
                                        </span>
                                    </h2>
                                </div>

                                {sportsPosts.length > 0 ? (
                                    <div className="flex flex-col gap-0">
                                        {/* Featured first post with image */}
                                        {(() => {
                                            const post = sportsPosts[0];
                                            const contentImages = extractImagesFromContent(
                                                post.content,
                                            );
                                            const featuredImageUrl = post.featuredImage;
                                            const thumbnailImage =
                                                featuredImageUrl ?? contentImages[0] ?? undefined;
                                            return (
                                                <a href={getPostUrl(post)} className="group block mb-5">
                                                    <div className="w-full h-48 md:h-52 bg-gray-100 overflow-hidden mb-3">
                                                        <NewsImage
                                                            post={post}
                                                            images={thumbnailImage ? [thumbnailImage] : []}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                            fallbackGradient="bg-gradient-to-br from-gray-200 to-gray-300"
                                                        />
                                                    </div>
                                                    <h3 className="font-nepali-serif font-bold text-lg md:text-xl text-gray-900 leading-tight group-hover:text-nepal-red transition-colors duration-150 line-clamp-2">
                                                        {getCleanTitle(post.title)}
                                                    </h3>
                                                </a>
                                            );
                                        })()}

                                        {/* Remaining posts as compact list */}
                                        {sportsPosts.slice(1, 5).map((post) => (
                                            <a
                                                key={post.id}
                                                href={getPostUrl(post)}
                                                className="group block py-3 border-t border-gray-100"
                                            >
                                                <h3 className="font-nepali-serif font-bold text-xl text-gray-900 leading-snug group-hover:text-nepal-red transition-colors duration-150 line-clamp-2">
                                                    {getCleanTitle(post.title)}
                                                </h3>
                                            </a>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-400 font-poppins text-sm py-8">
                                        No content available
                                    </p>
                                )}
                            </div>

                            {/* Health & Lifestyle Column */}
                            <div className="flex flex-col">
                                <div className="flex items-center mb-5 border-b-4 border-nepal-orange pb-3">
                                    <h2 className="text-2xl md:text-3xl font-bold text-nepal-black font-nepali-serif">
                                        स्वास्थ्य{" "}
                                        <span className="text-gray-500 font-poppins text-sm font-normal">
                                            / Health & Lifestyle
                                        </span>
                                    </h2>
                                </div>

                                {(() => {
                                    const healthPosts = healthPostsList;
                                    return healthPosts.length > 0 ? (
                                        <div className="flex flex-col gap-0">
                                            {/* Featured first post with image */}
                                            {(() => {
                                                const post = healthPosts[0];
                                                const contentImages = extractImagesFromContent(
                                                    post.content,
                                                );
                                                const featuredImageUrl = post.featuredImage;
                                                const thumbnailImage =
                                                    featuredImageUrl ?? contentImages[0] ?? undefined;
                                                return (
                                                    <a
                                                        href={getPostUrl(post)}
                                                        className="group block mb-5"
                                                    >
                                                        <div className="w-full h-48 md:h-52 bg-gray-100 overflow-hidden mb-3">
                                                            <NewsImage
                                                                post={post}
                                                                images={thumbnailImage ? [thumbnailImage] : []}
                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                                fallbackGradient="bg-gradient-to-br from-gray-200 to-gray-300"
                                                            />
                                                        </div>
                                                        <h3 className="font-nepali-serif font-bold text-lg md:text-xl text-gray-900 leading-tight group-hover:text-nepal-red transition-colors duration-150 line-clamp-2">
                                                            {getCleanTitle(post.title)}
                                                        </h3>
                                                    </a>
                                                );
                                            })()}

                                            {/* Remaining posts as compact list */}
                                            {healthPosts.slice(1, 5).map((post) => (
                                                <a
                                                    key={post.id}
                                                    href={getPostUrl(post)}
                                                    className="group block py-3 border-t border-gray-100"
                                                >
                                                    <h3 className="font-nepali-serif text-xl font-bold text-gray-900 leading-snug group-hover:text-nepal-red transition-colors duration-150 line-clamp-2">
                                                        {getCleanTitle(post.title)}
                                                    </h3>
                                                </a>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-400 font-poppins text-sm py-8">
                                            No content available
                                        </p>
                                    );
                                })()}
                            </div>

                            {/* International Column */}
                            <div className="flex flex-col">
                                <div className="flex items-center mb-5 border-b-4 border-nepal-orange pb-3">
                                    <h2 className="text-2xl md:text-3xl font-bold text-nepal-black font-nepali-serif">
                                        अन्तराष्ट्रिय{" "}
                                        <span className="text-gray-500 font-poppins text-sm font-normal">
                                            / International
                                        </span>
                                    </h2>
                                </div>

                                {internationalPosts.length > 0 ? (
                                    <div className="flex flex-col gap-0">
                                        {/* Featured first post with image */}
                                        {(() => {
                                            const post = internationalPosts[0];
                                            const contentImages = extractImagesFromContent(
                                                post.content,
                                            );
                                            const featuredImageUrl = post.featuredImage;
                                            const thumbnailImage =
                                                featuredImageUrl ?? contentImages[0] ?? undefined;
                                            return (
                                                <a href={getPostUrl(post)} className="group block mb-5">
                                                    <div className="w-full h-48 md:h-52 bg-gray-100 overflow-hidden mb-3">
                                                        <NewsImage
                                                            post={post}
                                                            images={thumbnailImage ? [thumbnailImage] : []}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                            fallbackGradient="bg-gradient-to-br from-gray-200 to-gray-300"
                                                        />
                                                    </div>
                                                    <h3 className="font-nepali-serif font-bold text-lg md:text-xl text-gray-900 leading-tight group-hover:text-nepal-red transition-colors duration-150 line-clamp-2">
                                                        {getCleanTitle(post.title)}
                                                    </h3>
                                                </a>
                                            );
                                        })()}

                                        {/* Remaining posts as compact list */}
                                        {internationalPosts.slice(1, 5).map((post) => (
                                            <a
                                                key={post.id}
                                                href={getPostUrl(post)}
                                                className="group block py-3 border-t border-gray-100"
                                            >
                                                <h3 className="font-nepali-serif font-bold text-xl text-gray-900 leading-snug group-hover:text-nepal-red transition-colors duration-150 line-clamp-2">
                                                    {getCleanTitle(post.title)}
                                                </h3>
                                            </a>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-400 font-poppins text-sm py-8">
                                        No content available
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
                {/* Opinion Section - 4-Column Layout */}
                <div className="h-10 md:h-14 lg:h-16 bg-transparent"> </div>
                {opinionPosts.length > 0 && (
                    <section className="w-full">
                        <div className="w-full max-w-[1920px] mx-auto px-mobile-safe">
                            <div className="flex items-center mb-6 md:mb-8 border-b-4 border-nepal-orange pb-3 md:pb-4">
                                <h2 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-nepal-black font-nepali-serif">
                                    विचार{" "}
                                    <span className="text-gray-500 font-poppins text-lg font-normal">
                                        / Opinion
                                    </span>
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 lg:gap-10">
                                {opinionPosts.slice(0, 5).map((post) => {
                                    const contentImages = extractImagesFromContent(post.content);
                                    const featuredImageUrl = post.featuredImage;
                                    const thumbnailImage =
                                        featuredImageUrl ?? contentImages[0] ?? undefined;
                                    const formattedDate = new Date(post.date).toLocaleDateString(
                                        "en-US",
                                        {
                                            month: "short",
                                            day: "numeric",
                                            timeZone: "Asia/Kathmandu",
                                        },
                                    );

                                    return (
                                        <a
                                            key={post.id}
                                            href={getPostUrl(post)}
                                            className="group flex cursor-pointer bg-white border border-gray-200 p-4 transition-all duration-200 hover:shadow-md"
                                        >
                                            {/* Image container */}
                                            <div className="flex gap-5 md:gap-6 w-full items-start">
                                                <div className="flex-1 min-w-0 space-y-3 pr-2">
                                                    <span className="text-xs font-bold uppercase tracking-wider text-nepal-red font-poppins">
                                                        विचार
                                                    </span>
                                                    <h3 className="font-nepali-serif font-bold text-lg md:text-xl text-gray-900 leading-snug line-clamp-2 group-hover:text-nepal-red transition-colors duration-150">
                                                        {getCleanTitle(post.title)}
                                                    </h3>
                                                    <div className="pt-1 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 font-poppins font-medium">
                                                        <span>
                                                            {(() => {
                                                                const authorName =
                                                                    post.author?.node?.name?.trim();
                                                                const isValidAuthor =
                                                                    authorName &&
                                                                    authorName.toLowerCase() !== "news";
                                                                return isValidAuthor
                                                                    ? authorName
                                                                    : "KTM Time Opinions";
                                                            })()}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="shrink-0 w-20 h-20 md:w-24 md:h-24 lg:w-26 lg:h-26 bg-gray-100 overflow-hidden rounded-sm">
                                                    <Image
                                                        src={thumbnailImage}
                                                        alt="image"
                                                        width={100}
                                                        height={100}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            </div>
                                        </a>
                                    );
                                })}
                            </div>
                        </div>
                    </section>
                )}

                {/* Multimedia / Videos Section - Dark Layout */}
                <div className="h-10 md:h-14 lg:h-16 bg-transparent"> </div>
                {multimediaPosts.length > 0 && (
                    <section className="w-full bg-[#1a1a1a] py-10 md:py-14">
                        <div className="w-full max-w-[1920px] mx-auto px-mobile-safe">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl md:text-3xl font-bold text-white">
                                    <span className="text-white"> मल्टिमिडिया </span>{" "}
                                    <span className="text-nepal-red"> भिडियो </span>
                                </h2>
                                <Link
                                    href="/multimedia"
                                    className="hidden md:flex items-center gap-2 text-white text-sm font-bold uppercase tracking-wider hover:text-nepal-red transition-colors"
                                >
                                    View More <span aria-hidden="true">→</span>
                                </Link>
                            </div>

                            {/* Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                                {multimediaPosts.slice(0, 4).map((post) => {
                                    const contentImages = extractImagesFromContent(post.content);
                                    const featuredImageUrl = post.featuredImage;
                                    const thumbnailImage =
                                        featuredImageUrl ?? contentImages[0] ?? undefined;
                                    const authorName = post.author?.node?.name?.trim();
                                    const displayAuthor =
                                        authorName && authorName.toLowerCase() !== "news"
                                            ? authorName
                                            : "KTM Post";

                                    return (
                                        <Link
                                            href={getPostUrl(post)}
                                            key={post.id}
                                            className="group flex flex-col"
                                        >
                                            {/* Thumbnail with play button */}
                                            <div className="relative w-full aspect-video bg-gray-800 overflow-hidden">
                                                {thumbnailImage && (
                                                    <img
                                                        src={thumbnailImage}
                                                        alt={getCleanTitle(post.title)}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                    />
                                                )}
                                                {/* Play button overlay */}
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/90 flex items-center justify-center group-hover:bg-white transition-colors">
                                                        <svg
                                                            viewBox="0 0 24 24"
                                                            className="w-5 h-5 md:w-6 md:h-6 text-black ml-0.5"
                                                            fill="currentColor"
                                                        >
                                                            <path d="M8 5v14l11-7z" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Title + author */}
                                            <h3 className="mt-4 text-base md:text-lg font-bold text-white leading-snug line-clamp-2 group-hover:text-nepal-red transition-colors">
                                                {getCleanTitle(post.title)}
                                            </h3>
                                        </Link>
                                    );
                                })}
                            </div>

                            {/* Mobile "View More" */}
                            <Link
                                href="/multimedia"
                                className="md:hidden flex items-center justify-center gap-2 mt-8 text-white text-sm font-bold uppercase tracking-wider hover:text-nepal-red transition-colors"
                            >
                                View More <span aria-hidden="true">→</span>
                            </Link>
                        </div>
                    </section>
                )}

        {/* Legal Section + Nepal at a Glance Row */}
        <div className="h-10 md:h-14 lg:h-16 bg-transparent"> </div>
        <section className="w-full">
          <div className="w-full max-w-[1920px] mx-auto px-mobile-safe">
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-8 md:gap-10">
              {/* LEFT: Legal and Exclusive Sections */}
              <div className="flex flex-col gap-10">
                {/* Exclusive / विशेष Section */}
                {exclusivePosts.length > 0 && (
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-6 border-b-2 border-nepal-orange pb-3">
                      <h2 className="text-2xl md:text-3xl font-bold text-nepal-black font-nepali-serif">
                        विशेष{" "}
                        <span className="text-gray-500 font-poppins text-lg font-normal">
                          / Exclusive
                        </span>
                      </h2>
                      <Link
                        href="/exclusive"
                        className="text-xs font-bold text-nepal-red uppercase tracking-wider hover:underline"
                      >
                        थप हेर्नुहोस् →
                      </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                      {exclusivePosts.slice(0, 6).map((post) => {
                        const contentImages = extractImagesFromContent(
                          post.content,
                        );
                        const featuredImageUrl = post.featuredImage;
                        const thumbnailImage =
                          featuredImageUrl ?? contentImages[0] ?? undefined;

                        return (
                          <Link
                            key={post.id}
                            href={getPostUrl(post)}
                            className="group flex flex-col cursor-pointer bg-white border border-gray-200 p-4 transition-all duration-200 hover:shadow-md"
                          >
                            <div className="w-full h-40 bg-gray-100 overflow-hidden mb-3">
                              <NewsImage
                                post={post}
                                images={thumbnailImage ? [thumbnailImage] : []}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                fallbackGradient="bg-gradient-to-br from-gray-200 to-gray-300"
                              />
                            </div>
                            <h3 className="font-nepali-serif font-bold text-base md:text-lg text-gray-900 leading-snug group-hover:text-nepal-red transition-colors line-clamp-2 mb-2">
                              {getCleanTitle(post.title)}
                            </h3>
                            <p className="text-sm text-gray-600 font-poppins line-clamp-2">
                              {getCleanContent(post.content, 90)}
                            </p>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Legal Section */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-6 border-b-2 border-gray-200 pb-3">
                    <h2 className="text-2xl md:text-3xl font-bold text-nepal-black font-nepali-serif">
                      कानून{" "}
                      <span className="text-gray-500 font-poppins text-lg font-normal">
                        / Legal
                      </span>
                    </h2>
                    <Link
                      href="/legal"
                      className="text-xs font-bold text-nepal-red uppercase tracking-wider hover:underline"
                    >
                      थप हेर्नुहोस् →
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {legalPosts.map((post) => {
                      const contentImages = extractImagesFromContent(
                        post.content,
                      );
                      const featuredImageUrl = post.featuredImage;
                      const thumbnailImage =
                        featuredImageUrl ?? contentImages[0] ?? undefined;

                      return (
                        <Link
                          key={post.id}
                          href={getPostUrl(post)}
                          className="group flex flex-col cursor-pointer bg-white border border-gray-200 p-4 transition-all duration-200 hover:shadow-md"
                        >
                          <div className="w-full h-40 bg-gray-100 overflow-hidden mb-3">
                            <NewsImage
                              post={post}
                              images={thumbnailImage ? [thumbnailImage] : []}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              fallbackGradient="bg-gradient-to-br from-gray-200 to-gray-300"
                            />
                          </div>
                          <h3 className="font-nepali-serif font-bold text-base md:text-lg text-gray-900 leading-snug group-hover:text-nepal-red transition-colors line-clamp-2 mb-2">
                            {getCleanTitle(post.title)}
                          </h3>
                          <p className="text-sm text-gray-600 font-poppins line-clamp-2">
                            {getCleanContent(post.content, 90)}
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* RIGHT: Nepal at a Glance / Forex Rates */}
              <div className="flex flex-col">
     
                <Suspense
                  fallback={
                    <div className="border border-gray-200 h-64 flex items-center justify-center text-gray-400 text-sm font-poppins">
                      दर लोड हुँदैछ...
                    </div>
                  }
                >
                  <ForexRatesWidget />
                </Suspense>
              </div>
            </div>
          </div>
        </section>

        {/* Science & Technology Section + Calendar & Holidays Row */}
        <div className="h-10 md:h-14 lg:h-16 bg-transparent"> </div>
        <section className="w-full">
          <div className="w-full max-w-[1920px] mx-auto px-mobile-safe">
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-8 md:gap-10">
              {/* LEFT: Science & Technology Section */}
              <div className="order-2 md:order-1 flex flex-col">
                {/* Section Header */}
                <div className="flex items-center justify-between gap-4 mb-6 border-b-2 border-gray-200 pb-3">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-nepal-black font-nepali-serif">
                    सूचना-प्रविधि{" "}
                    <span className="text-sm sm:text-base md:text-lg text-gray-500 font-normal font-poppins">
                      / Science & Technology
                    </span>
                  </h2>

                  <Link
                    href="/technology"
                    className="shrink-0 text-xs sm:text-sm font-bold text-nepal-red uppercase tracking-wider hover:underline"
                  >
                    थप हेर्नुहोस् →
                  </Link>
                </div>

                {/* Science & Technology Posts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
                  {techPosts.slice(0, 6).map((post) => {
                    const contentImages = extractImagesFromContent(
                      post.content,
                    );
                    const thumbnailImage =
                      post.featuredImage ?? contentImages[0] ?? undefined;

                    return (
                      <Link
                        key={post.id}
                        href={getPostUrl(post)}
                        className="group flex h-full flex-col cursor-pointer border border-gray-200 bg-white p-3 sm:p-4 transition-all duration-200 hover:shadow-md"
                      >
                        <div className="mb-3 aspect-video w-full overflow-hidden bg-gray-100">
                          <NewsImage
                            post={post}
                            images={thumbnailImage ? [thumbnailImage] : []}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            fallbackGradient="bg-gradient-to-br from-gray-200 to-gray-300"
                          />
                        </div>

                        <h3 className="mb-2 line-clamp-2 font-nepali-serif text-sm font-bold leading-snug text-gray-900 transition-colors group-hover:text-nepal-red sm:text-base md:text-lg">
                          {getCleanTitle(post.title)}
                        </h3>

                        <p className="line-clamp-2 font-poppins text-xs text-gray-600 sm:text-sm">
                          {getCleanContent(post.content, 90)}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT: Nepali Calendar & Holidays */}
              <div className="flex flex-col gap-4 order-1 md:order-2 ">
                <div className="flex items-center mb-2 border-b-2 border-gray-200 pb-2">
                  <h3 className="text-xl font-bold text-nepal-black font-nepali-serif">
                    पात्रो र बिदाहरू{" "}
                    <span className="text-gray-400 font-poppins text-xs font-normal">
                      / Calendar
                    </span>
                  </h3>
                </div>
                <NepaliCalendarWidget />
                <UpcomingHolidays maxItems={3} />
              </div>
            </div>
          </div>
        </section>

                <div className="h-10 md:h-14 lg:h-16 bg-transparent"> </div>
            </main>
        </div>
    );
}
