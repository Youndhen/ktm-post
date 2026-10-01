# AWS Edge Caching and Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put CloudFront in front of the single Fargate task, make rarely-changing pages ISR, remove public sign-up, enforce staff roles everywhere a write happens, and delete dead endpoints.

**Architecture:** Next.js 16 App Router (standalone output) running as one ECS Fargate task behind an ALB. CloudFront caches static assets, optimised images and ISR HTML; the origin only sees cache misses, admin, auth and API traffic. Better Auth (Prisma adapter, admin plugin) handles staff login; public reader accounts are removed.

**Tech Stack:** Next.js 16.0.10, React 19, Prisma 5 on Neon Postgres, better-auth 1.7, Cloudinary SDK, cheerio, Tailwind 4, Docker (node:20-alpine), AWS CLI v2, vitest (added in Task 1 for pure helpers).

**Spec:** `docs/superpowers/specs/2026-10-01-aws-edge-caching-and-hardening-design.md`

## Global Constraints

- Node 20 in the image, Node 24 locally; no syntax newer than ES2022 in `lib/`.
- `npm run build` runs `prisma generate && next build` and needs `DATABASE_URL` (the local `.env` has it; `next build` reads `.env`).
- Commit on branch `aws-edge-hardening`. Every commit message ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Public pages must not read the session (CloudFront drops cookies from the cache key).
- Fargate desired count stays 1. Task size stays 512 CPU / 1024 MB.
- Nothing is deployed to AWS by this plan. Scripts are written and syntax-checked only.
- Shell: zsh. Quote glob patterns passed to grep (`--include='*.ts'`), or zsh errors with "no matches found".

## Review Focus

1. A client-side navigation (RSC fetch with `RSC: 1`) to `/` must not be served the full HTML cached for a browser load, and vice versa. Pinned in Task 9 by the pages cache policy header whitelist test.
2. An editor who saves a static page with a changed slug must see the new slug live and the old one gone within one request. Pinned in Task 3 by revalidating both slugs under both `/` and `/page/` prefixes.
3. A valid session whose role is `user` (legacy account created before this change) must be refused by every admin server action, not only the layout. Pinned in Task 4 by `isStaff` tests and the shared `requireStaffSession`.
4. `POST /api/auth/setup-admin` with a correct token but an existing user must still be refused, and a wrong token must be refused even with zero users. Pinned in Task 6 by `checkSetupToken` tests plus route ordering.
5. An upload whose browser-reported type is `image/svg+xml` must be rejected (SVG can carry script). Pinned in Task 7 by `validateUpload` tests.

---

### Task 1: Move post formatting helpers to `lib/post-format.ts`

**Files:**
- Create: `vitest.config.ts`
- Create: `lib/post-format.ts`
- Create: `lib/__tests__/post-format.test.ts`
- Modify: `package.json` (add `test` script and `vitest` devDependency)
- Modify: `app/page.tsx:1-262` (remove helper block and `getPosts`)
- Modify: `app/[category]/page.tsx:6`, `app/search/page.tsx:5`, `app/news/page.tsx:4-10`, `app/news/[id]/page.tsx:13`, `app/api/search/route.ts:3`

**Interfaces:**
- Produces: `lib/post-format.ts` exporting `decodeHtmlEntities(text: string | null): string`, `getCleanContent(content: string | null, maxLength?: number): string`, `getCleanTitle(title: string | null): string`, `extractImagesFromContent(content: string | null): string[]`, `mapWpPost(post: WordPressPost): FormattedPost`, `getPostUrl(post: { slug: string; categorySlug?: string; databaseId?: number }): string`, and the `FormattedPost` interface.

- [ ] **Step 1: Install vitest and add the test script**

```bash
cd /Users/phurba/Desktop/ktmposts/ktm-post && npm install -D vitest@^3
```

Edit `package.json` scripts to add:

```json
"test": "vitest run"
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Write the failing test**

Create `lib/__tests__/post-format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  decodeHtmlEntities,
  extractImagesFromContent,
  getCleanTitle,
  getPostUrl,
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL, "Failed to resolve import "@/lib/post-format"".

- [ ] **Step 4: Create `lib/post-format.ts`**

Move the code verbatim from `app/page.tsx` lines 77-260 (functions `decodeHtmlEntities`, `getCleanContent`, `getCleanTitle`, `extractImagesFromContent`, `mapWpPost`, `getPostUrl`). Drop the commented-out regex version of `extractImagesFromContent`. Rename the local `Post` interface to `FormattedPost` and export it. The file header is:

```ts
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
```

`mapWpPost` returns `FormattedPost`. Everything else is unchanged.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: PASS, 8 tests.

- [ ] **Step 6: Point importers at the new module and slim `app/page.tsx`**

In `app/page.tsx`:
- Delete lines 33-75 (the first local `Post` interface and `getPosts`) and lines 77-260 (helpers, second `Post` interface, `transliterateSlug` import).
- Delete `import * as cheerio from "cheerio";` (line 3) and `type Post as WordPressPost` from the `@/lib/wordpress` import (line 17).
- Add `import { getCleanContent, getCleanTitle, getPostUrl, mapWpPost, extractImagesFromContent } from "@/lib/post-format";` and then remove any of those names the file body does not use (check with `grep -c <name> app/page.tsx`; a count of 1 means only the import uses it).

Replace in the five importers:
- `app/[category]/page.tsx:6` and `app/search/page.tsx:5`: `from "../page"` → `from "@/lib/post-format"`.
- `app/news/page.tsx:10`: `from "../page"` → `from "@/lib/post-format"`.
- `app/news/[id]/page.tsx:13` and `app/api/search/route.ts:3`: `from "@/app/page"` → `from "@/lib/post-format"`.

- [ ] **Step 7: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. If `tsc` reports an unused import in `app/page.tsx`, remove that name from the import.

