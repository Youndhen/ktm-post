import sanitizeHtml from "sanitize-html";

// Rich text written in the admin editor (TipTap: StarterKit, Image, Link,
// Underline, TextAlign) plus the tags found in imported WordPress articles.
// Anything else, in particular scripts, event handlers and javascript: URLs,
// is dropped. Editors are not admins, so what they save must not be able to
// run in an admin's or a reader's browser.
const ALLOWED_TAGS = [
  "p", "br", "hr",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "strike", "del", "mark", "sub", "sup",
  "a", "ul", "ol", "li", "blockquote", "pre", "code",
  "img", "figure", "figcaption", "span", "div",
  "table", "thead", "tbody", "tr", "th", "td",
  "iframe",
];

const YOUTUBE_HOSTS = ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com"];

const options: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    "*": ["class", "style"],
    a: ["href", "target", "rel", "title"],
    img: ["src", "alt", "title", "width", "height", "data-src", "data-lazy-src", "srcset", "loading"],
    iframe: ["src", "width", "height", "allow", "allowfullscreen", "frameborder", "title"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan"],
  },
  allowedStyles: {
    "*": { "text-align": [/^(left|right|center|justify)$/] },
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https"], iframe: ["https"] },
  allowProtocolRelative: true,
  allowedIframeHostnames: YOUTUBE_HOSTS,
  // An iframe whose src was rejected (or that only had srcdoc) is removed
  // rather than left as an empty frame.
  exclusiveFilter: (frame) => frame.tag === "iframe" && !frame.attribs.src,
};

export function sanitizeContent(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, options);
}
