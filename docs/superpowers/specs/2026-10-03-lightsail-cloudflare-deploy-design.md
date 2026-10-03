# Lightsail deployment with Cloudflare in front

Date: 2026-10-03
Status: draft, awaiting review
Supersedes the hosting parts of `2026-10-01-aws-edge-caching-and-hardening-design.md`
(ECS Fargate, ALB, CloudFront). The application hardening in that spec stands.

## Goal

Run ktm-post on one AWS Lightsail instance, with Cloudflare as the CDN,
certificate and firewall, Postgres on the same instance, and a push to
`main` deploying automatically. Keep the monthly cost to the instance alone.

Why this shape:

- Traffic is readers only. Public pages are already cached by the app
  (60 s for news, 1 h for footer pages); a CDN in front means the server
  mostly serves editors and cache refreshes.
- DNS is already on Cloudflare, whose free plan covers CDN, TLS, DDoS,
  a managed WAF, one rate-limit rule and a traffic dashboard. CloudFront
  would duplicate all of that for more setup.
- Neon is being dropped. A Postgres container next to the app costs
  nothing extra and keeps the data on hardware the owner controls.

## Out of scope

- Zero-downtime deploys. A deploy restarts the app container; the gap is a
  few seconds and Cloudflare keeps serving cached pages through it.
- Staging environments and preview deploys.
- An application-level latency dashboard (P95/P99 per route). Cloudflare's
  analytics cover requests, cache ratio, status codes and top paths.
- Running more than one app server. Nothing here is shared-state ready.

## 1. The instance

- Lightsail Linux instance, Ubuntu 24.04 LTS, 4 GB RAM / 2 vCPU / 80 GB
  SSD, region `ap-southeast-1` (Singapore), with a static IP attached.
  4 GB because the Docker image is built on the box next to the running app
  and database.
- Lightsail firewall: TCP 22 (SSH), 80 and 443 only. Everything else closed.
- Automatic snapshots enabled in the Lightsail console (daily).
- Installed by hand once, following `DEPLOY.md`: Docker Engine with the
  Compose plugin, a clone of the repo at `/opt/ktm-post`, a `.env` file
  there, the Cloudflare origin certificate under `/opt/ktm-post/certs/`,
  and a `deploy` SSH key authorised for the `ubuntu` user.

## 2. Containers

`docker-compose.yml` becomes the production definition and runs on the
instance (it also works locally with `docker compose up` for a full stack).

| Service | Image | Role |
|---|---|---|
| `web` | built from `Dockerfile` (unchanged) | Next.js on port 3000, internal only |
| `db` | `postgres:16-alpine` | Postgres, data in a named volume, bound to `127.0.0.1:5432` on the host only |
| `migrate` | built from `Dockerfile` stage `deps` | one-shot `prisma db push`; run by the deploy script, not on `up` |
| `caddy` | `caddy:2-alpine` | TLS termination with the Cloudflare origin certificate, origin-verify check, reverse proxy to `web` |

- `web` builds with `network: host` so `next build` can reach Postgres at
  `127.0.0.1:5432` for the pages it prerenders (`/`, `/news`, footer pages).
  `DATABASE_URL` at build time therefore uses `127.0.0.1`; at run time it
  uses the compose hostname `db`. Both come from `.env`
  (`DATABASE_URL_BUILD`, `DATABASE_URL`).
- `web` depends on `db` being healthy (`pg_isready`).
- `migrate` exists because the standalone image has no Prisma CLI. The
  repo has no migration files; `prisma db push --skip-generate` syncs the
  schema and is a no-op when nothing changed.
- `caddy` is the only service with published ports (80, 443).

`.env.example` gains `DATABASE_URL_BUILD`, `POSTGRES_PASSWORD` and
`ORIGIN_VERIFY`, and loses the Neon wording.

## 3. Caddy

`infra/caddy/Caddyfile`:

- Serves `www.ktmpost.com` and `ktmpost.com` with
  `tls /certs/origin.pem /certs/origin.key` (Cloudflare Origin CA, 15-year,
  trusted by Cloudflare only). Port 80 redirects to HTTPS.
- Returns 403 unless the request carries `X-Origin-Verify: {$ORIGIN_VERIFY}`.
  Cloudflare adds that header (section 4); anyone reaching the instance IP
  directly gets 403. The value lives in `.env`.
- `reverse_proxy web:3000`. Caddy sets `X-Forwarded-Proto` and `Host`
  for Next.js and better-auth.
- A second site block, `http://localhost`, proxies without TLS or the
  origin-verify check, for running the full stack on a laptop.

## 4. Cloudflare

Dashboard steps, documented in `DEPLOY.md`; nothing is scripted against
the Cloudflare API.

- DNS: `A www` and `A @` to the static IP, both proxied (orange cloud).
- SSL/TLS: mode **Full (strict)**; create an Origin CA certificate for
  `ktmpost.com, *.ktmpost.com` and install it on the instance.
  "Always Use HTTPS" on.