- [ ] **Step 8: Commit**

```bash
git add vitest.config.ts package.json package-lock.json lib/post-format.ts lib/__tests__/post-format.test.ts app/page.tsx "app/[category]/page.tsx" app/search/page.tsx app/news/page.tsx "app/news/[id]/page.tsx" app/api/search/route.ts
git commit -m "Move post formatting helpers out of the home page module

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Remove dead comment and summariser code

**Files:**
- Delete: `app/api/comment/route.ts`, `app/components/CommentsSection.tsx`, `app/api/summarizeroute/route.ts`, `app/components/SummaryButton.tsx`, `app/components/SummaryModal.tsx`

- [ ] **Step 1: Confirm nothing imports them**

Run:
```bash
grep -rn "CommentsSection\|SummaryButton\|SummaryModal\|/api/comment\|summarizeroute" app lib --include='*.ts' --include='*.tsx' | grep -v "^app/components/CommentsSection.tsx\|^app/components/SummaryButton.tsx\|^app/components/SummaryModal.tsx\|^app/api/comment/\|^app/api/summarizeroute/"
```
Expected: no output.

- [ ] **Step 2: Delete**

```bash
git rm -q app/api/comment/route.ts app/components/CommentsSection.tsx app/api/summarizeroute/route.ts app/components/SummaryButton.tsx app/components/SummaryModal.tsx
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "Remove unused comment and summariser endpoints and components

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: ISR for static pages and matching revalidation

**Files:**
- Modify: `app/about-us/page.tsx:5`, `app/accessibility/page.tsx:5`, `app/advertise/page.tsx:5`, `app/privacy-policy/page.tsx:5`, `app/terms-of-service/page.tsx:5`, `app/contact/page.tsx:5`, `app/page/[slug]/page.tsx:6`
- Modify: `app/admin/(dashboard)/pages/action.ts:57-58,109-112,127-129`
- Modify: `app/admin/(dashboard)/settings/action.ts:55-56`

- [ ] **Step 1: Switch the seven pages to hourly ISR**

In each of the seven files replace the line

```ts
export const dynamic = "force-dynamic";
```

with

```ts
export const revalidate = 3600;
```

- [ ] **Step 2: Revalidate both URL shapes on page writes**

In `app/admin/(dashboard)/pages/action.ts`, add this helper below the `PageActionState` type:

```ts
function revalidateStaticPage(slug: string) {
  revalidatePath(`/${slug}`);
  revalidatePath(`/page/${slug}`);
}
```

Then:
- In `createStaticPage`, replace `revalidatePath("/");` (line 58) with `revalidateStaticPage(slug);` followed by `revalidatePath("/");`.
- In `updateStaticPage`, replace lines 110-111 (`revalidatePath(`/${current.slug}`);` and the `if (slug !== current.slug) ...` line) with:
  ```ts
  revalidateStaticPage(current.slug);
  if (slug !== current.slug) revalidateStaticPage(slug);
  ```
- In `deleteStaticPage`, replace `revalidatePath(`/${page.slug}`);` (line 128) with `revalidateStaticPage(page.slug);`.

- [ ] **Step 3: Revalidate the contact page when settings change**

In `app/admin/(dashboard)/settings/action.ts`, after `revalidatePath("/");` on line 55 add:

```ts
    revalidatePath("/contact");
```

- [ ] **Step 4: Build and check the prerender manifest**

Run: `npm run build 2>&1 | tail -40`
Expected: build succeeds. Then:

```bash
node -e "const m=require('./.next/prerender-manifest.json'); for (const r of ['/about-us','/contact','/privacy-policy']) console.log(r, m.routes[r]?.initialRevalidateSeconds)"
```
Expected: each prints `3600`. And:

```bash
node -e "const m=require('./.next/prerender-manifest.json'); console.log(Object.keys(m.dynamicRoutes).filter(k=>k.startsWith('/page/')))"
```
Expected: `[ '/page/[slug]' ]`.

- [ ] **Step 5: Commit**

```bash
git add app/about-us app/accessibility app/advertise app/privacy-policy app/terms-of-service app/contact "app/page/[slug]" "app/admin/(dashboard)/pages/action.ts" "app/admin/(dashboard)/settings/action.ts"
git commit -m "Serve static pages with hourly ISR and revalidate them on edit

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Staff role enforcement

**Files:**
- Create: `lib/staff.ts`, `lib/__tests__/staff.test.ts`
- Modify: `lib/get-session.ts`
- Modify: `app/admin/(dashboard)/layout.tsx:11-15`
- Modify: `app/admin/(dashboard)/{categories,menu,sponsors,settings,pages,posts}/action.ts` (the local `requireAdmin`/`requireSession` helper in each)
- Modify: `app/api/upload/route.ts:16-19,78-81`, `app/api/import/route.ts:8-11`

**Interfaces:**
- Produces: `isStaff(role: string | null | undefined): boolean` in `lib/staff.ts`; `requireStaffSession(): Promise<Session>` in `lib/get-session.ts` (throws `Error("Unauthorized")` with no session, `Error("Forbidden")` for non-staff).

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/staff.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isStaff } from "@/lib/staff";

describe("isStaff", () => {
  it("accepts admin and editor", () => {
    expect(isStaff("admin")).toBe(true);
    expect(isStaff("editor")).toBe(true);
  });
  it("rejects user, empty, null and undefined", () => {
    expect(isStaff("user")).toBe(false);
    expect(isStaff("")).toBe(false);
    expect(isStaff(null)).toBe(false);
    expect(isStaff(undefined)).toBe(false);
  });
  it("is case sensitive, matching how roles are stored", () => {
    expect(isStaff("Admin")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL, cannot resolve `@/lib/staff`.

- [ ] **Step 3: Implement `lib/staff.ts`**

```ts
export const STAFF_ROLES = ["admin", "editor"] as const;

