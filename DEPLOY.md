# Deploying to ECS Fargate

## What this is

**ECR** is AWS's private Docker registry. The image is pushed there.

**ECS** is AWS's container orchestrator. It keeps N copies of the container
running, replaces unhealthy ones, and rolls out new versions.

**Fargate** is the "no servers" mode of ECS. You do not create or patch EC2
instances; you declare CPU and memory and AWS runs the container for you.
You pay per second for the vCPU and memory reserved.

The pieces fit together like this:

```
  git push
     |
     v
  docker buildx build  ->  ECR (image registry)
     |
     v
  task definition  ..... the spec: image, CPU/memory, env vars, secrets, logs
     |
     v
  ECS service  ......... keeps the desired number of tasks running
     |
     v
  Fargate tasks  ....... the actual running containers
     ^
     |
  ALB  ................. public HTTPS entry point, health checks /api/health
```

A **task definition** is a versioned spec. A **service** points at one and
keeps that many tasks alive. Deploying = register a new task definition
revision, then tell the service to use it. ECS drains the old tasks and
starts new ones.

The database stays on Neon. Nothing about it changes.

## Architecture choice

The stack defaults to **ARM64 (Graviton)**, because:

- your Mac is ARM64, so builds are native instead of emulated
- Fargate ARM64 is roughly 20% cheaper than X86_64

`TARGET_ARCH` controls it and keeps the image and the task definition's
`runtimePlatform` in sync. To use Intel instead:

```bash
TARGET_ARCH=amd64 ./scripts/deploy-ecs.sh
```

Do not mix them. Prisma ships a native engine binary, so an
architecture mismatch fails at startup, not at build.

## One-time setup

These steps create billable resources. Do them once, by hand, so you can
see what is being made.

### 1. Store the secrets

```bash
aws secretsmanager create-secret \
  --name ktm-post/app \
  --region ap-south-1 \
  --secret-string '{
    "DATABASE_URL":"postgresql://...",
    "BETTER_AUTH_SECRET":"...",
    "CLOUDINARY_CLOUD_NAME":"...",
    "CLOUDINARY_API_KEY":"...",
    "CLOUDINARY_API_SECRET":"...",
    "CLOUDINARY_URL":"...",
    "ADMIN_SETUP_TOKEN":"..."
  }'
```

Note the returned ARN. ECS injects these as environment variables at start,
so they never enter the image.

`ADMIN_SETUP_TOKEN` enables the one-time first-admin form at `/admin/login`.
Use a long random value (`openssl rand -hex 32`). After the first admin
exists, set the key to an empty string and redeploy; the endpoint then
answers 404. Do not delete the key from the secret: the task definition
references it, and ECS refuses to start a task whose secret key is missing.
For the same reason, a secret created before this key existed needs it added
(an empty string is fine) before the next deploy.

`NEXT_PUBLIC_SITE_URL` and `BETTER_AUTH_URL` are *not* secrets and are set
as plain env vars in the task definition.

### 2. IAM roles

- `ktmPostEcsExecutionRole` — used by the ECS agent to pull the image, write
  logs and read the secret. Attach the managed policy
  `AmazonECSTaskExecutionRolePolicy`, plus `secretsmanager:GetSecretValue`
  on the secret ARN above, plus `logs:CreateLogGroup`. That last one is not
  in the managed policy, and the task definition sets
  `awslogs-create-group=true`, so without it tasks fail to start.
- `ktmPostEcsTaskRole` — used by the application itself. The app talks only
  to Neon and Cloudinary over the internet, so this can start empty.

### 3. Cluster, ALB and service

Create an ECS cluster named `ktm-post`, an Application Load Balancer with an
HTTPS listener (ACM certificate for `www.ktmpost.com`), and a target group of
type **ip** on port 3000 with health check path `/api/health`.

Then create a service named `ktm-post` on that cluster, launch type Fargate,
attached to the target group. Run tasks in private subnets with a NAT
gateway, or in public subnets with a public IP — they need outbound internet
to reach Neon and Cloudinary.

Finally point the `www.ktmpost.com` DNS record at the ALB.

## CloudFront (do this once the ALB works)

Without a CDN every JS chunk, font, image and cached page is served by the
Fargate task through the ALB, and Nepali readers connect to Mumbai for all
of it. CloudFront caches:

- `/_next/static/*`  for a year (hashed filenames, managed CachingOptimized)
- `/_next/image*`    for a day, keyed on the query string and `Accept`
- everything else    exactly as long as the origin says: ISR pages send
                     `s-maxage=60` (home, news, category and article pages)
                     or `s-maxage=3600` (footer pages); dynamic pages send
                     `no-store` and are never cached
- `/admin`, `/admin/*`, `/api/*`  never cached

