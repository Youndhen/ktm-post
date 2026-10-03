import { describe, expect, it } from "vitest";
import { sanitizeContent } from "@/lib/sanitize-content";

describe("sanitizeContent", () => {
  it("removes script tags and their contents", () => {
    expect(sanitizeContent('<p>hi</p><script>alert(1)</script>')).toBe("<p>hi</p>");
  });

  it("removes inline event handlers", () => {
    expect(sanitizeContent('<img src="https://a.com/x.jpg" onerror="alert(1)">')).toBe(
      '<img src="https://a.com/x.jpg" />',
    );
  });

  it("drops javascript: links but keeps https and mailto links", () => {
    expect(sanitizeContent('<a href="javascript:alert(1)">x</a>')).toBe("<a>x</a>");
    expect(sanitizeContent('<a href="https://ktmpost.com/a" target="_blank" rel="noopener noreferrer">x</a>')).toBe(
      '<a href="https://ktmpost.com/a" target="_blank" rel="noopener noreferrer">x</a>',
    );
    expect(sanitizeContent('<a href="mailto:news@ktmpost.com">m</a>')).toBe(
      '<a href="mailto:news@ktmpost.com">m</a>',
    );
  });

  it("keeps the editor's formatting: headings, lists, quotes, code, marks and alignment", () => {
    const html =
      '<h2 style="text-align: center">T</h2><p><strong>b</strong> <em>i</em> <u>u</u> <s>s</s></p>' +
      "<ul><li>a</li></ul><ol><li>b</li></ol><blockquote><p>q</p></blockquote><pre><code>c</code></pre><hr />";
    // Styles are re-serialised without the space; same CSS.
    expect(sanitizeContent(html)).toBe(html.replace("text-align: center", "text-align:center"));
  });

  it("drops style properties other than text-align", () => {
    expect(sanitizeContent('<p style="text-align: right; position: fixed">x</p>')).toBe(
      '<p style="text-align:right">x</p>',
    );
  });

  it("keeps images with http(s) sources and their lazy-load attributes", () => {
    const html =
      '<img src="https://res.cloudinary.com/x.jpg" alt="a" class="article-inline-image" data-src="https://a.com/y.jpg" width="600" height="400" />';
    expect(sanitizeContent(html)).toBe(html);
    expect(sanitizeContent('<img src="data:text/html;base64,AAAA">')).toBe("<img />");
  });

  it("allows iframes only from YouTube", () => {
    const yt =
      '<iframe src="https://www.youtube-nocookie.com/embed/abc123DEF45" allowfullscreen width="560" height="315"></iframe>';
    expect(sanitizeContent(yt)).toBe(yt);
    expect(sanitizeContent('<iframe src="https://evil.example/x"></iframe>')).toBe("");
    expect(sanitizeContent('<iframe srcdoc="<script>alert(1)</script>"></iframe>')).toBe("");
  });

  it("removes forms, objects and svg", () => {
    expect(
      sanitizeContent('<form action="/x"><input name="a"></form><object data="x"></object><svg onload="alert(1)"></svg>'),
    ).toBe("");
  });

  it("returns an empty string for null or empty input", () => {
    expect(sanitizeContent(null)).toBe("");
    expect(sanitizeContent("")).toBe("");
  });
});