export function isStaff(role: string | null | undefined): boolean {
  return role != null && (STAFF_ROLES as readonly string[]).includes(role);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Add `requireStaffSession` to `lib/get-session.ts`**

Replace the file with:

```ts
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isStaff } from "@/lib/staff";

export async function getServerSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

/**
 * For server actions and admin-only code paths. A session alone is not
 * enough: the user must hold a staff role (admin or editor).
 */
export async function requireStaffSession() {
  const session = await getServerSession();
  if (!session) throw new Error("Unauthorized");
  if (!isStaff(session.user.role)) throw new Error("Forbidden");
  return session;
}
```

- [ ] **Step 6: Gate the admin layout by role**

In `app/admin/(dashboard)/layout.tsx`, add `import { isStaff } from "@/lib/staff";` and replace

```ts
  if (!session) {
    redirect("/admin/login");
  }
```

with

```ts
  if (!session) {
    redirect("/admin/login");
  }
  if (!isStaff(session.user.role)) {
    redirect("/");
  }
```

- [ ] **Step 7: Replace the local helpers in six action files**

In each of `categories`, `menu`, `sponsors` action files, delete the local function:

```ts
async function requireAdmin() {
  const session = await getServerSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}
```

and in `settings`, `pages`, `posts` action files delete the identical local `requireSession()`. In all six, change the import `import { getServerSession } from "@/lib/get-session";` to `import { requireStaffSession } from "@/lib/get-session";` and rename every call `requireAdmin()` / `requireSession()` to `requireStaffSession()`. Use:

```bash
for d in categories menu sponsors settings pages posts; do
  f="app/admin/(dashboard)/$d/action.ts"
  perl -0pi -e 's/async function (requireAdmin|requireSession)\(\) \{\n  const session = await getServerSession\(\);\n  if \(!session\) throw new Error\("Unauthorized"\);\n  return session;\n\}\n\n?//; s/import \{ getServerSession \} from "\@\/lib\/get-session";/import { requireStaffSession } from "\@\/lib\/get-session";/; s/\b(requireAdmin|requireSession)\(\)/requireStaffSession()/g' "$f"
done
grep -c "requireStaffSession" "app/admin/(dashboard)/"{categories,menu,sponsors,settings,pages,posts}/action.ts
```
Expected: each file reports a count of at least 2 (import plus one call). `users/action.ts` is not touched; it keeps its admin-only check.

- [ ] **Step 8: Return 403 for non-staff in the upload and import routes**

In `app/api/upload/route.ts`, add `import { isStaff } from "@/lib/staff";` and change both handlers (POST at line 16, GET at line 78) from

```ts
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
```

to

```ts
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
```

Make the same change in `app/api/import/route.ts` at line 8.

- [ ] **Step 9: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add lib/staff.ts lib/__tests__/staff.test.ts lib/get-session.ts "app/admin/(dashboard)" app/api/upload/route.ts app/api/import/route.ts
git commit -m "Require a staff role, not just a session, for every admin write

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Remove public login and sign-up

**Files:**
- Delete: `app/login/page.tsx`
- Modify: `lib/auth.ts:7-16,21-24`
- Modify: `app/components/SearchDropdown.tsx:147-152`
- Modify: `app/admin/login/page.tsx:186-191`

- [ ] **Step 1: Delete the public login page**

```bash
git rm -q app/login/page.tsx
rmdir app/login 2>/dev/null || true
```

- [ ] **Step 2: Close the sign-up endpoint and trim trusted origins**

Replace the top of `lib/auth.ts` down to the `database:` line with:

```ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { prisma } from "./prisma";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.ktmpost.com";

const devOrigins =
  process.env.NODE_ENV !== "production"
    ? [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
      ]
    : [];

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  trustedOrigins: Array.from(
    new Set([siteUrl, "https://ktmpost.com", "https://www.ktmpost.com", ...devOrigins]),
  ),
```

and change the `emailAndPassword` block to:

```ts
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    // Staff accounts are created from the admin users page. Nobody signs up.
    disableSignUp: true,
  },
```

- [ ] **Step 3: Point the header icon at the admin login**

In `app/components/SearchDropdown.tsx` line 148 change `href="/login"` to `href="/admin/login"` and the `title` on line 150 to `"Admin Login"`.

- [ ] **Step 4: Remove the reader sign-in link from the admin login page**

In `app/admin/login/page.tsx` delete the `<Link href="/login" ...>Switch to Public Reader Sign In →</Link>` element (lines 186-191). If `Link` is then unused in the file, keep it: the logo at the top still uses it.

- [ ] **Step 5: Type-check, lint, test**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add lib/auth.ts app/components/SearchDropdown.tsx app/admin/login/page.tsx
git commit -m "Remove public login and sign-up; staff accounts come from the admin

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Token-gated first-admin setup

**Files:**
- Create: `lib/setup-token.ts`, `lib/__tests__/setup-token.test.ts`
- Rewrite: `app/api/auth/setup-admin/route.ts`
- Modify: `app/admin/login/page.tsx` (state, header, input)
- Modify: `infra/ecs/task-definition.json` (secrets), `docker-compose.yml` (environment), `.env.example`, `DEPLOY.md` (secret JSON and a note)

**Interfaces:**
- Produces: `checkSetupToken(configured: string | undefined, provided: string | null): "disabled" | "invalid" | "ok"`.
- Consumes: `hashPassword` from `better-auth/crypto` (already used by `users/action.ts`).

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/setup-token.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkSetupToken } from "@/lib/setup-token";

