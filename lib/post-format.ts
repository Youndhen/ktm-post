import * as cheerio from "cheerio";
import { type Post as WordPressPost } from "@/lib/wordpress";
import { transliterateSlug } from "@/lib/transliterate";

export interface FormattedPost {
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

export function mapWpPost(post: WordPressPost): FormattedPost {
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