The default behaviour keys on the Next.js `RSC`, `Next-Router-Prefetch`,
`Next-Router-State-Tree`, `Next-Router-Segment-Prefetch` and `Next-Url`
headers so client-side navigation payloads and full HTML do not collide in
the cache. Cookies are forwarded to the origin but are not part of the cache
key; no public page reads the session, so this is safe. Keep it that way: a
public page that reads cookies or headers would be cached for one visitor
and served to everyone.

Every behaviour forwards the viewer `Host` header (managed AllViewer origin
request policy). CloudFront checks the ALB's certificate against that
header, so the ALB keeps its `www.ktmpost.com` certificate even though the
origin is addressed by its `*.elb.amazonaws.com` name.

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
3. Wait until the distribution status is `Deployed` (10-15 minutes), then
   test it **before** touching DNS. The distribution's own
   `dxxxx.cloudfront.net` name cannot be used for this (the ALB certificate
   does not cover it), so pin the real hostname to an edge address:

   ```bash
   EDGE_IP=$(dig +short dxxxx.cloudfront.net | head -1)
   curl -sI --resolve www.ktmpost.com:443:$EDGE_IP https://www.ktmpost.com/ | grep -iE "^(HTTP|x-cache|cache-control)"
   curl -sI --resolve www.ktmpost.com:443:$EDGE_IP -H 'RSC: 1' https://www.ktmpost.com/ | grep -iE "^(HTTP|x-cache|content-type)"
   ```

   Expect `200` both times, `x-cache: Hit from cloudfront` on a repeat, and
   `text/x-component` only for the `RSC: 1` request.
4. Change the `www.ktmpost.com` DNS record to the distribution domain and
   wait out the old record's TTL, so no visitor is still resolving the ALB.
5. Only then lock the ALB to CloudFront. On the HTTPS listener, change the
   default action to a fixed 403 response and add a rule: if HTTP header
   `X-Origin-Verify` equals the printed value, forward to the target group.
   Requests that bypass CloudFront then get 403. The target group health
   check goes straight to the task and is not affected. Doing this before
   step 4 has taken effect returns 403 to every visitor still on the ALB.

`SITE_URL`/`NEXT_PUBLIC_SITE_URL` stay `https://www.ktmpost.com`.

### How fresh is a cached page

After a content change the admin server actions call `revalidatePath`,
which refreshes the origin's ISR cache. CloudFront picks the new version up
when its own copy expires (60s for news, 1h for footer pages). Next also
sends `stale-while-revalidate`, which CloudFront honours: the first request
after expiry is answered from the old copy while a fresh one is fetched in
the background. A page nobody has opened for a while can therefore show its
previous version once. To force everything fresh, create an invalidation:

```bash
aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
```

### Database region

The Neon project is in `us-east-2` (Ohio) while the task runs in
`ap-south-1`. Every query crosses roughly 200ms of round trip, and dynamic
pages run several queries in sequence (an uncached article render takes
several seconds). Create the Neon project in `ap-southeast-1` (Singapore)
and keep the pooled connection string. This is the single biggest latency
improvement available and needs no code change.

## Deploying

Before the first deploy of this version:

- Add the `ADMIN_SETUP_TOKEN` key to the existing secret (an empty string is
  fine). The task definition now references it, and the task will not start
  without it.
- Review the accounts. Public sign-up used to be open and gave every new
  account the `editor` role, so anyone who registered that way is still
  staff. In `/admin/users` (or the `user` table) delete accounts you do not
  recognise; deleting a user also removes their sessions.

After the one-time setup, every deploy is:

```bash
export SECRET_ARN=arn:aws:secretsmanager:ap-south-1:<account>:secret:ktm-post/app-XXXXXX
./scripts/deploy-ecs.sh
```

The script creates the ECR repo if missing, logs in, builds for the target
architecture, pushes, registers a new task definition revision, updates the
service, and waits for the rollout to stabilise. The image is tagged with the
short git SHA, so rollback is redeploying an older tag.

## Things to know

- **`NEXT_PUBLIC_SITE_URL` is baked in at build time**, because Next inlines
  `NEXT_PUBLIC_*` into the client bundle. An image built for production
  cannot be reused for staging; build one per environment.
- **`DATABASE_URL` is needed at build time too.** `/` and `/news` are
  statically generated from the database.
- **`DATABASE_URL` is passed as a build arg**, so it can appear in CI build
  logs. It is absent from the final image, but mask it in your CI provider.
  A BuildKit secret mount is the stricter option.
- **There are no Prisma migrations** in this repo, only `schema.prisma`, so
  the deploy does not run one. Schema changes have to be applied to Neon
  separately.
- **Cost**: 0.5 vCPU / 1GB on Fargate ARM64 runs a few dollars a month per
  task; the ALB is the larger fixed cost at roughly $16-20/month. CloudFront
  is free for the first 1 TB/month out and then roughly $0.12/GB from Asian
  edges.
