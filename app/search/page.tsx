export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { searchPosts, fetchPosts } from "@/lib/wordpress";
import { extractImagesFromContent, getCleanContent, getCleanTitle, getPostUrl, mapWpPost } from "@/lib/post-format";
import Card from "../components/Card";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q || "";

  // Fetch search results from WP GraphQL if query exists,else recent posts
  const rawPosts = query ? await searchPosts(query, 30) : await fetchPosts(24);
  const posts = rawPosts.map(mapWpPost);

  return (
    <div className="w-full min-h-screen bg-white">
      <main className="w-full" style={{ paddingTop: "var(--header-height)" }}>
        <div className="w-full max-w-[1920px] mx-auto px-mobile-safe pt-6 pb-16">
          {/* Section title */}
          <div className="flex flex-col items-start mb-8 border-b border-gray-200 pb-4">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-nepal-black font-nepali-serif">
              खोज नतिजा: <span className="text-nepal-red">"{query}"</span>
            </h1>
            <p className="text-sm text-gray-500 font-poppins mt-1">
              {posts.length} समाचार भेटियो
            </p>
            <div className="bg-nepal-red h-[3px] rounded-none w-24 mt-2" />
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
                "{query}" सम्बन्धी कुनै समाचार भेटिएन। (No search results found)
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
