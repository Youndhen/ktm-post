# AWS edge caching and hardening

Date: 2026-10-01
Status: approved

## Goal

Run ktm-post on ECS Fargate as cheaply as possible while fixing the
security and latency problems found in the deployment audit.

"Separate SSR from client rendering" in a Next.js app does not mean two
servers. The client bundle is already static files. The separation that
saves money is:

- **Edge (CloudFront):** JS/CSS chunks, fonts, optimised images, and the
  HTML of public pages that Next already generates with ISR.
- **Origin (one Fargate task):** cache misses, ISR regeneration, the admin
  dashboard, auth, and API routes.

Public pages declare `revalidate = 60`, but the dynamic-segment routes
(`/[category]`, `/[category]/[id]`, `/news/[id]`) need an empty
`generateStaticParams` before Next 16 treats them as ISR; without it they
answer `no-store`. The task is to put a CDN
in front, stop serving rarely-changing pages dynamically, and close the
security holes.

## Out of scope

- Moving the Neon project from `us-east-2` to `ap-southeast-1`. Dashboard
  action, not code. It is the single biggest latency win and is called out
  in DEPLOY.md.
- A shared ISR cache handler for multi-task scaling. Desired count stays 1.
- AWS WAF and a script-src Content-Security-Policy.
- Renaming `middleware.ts` to `proxy.ts` (Next 16 deprecation warning only).

## 1. CloudFront in front of the ALB

New files: `infra/cloudfront/distribution.json`,
`scripts/setup-cloudfront.sh` (one-time, prints the distribution domain),
and a CloudFront section in `DEPLOY.md`.

Origin: the ALB DNS name, HTTPS only, with the viewer `Host` header
forwarded so the ALB's ACM certificate for `www.ktmpost.com` validates.
CloudFront adds a custom header `X-Origin-Verify: <random>`; DEPLOY.md
documents an ALB listener rule that returns 403 when it is missing, so the
origin cannot be reached around the CDN. The CloudFront certificate must be
requested in `us-east-1`; DEPLOY.md says so.

Cache behaviours, most specific first:

| Path | Cache policy | Origin request policy |
|---|---|---|
| `/_next/static/*` | managed CachingOptimized | managed AllViewer |
| `/_next/image*` | custom: key = query string + header `Accept`, min 60s, default 1 day, max 1 year | managed AllViewer |
| `/admin`, `/admin/*`, `/api/*` | managed CachingDisabled | managed AllViewer |
| `/*` default | custom: min 0, default 0, max 1 year, key = all query strings + headers `RSC`, `Next-Router-Prefetch`, `Next-Router-State-Tree`, `Next-Router-Segment-Prefetch`, `Next-Url`; no cookies | managed AllViewer |

AllViewer is attached to every behaviour, including the static ones, because
it is what forwards the viewer `Host` header: CloudFront validates the ALB's
certificate against the forwarded `Host`, and without it against the
`*.elb.amazonaws.com` origin name, which the certificate does not cover.

With min TTL 0 the default behaviour obeys the origin. Next sends
`s-maxage=60, stale-while-revalidate` for ISR pages and `no-store` for
dynamic ones, so only public pages are cached. The RSC headers keep
client-side navigation payloads from colliding with full HTML in the cache.
Public pages do not read the session, so dropping cookies at the edge is
safe; the login state in the header is fetched client-side from `/api/auth`,
which is uncached.

`next.config.ts` sets `images.minimumCacheTTL = 86400` so Next and
CloudFront agree on a one-day image TTL.

## 2. Security headers

`headers()` in `next.config.ts`, applied to `/(.*)`:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

No `Content-Security-Policy` with `script-src` in this round. The site
embeds YouTube and loads images from four remote hosts; a strict CSP needs
its own testing pass.

## 3. Rendering modes

Change from `force-dynamic` to `revalidate = 3600`:
`app/about-us`, `app/accessibility`, `app/advertise`, `app/privacy-policy`,
`app/terms-of-service`, `app/contact`, `app/page/[slug]`.

`app/page/[slug]` gets a `generateStaticParams` that returns an empty list,
which makes it on-demand ISR: first hit renders, later hits are cached for
an hour.

Invalidation so edits show up immediately:
- `pages/action.ts` create/update/delete: also `revalidatePath("/" + slug)`
  and `revalidatePath("/page/" + slug)` for the old and new slug.
- `settings/action.ts`: also `revalidatePath("/contact")`, because contact
  renders site settings.

`app/search` and everything under `app/admin` stay dynamic.

## 4. Auth and role hardening