describe("checkSetupToken", () => {
  it("is disabled when no token is configured", () => {
    expect(checkSetupToken(undefined, "anything")).toBe("disabled");
    expect(checkSetupToken("", "anything")).toBe("disabled");
    expect(checkSetupToken("   ", "anything")).toBe("disabled");
  });
  it("is invalid when the header is missing or wrong", () => {
    expect(checkSetupToken("secret", null)).toBe("invalid");
    expect(checkSetupToken("secret", "")).toBe("invalid");
    expect(checkSetupToken("secret", "secre")).toBe("invalid");
    expect(checkSetupToken("secret", "secret!")).toBe("invalid");
  });
  it("is ok on an exact match", () => {
    expect(checkSetupToken("secret", "secret")).toBe("ok");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL, cannot resolve `@/lib/setup-token`.

- [ ] **Step 3: Implement `lib/setup-token.ts`**

```ts
import { timingSafeEqual } from "node:crypto";

export type SetupTokenCheck = "disabled" | "invalid" | "ok";

/**
 * Compare the configured ADMIN_SETUP_TOKEN with the value a request sent.
 * "disabled" means the feature is off (no token configured) and the route
 * should behave as if it does not exist.
 */
export function checkSetupToken(
  configured: string | undefined,
  provided: string | null,
): SetupTokenCheck {
  const expected = configured?.trim() ?? "";
  if (!expected) return "disabled";
  if (!provided) return "invalid";
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return "invalid";
  return timingSafeEqual(a, b) ? "ok" : "invalid";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Rewrite the setup-admin route**

Replace `app/api/auth/setup-admin/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";
import { checkSetupToken } from "@/lib/setup-token";

// One-time bootstrap of the first admin account.
//
// Sign-up is disabled in better-auth, so this creates the user and its
// credential account directly, the same way the admin users page does.
// It is a no-op (404) unless ADMIN_SETUP_TOKEN is set, needs that token in
// the x-setup-token header, and refuses once any user exists.
export async function POST(req: Request) {
  const tokenCheck = checkSetupToken(
    process.env.ADMIN_SETUP_TOKEN,
    req.headers.get("x-setup-token"),
  );
  if (tokenCheck === "disabled") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (tokenCheck === "invalid") {
    return NextResponse.json({ error: "Invalid setup token" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 },
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return NextResponse.json(
        {
          error:
            "Setup is closed. The administrator must create your account from the dashboard.",
        },
        { status: 403 },
      );
    }

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: { name, email, emailVerified: true, role: "admin" },
    });
    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hashedPassword,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("First admin setup error:", error);
    return NextResponse.json({ error: "Failed to create first admin" }, { status: 500 });
  }
}
```

- [ ] **Step 6: Add the token field to the admin login page**

In `app/admin/login/page.tsx`:
- After `const [password, setPassword] = useState("");` add `const [setupToken, setSetupToken] = useState("");`.
- In the `fetch("/api/auth/setup-admin", ...)` call, change `headers` to `{ "Content-Type": "application/json", "x-setup-token": setupToken }`.
- Inside the `{isSignUp && ( ... )}` block, after the Full Name `<div>`, add:

```tsx
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                  Setup Token
                </label>
                <input
                  type="password"
                  value={setupToken}
                  onChange={(e) => setSetupToken(e.target.value)}
                  required
                  placeholder="ADMIN_SETUP_TOKEN from the server environment"
                  className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-nepal-red focus:bg-white text-gray-900 font-poppins transition-all placeholder-gray-400"
                />
              </div>
```

Note the `{isSignUp && (<div>...</div>)}` block currently wraps a single `<div>`; wrap the two divs in a fragment `<>...</>`.

- [ ] **Step 7: Wire the env var through deployment files**

`infra/ecs/task-definition.json`, inside `"secrets"`, add:

```json
        { "name": "ADMIN_SETUP_TOKEN",     "valueFrom": "${SECRET_ARN}:ADMIN_SETUP_TOKEN::" }
```

`docker-compose.yml`, under `environment:`, add `ADMIN_SETUP_TOKEN: ${ADMIN_SETUP_TOKEN:-}`.

`.env.example`, after the Better Auth block, add:

```
# One-time first-admin bootstrap. Leave empty to disable /api/auth/setup-admin.
# Set it, create the first admin at /admin/login, then remove it and redeploy.
ADMIN_SETUP_TOKEN=
```

`DEPLOY.md`: in the `create-secret` JSON add `"ADMIN_SETUP_TOKEN":"..."` and, after the "Note the returned ARN" paragraph, add:

```
`ADMIN_SETUP_TOKEN` enables the one-time first-admin form at `/admin/login`.
After the first admin exists, remove the key from the secret (or set it to an
empty string) and redeploy; the endpoint then answers 404.
```

Note: ECS fails a task when a `valueFrom` key is missing from the secret, so the key must exist in Secrets Manager even when empty.

- [ ] **Step 8: Validate JSON, type-check, lint**

Run: `python3 -m json.tool infra/ecs/task-definition.json >/dev/null && npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add lib/setup-token.ts lib/__tests__/setup-token.test.ts app/api/auth/setup-admin/route.ts app/admin/login/page.tsx infra/ecs/task-definition.json docker-compose.yml .env.example DEPLOY.md
git commit -m "Gate first-admin setup behind ADMIN_SETUP_TOKEN

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Upload size and type limits

**Files:**
- Create: `lib/upload-validation.ts`, `lib/__tests__/upload-validation.test.ts`
- Modify: `app/api/upload/route.ts:23-39`

**Interfaces:**
- Produces: `MAX_UPLOAD_BYTES`, `ALLOWED_IMAGE_TYPES`, `validateUpload(file: { size: number; type: string }): { ok: true } | { ok: false; status: 413 | 415; error: string }`.

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/upload-validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, validateUpload } from "@/lib/upload-validation";

describe("validateUpload", () => {
  it("accepts a small jpeg", () => {
    expect(validateUpload({ size: 1024, type: "image/jpeg" })).toEqual({ ok: true });
  });
  it("rejects files over the limit with 413", () => {
    const r = validateUpload({ size: MAX_UPLOAD_BYTES + 1, type: "image/png" });
    expect(r).toMatchObject({ ok: false, status: 413 });
  });
  it("accepts exactly the limit", () => {
    expect(validateUpload({ size: MAX_UPLOAD_BYTES, type: "image/webp" })).toEqual({ ok: true });
  });
  it("rejects non-image and svg types with 415", () => {
    expect(validateUpload({ size: 10, type: "application/pdf" })).toMatchObject({ ok: false, status: 415 });
    expect(validateUpload({ size: 10, type: "image/svg+xml" })).toMatchObject({ ok: false, status: 415 });
    expect(validateUpload({ size: 10, type: "" })).toMatchObject({ ok: false, status: 415 });
  });
  it("checks size before type so an oversized pdf reports 413", () => {
    expect(validateUpload({ size: MAX_UPLOAD_BYTES + 1, type: "application/pdf" })).toMatchObject({ status: 413 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL, cannot resolve `@/lib/upload-validation`.

- [ ] **Step 3: Implement `lib/upload-validation.ts`**

```ts
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // Cloudinary free-plan image limit

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export type UploadValidation =
  | { ok: true }
  | { ok: false; status: 413 | 415; error: string };

export function validateUpload(file: { size: number; type: string }): UploadValidation {
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `File is too large. Maximum size is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
    };
  }
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return {
      ok: false,
      status: 415,
      error: "Unsupported file type. Upload a JPEG, PNG, WebP, GIF or AVIF image.",
    };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Use it in the upload route**

In `app/api/upload/route.ts` add `import { validateUpload } from "@/lib/upload-validation";` and, after the `if (!file) { ... }` check, add:

```ts
    const check = validateUpload(file);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status });
    }
```

Change `resource_type: "auto",` to `resource_type: "image",`.

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/upload-validation.ts lib/__tests__/upload-validation.test.ts app/api/upload/route.ts
git commit -m "Limit uploads to 10 MB raster images

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Security headers and image cache TTL

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Add headers and the image TTL**

In `next.config.ts`, inside `nextConfig`, add after `staticPageGenerationTimeout: 120,`:

```ts
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
```

and inside `images: {` add, before `remotePatterns`:

```ts
    // One day. CloudFront's image cache policy uses the same floor.
    minimumCacheTTL: 86400,
```

- [ ] **Step 2: Build, start, and check headers**

Run:
```bash
npm run build 2>&1 | tail -5 && (PORT=3100 npm start >/tmp/ktm-start.log 2>&1 &) && sleep 4 && curl -sI http://localhost:3100/about-us | grep -iE "strict-transport|x-content-type|x-frame|referrer-policy|permissions-policy|cache-control"
```
Expected: five security header lines plus a `cache-control` line containing `s-maxage=3600`. Then:

```bash
curl -sI http://localhost:3100/admin/login | grep -i cache-control; curl -sI "http://localhost:3100/search?q=x" | grep -i cache-control
```
Expected: both show `private, no-cache, no-store, max-age=0, must-revalidate`. Then stop the server:

```bash
pkill -f "next start" || true
```

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "Add security headers and a one-day image cache floor

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: CloudFront distribution config and setup script

**Files:**
- Create: `infra/cloudfront/cache-policy-pages.json`, `infra/cloudfront/cache-policy-images.json`, `infra/cloudfront/distribution.json`
- Create: `scripts/setup-cloudfront.sh`
- Create: `lib/__tests__/cloudfront-config.test.ts`
- Modify: `DEPLOY.md` (new "CloudFront" section, Neon region note, cost line)
- Modify: `docs/superpowers/specs/2026-10-01-aws-edge-caching-and-hardening-design.md` (move `Accept` from the pages key to the images key)

**Interfaces:**
- Consumes: the ALB DNS name and an ACM certificate ARN in `us-east-1`, supplied as env vars to the script.

- [ ] **Step 1: Write the failing config test**

Create `lib/__tests__/cloudfront-config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const read = (p: string) => JSON.parse(readFileSync(path.join(root, p), "utf8"));

describe("CloudFront pages cache policy", () => {
  const policy = read("infra/cloudfront/cache-policy-pages.json").CachePolicyConfig;
  it("obeys origin Cache-Control (min 0, default 0)", () => {
    expect(policy.MinTTL).toBe(0);
    expect(policy.DefaultTTL).toBe(0);
    expect(policy.MaxTTL).toBe(31536000);
  });
  it("keys on the Next.js RSC headers and ignores cookies", () => {
    const p = policy.ParametersInCacheKeyAndForwardedToOrigin;
    expect(p.HeadersConfig.Headers.Items).toEqual([
      "RSC",
      "Next-Router-Prefetch",
      "Next-Router-State-Tree",
      "Next-Url",
    ]);
    expect(p.CookiesConfig.CookieBehavior).toBe("none");
    expect(p.QueryStringsConfig.QueryStringBehavior).toBe("all");
  });
});

describe("CloudFront images cache policy", () => {
  const policy = read("infra/cloudfront/cache-policy-images.json").CachePolicyConfig;
  it("caches for at least a minute and a day by default", () => {
    expect(policy.MinTTL).toBe(60);
    expect(policy.DefaultTTL).toBe(86400);
  });
  it("keys on Accept for format negotiation and all query strings", () => {
    const p = policy.ParametersInCacheKeyAndForwardedToOrigin;
    expect(p.HeadersConfig.Headers.Items).toEqual(["Accept"]);
    expect(p.QueryStringsConfig.QueryStringBehavior).toBe("all");
  });
});

describe("CloudFront distribution template", () => {
  const raw = readFileSync(path.join(root, "infra/cloudfront/distribution.json"), "utf8");
  const dist = JSON.parse(raw);
  const behaviours = dist.CacheBehaviors.Items as Array<{ PathPattern: string; CachePolicyId: string }>;
  it("never caches admin or api paths", () => {
    for (const p of ["/admin/*", "/api/*"]) {
      const b = behaviours.find((x) => x.PathPattern === p);
      expect(b?.CachePolicyId).toBe("4135ea2d-6df8-44a3-9df3-4b5a84be39ad"); // managed CachingDisabled
    }
  });
  it("uses CachingOptimized for hashed static chunks", () => {
    const b = behaviours.find((x) => x.PathPattern === "/_next/static/*");
    expect(b?.CachePolicyId).toBe("658327ea-f89d-4fab-a63d-7e88639e58f6");
  });
  it("includes Asia in the price class and sends a verify header to the origin", () => {
    expect(dist.PriceClass).toBe("PriceClass_200");
    expect(dist.Origins.Items[0].CustomHeaders.Items[0].HeaderName).toBe("X-Origin-Verify");
    expect(dist.Origins.Items[0].CustomOriginConfig.OriginProtocolPolicy).toBe("https-only");
  });
  it("only has the placeholders the setup script substitutes", () => {
    const placeholders = Array.from(raw.matchAll(/\$\{([A-Z_]+)\}/g)).map((m) => m[1]);
    expect(new Set(placeholders)).toEqual(
      new Set(["CALLER_REFERENCE", "SITE_DOMAIN", "ALB_DNS", "ORIGIN_VERIFY", "PAGES_CACHE_POLICY_ID", "IMAGES_CACHE_POLICY_ID", "ACM_CERT_ARN"]),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL, ENOENT on `infra/cloudfront/cache-policy-pages.json`.

- [ ] **Step 3: Write the two cache policies**

`infra/cloudfront/cache-policy-pages.json`:

```json
{
  "CachePolicyConfig": {
    "Name": "ktm-post-pages",
    "Comment": "Obey origin Cache-Control. ISR pages send s-maxage, dynamic pages send no-store.",
    "MinTTL": 0,
    "DefaultTTL": 0,
    "MaxTTL": 31536000,
    "ParametersInCacheKeyAndForwardedToOrigin": {
      "EnableAcceptEncodingGzip": true,
      "EnableAcceptEncodingBrotli": true,
      "HeadersConfig": {
        "HeaderBehavior": "whitelist",
        "Headers": {
          "Quantity": 4,
          "Items": ["RSC", "Next-Router-Prefetch", "Next-Router-State-Tree", "Next-Url"]
        }
      },
      "CookiesConfig": { "CookieBehavior": "none" },
      "QueryStringsConfig": { "QueryStringBehavior": "all" }
    }
  }
}
```

`infra/cloudfront/cache-policy-images.json`:

```json
{
  "CachePolicyConfig": {
    "Name": "ktm-post-images",
    "Comment": "next/image output. Keyed on url/w/q query and Accept for webp/avif negotiation.",
    "MinTTL": 60,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000,
    "ParametersInCacheKeyAndForwardedToOrigin": {
      "EnableAcceptEncodingGzip": false,
      "EnableAcceptEncodingBrotli": false,
      "HeadersConfig": {
        "HeaderBehavior": "whitelist",
        "Headers": { "Quantity": 1, "Items": ["Accept"] }
      },
      "CookiesConfig": { "CookieBehavior": "none" },
      "QueryStringsConfig": { "QueryStringBehavior": "all" }
    }
  }
}
```

- [ ] **Step 4: Write the distribution template**

`infra/cloudfront/distribution.json`:

```json
{
  "CallerReference": "${CALLER_REFERENCE}",
  "Comment": "ktm-post",
  "Enabled": true,
  "HttpVersion": "http2and3",
  "IsIPV6Enabled": true,
  "PriceClass": "PriceClass_200",
  "DefaultRootObject": "",
  "Aliases": { "Quantity": 1, "Items": ["${SITE_DOMAIN}"] },
  "ViewerCertificate": {
    "ACMCertificateArn": "${ACM_CERT_ARN}",
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021"
  },
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "alb",
        "DomainName": "${ALB_DNS}",
        "CustomHeaders": {
          "Quantity": 1,
          "Items": [{ "HeaderName": "X-Origin-Verify", "HeaderValue": "${ORIGIN_VERIFY}" }]
        },
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "https-only",
          "OriginSslProtocols": { "Quantity": 1, "Items": ["TLSv1.2"] },
          "OriginReadTimeout": 60,
          "OriginKeepaliveTimeout": 5
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "alb",
    "ViewerProtocolPolicy": "redirect-to-https",
    "Compress": true,
    "AllowedMethods": {
      "Quantity": 7,
      "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
      "CachedMethods": { "Quantity": 2, "Items": ["GET", "HEAD"] }
    },
    "CachePolicyId": "${PAGES_CACHE_POLICY_ID}",
    "OriginRequestPolicyId": "216adef6-5c7f-47e4-b989-5492eafa07d3"
  },
  "CacheBehaviors": {
    "Quantity": 4,
    "Items": [
      {
        "PathPattern": "/_next/static/*",
        "TargetOriginId": "alb",
        "ViewerProtocolPolicy": "redirect-to-https",
        "Compress": true,
        "AllowedMethods": {
          "Quantity": 2,
          "Items": ["GET", "HEAD"],
          "CachedMethods": { "Quantity": 2, "Items": ["GET", "HEAD"] }
        },
        "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6"
      },
      {
        "PathPattern": "/_next/image*",
        "TargetOriginId": "alb",
        "ViewerProtocolPolicy": "redirect-to-https",
        "Compress": false,
        "AllowedMethods": {
          "Quantity": 2,
          "Items": ["GET", "HEAD"],
          "CachedMethods": { "Quantity": 2, "Items": ["GET", "HEAD"] }
        },
        "CachePolicyId": "${IMAGES_CACHE_POLICY_ID}"
      },
      {
        "PathPattern": "/admin/*",
        "TargetOriginId": "alb",
        "ViewerProtocolPolicy": "redirect-to-https",
        "Compress": true,
        "AllowedMethods": {
          "Quantity": 7,
          "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
          "CachedMethods": { "Quantity": 2, "Items": ["GET", "HEAD"] }
        },
        "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
        "OriginRequestPolicyId": "216adef6-5c7f-47e4-b989-5492eafa07d3"
      },
      {
        "PathPattern": "/api/*",
        "TargetOriginId": "alb",
        "ViewerProtocolPolicy": "redirect-to-https",
        "Compress": true,
        "AllowedMethods": {
          "Quantity": 7,
          "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
          "CachedMethods": { "Quantity": 2, "Items": ["GET", "HEAD"] }
        },
        "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
        "OriginRequestPolicyId": "216adef6-5c7f-47e4-b989-5492eafa07d3"
      }
    ]
  }
}
```

Managed policy IDs used: CachingOptimized `658327ea-f89d-4fab-a63d-7e88639e58f6`, CachingDisabled `4135ea2d-6df8-44a3-9df3-4b5a84be39ad`, AllViewer origin request `216adef6-5c7f-47e4-b989-5492eafa07d3`. These are AWS-global constants.

- [ ] **Step 5: Run the config tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Write the setup script**

`scripts/setup-cloudfront.sh`:

```bash
#!/usr/bin/env bash
#
# One-time: create the CloudFront distribution in front of the ALB.
#
# This creates billable resources. Read the CloudFront section of DEPLOY.md.
#
# Required:
#   ALB_DNS       the load balancer's DNS name, e.g. ktm-post-123.ap-south-1.elb.amazonaws.com
#   ACM_CERT_ARN  an ACM certificate for SITE_DOMAIN issued in us-east-1
# Optional:
#   SITE_DOMAIN    default www.ktmpost.com
#   ORIGIN_VERIFY  shared secret sent to the ALB; generated and printed if unset
#
set -euo pipefail
cd "$(dirname "$0")/.."

SITE_DOMAIN="${SITE_DOMAIN:-www.ktmpost.com}"
: "${ALB_DNS:?ALB_DNS is required}"
: "${ACM_CERT_ARN:?ACM_CERT_ARN (us-east-1) is required}"
ORIGIN_VERIFY="${ORIGIN_VERIFY:-$(openssl rand -hex 16)}"

existing="$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='ktm-post'].[Id,DomainName]" --output text 2>/dev/null || true)"
if [[ -n "$existing" ]]; then
  echo "A ktm-post distribution already exists: $existing"
  echo "Update it in the console or with 'aws cloudfront update-distribution'."
  exit 0
fi

ensure_cache_policy() {
  local file="$1" name
  name="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["CachePolicyConfig"]["Name"])' "$file")"
  local id
  id="$(aws cloudfront list-cache-policies --type custom \
    --query "CachePolicyList.Items[?CachePolicy.CachePolicyConfig.Name=='${name}'].CachePolicy.Id" --output text)"
  if [[ -z "$id" || "$id" == "None" ]]; then
    id="$(aws cloudfront create-cache-policy --cli-input-json "file://${file}" \
      --query 'CachePolicy.Id' --output text)"
    echo "==> created cache policy ${name} (${id})" >&2
  else
    echo "==> using cache policy ${name} (${id})" >&2
  fi
  echo "$id"
}

PAGES_CACHE_POLICY_ID="$(ensure_cache_policy infra/cloudfront/cache-policy-pages.json)"
IMAGES_CACHE_POLICY_ID="$(ensure_cache_policy infra/cloudfront/cache-policy-images.json)"
CALLER_REFERENCE="ktm-post-$(date +%s)"

RENDERED="$(mktemp -t ktm-post-cloudfront)"
CALLER_REFERENCE="$CALLER_REFERENCE" SITE_DOMAIN="$SITE_DOMAIN" ALB_DNS="$ALB_DNS" \
ORIGIN_VERIFY="$ORIGIN_VERIFY" PAGES_CACHE_POLICY_ID="$PAGES_CACHE_POLICY_ID" \
IMAGES_CACHE_POLICY_ID="$IMAGES_CACHE_POLICY_ID" ACM_CERT_ARN="$ACM_CERT_ARN" \
python3 - infra/cloudfront/distribution.json "$RENDERED" <<'PY'
import json, os, sys
src, dst = sys.argv[1], sys.argv[2]
raw = open(src).read()
for key in ("CALLER_REFERENCE","SITE_DOMAIN","ALB_DNS","ORIGIN_VERIFY",
            "PAGES_CACHE_POLICY_ID","IMAGES_CACHE_POLICY_ID","ACM_CERT_ARN"):
    raw = raw.replace("${%s}" % key, os.environ[key])
if "${" in raw:
    sys.exit("unsubstituted placeholder remains in distribution config")
json.loads(raw)
open(dst, "w").write(raw)
PY

echo "==> creating distribution"
aws cloudfront create-distribution --distribution-config "file://${RENDERED}" \
  --query 'Distribution.[Id,DomainName]' --output text
rm -f "$RENDERED"

cat <<EOF

Next steps (see DEPLOY.md, "CloudFront"):
  1. Add an ALB listener rule that returns 403 unless the request carries
       X-Origin-Verify: ${ORIGIN_VERIFY}
     Keep this value somewhere safe; it is not stored anywhere else.
  2. Point the ${SITE_DOMAIN} DNS record (CNAME or alias) at the distribution
     domain printed above instead of the ALB.
  3. Wait for the distribution status to become Deployed (10-15 minutes).
EOF
```

Then: `chmod +x scripts/setup-cloudfront.sh && bash -n scripts/setup-cloudfront.sh`
Expected: no output.

- [ ] **Step 7: Document in DEPLOY.md**

Append a section before "## Deploying":

````markdown
## CloudFront (do this once the ALB works)

Without a CDN every JS chunk, font, image and cached page is served by the
Fargate task through the ALB, and Nepali readers connect to Mumbai for all
of it. CloudFront caches:

- `/_next/static/*`  for a year (hashed filenames, managed CachingOptimized)
- `/_next/image*`    for a day, keyed on the query string and `Accept`
- everything else    exactly as long as the origin says: ISR pages send
                     `s-maxage=60` (news) or `s-maxage=3600` (footer pages);
                     dynamic pages send `no-store` and are never cached
- `/admin/*`, `/api/*`  never cached, cookies and headers forwarded

The default behaviour keys on the Next.js `RSC`, `Next-Router-Prefetch`,
`Next-Router-State-Tree` and `Next-Url` headers so client-side navigation
payloads and full HTML do not collide in the cache. Cookies are forwarded to
the origin but are not part of the cache key; no public page reads the
session, so this is safe.

### Setup

1. Request an ACM certificate for `www.ktmpost.com` **in `us-east-1`**.
   CloudFront only accepts certificates from that region; the ALB's
   certificate in `ap-south-1` cannot be reused.
2. Run:

   ```bash
   ALB_DNS=ktm-post-123456.ap-south-1.elb.amazonaws.com \
   ACM_CERT_ARN=arn:aws:acm:us-east-1:<account>:certificate/... \
   ./scripts/setup-cloudfront.sh
   ```

   It creates two cache policies and the distribution, prints the
   distribution domain and a generated `X-Origin-Verify` value.
3. Lock the ALB to CloudFront. On the HTTPS listener, change the default
   action to a fixed 403 response and add a rule: if HTTP header
   `X-Origin-Verify` equals the printed value, forward to the target group.
   Requests that bypass CloudFront then get 403.
4. Change the `www.ktmpost.com` DNS record to the distribution domain.

Set `SITE_URL`/`NEXT_PUBLIC_SITE_URL` to the CloudFront-fronted domain (it
already is `https://www.ktmpost.com`). After a content change the admin
server actions call `revalidatePath`, which refreshes the origin's ISR cache;
CloudFront picks the new version up when its copy expires (60s for news,
1h for footer pages). To force it, create an invalidation:

```bash
aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
```

### Database region

The Neon project is in `us-east-2` (Ohio) while the task runs in
`ap-south-1`. Every query crosses roughly 200ms of round trip, and dynamic
pages run several queries in sequence. Create the Neon project in
`ap-southeast-1` (Singapore) and keep the pooled connection string. This is
the single biggest latency improvement available and needs no code change.
````

Also change the "Cost" bullet under "Things to know" to end with: `CloudFront is free for the first 1 TB/month out and then roughly $0.12/GB from Asian edges.`

- [ ] **Step 8: Align the spec table**

In the spec, change the default behaviour row to list headers `RSC`, `Next-Router-Prefetch`, `Next-Router-State-Tree`, `Next-Url` (drop `Accept`) and the `/_next/image*` row to say "key = query string + `Accept`".

- [ ] **Step 9: Commit**

```bash
git add infra/cloudfront scripts/setup-cloudfront.sh lib/__tests__/cloudfront-config.test.ts DEPLOY.md docs/superpowers/specs
git commit -m "Add CloudFront distribution config and setup script

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: End-to-end verification in Docker

**Files:**
- Modify: `README.md` (test script mention)

- [ ] **Step 1: Full local checks**

Run: `npm test && npm run lint && npx tsc --noEmit && npm run build 2>&1 | tail -3`
Expected: all pass.

- [ ] **Step 2: Build and start the container**

Run: `docker compose build 2>&1 | tail -3 && docker compose up -d && sleep 8 && docker compose ps`
Expected: `ktm-post` is `running (healthy)` or `running (health: starting)`.

- [ ] **Step 3: Header and cache checks against the container**

```bash
for p in / /about-us /admin/login "/search?q=x" ; do echo "== $p"; curl -sI "http://localhost:3000$p" | grep -iE "^(cache-control|strict-transport-security|x-frame-options|x-content-type-options|referrer-policy|permissions-policy):"; done
```
Expected: `/` has `s-maxage=60`, `/about-us` has `s-maxage=3600`, `/admin/login` and `/search` have `no-store`; every response has the five security headers.

```bash
chunk=$(curl -s http://localhost:3000/ | grep -oE '/_next/static/[^"]+\.js' | head -1); curl -sI "http://localhost:3000$chunk" | grep -i cache-control
```
Expected: `public, max-age=31536000, immutable`.

- [ ] **Step 4: Auth surface checks**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H 'content-type: application/json' -d '{"email":"a@b.c","password":"longenough1","name":"x"}' http://localhost:3000/api/auth/sign-up/email
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H 'content-type: application/json' -d '{}' http://localhost:3000/api/auth/setup-admin
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/upload
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/comment
```
Expected, in order: `404`, a 4xx (better-auth returns `400` or `403` with sign-up disabled, not `200`), `404` (no `ADMIN_SETUP_TOKEN` in `.env`), `401`, `404`.

- [ ] **Step 5: Setup token behaviour with a token set**

```bash
docker compose down && ADMIN_SETUP_TOKEN=testtoken docker compose up -d && sleep 8
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H 'content-type: application/json' -d '{}' http://localhost:3000/api/auth/setup-admin
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H 'content-type: application/json' -H 'x-setup-token: testtoken' -d '{"name":"a","email":"a@b.c","password":"longenough1"}' http://localhost:3000/api/auth/setup-admin
docker compose down
```
Expected: `401` then `403` (users already exist in the Neon database, so setup is closed). Do not run this against an empty database.

- [ ] **Step 6: Note the test command in README**

In `README.md`, under the development instructions, add:

```markdown
Run the unit tests for the pure helpers in `lib/` with `npm test`.
```

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "Document the test command

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
