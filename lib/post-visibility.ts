/**
 * Public pages must treat anything that is not PUBLISHED as missing. The
 * list and search queries filter on status in SQL; the article lookup
 * resolves by several keys in turn, so it applies this to the result instead.
 */
export function publishedOnly<T extends { status: string }>(post: T | null): T | null {
  if (!post || post.status !== "PUBLISHED") return null;
  return post;
}
