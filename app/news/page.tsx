export const runtime = "nodejs";
export const revalidate = 60;
import * as cheerio from "cheerio";
import {
  extractImagesFromContent,
  getCleanContent,
  getCleanTitle,
  getPostUrl,
  mapWpPost,
} from "@/lib/post-format";
import { fetchPosts } from "@/lib/wordpress";
import Card from "../components/Card";


export default async function NewsPage() {
  const news = await fetchPosts(10);
  const posts = news.map(mapWpPost)


  return (
    <section className="w-full" style={{ paddingTop: "var(--header-height)" }}>
      <div className="w-full max-w-[1920px] mx-auto px-mobile-safe pt-6 pb-16">

        {/* Section title - matching other category sections */}
        <div className="flex justify-center mb-8 border-b-4 border-nepal-red pb-4 flex-col items-start">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-nepal-black font-nepali-serif">
            समाचार{" "}
            <span className="text-gray-500 font-poppins text-lg font-normal">
              / News
            </span>
          </h2>
        </div>

        {/* FLEX GRID: professional cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {posts.length > 0 ? (
            posts.map((post) =>{

              const contentImages = extractImagesFromContent(post.content);
              const featuredImageUrl = post.featuredImage;
              const thumbnailImage = featuredImageUrl ?? contentImages[0] ?? undefined;
              return(
                <Card key={post.id}
                  link={getPostUrl(post)}
                  images={thumbnailImage ? [thumbnailImage] : []}
                  title={getCleanTitle(post.title)}
                  content={getCleanContent(post.content, 150)}
                />
              )
            })
          ) : (
            <div className="col-span-full w-full text-center text-gray-500 font-poppins py-20">
              No Content Available For Now
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