- Redirect rule: `ktmpost.com/*` → `https://www.ktmpost.com/$1` (301).
- Transform rule (modify request header): set `X-Origin-Verify` to the
  value from `.env`.
- Cache rule, `www.ktmpost.com`, path not starting with `/admin` and not
  `/api`: eligible for cache, Edge TTL and Browser TTL "respect origin".
  Next.js sends `s-maxage=60` / `s-maxage=3600` for cached pages and
  `no-store` for dynamic ones, so this caches exactly what the app allows.
  `/_next/static/*` carries `immutable, max-age=31536000` and is cached a
  year; `/_next/image*` carries `max-age=86400`.
- WAF: Cloudflare managed ruleset on. One rate-limit rule on
  `/api/auth/*`: 10 requests per 10 seconds per IP, block for 1 minute.
- Client-side navigations fetch `?_rsc=<hash>` URLs, and Cloudflare keys
  its cache on the full query string, so page HTML and navigation payloads
  never collide. Cloudflare ignores `Vary`, so `next.config.ts` sets
  `images.formats = ["image/webp"]`: every browser then gets the same
  cached file per image URL. AVIF is dropped.

## 5. Deploy pipeline

`.github/workflows/deploy.yml`:

1. On every push and pull request: `npm ci`, `npm test`, `npx tsc --noEmit`.
   No `next build` on GitHub, because it needs the database.
2. On push to `main` only, after step 1 passes: SSH to the instance
   (secrets `LIGHTSAIL_HOST`, `LIGHTSAIL_SSH_KEY`, `LIGHTSAIL_KNOWN_HOSTS`)
   and run `/opt/ktm-post/scripts/deploy.sh`.

`scripts/deploy.sh` (runs on the instance, idempotent):

```
git fetch origin && git reset --hard origin/main
docker compose build web migrate
docker compose run --rm migrate
docker compose up -d
docker image prune -f
```

The workflow then requests `https://www.ktmpost.com/api/health` through
Cloudflare, so a deploy that broke startup fails the workflow and shows
red on GitHub. Rollback is `git reset --hard <previous sha>` and
re-running the script.

Vercel keeps deploying `main` as before until DNS moves; nothing in this
spec touches Vercel.

## 6. Data migration from Neon

One-time, documented step: `pg_dump` from Neon (plain SQL, `--no-owner
--no-privileges`), copy to the instance, `psql` into the `db` container,
then run `migrate` once. Done before DNS moves, so the new site starts
with current content. Cloudinary images need nothing.

## 7. Backups and alerts

- `scripts/backup-db.sh`: `pg_dump` through the `db` container to
  `/opt/backups/ktmpost-<date>.sql.gz`, keep 14 days. Installed as a
  nightly cron entry (documented).
- Lightsail automatic instance snapshots (daily) as the second copy.
- Lightsail alarms by email: instance status check failed, CPU over 80%
  for 15 minutes.
- Uptime: an external checker (UptimeRobot free tier) on
  `https://www.ktmpost.com/api/health` every 5 minutes, emailing on failure.

## 8. Removed

- `infra/ecs/`, `infra/cloudfront/`, `scripts/deploy-ecs.sh`,
  `scripts/setup-cloudfront.sh`, `lib/__tests__/cloudfront-config.test.ts`.
- `@neondatabase/serverless` from `package.json` (unused).
- The ECS and CloudFront sections of `DEPLOY.md`, replaced by the Lightsail
  and Cloudflare setup, cutover order, backup and alert steps.

## Cutover order

1. Instance set up, stack running, data imported, origin cert installed.
2. Test through Cloudflare before moving DNS: temporarily add
   `test.ktmpost.com` as a proxied A record to the instance and check
   `curl -sI https://test.ktmpost.com/` (200, `cf-cache-status`), then an
   admin login. Remove the record afterwards.
3. Switch `www` and `@` records to the instance IP (proxied). Cloudflare's
   DNS TTL is automatic for proxied records, so the change is immediate.
4. Confirm `curl -sI https://<instance-ip>/ -k` is 403 (origin locked) and
   `https://www.ktmpost.com/` is 200 with `cf-cache-status: HIT` on a
   repeat.
5. Leave Vercel running for a week as a fallback, then remove the domain
   from the Vercel project.

## Verification

- `npm test` includes checks that `next.config.ts` sets
  `images.formats = ["image/webp"]`, that the workflow deploys only on
  `main`, and that the compose file publishes ports only on `caddy`.
- `docker compose config` validates on a clean checkout.
- `bash -n` on both shell scripts; `caddy validate` on the Caddyfile via
  the `caddy:2-alpine` image.
- Local full stack: `docker compose up` (without Caddy's certificate it
  serves HTTP on 80 only, via a `localhost` site block) returns 200 on `/`,
  `/about-us`, `/admin/login` and `/api/health`, with `s-maxage` on the
  first two and `no-store` on the others.

## Cost

Instance about $24/month (4 GB plan, check current Lightsail pricing).
Cloudflare free. GitHub Actions free (public repo). Snapshots a few
dollars. Nothing else.
