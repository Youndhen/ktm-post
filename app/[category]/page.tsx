export const runtime = "nodejs";
export const revalidate = 60;

import { fetchPostsByCategory, fetchWPCategories } from "@/lib/wordpress";
import { transliterateSlug } from "@/lib/transliterate";
import { extractImagesFromContent, getCleanContent, getCleanTitle, getPostUrl, mapWpPost } from "@/lib/post-format";
import Card from "../components/Card";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const decodedCategory = decodeURIComponent(category).toLowerCase().trim();
  
  // Fetch all WP categories to find matching category details dynamically
  const allCategories = await fetchWPCategories();
  const matchedCategory = allCategories.find((c) => {
    const slugLower = c.slug.toLowerCase();
    const nameLower = c.name.toLowerCase();
    const transliteratedName = transliterateSlug(c.name).toLowerCase();
    return (
      slugLower === decodedCategory ||
      nameLower === decodedCategory ||
      transliteratedName === decodedCategory
    );
  });

  // If no category matched, check if it's a static page
  if (!matchedCategory) {
    const staticPage = await (await import("@/lib/prisma")).prisma.staticPage.findFirst({
      where: {
        slug: {
          equals: decodedCategory,
          mode: "insensitive",
        },
      },
    });

    if (staticPage) {
      const { default: StaticPageView } = await import("../page/[slug]/page");
      return <StaticPageView params={Promise.resolve({ slug: staticPage.slug })} />;
    }
  }

  // Use matching category slug or fallback to decodedCategory
  const wpCategorySlug = matchedCategory ? matchedCategory.slug : decodedCategory;
  const categoryDisplayName = matchedCategory ? (matchedCategory.nepaliName || matchedCategory.name) : decodeURIComponent(category);
  
  // Fetch posts dynamically by category slug
  // विशेष (exclusive) = fetch more posts since it's a key catalogue
  const fetchLimit = wpCategorySlug === "exclusive" ? 100 : 50;
  const rawPosts = await fetchPostsByCategory(wpCategorySlug, fetchLimit);
  const posts = rawPosts.map(mapWpPost);

  return (
    <div className="w-full min-h-screen bg-white">
      <main className="w-full" style={{ paddingTop: "var(--header-height)" }}>
        <div className="w-full max-w-[1920px] mx-auto px-mobile-safe pt-6 pb-16">

          {/* Section title */}
          <div className="flex justify-center mb-8 border-b-4 border-nepal-red pb-4 flex-col items-start">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-nepal-black font-nepali-serif">
              {categoryDisplayName}
            </h1>
          </div>

          {/* Grid cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {posts.length > 0 ? (
              posts.map((post) => {
                const contentImages = extractImagesFromContent(post.content);
                const featuredImageUrl = post.featuredImage;
                const thumbnailImage = featuredImageUrl ?? contentImages[0] ?? undefined;

                return (
                  <Card
                    key={post.id}
                    link={getPostUrl(post)}
                    images={thumbnailImage ? [thumbnailImage] : []}
                    title={getCleanTitle(post.title)}
                    content={getCleanContent(post.content, 150)}
                  />
                );
              })
            ) : (
              <div className="col-span-full w-full text-center text-gray-500 font-poppins py-20">
                No Content Available For Now
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