The critical finding: `/login` offers public sign-up, `lib/auth.ts` gives
every new account `defaultRole: "editor"`, and the admin layout and server
actions only check that a session exists. Anyone can register and edit the
site.

Decision: reader accounts are not needed for now. Public login and sign-up
are removed, not hardened.

- Delete `app/login/page.tsx`. Remove the `/login` links in
  `app/components/SearchDropdown.tsx` and `app/admin/login/page.tsx`.
- `lib/auth.ts`: `emailAndPassword.disableSignUp: true`, so the
  `/api/auth/sign-up/email` endpoint is closed regardless of UI.
  `trustedOrigins` becomes the site URL and apex only; the localhost entries
  are added only when `NODE_ENV !== "production"`.
- Staff accounts are created only from the admin users page, which already
  sets role `editor` or `admin`.
- Defence in depth, because a session alone must never grant write access:
  - `lib/get-session.ts`: add `requireStaffSession()` that throws unless
    `session.user.role` is `admin` or `editor`, and `isStaff(session)`.
  - `app/admin/(dashboard)/layout.tsx`: redirect to `/admin/login` when
    there is no session, and to `/` when the session is not staff.
  - Every `app/admin/(dashboard)/*/action.ts`: replace the bare session
    check with `requireStaffSession()`. `users/action.ts` keeps its
    admin-only check.
  - `app/api/upload/route.ts` and `app/api/import/route.ts`: use
    `requireStaffSession()`; return 403 for non-staff.

First-admin setup (`app/api/auth/setup-admin/route.ts`):
- Because sign-up is disabled, the route can no longer call
  `auth.api.signUpEmail`. It creates the user and credential account
  directly with Prisma and better-auth's `hashPassword`, the same way
  `users/action.ts` already does, with role `admin`.
- Read `ADMIN_SETUP_TOKEN` from the environment. If unset, respond 404.
- Require header `x-setup-token` equal to it (401 otherwise), in addition to
  the existing zero-users check.
- `app/admin/login/page.tsx` shows a "setup token" field on the first-time
  tab and sends it.
- Add the token to the task definition `secrets`, `docker-compose.yml`,
  and `.env.example`, documented as optional and removable after setup.

## 5. Upload limits

`app/api/upload/route.ts`:
- Reject files over 10 MB with 413.
- Allow only `image/jpeg`, `image/png`, `image/webp`, `image/gif`,
  `image/avif`; otherwise 415.
- Upload with `resource_type: "image"` instead of `"auto"`.

## 6. Dead code removal

Delete, all currently unused by any page:
- `app/api/comment/route.ts` and `app/components/CommentsSection.tsx`
  (WordPress comments are dead; the env var it needed was never deployed).
- `app/api/summarizeroute/route.ts`, `app/components/SummaryButton.tsx`,
  `app/components/SummaryModal.tsx` (placeholder summariser, CORS `*`,
  nothing renders the button).
- `getPosts()` in `app/page.tsx` (fetches another site, only referenced in a
  comment).

## 7. Shared helpers out of the home page module

Move to `lib/post-format.ts`: `decodeHtmlEntities`, `getCleanContent`,
`getCleanTitle`, `extractImagesFromContent`, `mapWpPost`, `getPostUrl`, and
the `Post` / `WordPressPost` interfaces they use. Update importers:
`app/page.tsx`, `app/[category]/page.tsx`, `app/search/page.tsx`,
`app/news/page.tsx`, `app/news/[id]/page.tsx`, `app/api/search/route.ts`.
Behaviour unchanged; the API route stops pulling the page module, cheerio
and the font loader into its bundle.

## 8. Commit the deploy work

The untracked health route, `DEPLOY.md`, `infra/`, `scripts/deploy-ecs.sh`,
and the Dockerfile health-check change are committed as the first commit on
the working branch.

## Verification

- `npm run lint` and `npm run build` pass (build needs `DATABASE_URL`).
- `docker compose build && docker compose up -d`, then with `curl -sI`:
  - `/` and `/about-us` return `Cache-Control` containing `s-maxage`.
  - `/admin/login` and `/search?q=x` return `no-store` or `private`.
  - `/_next/static/...` returns `immutable`.
  - every response carries the five security headers.
- `GET /login` returns 404 and `POST /api/auth/sign-up/email` is rejected.
- Role test against the local container: a session whose role is neither
  admin nor editor gets redirected from `/admin` to `/` and 403 from
  `POST /api/upload`.
- `POST /api/auth/setup-admin` without the header returns 401 when the
  token is set and 404 when it is not.
- Upload test: a 11 MB file returns 413, a `.pdf` returns 415.
