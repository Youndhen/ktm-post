import { describe, expect, it } from "vitest";
import {
  decodeHtmlEntities,
  extractImagesFromContent,
  getCleanTitle,
  getPostUrl,
  postPublicPaths,
} from "@/lib/post-format";

describe("decodeHtmlEntities", () => {
  it("decodes common entities", () => {
    expect(decodeHtmlEntities("a &amp; b &lt;c&gt;")).toBe("a & b <c>");
  });
  it("returns a placeholder for null", () => {
    expect(decodeHtmlEntities(null)).toBe("No preview available.");
  });
});

describe("getCleanTitle", () => {
  it("returns Untitled Post for null", () => {
    expect(getCleanTitle(null)).toBe("Untitled Post");
  });
  it("strips bracket tags and page counters", () => {
    expect(getCleanTitle("Budget speech [Photo] 1/3")).toBe("Budget speech");
  });
});

describe("getPostUrl", () => {
  it("uses the category path with the database id prefix", () => {
    expect(getPostUrl({ slug: "hello world", categorySlug: "politics", databaseId: 12 })).toBe(
      "/politics/12-hello-world",
    );
  });
  it("falls back to /news for feed categories", () => {
    expect(getPostUrl({ slug: "hello", categorySlug: "breaking-news" })).toBe("/news/hello");
  });
});

describe("extractImagesFromContent", () => {
  it("normalises protocol-relative and root-relative sources and dedupes", () => {
    const html =
      '<p><img src="//a.com/x.jpg"><img src="/y.jpg"><img src="//a.com/x.jpg"></p>';
    expect(extractImagesFromContent(html)).toEqual([
      "https://a.com/x.jpg",
      "https://cms.ktmpost.com/y.jpg",
    ]);
  });
  it("prefers data-src over a base64 placeholder", () => {
    const html = '<img src="data:image/gif;base64,AAA" data-src="https://b.com/z.png">';
    expect(extractImagesFromContent(html)).toEqual(["https://b.com/z.png"]);
  });
});

describe("postPublicPaths", () => {
  it("lists the article under /news and under each of its categories", () => {
    expect(postPublicPaths("budget-speech", ["politics"])).toEqual([
      "/news/budget-speech",
      "/politics",
      "/politics/budget-speech",
    ]);
  });
  it("uses the public name for categories that are shown under another slug", () => {
    const paths = postPublicPaths("x", ["business", "science-technology"]);
    expect(paths).toEqual(
      expect.arrayContaining(["/economy", "/economy/x", "/technology", "/technology/x"]),
    );
  });
  it("does not repeat a path", () => {
    const paths = postPublicPaths("x", ["economy", "business"]);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
